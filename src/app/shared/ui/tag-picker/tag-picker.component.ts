import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

/**
 * Selettore di tag "select-or-create": i tag già esistenti come chip
 * cliccabili, più un campo libero per aggiungerne di nuovi.
 *
 * Estratto dal form lezioni quando è servito anche alla pubblicazione di una
 * registrazione live: la regola di normalizzazione (trim, minuscole, dedup) e
 * il divieto di virgole devono vivere in UN solo posto, altrimenti le due copie
 * divergono alla prima modifica.
 *
 * ⚠️ La virgola non può far parte di un tag: il filtro della lista lezioni li
 * serializza in CSV e il backend la rifiuta con 400. Qui la virgola separa più
 * tag scritti insieme ("icm, push fold" → due tag).
 */
@Component({
  selector: 'app-tag-picker',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <label [attr.for]="inputId()">{{ label() }}</label>
      @if (chips().length > 0) {
        <div class="row admin-form__tags" role="group" aria-label="Seleziona i tag">
          @for (tag of chips(); track tag) {
            <button
              type="button"
              class="badge badge--tag"
              [class.is-active]="selected().includes(tag)"
              [attr.aria-pressed]="selected().includes(tag)"
              (click)="toggle(tag)"
            >
              {{ tag }}
            </button>
          }
        </div>
      }
      <div class="row" style="gap: 0.5rem">
        <input
          [id]="inputId()"
          type="text"
          class="input"
          [formControl]="newTag"
          placeholder="Nuovo tag…"
          style="flex: 1"
          (keydown.enter)="addNew($event)"
        />
        <button type="button" class="btn btn--ghost btn--sm" (click)="addNew()">
          Aggiungi
        </button>
      </div>
    </div>
  `,
})
export class TagPickerComponent {
  /** Tag proposti come chip. Bidirezionale: i tag nuovi entrano nell'elenco. */
  readonly known = model<string[]>([]);
  /** Tag scelti. Bidirezionale: è il valore che il form invia al backend. */
  readonly selected = model<string[]>([]);
  readonly label = input('Tag');
  /** Id dell'input: serve distinto quando due picker convivono nella pagina. */
  readonly inputId = input('newTag');

  protected readonly newTag = new FormControl('', { nonNullable: true });

  /**
   * Chip mostrate: l'unione di quelle note e di quelle già selezionate. Senza
   * l'unione, un tag preselezionato dall'esterno e non ancora presente in
   * archivio (es. il marcatore 'live' prima della prima VOD pubblicata) sarebbe
   * attivo ma INVISIBILE — impossibile da togliere e facile da non notare.
   */
  protected readonly chips = computed(() =>
    [...new Set([...this.known(), ...this.selected()])].sort(),
  );

  protected toggle(tag: string): void {
    this.selected.update((tags) =>
      tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag],
    );
  }

  protected addNew(event?: Event): void {
    event?.preventDefault();
    const parts = this.newTag.value
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    for (const raw of parts) {
      if (!this.known().includes(raw))
        this.known.update((tags) => [...tags, raw].sort());
      if (!this.selected().includes(raw))
        this.selected.update((tags) => [...tags, raw]);
    }
    this.newTag.setValue('');
  }
}
