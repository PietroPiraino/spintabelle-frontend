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
import { apiErrorMessage } from '../../../core/utils/http-error';

const ROLE_LABELS: Record<Role, string> = {
  USER: 'Iscritto',
  SUBSCRIBER: 'Abbonato',
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
  private readonly auth = inject(AuthService);

  protected readonly page = signal<Paginated<AdminUser> | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly query = signal('');
  private readonly currentPage = signal(1);

  protected readonly roles: Role[] = ['USER', 'SUBSCRIBER', 'ADMIN'];
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

  protected changeRole(user: AdminUser, event: Event): void {
    const role = (event.target as HTMLSelectElement).value as Role;
    if (role === user.role) return;
    this.error.set(null);
    this.feedback.set(null);
    this.usersApi.updateRole(user.id, role).subscribe({
      next: (updated) => {
        this.patchUser(updated);
        this.feedback.set(
          `Ruolo di ${user.email} aggiornato a ${ROLE_LABELS[role]}.`,
        );
      },
      error: (err: unknown) => {
        this.error.set(apiErrorMessage(err, 'Cambio ruolo non riuscito.'));
        this.load(); // ripristina la select al valore reale
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
