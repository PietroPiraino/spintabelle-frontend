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
import {
  AdminActionLogEntry,
  AdminUser,
  DiscountCode,
  Paginated,
  Role,
  SubscriptionRequest,
  SubscriptionTier,
} from '../../../core/models/api.models';
import { AdminDiscountsService } from '../../../core/services/admin-discounts.service';
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

type PanelKind =
  | 'points'
  | 'expiry'
  | 'grant'
  | 'profile'
  | 'history'
  | 'discount';

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
  private readonly discountsApi = inject(AdminDiscountsService);
  private readonly auth = inject(AuthService);

  protected readonly page = signal<Paginated<AdminUser> | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);

  // ── Pannello inline aperto (uno solo, per utente) ──
  protected readonly panel = signal<{ id: string; kind: PanelKind } | null>(
    null,
  );
  protected readonly savingPanel = signal(false);

  // ── Rettifica punti ──
  protected readonly deltaControl = new FormControl<number | null>(null);
  protected readonly reasonControl = new FormControl('', { nonNullable: true });

  // ── Scadenza abbonamento ──
  protected readonly expiryDateControl = new FormControl('', {
    nonNullable: true,
  });
  protected readonly notifyControl = new FormControl(false, {
    nonNullable: true,
  });

  // ── Concessione manuale ──
  protected readonly grantTierControl = new FormControl<SubscriptionTier>(
    'PESCE_ROSSO',
    { nonNullable: true },
  );
  protected readonly grantDateControl = new FormControl('', {
    nonNullable: true,
  });
  protected readonly grantNoteControl = new FormControl('', {
    nonNullable: true,
  });

  // ── Modifica profilo ──
  protected readonly emailControl = new FormControl('', { nonNullable: true });
  protected readonly nickControl = new FormControl('', { nonNullable: true });
  protected readonly verifiedControl = new FormControl(false, {
    nonNullable: true,
  });

  // ── Storico (richieste + audit) ──
  protected readonly historyReqs = signal<SubscriptionRequest[] | null>(null);
  protected readonly historyAudit = signal<AdminActionLogEntry[] | null>(null);
  protected readonly historyLoading = signal(false);

  // ── Assegna codice sconto ──
  protected readonly discountCodes = signal<DiscountCode[] | null>(null);
  protected readonly selectedCodeId = new FormControl('', { nonNullable: true });

  // ── Ruolo (modifica in sospeso, conferma esplicita) ──
  protected readonly pendingRoles = signal<Record<string, Role>>({});
  protected readonly savingRoleId = signal<string | null>(null);

  // ── Ricerca + filtri ──
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly query = signal('');
  protected readonly roleFilter = signal<Role | ''>('');
  protected readonly expiringFilter = signal<number | null>(null);
  private readonly currentPage = signal(1);

  protected readonly roles: Role[] = ['USER', 'PESCE_ROSSO', 'SQUALO', 'ADMIN'];
  protected readonly tiers: SubscriptionTier[] = ['PESCE_ROSSO', 'SQUALO'];
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
      .list({
        q: this.query() || undefined,
        role: this.roleFilter() || undefined,
        expiring: this.expiringFilter() ?? undefined,
        page: this.currentPage(),
      })
      .subscribe({
        next: (page) => {
          this.page.set(page);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.error.set(
            apiErrorMessage(err, 'Caricamento iscritti non riuscito.'),
          );
        },
      });
  }

  protected setRoleFilter(value: string): void {
    this.roleFilter.set((value as Role) || '');
    this.currentPage.set(1);
    this.feedback.set(null);
    this.load();
  }

  protected setExpiringFilter(value: string): void {
    this.expiringFilter.set(value ? Number(value) : null);
    this.currentPage.set(1);
    this.feedback.set(null);
    this.load();
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

  // ── Pannelli inline ─────────────────────────────────────────────────────--

  protected isPanel(user: AdminUser, kind: PanelKind): boolean {
    const p = this.panel();
    return !!p && p.id === user.id && p.kind === kind;
  }

  protected openPanel(user: AdminUser, kind: PanelKind): void {
    this.feedback.set(null);
    this.error.set(null);
    switch (kind) {
      case 'points':
        this.deltaControl.reset(null);
        this.reasonControl.reset('');
        break;
      case 'expiry':
        this.expiryDateControl.setValue(
          user.subscriptionExpiresAt
            ? this.toDateInput(new Date(user.subscriptionExpiresAt))
            : '',
        );
        this.notifyControl.setValue(false);
        break;
      case 'grant':
        this.grantTierControl.setValue(
          user.role === 'SQUALO' ? 'SQUALO' : 'PESCE_ROSSO',
        );
        this.grantDateControl.setValue(
          this.toDateInput(this.addDays(new Date(), 30)),
        );
        this.grantNoteControl.reset('');
        break;
      case 'profile':
        this.emailControl.setValue(user.email);
        this.nickControl.setValue(user.nickname ?? '');
        this.verifiedControl.setValue(user.verified);
        break;
      case 'history':
        this.loadHistory(user);
        break;
      case 'discount':
        this.selectedCodeId.reset('');
        this.loadDiscountCodes();
        break;
    }
    this.panel.set({ id: user.id, kind });
  }

  protected closePanel(): void {
    this.panel.set(null);
  }

  /** Aggiorna in place l'utente nella pagina corrente (evita un reload). */
  private patchUser(updated: AdminUser): void {
    this.page.update((p) =>
      p
        ? { ...p, items: p.items.map((u) => (u.id === updated.id ? updated : u)) }
        : p,
    );
  }

  // ── Date helper ─────────────────────────────────────────────────────────--

  private toDateInput(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private addDays(d: Date, days: number): Date {
    const out = new Date(d);
    out.setDate(out.getDate() + days);
    return out;
  }

  /** yyyy-MM-dd → ISO a fine giornata locale ("valido fino a"). */
  private dateInputToIso(value: string): string {
    return new Date(`${value}T23:59:59`).toISOString();
  }

  // ── Ruolo ───────────────────────────────────────────────────────────────--

  protected pendingRole(user: AdminUser): Role {
    return this.pendingRoles()[user.id] ?? user.role;
  }

  protected isRoleDirty(user: AdminUser): boolean {
    return this.pendingRole(user) !== user.role;
  }

  protected onRoleSelect(user: AdminUser, event: Event): void {
    const role = (event.target as HTMLSelectElement).value as Role;
    this.pendingRoles.update((map) => {
      const next = { ...map };
      if (role === user.role) delete next[user.id];
      else next[user.id] = role;
      return next;
    });
  }

  protected cancelRole(user: AdminUser): void {
    this.pendingRoles.update((map) => {
      const next = { ...map };
      delete next[user.id];
      return next;
    });
  }

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
        this.cancelRole(user);
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

  // ── Scadenza abbonamento ────────────────────────────────────────────────--

  protected addToExpiry(user: AdminUser, days: number): void {
    const cur = this.expiryDateControl.value;
    let base: Date;
    if (cur) base = new Date(`${cur}T00:00:00`);
    else if (
      user.subscriptionExpiresAt &&
      new Date(user.subscriptionExpiresAt) > new Date()
    )
      base = new Date(user.subscriptionExpiresAt);
    else base = new Date();
    this.expiryDateControl.setValue(this.toDateInput(this.addDays(base, days)));
  }

  protected saveExpiry(user: AdminUser): void {
    const v = this.expiryDateControl.value;
    if (!v || this.savingPanel()) return;
    this.savingPanel.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.usersApi
      .setSubscriptionExpiry(user.id, this.dateInputToIso(v), this.notifyControl.value)
      .subscribe({
        next: (updated) => {
          this.savingPanel.set(false);
          this.closePanel();
          this.patchUser(updated);
          this.feedback.set(`Scadenza di ${user.email} aggiornata.`);
        },
        error: (err: unknown) => {
          this.savingPanel.set(false);
          this.error.set(
            apiErrorMessage(err, 'Aggiornamento scadenza non riuscito.'),
          );
        },
      });
  }

  protected removeExpiry(user: AdminUser): void {
    if (this.savingPanel()) return;
    if (!confirm(`Rimuovere la scadenza abbonamento di ${user.email}?`)) return;
    this.savingPanel.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.usersApi.setSubscriptionExpiry(user.id, null).subscribe({
      next: (updated) => {
        this.savingPanel.set(false);
        this.closePanel();
        this.patchUser(updated);
        this.feedback.set(`Scadenza di ${user.email} rimossa.`);
      },
      error: (err: unknown) => {
        this.savingPanel.set(false);
        this.error.set(apiErrorMessage(err, 'Rimozione scadenza non riuscita.'));
      },
    });
  }

  // ── Concessione manuale ─────────────────────────────────────────────────--

  protected addToGrant(days: number): void {
    const cur = this.grantDateControl.value;
    const base = cur ? new Date(`${cur}T00:00:00`) : new Date();
    this.grantDateControl.setValue(this.toDateInput(this.addDays(base, days)));
  }

  protected saveGrant(user: AdminUser): void {
    const date = this.grantDateControl.value;
    if (!date || this.savingPanel()) return;
    this.savingPanel.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.usersApi
      .grantSubscription(
        user.id,
        this.grantTierControl.value,
        this.dateInputToIso(date),
        this.grantNoteControl.value.trim() || undefined,
      )
      .subscribe({
        next: (updated) => {
          this.savingPanel.set(false);
          this.closePanel();
          this.patchUser(updated);
          this.feedback.set(
            `Abbonamento ${ROLE_LABELS[updated.role]} concesso a ${user.email}.`,
          );
        },
        error: (err: unknown) => {
          this.savingPanel.set(false);
          this.error.set(apiErrorMessage(err, 'Concessione non riuscita.'));
        },
      });
  }

  // ── Modifica profilo ────────────────────────────────────────────────────--

  protected saveProfile(user: AdminUser): void {
    if (this.savingPanel()) return;
    const patch: { email?: string; nickname?: string; verified?: boolean } = {};
    const email = this.emailControl.value.trim();
    const nick = this.nickControl.value.trim();
    if (email && email !== user.email) patch.email = email;
    if (nick !== (user.nickname ?? '')) patch.nickname = nick;
    if (this.verifiedControl.value !== user.verified)
      patch.verified = this.verifiedControl.value;
    if (Object.keys(patch).length === 0) {
      this.closePanel();
      return;
    }
    this.savingPanel.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.usersApi.updateProfile(user.id, patch).subscribe({
      next: (updated) => {
        this.savingPanel.set(false);
        this.closePanel();
        this.patchUser(updated);
        this.feedback.set(`Dati di ${updated.email} aggiornati.`);
      },
      error: (err: unknown) => {
        this.savingPanel.set(false);
        this.error.set(apiErrorMessage(err, 'Modifica dati non riuscita.'));
      },
    });
  }

  // ── Storico ─────────────────────────────────────────────────────────────--

  private loadHistory(user: AdminUser): void {
    this.historyReqs.set(null);
    this.historyAudit.set(null);
    this.historyLoading.set(true);
    this.usersApi.subscriptionRequests(user.id).subscribe({
      next: (reqs) => this.historyReqs.set(reqs),
      error: () => this.historyReqs.set([]),
    });
    this.usersApi.auditLog(user.id).subscribe({
      next: (log) => {
        this.historyAudit.set(log);
        this.historyLoading.set(false);
      },
      error: () => {
        this.historyAudit.set([]);
        this.historyLoading.set(false);
      },
    });
  }

  protected actionLabel(action: string): string {
    const map: Record<string, string> = {
      'set-expiry': 'Scadenza modificata',
      'grant-subscription': 'Abbonamento concesso',
      'set-role': 'Ruolo modificato',
      'edit-profile': 'Dati modificati',
      'grant-discount-eligibility': 'Codice sconto assegnato',
      'revoke-discount-eligibility': 'Codice sconto revocato',
    };
    return map[action] ?? action;
  }

  // ── Assegna codice sconto ───────────────────────────────────────────────--

  private loadDiscountCodes(): void {
    if (this.discountCodes() !== null) return;
    this.discountsApi
      .list({ audience: 'RESTRICTED', active: true, limit: 100 })
      .subscribe({
        next: (page) => this.discountCodes.set(page.items),
        error: () => this.discountCodes.set([]),
      });
  }

  protected assignDiscount(user: AdminUser): void {
    const codeId = this.selectedCodeId.value;
    if (!codeId || this.savingPanel()) return;
    this.savingPanel.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.discountsApi.addEligibility(codeId, [user.id]).subscribe({
      next: (res) => {
        this.savingPanel.set(false);
        this.closePanel();
        const code = this.discountCodes()?.find((c) => c.id === codeId);
        this.feedback.set(
          res.added > 0
            ? `Codice ${code?.code ?? ''} assegnato a ${user.email}.`
            : `${user.email} era già abilitato a questo codice.`,
        );
      },
      error: (err: unknown) => {
        this.savingPanel.set(false);
        this.error.set(apiErrorMessage(err, 'Assegnazione codice non riuscita.'));
      },
    });
  }

  // ── Azioni esistenti ────────────────────────────────────────────────────--

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
      next: () =>
        this.feedback.set(`Email di verifica reinviata a ${user.email}.`),
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, 'Reinvio non riuscito.')),
    });
  }

  protected applyAdjust(user: AdminUser): void {
    const delta = this.deltaControl.value;
    const reason = this.reasonControl.value.trim();
    if (!delta || !reason || this.savingPanel()) return;
    this.savingPanel.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.pointsApi.adjust(user.id, delta, reason).subscribe({
      next: (res) => {
        this.savingPanel.set(false);
        this.closePanel();
        this.patchUser({ ...user, points: res.balance });
        this.feedback.set(
          `Saldo di ${user.email} aggiornato a ${res.balance} punti.`,
        );
      },
      error: (err: unknown) => {
        this.savingPanel.set(false);
        this.error.set(apiErrorMessage(err, 'Rettifica punti non riuscita.'));
      },
    });
  }
}
