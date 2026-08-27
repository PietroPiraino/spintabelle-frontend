import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HandActionView, HandStreetName, HandView } from '../../../core/models/api.models';
import { AuthService } from '../../../core/services/auth.service';
import { HandsService, formatBui, formatImporto } from '../../../core/services/hands.service';
import { SeoService } from '../../../core/services/seo.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { PlayingCardComponent } from './playing-card.component';
import { ReplayContextService } from './replay-context.service';
import {
  PassoMano,
  PostoAlTavolo,
  TipoPasso,
  VERBI_AZIONE,
  latoDelPosto,
  latoDelleFiche,
  latoFicheQuadro,
  latoVerticale,
  passi,
  postiSullOvale,
  statoAlPasso,
} from './replay-state';

/**
 * Quanto resta a schermo ogni tipo di passo, in millisecondi.
 *
 * ⚠️ **Non è un metronomo, ed è deliberato.** Una mano vera non ha un ritmo
 * costante: un'azione va letta, una carta che esce va guardata, una raccolta di
 * fiche è un gesto rapido. Con un intervallo unico o si corre sulle decisioni o
 * si aspetta sulle transizioni.
 */
const DURATA: Record<TipoPasso, number> = {
  ANTE: 900,
  APERTURA: 1100,
  AZIONE: 1150,
  RACCOLTA: 700,
  CARTE: 950,
  RESTITUZIONE: 750,
  SHOWDOWN: 1300,
  ASSEGNAZIONE: 1600,
};

/**
 * Quanto l'azione resta al posto del nickname, in millisecondi.
 *
 * ⚠️ **È il numero che decide se la mano si legge.** Sotto il secondo l'etichetta
 * lampeggia e non si fa in tempo a leggerla; sopra i tre, in riproduzione, si
 * accavalla col passo dopo e non si capisce più a chi appartenga. Due secondi
 * sono il compromesso di Hand2Note, e su una riproduzione a velocità 1 (dove un
 * passo di azione dura 1.150 ms) significa che l'etichetta viene **sostituita**
 * dalla successiva prima di scadere — che è il comportamento voluto: a schermo
 * c'è sempre e solo l'ultima azione.
 */
const DURATA_LAMPO = 2000;

/** Le tre velocità offerte. `1` è quella di riferimento. */
const VELOCITA = [0.5, 1, 2] as const;

/** L'ordine canonico delle strade, per la barra dei comandi. */
const STRADE: HandStreetName[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];

const ETICHETTA_STRADA: Record<string, string> = {
  PREFLOP: 'Preflop',
  FLOP: 'Flop',
  TURN: 'Turn',
  RIVER: 'River',
};


/** Una strada nella barra dei comandi. */
interface BottoneStrada {
  nome: HandStreetName;
  etichetta: string;
  /** Il passo da cui comincia, o `null` se la mano non ci è mai arrivata. */
  passo: number | null;
  attiva: boolean;
}

/**
 * `/replayer/:publicId` — il replayer di una singola mano.
 *
 * ⚠️ **Pagina PUBBLICA**: chi ha il collegamento la apre senza account, ed è
 * metà della funzione richiesta. Il `noindex` non è qui — lo mettono
 * `public/_headers` e il renderer di bordo (decisione D2).
 *
 * ⚠️ **Il passo corrente vive nella query string (`?a=`)**, così un collegamento
 * può puntare a **quel** momento della mano invece che al suo inizio: è la
 * differenza fra «guarda questa mano» e «guarda cosa ho fatto qui». Il router
 * del sito fa scroll-to-top **solo quando cambia il percorso**, quindi scorrere
 * le azioni non fa saltare la pagina — è una proprietà voluta di
 * `app.config.ts`, non un caso.
 *
 * ⚠️ **L'URL NON si riscrive durante la riproduzione automatica.** Prima si
 * chiamava `router.navigate` a ogni passo, cioè una navigazione ogni secolo di
 * secondo per tutta la mano: lavoro inutile su un dato che nessuno sta leggendo
 * mentre scorre. Si sincronizza sui movimenti manuali e quando la riproduzione
 * si ferma.
 *
 * ⚠️⚠️ **LA MANO SI LEGGE DA `paramMap`, MAI DALLO SNAPSHOT** (26/08/2026, ed è
 * la condizione perché ▲ ▼ funzionino). Passando da `/replayer/A` a
 * `/replayer/B` il router **riusa la stessa istanza** del componente: il
 * costruttore non gira una seconda volta, quindi con `route.snapshot` la pagina
 * restava sulla mano A mentre l'indirizzo diceva B — un guasto silenzioso, senza
 * errori in console e senza nulla di rotto a vista.
 */
