import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { frecceTablist } from '../../a11y/radiogroup';

/** Una scheda: il valore che scrive, l'etichetta che si legge, un conteggio. */
export interface VoceScheda<T extends string> {
  readonly valore: T;
  readonly etichetta: string;
  /** Mostrato accanto all'etichetta. `null`/assente = niente pillola. */
  readonly conteggio?: number | null;
}

let seq = 0;

/**
 * Schede vere: cambiano il GENERE di cosa che si vede, non l'elenco.
 *
 * ⚠️ È il gemello di `app-filtro`, e i due NON si fondono. La domanda che li
 * separa: *ricaricando la pagina con questa scelta, cambia il genere di cosa
 * che vedo (scheda) o l'elenco di cose dello stesso genere (filtro)?* Una
 * scheda promette un PANNELLO raggiungibile — `aria-controls` verso un
 * `role="tabpanel"` in cui si può saltare da tastiera; un filtro promette una
 * scelta esclusiva e non ha alcun pannello, perché il risultato è la stessa
 * lista di prima con dentro altre righe. Fonderli significa promettere un
 * pannello che non esiste, che è il difetto che questo primitivo sostituisce.
 *
 * ⚠️ Si chiama `schede` e non `tabs` perché in questo pannello «tab» significa
 * già SEZIONE (`admin-tab-compat.guard.ts`, i `?tab=` storici, `ADMIN_NAV`).
 * È lo stesso ragionamento scritto in testa a `admin-table.scss`.
 *
 * I bottoni riusano `badge badge--tag`: ereditano i 44px di
 * `button.badge--tag` e lo stato attivo distinto dall'hover. Zero pixel nuovi,
 * e le sotto-sezioni che esistevano prima non cambiano aspetto.
 *
 * Uso:
 * ```html
 * <app-schede #sch etichetta="Sotto-sezioni" [voci]="VISTE" [scelto]="vista()"
 *             (scegli)="setVista($event)" />
 * <div role="tabpanel" tabindex="0" [id]="sch.idPannello()"
 *      [attr.aria-labelledby]="sch.idSchedaAttiva()"> … </div>
 * ```
 */
