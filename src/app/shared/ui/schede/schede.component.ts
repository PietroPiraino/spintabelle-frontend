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
          <span class="schede__n">{{ v.conteggio }}</span>
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