@Component({
  selector: 'app-hand-replay',
  imports: [IconComponent, PlayingCardComponent, RouterLink],
  templateUrl: './hand-replay.component.html',
  styleUrl: './hand-replay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HandReplayComponent {
  private readonly hands = inject(HandsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  /** La mappa dei verbi, per il template (stessa sede del resto). */
  protected readonly VERBI = VERBI_AZIONE;

  protected readonly auth = inject(AuthService);
  protected readonly contesto = inject(ReplayContextService);
  private readonly destroy = inject(DestroyRef);

  protected readonly mano = signal<HandView | null>(null);
  protected readonly errore = signal<string | null>(null);
  protected readonly passo = signal(0);
  protected readonly mostraTutto = signal(false);
  protected readonly inRiproduzione = signal(false);
  protected readonly copiato = signal(false);
  protected readonly velocita = signal(1);

  /** Il pannello della segnalazione: chiuso finché non serve. */
  protected readonly segnalaAperto = signal(false);
  protected readonly segnalato = signal(false);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private timerCopia: ReturnType<typeof setTimeout> | null = null;
  private timerLampo: ReturnType<typeof setTimeout> | null = null;

  /** Il voto di chi guarda: `1`, `-1` o `0` (non ha votato). */
  protected readonly mioVoto = signal(0);
  protected readonly likes = signal(0);
  protected readonly dislikes = signal(0);

  /**
   * **L'azione al posto del nickname**: `{seat, testo}` finché dura, poi `null`.
   *
   * ⚠️ È il modo in cui Hand2Note rende leggibile *chi ha fatto cosa* senza
   * aggiungere un solo oggetto al tavolo. Sostituisce la pillola che stava
   * accanto al posto: quella era un'etichetta **in più** su un feltro già pieno,
   * e per capire di chi fosse bisognava seguire una linea immaginaria fino alla
   * targa vicina. Qui l'azione compare **dentro** la targa di chi l'ha fatta:
   * non c'è nessun collegamento da fare con gli occhi.
   */
  protected readonly lampo = signal<{
    seat: number;
    testo: string;
    /**
     * ⚠️ **L'etichetta resta nel DOM anche da spenta**, ed è ciò che rende
     * possibile il *ritorno* animato: senza il testo, un `@if` la toglierebbe di
     * colpo e il nickname riapparirebbe con uno scatto. Spenta è a opacità zero
     * e `aria-hidden` — la regione `aria-live` ha già annunciato l'azione, e un
     * elemento trasparente resta nell'albero di accessibilità.
     */
    acceso: boolean;
  } | null>(null);

  /**
   * ⚠️ Chi ha chiesto meno movimento vede gli **stati**, non le transizioni: il
   * replayer resta pienamente utilizzabile, cambia solo che le fiche compaiono
   * dove devono arrivare invece di scivolarci.
   *
   * ⚠️ **L'etichetta lampo NON è una transizione e resta**: sparisce senza
   * dissolvenza (il blocco `prefers-reduced-motion` del foglio azzera le
   * animazioni dentro `.rp`), ma compare e se ne va come per tutti gli altri.
   * Toglierla sarebbe togliere un'informazione, non un movimento.
   */
  protected readonly ridottoMoto =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  protected readonly tutti = computed<PassoMano[]>(() => {
    const m = this.mano();
    return m ? passi(m) : [];
  });

  protected readonly ultimo = computed(() => Math.max(0, this.tutti().length - 1));

  protected readonly stato = computed(() => {
    const m = this.mano();
    return m ? statoAlPasso(m, this.passo(), this.mostraTutto(), this.tutti()) : null;
  });

  protected readonly posti = computed(() => {
    const m = this.mano();
    return m ? postiSullOvale(m.players) : new Map<number, PostoAlTavolo>();
  });

  /**
   * **Le fiche puntate, SUL FELTRO**, fra il posto e il centro.
   *
   * ⚠️ Prima stavano dentro la scatola del posto, sotto la targa: si vedeva
   * *quanto* qualcuno aveva puntato ma non *dove fossero i soldi*, e il feltro —
   * cioè la cosa che il replayer disegna — non diceva mai quanto ci fosse in
   * mezzo al tavolo.
   *
   * ⚠️ **Qui non c'è nessuna coordinata**: la pila è figlia del posto e la
   * appoggia il CSS al bordo giusto della sua scatola (vedi `latoDelleFiche`).
   * Un punto calcolato in percentuale ha bisogno dell'altezza della scatola, che
   * dipende da `clamp()` in `rem` e in TypeScript non si sa — la prima stesura
   * lo faceva e le pile finivano sulle targhe e sul board, misurato a due
   * viewport diverse.
   */
  protected readonly puntate = computed(() => {
    const st = this.stato();
    if (!st) return new Map<number, { importo: number; fascia: string; resto: boolean }>();
    const out = new Map<number, { importo: number; fascia: string; resto: boolean }>();
    for (const s of st.seggi) {
      const resto = st.daRestituire?.seat === s.seat;
      const importo = resto ? (st.daRestituire?.importo ?? 0) : s.davanti;
      if (importo <= 0) continue;
      out.set(s.seat, {
        importo,
        fascia: resto ? 'resto' : this.fascia(importo, s.allIn),
        resto,
      });
    }
    return out;
  });

  protected puntataDi(seat: number) {
    return this.puntate().get(seat) ?? null;
  }

  /** Da che lato della scatola il CSS appoggia le fiche di quel posto. */
  protected latoDi(seat: number): string {
    const p = this.posti().get(seat);
    return p ? latoDelleFiche(p.x, p.y) : 'basso';
  }

  /**
   * Lo stesso, per il tavolo **rettangolare** del telefono in orizzontale: le
   * fiche vanno da un lato diverso perché il posto cade in un punto diverso.
   * ⚠️ Un attributo a parte (`data-lato-s`) e non una riscrittura di
   * `data-lato`: quest'ultimo pilota il CSS del desktop, dove i posti stanno
   * ancora sull'ellisse — cambiarlo sposterebbe le fiche di una schermata che
   * nessuno ha chiesto di toccare.
   */
  protected latoQuadroDi(seat: number): string {
    const p = this.posti().get(seat);
    return p ? latoFicheQuadro(p.sx, p.sy) : 'basso';
  }

  /**
   * **Le fiche che si muovono**, in coordinate del **tavolo**: alla raccolta dal
   * posto al piatto, all'assegnazione dal piatto a chi ha vinto.
   *
   * ⚠️⚠️ **UN SOLO STRATO, E NON DUE.** Prima la raccolta era un elemento figlio
   * del *posto*, spostato di `50 − ancora` in `cqw`. Ma quell'elemento parte
   * dalla **pila puntata**, che è già staccata dall'ancora, quindi la traslazione
   * finiva **corta** e le fiche convergevano su un punto qualunque del feltro
   * invece che sul piatto. A schermo si leggeva esattamente così — pile che
   * volano «verso zone a caso» — ed è il rilievo del titolare. Con entrambi i
   * capi in coordinate del tavolo la destinazione è il centro per costruzione.
   *
   * ⚠️ **Le fiche si muovono SOLO quando il denaro si muove davvero**: quando
   * entra nel piatto e quando ne esce verso un vincitore. Nient'altro. Una pila
   * che scivola senza che nessuno abbia pagato o incassato è rumore, e insegna a
   * non guardare le animazioni proprio nei due momenti in cui contano.
   *
   * ⚠️ Alla raccolta le posizioni si leggono dallo stato **precedente**: a quel
   * passo il feltro è già pulito per definizione, e chiedere «chi aveva fiche
   * davanti» a questo stato risponderebbe «nessuno».
   */
  protected readonly volo = computed(() => {
    const m = this.mano();
    const st = this.stato();
    if (!m || !st || this.ridottoMoto) return [];
    const posti = this.posti();
    const centro = { x: 50, y: 50 };
    // Le fiche puntate non stanno sull'ancora del posto ma un po' più avanti,
    // verso il centro: il volo parte da lì, o si vedrebbe uscire da sotto la targa.
    const verso = (p: { x: number; y: number }, quanto: number) => ({
      x: p.x + (centro.x - p.x) * quanto,
      y: p.y + (centro.y - p.y) * quanto,
    });

    /**
     * ⚠️ **Le ante volano anch'esse**, ed è la ragione per cui il passo esiste:
     * negli hyper-turbo l'ante è la posta che rende il piatto degno di essere
     * combattuto, e senza vederla entrare il piatto iniziale sembra comparire
     * dal nulla. Partono dal posto e arrivano al centro, come ogni altra fiche
     * che entra nel piatto.
     */
    if (st.tipo === 'ANTE') {
      const p = this.tutti()[st.passo];
      return (p?.forzate ?? []).map((a) => ({
        chiave: `n${st.passo}-${a.seat}`,
        da: verso(posti.get(a.seat) ?? centro, 0.28),
        a: centro,
        importo: a.importo,
        fascia: 'piccola',
      }));
    }

    if (st.tipo === 'RACCOLTA') {
      const prima = statoAlPasso(m, st.passo - 1, this.mostraTutto(), this.tutti());
      return prima.seggi
        .filter((s) => s.davanti > 0)
        .map((s) => ({
          chiave: `r${st.passo}-${s.seat}`,
          da: verso(posti.get(s.seat) ?? centro, 0.28),
          a: centro,
          importo: s.davanti,
          fascia: this.fascia(s.davanti, s.allIn),
        }));
    }

    if (st.tipo === 'ASSEGNAZIONE') {
      return st.seggi
        .filter((s) => s.vinto)
        .map((s) => ({
          chiave: `a${st.passo}-${s.seat}`,
          da: centro,
          a: verso(posti.get(s.seat) ?? centro, 0.22),
          importo: s.vinto ?? 0,
          fascia: 'vinta',
        }));
    }
    return [];
  });

  /**
   * Le quattro strade per la barra dei comandi, **sempre tutte e quattro**.
   *
   * ⚠️ **Quelle che la mano non ha raggiunto restano a schermo, spente**: è la
   * forma di Hand2Note, e dice una cosa che l'elenco variabile non diceva —
   * *fin dove è arrivata questa mano*. Con solo le strade presenti, una mano
   * chiusa preflop mostrava un unico bottone e non si capiva se fosse una barra
   * o un'etichetta.
   */
  protected readonly barraStrade = computed<BottoneStrada[]>(() => {
    const seq = this.tutti();
    const presenti = new Map<string, number>();
    for (const p of seq) if (!presenti.has(p.strada)) presenti.set(p.strada, p.indice);
    const corrente = this.stato()?.strada;
    return STRADE.map((s) => ({
      nome: s,
      etichetta: ETICHETTA_STRADA[s],
      passo: presenti.has(s) ? (presenti.get(s) as number) : null,
      attiva: s === corrente,
    }));
  });

  // ── il contesto: mano precedente / successiva ─────────────────────────

  /**
   * L'indice della mano aperta dentro l'elenco di provenienza, o `-1`.
   *
   * ⚠️ **`-1` vale quanto «nessun contesto»**, ed è il caso della libreria oltre
   * la prima pagina: l'elenco che abbiamo non contiene questa mano, quindi non
   * sappiamo qual è la precedente. Meglio due frecce spente che due frecce che
   * saltano a una mano a caso.
   */
  protected readonly indiceNelContesto = computed(() => {
    const id = this.mano()?.publicId;
    if (!id) return -1;
    return this.contesto.mani().findIndex((x) => x.publicId === id);
  });

  protected readonly haContesto = computed(() => this.indiceNelContesto() >= 0);

  protected readonly manoPrecedente = computed(() => {
    const i = this.indiceNelContesto();
    return i > 0 ? this.contesto.mani()[i - 1] : null;
  });

  protected readonly manoSuccessiva = computed(() => {
    const i = this.indiceNelContesto();
    const l = this.contesto.mani();
    return i >= 0 && i < l.length - 1 ? l[i + 1] : null;
  });

  /**
   * La linea del tempo: un gettone per ogni passo, raggruppato per strada.
   * ⚠️ Porta **chi** e **quanto**, non il tipo grezzo in inglese maiuscolo: due
   * `CHECK` adiacenti erano indistinguibili, e nessuno sapeva di chi fossero.
   */
  protected readonly perStrada = computed(() => {
    const gruppi: { strada: string; etichetta: string; passi: PassoMano[] }[] = [];
    for (const p of this.tutti()) {
      const ultimo = gruppi[gruppi.length - 1];
      if (ultimo?.strada === p.strada) ultimo.passi.push(p);
      else
        gruppi.push({
          strada: p.strada,
          etichetta: ETICHETTA_STRADA[p.strada] ?? p.strada,
          passi: [p],
        });
    }
    return gruppi;
  });

  constructor() {
    this.ereditaContesto();

    /**
     * ⚠️ **`paramMap` e non lo snapshot** — vedi la nota in testa alla classe:
     * navigando fra due mani il componente viene riusato e il costruttore non
     * rigira. Ogni mano nuova riparte da zero: passo, riproduzione, «mostra
     * tutte le carte», etichetta lampo e voti.
     */
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.carica(p.get('publicId') ?? '');
    });

    /**
     * ⚠️ **L'etichetta lampo vive qui, in un `effect`, e non dentro `vai()`.**
     * Il passo cambia da cinque strade diverse (frecce, riproduzione, barra
     * delle strade, linea del tempo, `?a=` all'apertura): agganciarla a una sola
     * di esse significherebbe che dalle altre quattro non compare — e nessuna
     * delle quattro si romperebbe, quindi il buco resterebbe.
     */
    effect(() => {
      const p = this.tutti()[this.passo()];
      untracked(() => this.accendiLampo(p));
    });

    this.destroy.onDestroy(() => {
      this.ferma();
      if (this.timerCopia) clearTimeout(this.timerCopia);
      if (this.timerLampo) clearTimeout(this.timerLampo);
    });
  }

  /**
   * Deduce l'elenco di provenienza dalla **navigazione precedente**.
   *
   * ⚠️ La vetrina e la libreria non sanno nulla di questa pagina, e non devono:
   * vedi il commento in testa a `ReplayContextService`. Se si arriva da altrove
   * — un collegamento condiviso, un ricaricamento, una notizia — non c'è nulla
   * da dedurre e le due frecce restano spente, che è la verità.
   */
  private ereditaContesto(): void {
    // ⚠️ In Angular 22 `lastSuccessfulNavigation` è un **signal**, mentre
    // `getCurrentNavigation()` resta un metodo: qui il costruttore gira durante
    // l'attivazione, quindi la navigazione corrente c'è, e il ripiego serve solo
    // al caso di un montaggio fuori da una navigazione (i test).
    const nav = this.router.getCurrentNavigation() ?? this.router.lastSuccessfulNavigation();
    const prima = nav?.previousNavigation?.finalUrl?.toString() ?? '';
    // ⚠️ Il confronto è sul percorso **nudo**, non `includes`: `/replayer/XYZ`
    // contiene `/replayer` e farebbe ricaricare l'elenco a ogni salto fra mani.
    const percorso = prima.split('?')[0].replace(/\/$/, '');

    /**
     * ⚠️ **Una selezione esplicita batte la deduzione, ma solo finché contiene
     * la mano aperta.** Arrivando da `/mie-mani` con delle righe spuntate, il
     * ramo qui sotto ricaricherebbe l'intera libreria e cancellerebbe proprio la
     * scelta appena fatta. Il vincolo «finché la contiene» è ciò che rende la
     * cosa auto-riparante: aprendo poi una mano fuori dalla selezione, quella è
     * vecchia e si torna alla deduzione normale — senza alcun segnale da
     * azzerare a mano, che è il genere di stato che rimane appeso.
     */
    // ⚠️ **Qui lo `snapshot` è corretto**, malgrado l'avviso in testa alla
    // classe: quello riguarda il *caricamento della mano*, che deve reagire ai
    // cambi di parametro perché il router riusa l'istanza. Questo metodo gira
    // **una volta sola, nel costruttore**, e in quel momento lo snapshot è la
    // mano che si sta attivando.
    const id = this.route.snapshot.paramMap.get('publicId');
    if (
      this.contesto.origine() === 'selezione' &&
      id &&
      this.contesto.mani().some((m) => m.publicId === id)
    ) {
      return;
    }

    if (percorso === '/replayer') this.contesto.caricaVetrina();
    else if (percorso === '/mie-mani') this.contesto.caricaLibreria();
    // Da qualunque altro punto (compresa un'altra mano) si tiene ciò che c'è.
  }

  private carica(id: string): void {
    this.ferma();
    this.errore.set(null);
    this.mano.set(null);
    this.mostraTutto.set(false);
    this.lampo.set(null);
    this.mioVoto.set(0);
    this.daQui.set(false);

    /**
     * ⚠️ **Il numero nell'indirizzo è quello che si legge a schermo**, non
     * l'indice interno: con `?a=3` il contatore diceva «4 / 19», e chi apre un
     * collegamento «da qui» e confronta i due numeri vede un'incoerenza che non
     * può spiegarsi. Si converte qui, in un punto solo.
     * ⚠️ Troncato: con `?a=2.5` lo stato veniva calcolato su un indice
     * frazionario e il fotogramma si contraddiceva con la propria etichetta.
     */
    const a = Math.trunc(Number(this.route.snapshot.queryParamMap.get('a'))) - 1;

    this.hands
      .get(id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (m) => {
          this.mano.set(m);
          const n = Math.max(0, passi(m).length - 1);
          this.passo.set(Number.isFinite(a) && a > 0 ? Math.min(a, n) : 0);
          this.applicaSeo(m);
          this.likes.set(m.likes);
          this.dislikes.set(m.dislikes);
          // ⚠️ Solo per chi è collegato: la rotta del voto è autenticata, e
          // chiederla da anonimo produrrebbe un 401 a ogni apertura di un
          // collegamento condiviso — cioè sul caso d'uso principale.
          if (this.auth.isAuthenticated()) {
            this.hands.mioVoto(m.publicId).subscribe({
              next: (v) => this.mioVoto.set(v.value),
              error: () => undefined,
            });
          }
        },
        error: () =>
          this.errore.set(
            'Questa mano non esiste, oppure è stata rimossa da chi l’aveva caricata.',
          ),
      });
  }

  /**
   * ⚠️ Meta e titolo con i dati veri della mano: arrivano con la risposta HTTP
   * e **vincono** su quelli della rotta, come fa `news-detail`. In produzione
   * l'anteprima social la compone comunque il renderer di bordo — questo serve
   * a chi naviga dentro lo SPA.
   */
  private applicaSeo(m: HandView): void {
    this.seo.setSeo({
      title: `Mano di ${m.gameTypeLabel} — Best Fish Forever`,
      description: `Una mano di ${m.gameTypeLabel} a ${m.tableSize} giocatori, rivista azione per azione.`,
      // ⚠️ **Il percorso va passato.** Senza, `SeoService` ripiega su `/` e
      // questa pagina dichiarava come canonica la HOME. È lo stesso accoppiamento
      // pericoloso già documentato per la shell CSR: una pagina `noindex` che
      // punta altrove può far applicare il `noindex` al BERSAGLIO — e il
      // bersaglio era la home del sito.
      path: `/replayer/${m.publicId}/`,
    });
  }

  // ── l'azione al posto del nickname ────────────────────────────────────

  private accendiLampo(p: PassoMano | undefined): void {
    if (this.timerLampo) clearTimeout(this.timerLampo);
    this.timerLampo = null;
    const a = p?.tipo === 'AZIONE' ? p.azione : undefined;
    if (!a) {
      // ⚠️ Si SPEGNE, non si cancella: arrivando su una raccolta o su una carta
      // il nickname deve tornare con la stessa dissolvenza con cui se n'era
      // andato, non con uno scatto.
      this.spegniLampo();
      return;
    }
    this.lampo.set({ seat: a.seat, testo: this.testoLampo(a), acceso: true });
    // ⚠️ Ripulito alla distruzione: un timer che scrive su un signal di un
    // componente smontato è la fuga più banale che ci sia.
    this.timerLampo = setTimeout(
      () => this.spegniLampo(),
      DURATA_LAMPO / this.velocita(),
    );
  }

  /** Spegne senza cancellare: il testo serve alla dissolvenza di ritorno. */
  private spegniLampo(): void {
    this.lampo.update((l) => (l ? { ...l, acceso: false } : null));
  }

  /** «RILANCIA 5 bb», «PASSA», «ALL-IN 15 bb». */
  private testoLampo(a: HandActionView): string {
    // ⚠️ **Derivato, non una seconda copia**: il lampo è lo stesso verbo della
    // riga sotto il tavolo, gridato. Tenerne una mappa propria significava
    // poter correggere una parola in un posto e non nell'altro.
    const verbo = (
      VERBI_AZIONE[a.tipo as keyof typeof VERBI_AZIONE] ?? a.tipo
    ).toUpperCase();
    if (a.tipo === 'FOLD' || a.tipo === 'CHECK') return verbo;
    // ⚠️ Il **totale della strada** su rilancio e all-in, l'incremento sulle
    // altre: è la convenzione delle hand history, la stessa di `etichettaAzione`.
    const q = a.tipo === 'RAISE' || a.tipo === 'ALLIN' ? a.totaleStrada : a.importo;
    return `${verbo} ${this.imp(q)}`;
  }

  /** Il testo dell'etichetta a quel posto, acceso o in dissolvenza che sia. */
  protected lampoDi(seat: number): string | null {
    const l = this.lampo();
    return l && l.seat === seat ? l.testo : null;
  }

  /** L'etichetta è **accesa** a quel posto: copre il nickname adesso. */
  protected lampoAcceso(seat: number): boolean {
    const l = this.lampo();
    return Boolean(l && l.acceso && l.seat === seat);
  }

  // ── navigazione fra i passi ───────────────────────────────────────────

  protected vai(n: number, sincronizza = true): void {
    const v = Math.max(0, Math.min(n, this.ultimo()));
    this.passo.set(v);
    if (sincronizza) this.sincronizzaUrl(v);
  }

  private sincronizzaUrl(v: number): void {
    // ⚠️ `replaceUrl`: scorrere una mano non deve riempire la cronologia di
    // trenta voci, o il tasto «indietro» del browser smette di riportare alla
    // pagina da cui si è arrivati.
    void this.router.navigate([], {
      relativeTo: this.route,
      // Il passo visibile, cioè `indice + 1`: al passo 0 il parametro sparisce.
      queryParams: { a: v ? v + 1 : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected avanti(): void {
    this.vai(this.passo() + 1);
  }
  protected indietro(): void {
    this.ferma();
    this.vai(this.passo() - 1);
  }
  protected inizio(): void {
    this.ferma();
    this.vai(0);
  }

  /** Salta all'inizio di una strada. Le strade non raggiunte non arrivano qui. */
  protected vaiAStrada(p: number | null): void {
    if (p === null) return;
    this.ferma();
    this.vai(p);
  }

  protected cambiaVelocita(): void {
    const i = VELOCITA.indexOf(this.velocita() as (typeof VELOCITA)[number]);
    this.velocita.set(VELOCITA[(i + 1) % VELOCITA.length]);
  }

  protected riproduci(): void {
    if (this.inRiproduzione()) {
      this.ferma();
      return;
    }
    if (this.passo() >= this.ultimo()) this.vai(0, false);
    this.inRiproduzione.set(true);
    this.programma();
  }

  /**
   * Il prossimo passo, con l'attesa che compete al passo **corrente**.
   * ⚠️ `setTimeout` incatenato e non `setInterval`: la durata cambia da un passo
   * all'altro, e un intervallo fisso non può seguirla.
   */
  private programma(): void {
    const tipo = this.tutti()[this.passo()]?.tipo ?? 'AZIONE';
    const attesa = (this.ridottoMoto ? 900 : DURATA[tipo]) / this.velocita();
    this.timer = setTimeout(() => {
      if (this.passo() >= this.ultimo()) {
        this.ferma();
        return;
      }
      this.vai(this.passo() + 1, false);
      if (this.inRiproduzione()) this.programma();
    }, attesa);
  }

  private ferma(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.inRiproduzione()) {
      this.inRiproduzione.set(false);
      this.sincronizzaUrl(this.passo());
    }
  }

  // ── navigazione fra le mani ───────────────────────────────────────────

  /**
   * ⚠️ **Nessun `queryParams`**: si va all'inizio della mano nuova, e portarsi
   * dietro il `?a=` della precedente aprirebbe la successiva a metà, in un punto
   * che con quella mano non c'entra nulla.
   */
  protected apriMano(publicId: string | undefined): void {
    if (!publicId) return;
    this.ferma();
    void this.router.navigate(['/replayer', publicId]);
  }

  protected manoPrec(): void {
    this.apriMano(this.manoPrecedente()?.publicId);
  }
  protected manoSucc(): void {
    this.apriMano(this.manoSuccessiva()?.publicId);
  }

  /**
   * ⚠️ Le frecce e la barra spaziatrice, che è come si scorre una mano quando si
   * studia sul serio. Si ignorano quando il fuoco è in un campo di testo — o
   * scrivere «a» nella segnalazione farebbe avanzare la mano.
   */
  @HostListener('document:keydown', ['$event'])
  protected tasto(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (t?.isContentEditable) return;
    /**
     * ⚠️ **Sulla barra spaziatrice ci si ferma se il fuoco è su un comando.**
     * Su un `<button>`, su un `<a>` e su una casella di spunta lo spazio è il
     * tasto di attivazione **nativo**: intercettarlo comunque significava che
     * chi naviga da tastiera non poteva più premere «Azione successiva» né
     * l'occhio «Mostra tutte le carte» — il comando sotto il dito smetteva di
     * rispondere al gesto standard, e per giunta la pagina non scorreva più.
     */
    if (e.key === ' ' && t?.closest('button, a, [role="button"], label')) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.ferma();
      this.avanti();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.indietro();
    } else if (e.key === 'ArrowUp') {
      // ⚠️ `preventDefault` **solo se c'è davvero una mano dove andare**: senza
      // contesto ↑ e ↓ devono tornare a scorrere la pagina, che è il loro
      // comportamento nativo. Rubarli per non fare niente è peggio che non
      // averli.
      if (!this.manoPrecedente()) return;
      e.preventDefault();
      this.manoPrec();
    } else if (e.key === 'ArrowDown') {
      if (!this.manoSuccessiva()) return;
      e.preventDefault();
      this.manoSucc();
    } else if (e.key === ' ') {
      e.preventDefault();
      this.riproduci();
    } else if (e.key === 'Home') {
      e.preventDefault();
      this.inizio();
    } else if (e.key === 'End') {
      e.preventDefault();
      this.ferma();
      this.vai(this.ultimo());
    }
  }

  // ── formattazione ─────────────────────────────────────────────────────

  /**
   * Gli importi **in grandi bui** dove hanno senso, cioè nei tornei: uno stack
   * da 1.084 fiche non dice niente, «10,8 bb» sì — ed è la misura con cui si
   * confronta una decisione presa a dieci bui con una presa a venti.
   */
  protected imp(v: number): string {
    const m = this.mano();
    if (!m) return '';
    return formatBui(v, m.bigBlind) ?? formatImporto(v, m.decimali);
  }

  /** L'importo in fiche vere, per l'intestazione: «bui 15/30» dice la profondità. */
  protected fiche(v: number): string {
    const m = this.mano();
    return m ? formatImporto(v, m.decimali) : '';
  }

  protected etichettaStrada(s: string): string {
    return ETICHETTA_STRADA[s] ?? s;
  }

  /**
   * ⚠️ La scatola è **appesa all'ancora dal lato esterno**, non centrata su di
   * essa: `--anc` vale 0 a sinistra, 1 a destra, 0,5 al centro, e il CSS lo usa
   * nel `translate`. Centrata, a quattro giocatori metà scatola usciva dal
   * contenitore, e a otto due scatole si sovrapponevano.
   */
  /**
   * ⚠️ **Due coppie di coordinate, e a scegliere è il CSS.** `--x/--y` stanno
   * sull'ellisse (feltro desktop, `border-radius: 50%`), `--sx/--sy` sul
   * superellisse (feltro rettangolare del telefono in orizzontale) — vedi
   * `PostoAlTavolo` in `replay-state.ts`. La regola di base usa le prime, la
   * media query orizzontale le seconde: nessun `matchMedia`, nessun listener da
   * ripulire, e il desktop non si sposta di un pixel.
   *
   * ⚠️ Anche il **verso di aggancio** (`--anc`/`--ancy`, da che lato la targa
   * sporge) ha la sua coppia: dipende da dove cade il posto, e i due sistemi
   * lo fanno cadere in fasce diverse.
   */
  protected stile(seat: number): string {
    const p = this.posti().get(seat);
    if (!p) return '';
    return [
      `--x:${p.x}%`,
      `--y:${p.y}%`,
      `--sx:${p.sx}%`,
      `--sy:${p.sy}%`,
      `--anc:${latoDelPosto(p.x)}`,
      `--ancy:${latoVerticale(p.y)}`,
      `--anc-s:${latoDelPosto(p.sx)}`,
      `--ancy-s:${latoVerticale(p.sy)}`,
    ].join(';');
  }

  /**
   * Il posto che ha il bottone del mazziere. ⚠️ Mancava del tutto, ed è
   * l'oggetto che dice **da dove si conta**: senza, la posizione di ciascuno è
   * un'etichetta da leggere invece di una cosa da vedere.
   */
  protected readonly bottone = computed(() => {
    const seggi = this.stato()?.seggi ?? [];
    // Heads-up: il bottone è il piccolo buio, e non esiste un posto «BTN».
    return (
      seggi.find((s) => s.posizione === 'BTN')?.seat ??
      (seggi.length === 2 ? seggi.find((s) => s.posizione === 'SB')?.seat : undefined) ??
      null
    );
  });

  /**
   * L'entità di una puntata rispetto al piatto — **il numero che rende una
   * puntata leggibile senza aritmetica**. «22 bb» non dice niente da solo; «22
   * bb, due terzi del piatto» dice tutto.
   */
  protected percentualePiatto(importo: number): number | null {
    const st = this.stato();
    if (!st || importo <= 0) return null;
    const base = st.pot + st.inGioco - importo;
    return base > 0 ? importo / base : null;
  }

  /**
   * L'entità della puntata che si sta guardando, in percentuale del piatto.
   *
   * ⚠️ Compare solo su punta/rilancia/all-in: su una chiamata la misura è quella
   * di chi ha puntato prima, e ripeterla è rumore. Sta nel riquadro della
   * decisione e **non** nell'etichetta lampo: quella sostituisce il nickname
   * dentro la targa, e una seconda riga la farebbe crescere per due secondi —
   * cioè farebbe **saltare il tavolo** a ogni azione.
   */
  protected entitaCorrente(): string | null {
    const p = this.tutti()[this.passo()];
    const a = p?.tipo === 'AZIONE' ? p.azione : undefined;
    if (!a || !['BET', 'RAISE', 'ALLIN'].includes(a.tipo)) return null;
    const q = this.percentualePiatto(a.totaleStrada);
    return q === null ? null : `${Math.round(q * 100)}% piatto`;
  }

  /**
   * La fascia di una puntata, che pilota il **colore delle fiche**.
   *
   * ⚠️ Riusa la scala azioni del sito (`--act-raise-1/2/3`, `--act-allin`), la
   * stessa della matrice GTO di `/tabelle`: un rilancio grosso ha qui lo stesso
   * colore che ha là. Prima il replayer non usava un solo token di quella scala,
   * e tutte le puntate erano pilloline ambra identiche — 1 bb e 22 bb con lo
   * stesso peso visivo.
   */
  protected fascia(importo: number, allIn = false): string {
    if (allIn) return 'allin';
    const q = this.percentualePiatto(importo);
    if (q === null) return 'piccola';
    if (q < 0.4) return 'piccola';
    if (q < 0.85) return 'media';
    return 'grande';
  }

  /**
   * Quante fiche disegnare in una pila. Cresce col logaritmo dell'importo in
   * grandi bui: una pila che crescesse in proporzione diventerebbe una colonna
   * fuori dal tavolo al primo all-in.
   */
  protected pila(importo: number): number[] {
    const m = this.mano();
    if (!m || importo <= 0) return [];
    const bb = m.bigBlind > 0 ? importo / m.bigBlind : importo;
    const n = Math.max(1, Math.min(5, Math.round(Math.log2(bb + 1))));
    return Array.from({ length: n }, (_, i) => i);
  }

  /** Chi deve parlare adesso, se qualcuno deve parlare. */
  protected chiAgisce() {
    return this.stato()?.seggi.find((s) => s.deveAgire) ?? null;
  }

  /**
   * ⚠️ Il nome di chi sta a un posto. Il vincitore va nominato col **nickname**:
   * «13 bb al posto 10» era irrisolvibile guardando la pagina, perché il numero
   * di seggio non compare in nessuna targa del tavolo.
   */
  protected nomeDi(seat: number): string {
    return this.mano()?.players.find((p) => p.seat === seat)?.nome ?? `posto ${seat}`;
  }

  /**
   * ⚠️ C'è davvero qualcosa da scoprire? Nelle mani chiuse senza showdown — la
   * maggioranza — nessun avversario ha carte nei dati: il comando «mostra tutte
   * le carte» cambiava stato e il tavolo restava identico, cioè si comportava
   * come un comando rotto.
   */
  protected qualcunoDaScoprire(): boolean {
    return (this.mano()?.players ?? []).some((p) => !p.isHero && p.carte?.length);
  }

  /** L'etichetta di un passo nella linea del tempo: chi, che cosa, quanto. */
  protected etichettaPasso(p: PassoMano): string {
    switch (p.tipo) {
      case 'ANTE':
        return 'Ante';
      case 'APERTURA':
        return 'Bui';
      case 'RACCOLTA':
        return 'Piatto';
      case 'CARTE':
        return this.etichettaStrada(p.strada);
      case 'RESTITUZIONE':
        // ⚠️ **Non è un all-in**, ed è stato letto così: è la parte della
        // puntata che nessuno ha coperto e che torna a chi l'aveva messa.
        // «Resto» era troppo breve per dirlo.
        return 'Non chiamata';
      case 'SHOWDOWN':
        return 'Showdown';
      case 'ASSEGNAZIONE':
        return 'Vincitore';
      default: {
        const a = p.azione;
        if (!a) return '';
        const nome = this.mano()?.players.find((x) => x.seat === a.seat)?.posizione ?? '';
        // ⚠️ La stessa mappa della riga sotto il tavolo e del lampo sopra il
        // posto: era una **terza copia**, ed è così che «Bussa» è sopravvissuto
        // in una sede sola dopo essere stato corretto nelle altre.
        const verbo = VERBI_AZIONE[a.tipo as keyof typeof VERBI_AZIONE];
        const q = a.tipo === 'FOLD' || a.tipo === 'CHECK' ? '' : ` ${this.imp(a.totaleStrada)}`;
        return `${nome} ${verbo ?? a.tipo}${q}`;
      }
    }
  }

  /** Il testo che una tecnologia assistiva annuncia a ogni passo. */
  protected annuncio(): string {
    const st = this.stato();
    if (!st) return '';
    const p = this.tutti()[st.passo];
    if (!p) return '';
    switch (p.tipo) {
      case 'APERTURA':
        return `Mano distribuita. Piatto ${this.imp(st.pot + st.inGioco)}.`;
      case 'CARTE':
        return `${this.etichettaStrada(p.strada)}: ${st.board.join(', ')}. Piatto ${this.imp(st.pot)}.`;
      case 'RACCOLTA':
        return `Piatto raccolto: ${this.imp(st.pot)}.`;
      case 'RESTITUZIONE':
        return 'Puntata non chiamata restituita.';
      case 'SHOWDOWN':
        return 'Showdown.';
      case 'ASSEGNAZIONE': {
        const v = st.seggi.filter((s) => s.vinto);
        return v.map((s) => `${s.nome} vince ${this.imp(s.vinto ?? 0)}`).join('; ');
      }
      default: {
        const s = st.seggi.find((x) => x.diTurno);
        if (!s?.ultimaAzione) return '';
        const q = s.ultimaAzione.importo !== null ? ` ${this.imp(s.ultimaAzione.importo)}` : '';
        return `${s.nome} ${s.ultimaAzione.verbo}${q}. Piatto ${this.imp(st.pot + st.inGioco)}.`;
      }
    }
  }

  // ── condivisione ──────────────────────────────────────────────────────

  /**
   * ⚠️ L'indirizzo condiviso è quello **canonico**, non `location.href`: chi
   * scorre la mano ha un `?a=` nella barra, e mandarlo così spedirebbe l'amico
   * a metà mano senza volerlo. Se invece si vuole proprio quel momento, c'è il
   * secondo comando.
   */
  protected get url(): string {
    const m = this.mano();
    return m ? `${location.origin}/replayer/${m.publicId}/` : '';
  }

  /**
   * ⚠️ **La spunta «fai partire il link da questa azione»**, che ha sostituito
   * il secondo pulsante «Copia da qui»: due pulsanti quasi uguali non
   * spiegavano la differenza, una spunta col suo effetto visibile nell'input
   * sì. Si azzera da sola cambiando mano (in `carica()`): un `?a=7` della mano
   * precedente su una mano nuova sarebbe un link a un momento mai scelto.
   */
  protected readonly daQui = signal(false);

  /** L'indirizzo che il pulsante copia DAVVERO — lo stesso mostrato nell'input. */
  protected urlCondiviso(): string {
    return this.daQui() && this.passo() > 0
      ? `${this.url}?a=${this.passo() + 1}`
      : this.url;
  }

  protected async copia(): Promise<void> {
    const testo = this.urlCondiviso();
    try {
      await navigator.clipboard.writeText(testo);
      this.copiato.set(true);
      // Ripulito alla distruzione: un timer che scrive su un signal di un
      // componente smontato è la fuga più banale che ci sia.
      if (this.timerCopia) clearTimeout(this.timerCopia);
      this.timerCopia = setTimeout(() => this.copiato.set(false), 2200);
    } catch {
      // ⚠️ Il messaggio NON deve dire «copia dalla barra del browser»: lì c'è
      // `location.href`, che con `?a=` è un indirizzo diverso da questo.
      this.toast.error('Copia non riuscita: seleziona e copia il collegamento qui sopra.');
    }
  }

  // ── voti ──────────────────────────────────────────────────────────────

  /**
   * ⚠️ Ripremere lo **stesso** voto lo ritira: è il comportamento che chiunque
   * si aspetta da un pollice, e sul server il delta risultante è zero — un
   * doppio tocco su un telefono non deve essere un errore.
   */
  protected vota(v: 1 | -1): void {
    const m = this.mano();
    if (!m) return;
    const nuovo: 1 | -1 | 0 = this.mioVoto() === v ? 0 : v;
    this.hands.vota(m.publicId, nuovo).subscribe({
      next: (r) => {
        this.likes.set(r.likes);
        this.dislikes.set(r.dislikes);
        this.mioVoto.set(r.mio);
      },
      error: () => this.toast.error('Voto non registrato. Riprova.'),
    });
  }

  // ── segnalazione ──────────────────────────────────────────────────────

  /**
   * ⚠️ **Funziona SENZA account, ed è una condizione di liceità.** Chi ne ha più
   * bisogno è un giocatore che si è trovato nominato in questa mano: non è un
   * nostro iscritto, non ha credenziali e non sa di essere qui. Pretendere una
   * registrazione renderebbe la via di rimozione una via che non esiste.
   *
   * ⚠️ **E per la stessa ragione NON sparisce sul telefono in verticale**: là il
   * tavolo viene sostituito dall'invito a ruotare, ma questo comando resta dov'è
   * — è la via con cui un terzo esercita gli artt. 17 e 21, e una via che
   * dipende dall'orientamento del dispositivo non è una via.
   */
  protected segnala(motivo: 'DATI_PERSONALI' | 'CONTENUTO_ILLECITO' | 'ALTRO'): void {
    const m = this.mano();
    if (!m) return;
    this.hands.segnala(m.publicId, { motivo }).subscribe({
      next: () => {
        this.segnalato.set(true);
        this.segnalaAperto.set(false);
      },
      error: () => this.toast.error('Segnalazione non riuscita. Riprova fra poco.'),
    });
  }
}
