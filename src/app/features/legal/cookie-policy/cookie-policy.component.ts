import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cookie-policy',
  imports: [RouterLink],
  templateUrl: './cookie-policy.component.html',
  styleUrl: './cookie-policy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CookiePolicyComponent {
  protected readonly aggiornata = '15 luglio 2026';
}
