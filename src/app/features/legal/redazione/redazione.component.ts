import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * `/redazione` — chi scrive, chi risponde.
 *
 * ⚠️ Non e' una pagina di cortesia: e' la sede pubblica della responsabilita'
 * editoriale (nome e cognome reali + un recapito che qualcuno legge davvero).
 * Il recapito e' lo stesso indirizzo che il backend usa come `OWNER_EMAIL` e
 * che l'informativa privacy pubblica come contatto del Titolare: un contatto
 * che rimbalza qui e' peggio di nessuna pagina.
 *
 * ⚠️ Rotta di primo livello, MAI sotto /news: `/news/redazione` collide con la
 * rotta parametrica dell'articolo e finirebbe dentro l'include /news/* della
 * Pages Function.
 */
@Component({
  selector: 'app-redazione',
  imports: [RouterLink],
  templateUrl: './redazione.component.html',
  styleUrl: './redazione.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RedazioneComponent {
  // ⚠️ Da bumpare a ogni modifica del testo (idioma di PrivacyComponent).
  protected readonly aggiornata = '19 agosto 2026';
}
