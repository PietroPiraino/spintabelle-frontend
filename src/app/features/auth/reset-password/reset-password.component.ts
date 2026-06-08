import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { apiErrorMessage } from '../../../core/utils/http-error';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value as string;
  const confirm = group.get('confirm')?.value as string;
  return password && confirm && password !== confirm
    ? { passwordsMismatch: true }
    : null;
}

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  /** Token passato dal link via query param (?token=...). */
  readonly token = input<string>();

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal(false);

  protected readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  protected submit(): void {
    const token = this.token();
    if (!token) {
      this.error.set('Link non valido o incompleto.');
      return;
    }
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    this.auth.resetPassword(token, this.form.getRawValue().password).subscribe({
      next: () => this.done.set(true),
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(
          apiErrorMessage(
            err,
            'Reset non riuscito: il link potrebbe essere scaduto. Richiedine uno nuovo.',
          ),
        );
      },
    });
  }
}
