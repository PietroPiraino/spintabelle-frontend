import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  signal,
} from '@angular/core';

/** Una voce del pannello. Se `disabilitata`, il MOTIVO è obbligatorio. */
export interface MsOpzione {
  valore: string;
  etichetta: string;
  /** Non selezionabile con la scelta corrente degli ALTRI assi. */
  disabilitata?: boolean;
  /** Perché non è selezionabile. Senza, l'utente vede solo un comando spento. */
  motivo?: string;
}

/**
 * Selezione multipla dietro un trigger che mostra il valore corrente in chiaro.
 *
 * ⚠️ NON è una `<select multiple>` nativa, ed è una deviazione dalla richiesta
 * letterale dell'owner, presa con lui. In HTML **non esiste** una tendina a
 * scelta multipla: `<select multiple>` è una listbox sempre aperta ad altezza
 * fissa, si usa col ctrl+clic e su iOS diventa una ruota. Ma la ragione
 * decisiva è un'altra e si vede: una listbox nativa **non può portare né la
 * riga «tutte» né il MOTIVO accanto a una voce non selezionabile** — e su
 * /allenamento quel motivo è metà del problema, perché le voci si spengono a
 * vicenda. (Terza ragione, misurata in casa: `select.input` disegna la
 * freccetta in un data-URI con il navy `%2316223f` scritto dentro, senza
 * variante per tema — in Notte e Tramonto uscirebbe fuori palette.)
 *
 * ⚠️ Il pannello resta nel DOM e si nasconde con `[hidden]`, NON con un `@if`.
 * Con `@if` l'ultimo `Tab` in avanti rimuoverebbe il pannello **mentre** il
 * fuoco lo sta attraversando, e il fuoco finirebbe su `<body>`: è la classe di
 * bug che si ragiona male e si vede solo provando con la sola tastiera.
 *
 * ⚠️ Il pannello galleggia (`position: absolute`), ma NON è un dialog: niente
 * focus-trap, niente scroll-lock, niente `inert` sul resto della pagina. La
 * chiusura è il solo `focusout` qui sotto più `Escape`, ed è quanto basta per
 * una tendina — a differenza di una finestra modale, ciò che sta dietro resta
 * legittimamente raggiungibile. Il progetto non ha alcun dialog e non è questo
 * il lotto in cui scriverne uno.
 */
@Component({
  selector: 'app-multi-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './multi-select.component.html',
  styleUrl: './multi-select.component.scss',
  host: {
    class: 'ms',
    '(focusout)': 'onFocusOut($event)',
    '(keydown.escape)': 'chiudi()',
  },
})
export class MultiSelectComponent {
  /** Etichetta dell'asse: «Formato», «La tua posizione», … */
  readonly etichetta = input.required<string>();
  readonly opzioni = input.required<readonly MsOpzione[]>();
  readonly selezione = model<ReadonlySet<string>>(new Set<string>());
  /** Id del pannello, per `aria-controls`. Deve essere unico nella pagina. */
  readonly idPannello = input.required<string>();

  /**
   * Testo della riga «tutte», e insieme il valore mostrato a selezione vuota.
   * `null` = l'asse non ammette «tutte» (una scelta è obbligatoria).
   */
  readonly tuttiLabel = input<string | null>('tutte');
  /** Che cosa si conta oltre le tre voci: «4 profondità», «3 formati». */
  readonly nomePlurale = input('voci');
  /**
   * Riepilogo scritto dal chiamante, quando sa dire qualcosa che questo
   * componente non può sapere — es. «da 8 a 15 bb» per un tratto contiguo.
   */
  readonly valoreTesto = input<string | null>(null);
  /** Frase mostrata al posto del valore quando la selezione è vuota e obbligatoria. */
  readonly invito = input('scegli almeno una voce');
  /**
   * Elenco a matrice invece che a colonna: serve all'asse con decine di voci
   * brevi (le profondità).
   * ⚠️ Sta QUI e non nel foglio del chiamante perché una regola del genitore su
   * `.ms__list` sarebbe inerte — l'incapsulamento la lega a un attributo che
   * questo componente non porta.
   */
  readonly compatta = input(false);

  protected readonly aperto = signal(false);

  /** Quante voci sono disponibili davvero: alimenta « · 2 di 3 disponibili». */
  protected readonly disponibili = computed(
    () => this.opzioni().filter((o) => !o.disabilitata).length,
  );

  /**
   * Il valore in chiaro sul trigger. È la ragione per cui questa tendina esiste:
   * chiusa, deve dire che cosa si sta per allenare senza aprirla.
   */
  protected readonly valore = computed(() => {
    const custom = this.valoreTesto();
    if (custom) return custom;
    const sel = this.selezione();
    if (sel.size === 0) return this.tuttiLabel() ?? this.invito();
    const et = this.opzioni()
      .filter((o) => sel.has(o.valore))
      .map((o) => o.etichetta);
    if (et.length === 0) return this.tuttiLabel() ?? this.invito();
    if (et.length > 3) return `${et.length} ${this.nomePlurale()}`;
    if (et.length === 1) return et[0];
    return `${et.slice(0, -1).join(', ')} e ${et[et.length - 1]}`;
  });

  /** La riga «tutte» è a metà quando c'è una selezione parziale. */
  protected readonly parziale = computed(() => {
    const n = this.selezione().size;
    return n > 0 && n < this.opzioni().length;
  });

  protected apriChiudi(): void {
    this.aperto.update((a) => !a);
  }

  protected chiudi(): void {
    this.aperto.set(false);
  }

  /**
   * Chiude quando il fuoco esce dal componente, in QUALUNQUE direzione.
   *
   * ⚠️ `relatedTarget` è l'elemento che sta per ricevere il fuoco: senza questo
   * controllo il pannello si chiuderebbe passando da una checkbox all'altra.
   * `null` (clic fuori dalla finestra, o su un elemento non focusabile) conta
   * come uscita.
   */
  protected onFocusOut(event: FocusEvent): void {
    const dove = event.relatedTarget as Node | null;
    const host = event.currentTarget as HTMLElement;
    if (dove && host.contains(dove)) return;
    this.chiudi();
  }

  protected toggle(o: MsOpzione): void {
    if (o.disabilitata) return;
    this.selezione.update((s) => {
      const next = new Set(s);
      if (next.has(o.valore)) next.delete(o.valore);
      else next.add(o.valore);
      return next;
    });
  }

  /** «Tutte» = insieme VUOTO, che per il backend significa «qualunque». */
  protected tutte(): void {
    this.selezione.set(new Set<string>());
  }

  protected scelta(v: string): boolean {
    return this.selezione().has(v);
  }

  protected idMotivo(v: string): string {
    return `${this.idPannello()}-motivo-${v}`;
  }
}
