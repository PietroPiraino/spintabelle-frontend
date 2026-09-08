import { Injectable, isDevMode, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

/**
 * Toast effimeri riutilizzabili in tutto il sito (providedIn root). Feedback
 * d'azione (successo/errore/info) con auto-dismiss, distinti dalla banda errore
 * persistente delle pagine. Zoneless-safe: i toast vivono in un signal.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  readonly toasts = signal<Toast[]>([]);

  show(text: string, kind: ToastKind = 'info', ttlMs = 4000): void {
    // ⚠️ UN TOAST CON UNA MODALE APERTA È INVISIBILE, e questa è l'unica cosa
    // che lo dice. `showModal()` mette il `<dialog>` nel TOP LAYER, sopra
    // qualunque `position: fixed`; `<app-toast />` sta montato in `app-root`,
    // cioè nel flusso normale, e dipinge DIETRO il fondale. Il messaggio parte,
    // il signal si popola, il test resta verde — e nessuno lo legge mai.
    //
    // È il modo in cui il refactoring del pannello admin poteva introdurre una
    // regressione da solo: le sezioni che mandano il form in modale portavano
    // con sé i propri `toast.error`. La regola è: esito che CHIUDE la modale →
    // toast; errore con la modale APERTA → banda dentro il corpo.
    //
    // Solo in sviluppo: in produzione un messaggio invisibile è già abbastanza
    // brutto senza aggiungerci un errore in console per chi lo sta subendo.
    //
    // ⚠️ IL CONTROLLO È DIFFERITO, e questa è la parte che la prima stesura
    // sbagliava. Il caso CORRETTO è «chiudo la modale e annuncio l'esito»: lì
    // la chiusura è un `@if` del genitore, quindi nell'istante in cui il toast
    // parte il `<dialog>` è ancora nel DOM e sparisce un ciclo di change
    // detection dopo — prima che qualcosa venga dipinto. Controllando subito,
    // il pattern giusto risultava colpevole: quattro falsi allarmi in
    // `admin-fonti`, che è il modo più rapido per far spegnere una guardia.
    // Dopo un `setTimeout(0)` la change detection è passata, e un dialog ancora
    // aperto lì è un dialog che coprirà davvero il messaggio.
    //
    // ⚠️ E si legge `dialog[open]`, non la classe `is-modale`: quella la toglie
    // il `DestroyRef` di `app-modal`, cioè risponde a «il componente è ancora
    // vivo?» invece che a «c'è qualcosa in top layer?».
    if (isDevMode() && typeof document !== 'undefined') {
      setTimeout(() => {
        if (document.querySelector('dialog[open]') === null) return;
        console.error(
          `[toast] «${text}» è stato emesso con una modale aperta: il <dialog> è ` +
            'in top layer e il toast dipinge DIETRO il fondale. ' +
            'Usa la banda .form-feedback dentro la modale.',
        );
      }, 0);
    }
    const id = ++this.seq;
    this.toasts.update((list) => [...list, { id, text, kind }]);
    setTimeout(() => this.dismiss(id), ttlMs);
  }

  success(text: string): void {
    this.show(text, 'success');
  }

  error(text: string): void {
    this.show(text, 'error');
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
