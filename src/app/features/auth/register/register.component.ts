import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sentTo = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
      nickname: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(24),
          Validators.pattern(/^[a-zA-Z0-9_.-]+$/),
        ],
      ],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', [Validators.required]],
      privacy: [false, [Validators.requiredTrue]],
    },
    { validators: passwordsMatch },
  );

  protected submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    const { email, nickname, password } = this.form.getRawValue();
    this.auth.register({ email, nickname, password }).subscribe({
      next: () => this.sentTo.set(email),
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(
          apiErrorMessage(err, 'Registrazione non riuscita. Riprova.'),
        );
      },
    });
  }
}
