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
  // ⚠️ Da bumpare a ogni modifica del testo (vedi PrivacyComponent).
  protected readonly aggiornata = '29 luglio 2026';
}