@Component({
  selector: 'app-schede',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div
    class="schede"
    role="tablist"
    [class.schede--primarie]="primarie()"
    [attr.aria-label]="etichetta()"
    (keydown)="onTasto($event)"
  >
    @for (v of voci(); track v.valore) {
      <button
        type="button"
        role="tab"
        class="badge badge--tag"
        [id]="idScheda(v.valore)"
        [class.is-active]="scelto() === v.valore"
        [attr.aria-selected]="scelto() === v.valore"
        [attr.tabindex]="scelto() === v.valore ? 0 : -1"
        [attr.aria-controls]="scelto() === v.valore ? idPannello() : null"
        (click)="scegli.emit(v.valore)"
      >
        {{ v.etichetta }}
        @if (v.conteggio) {
          <!--
            ⚠️ Il numero da solo si legge «Rakeback 7»: uno screen reader non
            ha modo di sapere che 7 è un CONTEGGIO e non parte del nome. La
            parola sta in un visually-hidden, che è la utility del progetto
            (sr-only ne è l'alias).
          -->
          <span class="visually-hidden">, </span>
          <span class="schede__n">{{ v.conteggio }}</span>
          <span class="visually-hidden">elementi</span>
        }
      </button>
    }
  </div>`,
  styles: `
    .schede {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1.4rem;
    }

    /*
     * ⚠️ La variante \`[primarie]\` cambia SOLO la resa del TESTO. Padding,
     * \`min-height: 44px\` e la ricetta di \`.is-active\` restano quelli di
     * \`button.badge--tag\`: la scatola non cambia di un pixel, e i 44px sono
     * uno dei nove punti sorvegliati da \`scripts/lib/bersagli-tocco.test.mjs\`.
     *
     * Perché serve: a riposo una scheda eredita la livrea di \`.badge--tag\` —
     * mono 0,68rem (10,88px), MAIUSCOLO, \`letter-spacing: .14em\`,
     * \`--text-muted\`. È esattamente il vestito di \`.admin-stato\`, cioè
     * dell'etichetta di SOLA LETTURA più piccola della schermata, mentre queste
     * sono l'unico comando che cambia il genere di cosa che si vede. Nelle
     * sezioni a schede la navigazione principale finiva così al rango
     * tipografico più basso della pagina, col 60% del controllo vuoto.
     *
     * ⚠️ Perché è una VARIANTE e non il default: \`admin-news\` usa le schede
     * come micro-interruttore Scrivi/Anteprima DENTRO la modale dell'articolo,
     * appoggiato a un \`<label>\` in \`align-items: baseline\` — lì ingrandire
     * stringe una modale già fitta. È il precedente di \`[compatta]\` su
     * \`app-multi-select\`.
     */
    .schede--primarie button {
      font-family: var(--font-body);
      font-size: 0.85rem;
      letter-spacing: 0;
      text-transform: none;
      color: var(--text);
    }

    .schede__n {
      margin-left: 0.35rem;
      font-variant-numeric: tabular-nums;
      opacity: 0.75;
    }
  `,
})
export class SchedeComponent<T extends string> {
  readonly etichetta = input.required<string>();
  readonly voci = input.required<readonly VoceScheda<T>[]>();
  readonly scelto = input.required<T>();
  readonly scegli = output<T>();

  /**
   * Schede come NAVIGAZIONE DI SEZIONE invece che come micro-interruttore.
   *
   * ⚠️ Sta QUI e non nel foglio del chiamante perché una regola del genitore su
   * `.badge--tag` sarebbe INERTE: i bottoni nascono in questo template e
   * portano il suo attributo di scope, mentre l'incapsulamento riscrive il
   * selettore del genitore aggiungendogli il PROPRIO attributo. Dal foglio del
   * chiamante è raggiungibile solo l'host `<app-schede>`. È la stessa ragione
   * scritta su `[compatta]` in `multi-select.component.ts`.
   *
   * ⚠️ Cambia SOLO la tipografia, e non il margine sotto: `admin-affiliations`
   * e `admin-shop` hanno `<app-schede>` come elemento RADICE del template,
   * senza alcun contenitore, quindi il `margin-bottom: 1.4rem` del primitivo è
   * l'unica cosa che le stacca dal pannello. Azzerarlo qui le romperebbe
   * entrambe. Lo stacco sotto le schede resta perciò più largo del ritmo
   * generale della sezione — che su un confine di navigazione è giusto così, ed
   * è quello che `admin-participation` mostra da sempre.
   *
   * ⚠️⚠️ Si passa **`[primarie]="true"`**, MAI l'attributo nudo `primarie`: un
   * attributo statico lega l'input alla stringa `''`, che è falsa, quindi
   * `[class.schede--primarie]` non si applica e la variante è **inerte**. Non
   * c'è alcun `booleanAttribute` a raccoglierla — nel progetto quella
   * trasformazione non è usata da nessuna parte, e il precedente è
   * `[compatta]="true"` in `drill-config.component.html`. Le prime tre sezioni
   * convertite erano scritte così e non cambiavano di un pixel: build verde,
   * Karma verde, nessun errore.
   */
  readonly primarie = input(false);

  private readonly base = `sch-${(seq += 1)}`;

  idScheda(v: T): string {
    return `${this.base}-t-${v}`;
  }

  readonly idSchedaAttiva = computed(() => this.idScheda(this.scelto()));

  /**
   * L'id che il chiamante deve mettere sul proprio `role="tabpanel"`.
   *
   * ⚠️ `aria-controls` è dichiarato SOLO sulla scheda selezionata, ed è la
   * scelta che tiene insieme le schede e il caricamento pigro: i pannelli
   * vivono dentro un `@if` del chiamante, quindi di id ne esiste uno per
   * volta. Metterlo su tutte punterebbe a id inesistenti — che è peggio che
   * ometterlo, perché uno screen reader annuncia un pannello e poi non lo
   * trova.
   */
  readonly idPannello = computed(() => `${this.base}-p-${this.scelto()}`);

  protected onTasto(e: KeyboardEvent): void {
    const v = this.voci();
    frecceTablist(
      e,
      v.length,
      v.findIndex((x) => x.valore === this.scelto()),
      (j) => this.scegli.emit(v[j].valore),
    );
  }
}
