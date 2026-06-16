import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminUser, Paginated, Role } from '../../../core/models/api.models';
import { AdminUsersService } from '../../../core/services/admin-users.service';
import { AuthService } from '../../../core/services/auth.service';
import { PointsService } from '../../../core/services/points.service';
import { apiErrorMessage } from '../../../core/utils/http-error';

const ROLE_LABELS: Record<Role, string> = {
  USER: 'Iscritto',
  PESCE_ROSSO: 'Pesce Rosso',
  SQUALO: 'Squalo',
  ADMIN: 'Admin',
};

@Component({
  selector: 'app-admin-users',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './admin-users.component.html',
  styleUrl: '../admin-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersComponent {
  private readonly usersApi = inject(AdminUsersService);
  private readonly pointsApi = inject(PointsService);
  private readonly auth = inject(AuthService);

  // ── Rettifica punti per utente ──
  protected readonly adjustingId = signal<string | null>(null);
  protected readonly adjusting = signal(false);
  protected readonly deltaControl = new FormControl<number | null>(null);
  protected readonly reasonControl = new FormControl('', { nonNullable: true });

  protected readonly page = signal<Paginated<AdminUser> | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);

  /** Ruolo scelto nella select ma NON ancora salvato, per utente (chiave = id). */
  protected readonly pendingRoles = signal<Record<string, Role>>({});
  /** Id dell'utente per cui il salvataggio del ruolo è in corso. */
  protected readonly savingRoleId = signal<string | null>(null);

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly query = signal('');
  private readonly currentPage = signal(1);

  protected readonly roles: Role[] = ['USER', 'PESCE_ROSSO', 'SQUALO', 'ADMIN'];
  protected readonly roleLabels = ROLE_LABELS;

  /** Id dell'admin loggato: non può agire sul proprio account. */
  protected readonly selfId = computed(() => this.auth.user()?.id ?? null);

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        this.query.set(q.trim());
        this.currentPage.set(1);
        this.load();
      });
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.pendingRoles.set({});
    this.usersApi
      .list({ q: this.query() || undefined, page: this.currentPage() })
      .subscribe({
        next: (page) => {
          this.page.set(page);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.error.set(apiErrorMessage(err, 'Caricamento iscritti non riuscito.'));
        },
      });
  }

  protected goToPage(n: number): void {
    const total = this.page()?.totalPages ?? 1;
    if (n < 1 || n > total || n === this.currentPage()) return;
    this.currentPage.set(n);
    this.load();
  }

  protected isSelf(user: AdminUser): boolean {
    return user.id === this.selfId();
  }

  /** Ruolo mostrato nella select: quello in sospeso se modificato, altrimenti il salvato. */
  protected pendingRole(user: AdminUser): Role {
    return this.pendingRoles()[user.id] ?? user.role;
  }

  /** True se la select mostra un ruolo diverso da quello salvato (serve "Salva"). */
  protected isRoleDirty(user: AdminUser): boolean {
    return this.pendingRole(user) !== user.role;
  }

  /** Registra la scelta nella select SENZA salvarla: la conferma è esplicita. */
  protected onRoleSelect(user: AdminUser, event: Event): void {
    const role = (event.target as HTMLSelectElement).value as Role;
    this.pendingRoles.update((map) => {
      const next = { ...map };
      if (role === user.role) delete next[user.id];
      else next[user.id] = role;
      return next;
    });
  }

  /** Scarta la modifica non salvata, riportando la select al ruolo reale. */
  protected cancelRole(user: AdminUser): void {
    this.pendingRoles.update((map) => {
      const next = { ...map };
      delete next[user.id];
      return next;
    });
  }

  /** Conferma e salva il nuovo ruolo dell'utente. */
  protected saveRole(user: AdminUser): void {
    if (this.isSelf(user)) return;
    const role = this.pendingRole(user);
    if (role === user.role) return;
    this.savingRoleId.set(user.id);
    this.error.set(null);
    this.feedback.set(null);
    this.usersApi.updateRole(user.id, role).subscribe({
      next: (updated) => {
        this.savingRoleId.set(null);
        this.cancelRole(user); // pending ora coincide col salvato
        this.patchUser(updated);
        this.feedback.set(
          `Ruolo di ${user.email} aggiornato a ${ROLE_LABELS[role]}.`,
        );
      },
      error: (err: unknown) => {
        this.savingRoleId.set(null);
        this.error.set(apiErrorMessage(err, 'Cambio ruolo non riuscito.'));
      },
    });
  }

  protected remove(user: AdminUser): void {
    if (
      !confirm(
        `Eliminare definitivamente l'account ${user.email}? L'operazione è irreversibile.`,
      )
    ) {
      return;
    }
    this.error.set(null);
    this.feedback.set(null);
    this.usersApi.remove(user.id).subscribe({
      next: () => {
        this.feedback.set(`Account ${user.email} eliminato.`);
        this.load();
      },
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, 'Eliminazione non riuscita.')),
    });
  }

  protected resend(user: AdminUser): void {
    this.error.set(null);
    this.feedback.set(null);
    this.usersApi.resendVerification(user.id).subscribe({
      next: () => this.feedback.set(`Email di verifica reinviata a ${user.email}.`),
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, 'Reinvio non riuscito.')),
    });
  }

  /** Apre il pannello di rettifica punti per un utente. */
  protected openAdjust(user: AdminUser): void {
    this.adjustingId.set(user.id);
    this.deltaControl.reset(null);
    this.reasonControl.reset('');
    this.feedback.set(null);
    this.error.set(null);
  }

  protected cancelAdjust(): void {
    this.adjustingId.set(null);
  }

  /** Applica un accredito/storno punti all'utente. */
  protected applyAdjust(user: AdminUser): void {
    const delta = this.deltaControl.value;
    const reason = this.reasonControl.value.trim();
    if (!delta || !reason || this.adjusting()) return;
    this.adjusting.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.pointsApi.adjust(user.id, delta, reason).subscribe({
      next: (res) => {
        this.adjusting.set(false);
        this.adjustingId.set(null);
        this.patchUser({ ...user, points: res.balance });
        this.feedback.set(
          `Saldo di ${user.email} aggiornato a ${res.balance} punti.`,
        );
      },
      error: (err: unknown) => {
        this.adjusting.set(false);
        this.error.set(apiErrorMessage(err, 'Rettifica punti non riuscita.'));
      },
    });
  }

  /** Aggiorna in place l'utente nella pagina corrente (evita un reload). */
  private patchUser(updated: AdminUser): void {
    this.page.update((p) =>
      p
        ? {
            ...p,
            items: p.items.map((u) => (u.id === updated.id ? updated : u)),
          }
        : p,
    );
  }
}
