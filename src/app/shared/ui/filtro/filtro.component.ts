import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { frecceRadiogroup } from '../../a11y/radiogroup';

/** Una voce del filtro: il valore che scrive, l'etichetta, un conteggio. */
export interface VoceFiltro<T extends string> {
  readonly valore: T;
  readonly etichetta: string;
  /** Mostrato accanto all'etichetta. `null`/assente = niente numero. */
  readonly conteggio?: number | null;
}

/**
 * Filtro a scelta ESCLUSIVA: cambia l'elenco, non il genere di cosa che si
 * vede. Il gemello di `app-schede` — vedi lì la domanda che li separa.
 *
 * ⚠️ NON inventa una grammatica: è quella già scritta e motivata in
 * `/lezioni` — `role="radiogroup"` + `role="radio"` + `aria-checked` + roving
 * tabindex + `frecceRadiogroup`. Questo primitivo esiste per incapsulare le
 * CINQUE copie che nascerebbero altrimenti (news, sconti, stakings, richieste,
 * affiliazioni), non per aggiungere un sesto modo di fare la stessa cosa.
 *
 * ⚠️ `aria-checked` e MAI `aria-pressed`: quest'ultimo è la grammatica dei
 * toggle indipendenti (ed è giusto in `app-tag-picker`, dove la selezione è
 * multipla). Su cinque pillole di cui una è sempre accesa annuncia «cinque
 * interruttori, uno premuto» invece di «radio 2 di 5». Mai entrambi insieme:
 * ogni screen reader risolve la contraddizione a modo suo.
 */
@Component({
  selector: 'app-filtro',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div
    class="filtro"
    role="radiogroup"
    [attr.aria-label]="etichetta()"
    (keydown)="onTasto($event)"
  >
    @for (v of voci(); track v.valore) {
      <button
        type="button"
        role="radio"
        class="badge badge--tag"
        [class.is-active]="scelto() === v.valore"
        [attr.aria-checked]="scelto() === v.valore"
        [attr.tabindex]="scelto() === v.valore ? 0 : -1"
        [attr.aria-disabled]="inerte() ? 'true' : null"
        (click)="onClic(v.valore)"
      >
        {{ v.etichetta }}
        @if (v.conteggio != null) {
          <span class="filtro__n">{{ v.conteggio }}</span>
        }
      </button>
    }
  </div>`,
  styles: `
    .filtro {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .filtro__n {
      margin-left: 0.35rem;
      font-variant-numeric: tabular-nums;
      opacity: 0.75;
    }
  `,
})
export class FiltroComponent<T extends string> {
  readonly etichetta = input.required<string>();
  readonly voci = input.required<readonly VoceFiltro<T>[]>();
  readonly scelto = input.required<T>();
  /**
   * C'è una richiesta in volo: i clic non contano.
   *
   * ⚠️ Si rende `aria-disabled` e MAI `[disabled]`. In un gruppo a roving
   * tabindex il `tabindex="0"` sta sull'unico bottone attivo: disabilitarlo lo
   * rende non focalizzabile, e il fuoco esce dal gruppo senza poterci
   * rientrare con Tab finché il caricamento non finisce. Con `aria-disabled`
   * il gruppo resta raggiungibile e viene annunciato come non disponibile; a
   * fermare l'azione è la guardia nel click.
   */
  readonly inerte = input(false);
  readonly scegli = output<T>();

  protected onClic(v: T): void {
    if (this.inerte()) return;
    this.scegli.emit(v);
  }

  protected onTasto(e: KeyboardEvent): void {
    if (this.inerte()) return;
    const v = this.voci();
    frecceRadiogroup(
      e,
      v.length,
      v.findIndex((x) => x.valore === this.scelto()),
      (j) => this.scegli.emit(v[j].valore),
    );
  }
}
