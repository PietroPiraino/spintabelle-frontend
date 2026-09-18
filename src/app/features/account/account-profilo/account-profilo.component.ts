import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
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
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ConsensoRegistrazione, Percorso } from '../../../core/models/api.models';
import { AuthService } from '../../../core/services/auth.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { Carico } from '../account.types';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const p = group.get('newPassword')?.value as string;
  const c = group.get('confirm')?.value as string;
  return p && c && p !== c ? { passwordsMismatch: true } : null;
}

/** Il nome del file dell'export: lo stesso nel messaggio di esito. */
const NOME_FILE_EXPORT = 'best-fish-forever-i-miei-dati.json';

/**
 * Profilo e sicurezza: dati di profilo · notifiche · password · i tuoi dati ·
 * elimina account.
 *
 * ⚠️ Tutto ciò che succede DOPO un gesto era il buco della vecchia pagina:
 * ogni azione disabilitava il controllo sotto il fuoco e scriveva l'esito in
 * un `role=status` creato insieme al testo (che spesso non viene letto).
 * Qui ogni blocco ha una regione live PERSISTENTE (`.blocco__live`, esiste
 * nel DOM prima dell'azione), i bottoni usano `aria-disabled` + la guardia di
 * rientro (il fuoco non cade su `body`), e le conferme ricevono il fuoco.
 */
