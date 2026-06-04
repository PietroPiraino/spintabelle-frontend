import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { apiErrorMessage } from '../../../core/utils/http-error';

@Component({
  selector: 'app-resend-verification',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './resend-verification.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResendVerificationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sent = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    this.auth.resendVerification(this.form.getRawValue().email).subscribe({
      next: () => this.sent.set(true),
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err, 'Invio non riuscito. Riprova.'));
      },
    });
  }
}
