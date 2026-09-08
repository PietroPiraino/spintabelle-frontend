import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * Quante modali sono aperte adesso. Il blocco dello scorrimento è a CONTATORE e
 * non a booleano: con due modali sovrapposte, chiudere la seconda toglierebbe
 * il blocco anche alla prima.
 */
let aperte = 0;

/** Id progressivo per `aria-labelledby`: deve essere unico nella pagina. */
let seq = 0;

/**
 * Finestra modale del pannello admin.
 *
 * ⚠️ È un `<dialog>` NATIVO con `showModal()`, ed è la ragione per cui questa
 * primitiva sta in poche righe: il browser regala top-layer, focus-trap,
 * `Escape` e `::backdrop` — cioè esattamente le tre cose che finora erano il
 * motivo per non avere alcun dialog in questo progetto. Qui si scrive solo ciò
 * che il nativo NON dà:
 *   1. il blocco dello scorrimento della pagina sotto;
 *   2. la chiusura al clic sul fondale;
 *   3. il ritorno del fuoco quando chi ha aperto la modale non esiste più
 *      (il caso «Elimina», che ricarica l'elenco).
 *
 * ⚠️ NON è un contenitore che si nasconde: si crea e si distrugge con l'`@if`
 * del chiamante. Tenerlo montato e nascosto vorrebbe dire chiamare
 * `showModal()`/`close()` a mano e tenere il contatore allineato da fuori.
 */
/** Le tre larghezze della scatola. Vedi l'input `taglia`. */
export type TagliaModale = 'stretta' | 'media' | 'larga';