@Component({
  selector: 'app-account-profilo',
  imports: [ReactiveFormsModule, DatePipe, RouterLink],
  templateUrl: './account-profilo.component.html',
  styleUrls: ['../account-shared.scss', './account-profilo.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountProfiloComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** Per i consensi alla registrazione (blocco «I tuoi dati»). */
  readonly percorso = input.required<Carico<Percorso>>();
  readonly haConteggi = input(false);
  readonly riprovaPercorso = output<void>();

  protected readonly user = this.auth.user;
  protected readonly verified = computed(() => this.user()?.verified ?? false);

  /** Chi ha conteggi o è in staking legge che quelle righe si anonimizzano. */
  protected readonly anonimizzaNonCancella = computed(
    () => this.haConteggi() || this.user()?.role === 'STAKATO',
  );

  // ── Dati di profilo ───────────────────────────────────────────────────────

  protected readonly profileForm = this.fb.nonNullable.group({
    email: [
      '',
      // ⚠️ `maxLength(128)` col testo in italiano: senza, il 400 del DTO
      // arrivava con la frase inglese di class-validator.
      [Validators.required, Validators.email, Validators.maxLength(128)],
    ],
    nickname: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(24),
        Validators.pattern(/^[a-zA-Z0-9_.-]+$/),
      ],
    ],
    /**
     * Il nome da mostrare nella sala live (voce di registro A10).
     *
     * ⚠️ Facoltativo, e la regola NON è quella del nickname: qui servono
     * spazi, accenti e apostrofi — «Mario Rossi», «Niccolò», «D'Amico».
     * Specchio della regex del DTO, che è una lista di ciò che si ammette
     * (e quindi esclude a-capo, invisibili ed emoji per costruzione).
     * ⚠️ `^$|` in testa: la stringa vuota è valida ed è la cancellazione.
     */
    nomeSala: [
      '',
      [
        Validators.maxLength(32),
        Validators.pattern(/^$|^[\p{L}\p{N}][\p{L}\p{N} '’._-]{1,31}$/u),
      ],
    ],
  });
  protected readonly profileSaving = signal(false);
  protected readonly profileError = signal<string | null>(null);
  protected readonly profileMsg = signal<string | null>(null);
  /**
   * La conferma in linea quando l'email digitata è DIVERSA da quella del
   * profilo: cambiarla rende l'account non verificato e blocca il prossimo
   * accesso finché il nuovo indirizzo non è confermato — prima lo si scopriva
   * dopo aver salvato, e chi digitava male l'indirizzo restava fuori.
   */
  protected readonly confermaEmail = signal<string | null>(null);

  constructor() {
    const u = this.auth.user();
    this.profileForm.patchValue({
      email: u?.email ?? '',
      nickname: u?.nickname ?? '',
      nomeSala: u?.nomeSala ?? '',
    });
    this.notifyNewLessons.set(u?.notifyNewLessons ?? true);
  }

  protected emailCambiata(): boolean {
    const attuale = (this.user()?.email ?? '').toLowerCase();
    const nuova = this.profileForm.controls.email.value.trim().toLowerCase();
    return nuova !== attuale;
  }

  protected saveProfile(): void {
    if (this.profileSaving()) return;
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.focusFirstInvalid('form-profilo');
      return;
    }
    if (this.emailCambiata() && !this.confermaEmail()) {
      this.confermaEmail.set(this.profileForm.controls.email.value.trim());
      this.focusElement('conferma-email');
      return;
    }
    this.inviaProfilo();
  }

  protected annullaCambioEmail(): void {
    this.confermaEmail.set(null);
    this.profileForm.controls.email.setValue(this.user()?.email ?? '');
    this.focusElement('email');
  }

  private inviaProfilo(): void {
    const cambiavaEmail = this.emailCambiata();
    this.profileSaving.set(true);
    this.profileError.set(null);
    this.profileMsg.set(null);
    this.confermaEmail.set(null);

    const { email, nickname, nomeSala } = this.profileForm.getRawValue();
    this.auth.updateProfile({ email, nickname, nomeSala }).subscribe({
      next: (user) => {
        this.profileSaving.set(false);
        // Il form si riallinea al valore NORMALIZZATO (il server salva
        // minuscolo/trim), o la testata e il campo direbbero due grafie.
        this.profileForm.patchValue({
          email: user.email,
          nickname: user.nickname ?? '',
          nomeSala: user.nomeSala ?? '',
        });
        // ⚠️ Il messaggio si sceglie confrontando le email, non su
        // `verified`: un non verificato che cambia solo il nickname leggeva
        // «hai cambiato email» e andava a cercare una mail che non esiste.
        this.profileMsg.set(
          cambiavaEmail
            ? 'Profilo aggiornato. Hai cambiato email: controlla la posta per confermare il nuovo indirizzo, servirà al prossimo accesso.'
            : 'Profilo aggiornato.',
        );
      },
      error: (err: unknown) => {
        this.profileSaving.set(false);
        this.profileError.set(apiErrorMessage(err, 'Aggiornamento non riuscito.'));
      },
    });
  }

  // ── Notifiche ─────────────────────────────────────────────────────────────

  protected readonly notifyNewLessons = signal(true);
  protected readonly notifySaving = signal(false);
  protected readonly notifyError = signal<string | null>(null);
  protected readonly notifyMsg = signal<string | null>(null);

  /** Salva subito, ottimistico; su errore la casella torna com'era. */
  protected setNotifyNewLessons(enabled: boolean): void {
    if (this.notifySaving()) return;
    const previous = this.notifyNewLessons();
    this.notifyNewLessons.set(enabled);
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
        this.notifyNewLessons.set(previous);
        this.notifyError.set(apiErrorMessage(err, 'Salvataggio non riuscito.'));
      },
    });
  }

  // ── Password ──────────────────────────────────────────────────────────────

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

  protected changePassword(): void {
    if (this.pwSaving()) return;
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.focusFirstInvalid('form-password');
      return;
    }
    this.pwSaving.set(true);
    this.pwError.set(null);

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        // Il cambio password revoca tutte le sessioni. ⚠️ La navigazione sta
        // nel `finalize` del logout, cioè DOPO `clearSession()` e in ENTRAMBI
        // i versi: `/login` ha `guestGuard`, e navigando prima rimbalzerebbe in
        // home chi risulta ancora autenticato. Prima, la pagina restava in
        // piedi coi dati di un utente disconnesso e la card dell'accesso
        // diceva «Nessun abbonamento» a chi l'aveva pagato.
        this.auth
          .logout()
          .pipe(
            finalize(() => {
              this.toast.success('Password aggiornata: accedi con la nuova password.');
              void this.router.navigateByUrl('/login?redirect=/account');
            }),
          )
          .subscribe({ error: () => undefined });
      },
      error: (err: unknown) => {
        // Il 403 del server («Password attuale errata») arriva QUI: fino al
        // 14/09/2026 era un 401 e l'interceptor buttava fuori l'utente.
        this.pwSaving.set(false);
        this.pwError.set(apiErrorMessage(err, 'Cambio password non riuscito.'));
      },
    });
  }

  // ── I tuoi dati ───────────────────────────────────────────────────────────

  protected readonly exporting = signal(false);
  protected readonly exportError = signal<string | null>(null);
  protected readonly exportMsg = signal<string | null>(null);

  protected readonly consensi = computed<ConsensoRegistrazione[] | null>(() => {
    const p = this.percorso();
    return p.stato === 'ok' ? (p.dati.live?.consensi ?? []) : null;
  });

  protected exportData(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.exportError.set(null);
    this.exportMsg.set(null);

    this.auth.exportMyData().subscribe({
      next: (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = NOME_FILE_EXPORT;
        a.click();
        // ⚠️ La revoca nello stesso tick può abortire un salvataggio avviato
        // in modo asincrono: un secondo dopo.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.exporting.set(false);
        this.exportMsg.set(
          `Scaricato ${NOME_FILE_EXPORT}: lo trovi nella cartella dei download.`,
        );
      },
      error: (err: unknown) => {
        this.exporting.set(false);
        this.exportError.set(apiErrorMessage(err, 'Export non riuscito.'));
      },
    });
  }

  // ── Elimina account ───────────────────────────────────────────────────────

  protected readonly confirmingDelete = signal(false);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  /** Apre la conferma e ci porta il FUOCO: la domanda va letta, non solo vista. */
  protected apriConferma(): void {
    this.deleteError.set(null);
    this.confirmingDelete.set(true);
    this.focusElement('account-conferma-elimina');
  }

  protected chiudiConferma(): void {
    if (this.deleting()) return;
    this.confirmingDelete.set(false);
    this.focusElement('account-elimina-apri');
  }

  protected confirmDelete(): void {
    if (this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set(null);

    this.auth.deleteAccount().subscribe({
      next: () => void this.router.navigateByUrl('/'),
      error: (err: unknown) => {
        this.deleting.set(false);
        // ⚠️ Due esiti diversi: con status 0 il server non è stato raggiunto e
        // i token sono INTATTI (la sessione resta: si riprova); con un 5xx la
        // cancellazione può essere partita a metà, e l'unica cosa onesta è
        // dirlo e rimandare all'accesso.
        if (err instanceof HttpErrorResponse && err.status >= 500) {
          this.deleteError.set(
            'Cancellazione non completata: accedi di nuovo e, se il tuo account risulta ancora attivo, scrivici.',
          );
          this.confirmingDelete.set(false);
          return;
        }
        this.deleteError.set(apiErrorMessage(err, 'Cancellazione non riuscita.'));
      },
    });
  }

  // ── Fuoco ─────────────────────────────────────────────────────────────────

  /** In zoneless il DOM non esiste subito dopo il cambio di stato: un giro. */
  private focusElement(elementId: string): void {
    setTimeout(() => document.getElementById(elementId)?.focus(), 0);
  }

  /**
   * `markAllAsTouched()` non basta su un invio non valido: chi usa la
   * tastiera resterebbe in fondo a un form i cui errori sono tutti sopra.
   */
  private focusFirstInvalid(formId: string): void {
    setTimeout(() => {
      const root = document.getElementById(formId);
      root?.querySelector<HTMLElement>('input.ng-invalid')?.focus();
    }, 0);
  }
}
