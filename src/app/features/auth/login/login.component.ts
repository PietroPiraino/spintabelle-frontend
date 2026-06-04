import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { apiErrorMessage } from '../../../core/utils/http-error';

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

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
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

    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => void this.router.navigateByUrl(this.redirect() ?? '/'),
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