@Component({
  selector: 'app-modal',
  imports: [IconComponent],
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent {
  readonly titolo = input.required<string>();
  readonly sottotitolo = input<string | null>(null);
  /**
   * C'è del testo non salvato: `Escape` e il clic sul fondale chiedono conferma
   * invece di chiudere.
   *
   * ⚠️ Il chiamante DEVE passare un valore che cambia davvero. Un
   * `computed(() => control.value !== iniziale)` su un `FormControl` non si
   * ricalcola mai — un FormControl non è un signal — quindi resterebbe `false`
   * per sempre e `Escape` butterebbe via il digitato: cioè esattamente il
   * difetto che questo input esiste per prevenire. Si costruisce da
   * `toSignal(form.valueChanges, { initialValue: … })`.
   */
  readonly sporco = input(false);
  /**
   * Taglia della scatola: 480 · 720 · 960.
   *
   * ⚠️ Ha SOSTITUITO il booleano `larga`, non lo affianca: due modi di dire la
   * stessa cosa sono la divergenza che questo progetto paga ovunque, e le
   * call-site erano due.
   * ⚠️ Il default resta 720 anche perché la spec «è CENTRATA nel viewport»
   * misura `left` contro `(innerWidth - 720) / 2`: cambiarlo la rompe.
   * Oltre i 960 un form in colonna singola produce righe di lettura sopra gli
   * 80 caratteri — a un editor serve ALTEZZA, non larghezza.
   */
  readonly taglia = input<TagliaModale>('media');
  /**
   * C'è una richiesta in volo.
   *
   * ⚠️ Blocca le due chiusure ACCIDENTALI (Escape, clic sul fondale) e non la
   * ✕: bloccare ogni uscita significa che una richiesta appesa — rete morta,
   * 504 lento — intrappola chi la sta usando dentro un `<dialog>` modale, e
   * l'unica via d'uscita diventa ricaricare la pagina. È la stessa regola già
   * scritta per `sporco`: si ferma il gesto distratto, non quello deliberato.
   */
  readonly salvando = input(false);
  readonly chiusa = output<void>();

  private readonly dlg =
    viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly injector = inject(Injector);
  private d: HTMLDialogElement | null = null;

  protected readonly confermaUscita = signal(false);
  protected readonly idTitolo = `mo-${(seq += 1)}`;
  protected readonly idSottotitolo = computed(() =>
    this.sottotitolo() ? `${this.idTitolo}-sub` : null,
  );

  /**
   * ⚠️ Catturato nel COSTRUTTORE, cioè prima che `showModal()` sposti il fuoco.
   * Il ritorno automatico del browser non copre il caso che qui capita davvero:
   * «Elimina» ricarica l'elenco, quindi il bottone che aveva aperto la modale
   * non esiste più alla chiusura e il fuoco finirebbe su `<body>` — chi naviga
   * da tastiera ricomincerebbe dall'inizio della pagina.
   */
  private readonly apriva = document.activeElement as HTMLElement | null;

  /** Il fondale chiude solo se il tasto è stato PREMUTO sul fondale. */
  private giuSulFondale = false;

  constructor() {
    afterNextRender(
      () => {
        const d = (this.d = this.dlg().nativeElement);
        if (!d.open) d.showModal();
        // Fuoco iniziale sulla SCATOLA, non sul primo comando: con l'<h2> come
        // primo figlio uno screen reader annuncia il nome del riquadro invece
        // di leggere un campo fuori contesto. Un campo che deve prenderlo lo
        // dichiara con `autofocus`, che vince su questo.
        if (!d.querySelector('[autofocus]')) {
          d.querySelector<HTMLElement>('.mo__box')?.focus({
            preventScroll: true,
          });
        }
        aperte += 1;
        document.documentElement.classList.add('is-modale');
      },
      { injector: this.injector },
    );

    inject(DestroyRef).onDestroy(() => {
      if (this.d?.open) this.d.close();
      aperte = Math.max(0, aperte - 1);
      if (aperte === 0) {
        document.documentElement.classList.remove('is-modale');
      }
      // `isConnected`: se l'apritore è stato rimosso dal DOM non c'è nulla da
      // rimettere a fuoco, e chiamare focus() su un nodo staccato non fa nulla.
      if (this.apriva?.isConnected) {
        this.apriva.focus({ preventScroll: true });
      }
    });
  }

  /** `Escape`: il browser lo consegna come `cancel` PRIMA di chiudere. */
  protected onCancel(e: Event): void {
    // ⚠️ `salvando` PRIMA di `sporco`: con una richiesta in volo il contenuto
    // non è «perso», è in viaggio, e «vuoi chiudere e perderle?» sarebbe una
    // domanda a cui né sì né no è la risposta giusta.
    if (this.salvando()) {
      e.preventDefault();
      return;
    }
    if (!this.sporco()) {
      this.chiudi();
      return;
    }
    e.preventDefault();
    this.confermaUscita.set(true);
  }

  protected onGiu(e: MouseEvent): void {
    this.giuSulFondale = e.target === this.d;
  }

  /**
   * ⚠️ Il fondale È la scatola del `<dialog>`: si riconosce da
   * `target === dialog`, e funziona SOLO perché il dialog ha `padding: 0` — con
   * un padding, un clic sul padding conterebbe come clic sul fondale.
   * ⚠️ Serve anche il `mousedown`: selezionando del testo in un campo e
   * rilasciando fuori dalla scatola, il `click` arriva sul dialog e chiuderebbe
   * buttando via quello che si stava scrivendo.
   */
  protected onClic(e: MouseEvent): void {
    if (!this.giuSulFondale || e.target !== this.d) return;
    this.giuSulFondale = false;
    if (this.salvando()) return;
    if (this.sporco()) {
      this.confermaUscita.set(true);
      return;
    }
    this.chiudi();
  }

  /** La ✕ e «Annulla» sono gesti deliberati: chiudono anche da sporca. */
  protected chiudi(): void {
    this.confermaUscita.set(false);
    // ⚠️ Il `<dialog>` si chiude SUBITO, prima di emettere. Non è cosmesi: il
    // chiamante gestisce `(chiusa)` in modo sincrono — spesso mostrando un
    // toast di conferma — e finché il dialog è aperto quel toast dipinge dietro
    // il fondale, perché il top layer copre qualunque `position: fixed`. Il
    // ripiegamento del genitore (`@if` che distrugge il componente) arriva un
    // ciclo dopo, e un ciclo dopo è già tardi. Il `DestroyRef` fa comunque la
    // sua parte: chiudere due volte un `<dialog>` è un no-op.
    this.d?.close();
    this.chiusa.emit();
  }

  protected resta(): void {
    this.confermaUscita.set(false);
  }
}
