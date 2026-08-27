import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import type { IconName } from '../../../shared/ui/icon/icon.component';

/**
 * Una carta da gioco.
 *
 * ⚠️ **Il seme è un `app-icon`, MAI il carattere Unicode.** Su iOS `♥` (U+2665)
 * e `♦` (U+2666) prendono la presentazione **emoji**: si portano dentro i propri
 * colori e **ignorano `color:`** — cioè il difetto è invisibile esattamente
 * sulla piattaforma da cui non si sviluppa. È la stessa lezione già scritta per
 * i divisori del sito, e il selettore U+FE0E non basta: corregge il colore, non
 * la forma, che resterebbe quella del font di sistema.
 *
 * ⚠️ **Quattro colori, non due.** Picche nere, cuori rossi, quadri **blu**,
 * fiori **verdi**: in una mano che si scorre a colpi di freccia distinguere
 * cuori da quadri a colpo d'occhio è la differenza fra leggere un progetto di
 * colore e ricontarlo ogni volta. È anche la convenzione dei solutori, che è il
 * contesto in cui questi utenti studiano.
 */
@Component({
  selector: 'app-playing-card',
  imports: [IconComponent],
  template: `
    @if (coperta()) {
      <span class="pc pc--coperta" aria-hidden="true"></span>
    } @else {
      <!--
        ATTENZIONE: role="img" è obbligatorio, non decorativo. Uno span nudo
        mappa sul ruolo "generic", e sui ruoli generici la specifica ARIA VIETA
        aria-label: i lettori di schermo lo scartano. Risultato: la carta
        esisteva solo come rango più un glifo, e il seme spariva del tutto.
      -->
      <span
        class="pc"
        role="img"
        [attr.data-seme]="seme()"
        [attr.aria-label]="etichetta()"
      >
        <span class="pc__rango">{{ rango() }}</span>
        <app-icon class="pc__seme" [name]="icona()" />
      </span>
    }
  `,
  styleUrl: './playing-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayingCardComponent {
  /** Notazione `As`, `Th`, `7c`. Vuoto o assente = carta coperta. */
  readonly carta = input<string | null>(null);

  protected readonly coperta = computed(() => {
    const c = this.carta();
    return !c || c.length !== 2;
  });

  protected readonly rango = computed(() => {
    const r = this.carta()?.[0] ?? '';
    // ⚠️ `T` si stampa `10`: è il rango, e nessun giocatore lo chiama «ti».
    return r === 'T' ? '10' : r;
  });

  protected readonly seme = computed(() => this.carta()?.[1] ?? '');

  protected readonly icona = computed<IconName>(() => {
    switch (this.seme()) {
      case 'h':
        return 'heart';
      case 'd':
        return 'diamond';
      case 'c':
        return 'club';
      default:
        return 'spade';
    }
  });

  /** Per chi legge con lo screen reader: «Asso di picche», non «As». */
  protected readonly etichetta = computed(() => {
    const r = this.rango();
    const nomi: Record<string, string> = {
      A: 'Asso',
      K: 'Re',
      Q: 'Donna',
      J: 'Fante',
    };
    const semi: Record<string, string> = {
      s: 'picche',
      h: 'cuori',
      d: 'quadri',
      c: 'fiori',
    };
    return `${nomi[r] ?? r} di ${semi[this.seme()] ?? ''}`.trim();
  });
}
