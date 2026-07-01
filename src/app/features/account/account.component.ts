import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MyPoints, MyVoucher, ShopOrder } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { PointsService } from '../../core/services/points.service';
import { ShopService } from '../../core/services/shop.service';
import { apiErrorMessage } from '../../core/utils/http-error';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const p = group.get('newPassword')?.value as string;
  const c = group.get('confirm')?.value as string;
  return p && c && p !== c ? { passwordsMismatch: true } : null;
}

@Component({
  selector: 'app-account',
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly pointsApi = inject(PointsService);
  private readonly shop = inject(ShopService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly verified = computed(() => this.user()?.verified ?? false);

  // ── Punti BFF ──
  protected readonly myPoints = signal<MyPoints | null>(null);
  protected readonly pointsBalance = computed(
    () => this.myPoints()?.balance ?? this.user()?.points ?? 0,
  );

  // ── Negozio: buoni e ordini dell'utente (best-effort) ──
  protected readonly myVouchers = signal<MyVoucher[]>([]);
  protected readonly myOrders = signal<ShopOrder[]>([]);

  // ── Abbonamento (dal ruolo/scadenza già in auth.user) ──
  protected readonly isAdmin = this.auth.isAdmin;
  /** Etichetta del piano se l'utente è abbonato, altrimenti null. */
  protected readonly planLabel = computed(() => {
    const role = this.user()?.role;
    if (role === 'SQUALO') return 'Squalo';
    if (role === 'PESCE_ROSSO') return 'Pesce Rosso';
    return null;
  });
  protected readonly subExpires = computed(
    () => this.user()?.subscriptionExpiresAt ?? null,
  );

  // ── Profilo (email + nickname) ──
  protected readonly profileForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    nickname: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(24),
        Validators.pattern(/^[a-zA-Z0-9_.-]+$/),
      ],
    ],
  });
  protected readonly profileSaving = signal(false);
  protected readonly profileError = signal<string | null>(null);
  protected readonly profileMsg = signal<string | null>(null);

  // ── Preferenze notifiche (opt-out avvisi nuove lezioni) ──
  protected readonly notifyNewLessons = signal(true);
  protected readonly notifySaving = signal(false);
  protected readonly notifyError = signal<string | null>(null);
  protected readonly notifyMsg = signal<string | null>(null);

  // ── Password ──
  protected readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );
  protected readonly pwSaving = signal(false);
  protected readonly pwError = signal<string | null>(null);
  protected readonly pwDone = signal(false);

  // ── Export dei dati ──
  protected readonly exporting = signal(false);
  protected readonly exportError = signal<string | null>(null);

  // ── Cancellazione account ──
  protected readonly confirmingDelete = signal(false);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  constructor() {
    const u = this.auth.user();
    this.profileForm.patchValue({
      email: u?.email ?? '',
      nickname: u?.nickname ?? '',
    });
    this.notifyNewLessons.set(u?.notifyNewLessons ?? true);
    // saldo + storico punti (best-effort: il saldo cade su auth.user se fallisce)
    this.pointsApi.myPoints().subscribe({
      next: (p) => this.myPoints.set(p),
      error: () => undefined,
    });
    // buoni e ordini del Negozio (best-effort: in errore restano liste vuote)
    this.shop.myVouchers().subscribe({
      next: (v) => this.myVouchers.set(v),
      error: () => undefined,
    });
    this.shop.myOrders().subscribe({
      next: (o) => this.myOrders.set(o),
      error: () => undefined,
    });
  }

  /** Etichetta IT dello stato di un buono. */
  protected voucherStatusLabel(status: MyVoucher['status']): string {
    switch (status) {
      case 'available':
        return 'Disponibile';
      case 'reserved':
        return 'In attesa di approvazione';
      case 'redeemed':
        return 'Usato';
      case 'expired':
        return 'Scaduto';
      case 'inactive':
        return 'Disattivato';
      default:
        return 'Non valido';
    }
  }

  /** Valore leggibile di un buono (percentuale o importo in euro). */
  protected voucherValueLabel(v: MyVoucher): string {
    return v.kind === 'PERCENT' ? `${v.value}%` : `€${v.value}`;
  }

  /** Importo di un ordine: euro per gli ordini off-site, altrimenti punti spesi. */
  protected orderAmountLabel(o: ShopOrder): string {
    return o.amountEur != null
      ? `€${o.amountEur.toFixed(2)}`
      : `−${o.pointsSpent} pt`;
  }

  protected saveProfile(): void {
    if (this.profileForm.invalid || this.profileSaving()) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.profileSaving.set(true);
    this.profileError.set(null);
    this.profileMsg.set(null);

    const { email, nickname } = this.profileForm.getRawValue();
    this.auth.updateProfile({ email, nickname }).subscribe({
      next: (user) => {
        this.profileSaving.set(false);
        this.profileMsg.set(
          user.verified
            ? 'Profilo aggiornato.'
            : 'Profilo aggiornato. Hai cambiato email: controlla la posta per verificarla.',
        );
      },
      error: (err: unknown) => {
        this.profileSaving.set(false);
        this.profileError.set(
          apiErrorMessage(err, 'Aggiornamento non riuscito.'),
        );
      },
    });
  }

  /** Attiva/disattiva gli avvisi email sulle nuove lezioni (salva subito). */
  protected setNotifyNewLessons(enabled: boolean): void {
    if (this.notifySaving()) return;
    const previous = this.notifyNewLessons();
    this.notifyNewLessons.set(enabled); // ottimistico
    this.notifySaving.set(true);
    this.notifyError.set(null);
    this.notifyMsg.set(null);
    this.auth.updateProfile({ notifyNewLessons: enabled }).subscribe({
      next: (user) => {
        this.notifySaving.set(false);
        this.notifyNewLessons.set(user.notifyNewLessons ?? enabled);
        this.notifyMsg.set('Preferenza salvata.');
      },
      error: (err: unknown) => {
        this.notifySaving.set(false);
        this.notifyNewLessons.set(previous); // ripristina il valore precedente
        this.notifyError.set(apiErrorMessage(err, 'Salvataggio non riuscito.'));
      },
    });
  }

  protected changePassword(): void {
    if (this.passwordForm.invalid || this.pwSaving()) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.pwSaving.set(true);
    this.pwError.set(null);

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        // il cambio password revoca tutte le sessioni: disconnetti e invita al re-login
        this.auth.logout().subscribe();
        this.pwDone.set(true);
      },
      error: (err: unknown) => {
        this.pwSaving.set(false);
        this.pwError.set(apiErrorMessage(err, 'Cambio password non riuscito.'));
      },
    });
  }

  protected exportData(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.exportError.set(null);

    this.auth.exportMyData().subscribe({
      next: (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'best-fish-forever-i-miei-dati.json';
        a.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: (err: unknown) => {
        this.exporting.set(false);
        this.exportError.set(apiErrorMessage(err, 'Export non riuscito.'));
      },
    });
  }

  protected confirmDelete(): void {
    if (this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set(null);

    this.auth.deleteAccount().subscribe({
      next: () => void this.router.navigateByUrl('/'),
      error: (err: unknown) => {
        this.deleting.set(false);
        this.deleteError.set(apiErrorMessage(err, 'Cancellazione non riuscita.'));
      },
    });
  }
}
