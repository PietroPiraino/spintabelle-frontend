import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-verify-email',
  imports: [RouterLink],
  templateUrl: './verify-email.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailComponent {
  /** Query param impostato dal redirect del backend: ok | errore */
  readonly esito = input<string>();

  protected readonly success = computed(() => this.esito() === 'ok');
}
