import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { apiErrorMessage } from '../../../core/utils/http-error';

/**
 * Ripulisce la destinazione post-login.
 *
 * ⚠️ `redirect` arriva dalla query string, cioè da un link che chiunque può
 * confezionare e mandare a un iscritto: portarlo dritto in `navigateByUrl` è un
 * **open redirect** — si atterra su un dominio altrui subito dopo aver messo la
 * password su una pagina nostra, che è il modo più economico per farsi credere.
 * Si accetta SOLO un percorso interno: **una** barra iniziale, e in ogni altro
 * caso si torna in home.
 *
 * I casi che sembrano percorsi e non lo sono:
 * - `//host` e `/\host`: URL protocol-relative — il secondo i browser lo
 *   normalizzano nel primo, quindi vanno rifiutati entrambi;
 * - `https://host`, `javascript:…`: schemi assoluti, non iniziano con `/`;
 * - un percorso con caratteri di controllo (tab, a capo): i browser li tolgono
 *   dall'URL, e ciò che resta può essere di nuovo `//host`.
 */
export function safeRedirect(raw: string | null | undefined): string {
  const target = (raw ?? '').trim();
  if (!target.startsWith('/')) return '/';
  if (/^\/[/\\]/.test(target)) return '/';
  if (target.includes('\\')) return '/';
  if (/[\u0000-\u001f\u007f]/.test(target)) return '/';
  return target;
}

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Destinazione post-login (query param impostato dall'authGuard) */
  readonly redirect = input<string>();

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showResend = signal(false);

  // L'accesso accetta email O nome utente nello stesso campo: niente validatore
  // email (un nickname valido non lo passerebbe), solo lunghezza minima.
  protected readonly form = this.fb.nonNullable.group({
    identifier: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.showResend.set(false);

    const { identifier, password } = this.form.getRawValue();
    this.auth.login(identifier, password).subscribe({
      // ⚠️ mai `this.redirect()` grezzo: vedi `safeRedirect`
      next: () => void this.router.navigateByUrl(safeRedirect(this.redirect())),
      error: (err: unknown) => {
        this.loading.set(false);
        const message = apiErrorMessage(err, 'Accesso non riuscito. Riprova.');
        this.error.set(message);
        // Account non verificato → offri il reinvio del link
        this.showResend.set(message.toLowerCase().includes('non verificata'));
      },
    });
  }
}
