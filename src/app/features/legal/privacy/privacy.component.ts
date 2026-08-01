import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy',
  imports: [RouterLink],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyComponent {
  // ⚠️ Da bumpare a OGNI modifica del testo: un'informativa cambiata senza
  // data nuova è un difetto legale silenzioso (l'utente non può accorgersene).
  protected readonly aggiornata = '1 agosto 2026';
}
