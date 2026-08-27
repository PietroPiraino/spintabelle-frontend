import {
  HandActionView,
  HandPlayerView,
  HandStreetName,
  HandView,
} from '../../../core/models/api.models';

/**
 * Il motore del replayer: da una mano alla sequenza di **eventi** che la
 * raccontano, e dallo stato del tavolo a un qualunque punto di quella sequenza.
 *
 * ⚠️ **Funzioni pure, nessun Angular.** È la parte che deve essere *giusta* — il
 * piatto, le fiche davanti a ciascuno, gli stack, chi è ancora in gioco, quali
 * carte si vedono — e va provata senza montare niente.
 *
 * ⚠️⚠️ **QUESTA È UNA RISCRITTURA (26/08/2026), e le tre ragioni sono difetti
 * misurati sul corpus locale di 17 mani vere, non rifiniture:**
 *
 * 1. **Il run-out non si vedeva.** La versione precedente emetteva un passo per
 *    ogni *azione*, e una strada senza azioni non produceva nessun passo: in una
 *    mano finita all-in preflop il flop, il turn e il river **non comparivano
 *    mai** e il tavolo restava con cinque caselle vuote fino alla fine. Erano
 *    **5 mani su 17** — e negli Spin & Go e nei Twister l'all-in preflop è il
 *    caso *tipico*, non quello di bordo.
 * 2. **Il piatto finale era gonfiato, in 15 mani su 17, fino a 4,3 volte.** Si
 *    mostrava `azione.potDopo`, che comprende anche la **puntata non chiamata** —
 *    quella che al tavolo torna indietro. Su una mano vera: rilancio a 442,
 *    fold, `potDopo` 672, piatto vero 250.
 * 3. **Gli stack di fine mano erano sbagliati** per la stessa ragione, e chi
 *    aveva fatto un rilancio non chiamato veniva dichiarato «all-in» avendo
 *    ancora tutte le sue fiche.
 *
 * La regola che ripara 2 e 3 è quella del tavolo: **a fine strada il contributo
 * di ciascuno vale al massimo quanto il SECONDO contributo più alto della
 * strada**; l'eccedenza torna a chi l'ha messa. Vale anche per l'all-in per meno
 * (chi punta 100 e viene chiamato all-in per 60 riprende 40). Le **ante** ne
 * sono fuori: entrano sempre per intero. Verificata su tutte e 17 le mani del
 * corpus, al centesimo — non dedotta.
 */

/** Le azioni che nessuno ha scelto: si versano all'apertura, tutte insieme. */
const AZIONI_FORZATE = new Set(['SB', 'BB', 'ANTE', 'STRADDLE']);

/**
 * Che cosa succede a un passo del replay.
 *
 * ⚠️ **Gli eventi non sono solo le azioni**, ed è tutta la differenza con la
 * versione precedente: una mano è fatta anche di carte che escono, fiche che
 * vengono raccolte, denaro che torna indietro e un piatto che viene assegnato.
 * Quei momenti erano invisibili perché non erano *azioni di un giocatore*.
 */
export type TipoPasso =
  /**
   * Le **ante**: tutti versano prima che si distribuisca.
   *
   * ⚠️ **È un passo a sé, prima dei bui, e non un dettaglio contabile.** Prima
   * finivano nel piatto insieme ai bui, senza che si vedesse nessuno versarle:
   * negli hyper-turbo l'ante è la posta che rende il piatto degno di essere
   * combattuto, e chi studia deve vederla entrare. Esiste solo se la mano ne ha.
   */
  | 'ANTE'
  /** Carte distribuite e bui sul feltro. È il tavolo pronto a giocare. */
  | 'APERTURA'
  /** Un giocatore agisce. */
  | 'AZIONE'
  /** Fine strada: le fiche davanti a tutti scivolano nel piatto. */
  | 'RACCOLTA'
  /** Escono le carte comuni di una strada (3 al flop, 1 al turn, 1 al river). */
  | 'CARTE'
  /** La puntata non chiamata torna a chi l'aveva messa. */
  | 'RESTITUZIONE'
  /** Si scoprono le carte. */
  | 'SHOWDOWN'
  /** Il piatto va a chi ha vinto. */
  | 'ASSEGNAZIONE';

export interface PassoMano {
  indice: number;
  tipo: TipoPasso;
  strada: HandStreetName;
  /** Presente su `AZIONE`. */
  azione?: HandActionView;
  /** Presente su `APERTURA`: ante e bui, nell'ordine in cui sono stati versati. */
  forzate?: HandActionView[];
  /** Presente su `CARTE`: **solo le carte nuove**, non tutto il board. */
  carteNuove?: string[];
  /** Presente su `RESTITUZIONE`. */
  restituzione?: { seat: number; importo: number };
}

export interface SeggioStato {
  seat: number;
  nome: string;
  posizione: string;
  isHero: boolean;
  /** Le fiche che gli restano (stack). */
  chips: number;
  /** Quanto ha messo sul feltro in QUESTA strada, non ancora raccolto. */
  davanti: number;
  attivo: boolean;
  passato: boolean;
  allIn: boolean;
  carte: string[];
  /** Ha appena agito: è l'azione che si sta guardando. */
  diTurno: boolean;
  /**
   * ⚠️ **Deve agire ADESSO** — ed è una cosa diversa da `diTurno`, che dice chi
   * ha *già* agito. Senza questo il replayer sa raccontare una risposta ma non
   * sa mai porre la domanda: chi studia deve poter fermarsi un attimo prima e
   * chiedersi «che cosa faccio qui», che è l'unico momento in cui si impara.
   */
  deveAgire: boolean;
  /** Quanto gli manca per pareggiare la puntata più alta. */
  daPareggiare: number;
  ultimaAzione: { verbo: string; importo: number | null } | null;
  /** Ha vinto, e quanto. Valorizzato solo dopo l'assegnazione. */
  vinto: number | null;
}

export interface StatoTavolo {
  passo: number;
  tipo: TipoPasso;
  strada: HandStreetName;
  /** Le carte comuni **visibili adesso**. */
  board: string[];
  /** Le carte comparse proprio a questo passo: è ciò che va animato. */
  carteNuove: string[];
  /** Il piatto **già raccolto** al centro. Le puntate in corso stanno davanti. */
  pot: number;
  /**
   * La somma di ciò che è sul feltro davanti ai giocatori ed è **ancora in
   * gioco**, cioè che finirà nel piatto se qualcuno lo copre.
   *
   * ⚠️ **Non comprende la puntata non chiamata**, che vive in `daRestituire`:
   * senza quella separazione «piatto + in gioco» tornava a essere il numero
   * gonfiato di prima, proprio nel passo della raccolta.
   */
  inGioco: number;
  /**
   * Le fiche che restano sul feltro solo per tornare indietro: sono già state
   * escluse dal piatto e dal `davanti` di chi le ha messe.
   */
  daRestituire: { seat: number; importo: number } | null;
  seggi: SeggioStato[];
  /** Siamo alla fine della mano. */
  finita: boolean;
  /** La puntata più alta della strada: quanto bisogna pareggiare. */
  daChiamare: number;
  /**
   * Le quote del piatto per chi deve parlare: quanto deve mettere e quale
   * percentuale di equity gli serve perché la chiamata sia in pari.
   * `null` quando non c'è nessuno da far parlare o non c'è niente da chiamare.
   *
   * ⚠️ È il primo numero che un giocatore cerca con gli occhi, e non c'era.
   */
  quote: { daChiamare: number; equityNecessaria: number } | null;
  /**
   * Lo **stack effettivo** fra chi è ancora in gioco: il più piccolo, perché
   * è quello che limita quanto si può davvero vincere o perdere.
   */
  stackEffettivo: number;
  /**
   * Il **rake** trattenuto dalla sala, quando c'è (le mani da torneo non ne
   * hanno; quelle cash sì).
   *
   * ⚠️ Va dichiarato, non nascosto: il piatto sul feltro è **lordo**, mentre chi
   * vince incassa il netto. Senza questo numero il fotogramma finale mostra un
   * piatto che non coincide con la vincita e sembra un errore di conto, quando
   * invece l'errore sarebbe far sparire il rake.
   */
  rake: number;
}

/**
 * Il vocabolario delle azioni, **in una sede sola**.
 *
 * ⚠️⚠️ **PERCHÉ ESISTE.** Le stesse sei azioni erano tradotte in **tre** posti
 * diversi — qui, la mappa del lampo sopra il posto e l'etichetta della linea del
 * tempo — e le tre copie erano già divergenti: quando il titolare ha chiesto di
 * correggere «Bussa» in «Check», quella parola stava in *una* sede e nelle altre
 * due c'era già scritto altro. Una copia che nessuno sa esistere è una copia che
 * nessuno aggiorna.
 *
 * ⚠️ **In inglese, dentro un'interfaccia italiana**, ed è deliberato: check,
 * call, bet, raise, fold e all-in sono il vocabolario che i giocatori italiani
 * usano al tavolo, nei forum e in ogni tracker — «bussa» lo scrive solo chi non
 * gioca. Le **poste** restano invece in italiano: «piccolo buio» e «grande
 * buio» si dicono così anche parlando.
 *
 * ⚠️ Iniziale **maiuscola**: nella riga sotto il tavolo il verbo segue il
 * nickname («BTN Raise a 11 bb»), che è la forma di Hand2Note. Il lampo sopra
 * il posto applica `toUpperCase()` a questi stessi valori invece di tenerne una
 * seconda copia.
 */
export const VERBI_AZIONE = {
  FOLD: 'Fold',
  CHECK: 'Check',
  CALL: 'Call',
  BET: 'Bet',
  RAISE: 'Raise a',
  ALLIN: 'All-in',
  /**
   * ⚠️ Un all-in di **chiamata** non è un all-in di rilancio, e disegnarli
   * uguali cancella la differenza fra chi ha messo la pressione e chi l'ha
   * subita — che è metà del senso della mano.
   */
  ALLIN_CALL: 'Call all-in',
  SB: 'Piccolo buio',
  BB: 'Grande buio',
  ANTE: 'Ante',
} as const satisfies Readonly<Record<string, string>>;

/** Il verbo di un'azione e il suo importo **grezzo**; l'unità la decide chi stampa. */
export function etichettaAzione(a: HandActionView): {
  verbo: string;
  importo: number | null;
} {
  /**
   * ⚠️ **I verbi delle azioni sono in INGLESE, e il resto del sito resta in
   * italiano.** Non è un'incoerenza: check, call, bet, raise, fold e all-in sono
   * il vocabolario che i giocatori italiani usano al tavolo, nei forum e in ogni
   * tracker — «bussa» lo scrive solo chi non gioca. Tradurli allontanava questa
   * pagina dalla lingua di chi la usa, ed era il primo rilievo del titolare.
   */
  switch (a.tipo) {
    case 'FOLD':
      return { verbo: VERBI_AZIONE.FOLD, importo: null };
    case 'CHECK':
      return { verbo: VERBI_AZIONE.CHECK, importo: null };
    case 'CALL':
      return { verbo: VERBI_AZIONE.CALL, importo: a.importo };
    case 'BET':
      return { verbo: VERBI_AZIONE.BET, importo: a.importo };
    /**
     * ⚠️ Rilancio e all-in si citano col **totale della strada**, non con
     * l'incremento: è la convenzione di ogni hand history («raises 22 **to** 23»).
     * Con l'incremento l'etichetta e il gettone della puntata mostravano due
     * numeri veri per la stessa azione, che si legge come un errore di conto.
     */
    case 'RAISE':
      return { verbo: VERBI_AZIONE.RAISE, importo: a.totaleStrada };
    /**
     * ⚠️ **Un all-in di CHIAMATA non è un all-in di rilancio**, e disegnarli
     * uguali cancella la differenza fra chi ha messo la pressione e chi l'ha
     * subita — che è metà del senso della mano. Il tipo di partenza è conservato
     * in `tipoOriginale` proprio per questo: i parser lo scrivono apposta.
     */
    case 'ALLIN':
      return {
        verbo:
          a.tipoOriginale === 'CALL'
            ? VERBI_AZIONE.ALLIN_CALL
            : VERBI_AZIONE.ALLIN,
        importo: a.totaleStrada,
      };
    case 'SB':
      return { verbo: VERBI_AZIONE.SB, importo: a.importo };
    case 'BB':
      return { verbo: VERBI_AZIONE.BB, importo: a.importo };
    case 'ANTE':
      return { verbo: VERBI_AZIONE.ANTE, importo: a.importo };
    default:
      return { verbo: a.tipo.toLowerCase(), importo: null };
  }
}

/**
 * ⚠️ **LA REGOLA DEL PIATTO NON VIVE PIÙ QUI.** C'era, ed era corretta; ma la
 * stessa aritmetica serve anche alla tabella della libreria, e due copie della
 * regola del denaro sono due piatti diversi per la stessa mano il giorno che
 * qualcuno ne corregge una sola. Ora la calcola il server una volta — la sede è
 * `contiDiStrada` in `backend/src/hands/hands.types.ts` — e ogni strada arriva
 * già con `pot` (a inizio strada), `raccolto` e `restituzione`.
 */

/**
 * Tutti i passi del replay, in ordine.
 *
 * ⚠️ **Una strada senza azioni produce comunque i suoi passi** (raccolta e
 * carte): è ciò che fa esistere il run-out di una mano finita all-in, cioè il
 * momento più guardato di uno Spin & Go.
 */
export function passi(m: HandView): PassoMano[] {
  const out: PassoMano[] = [];
  const spingi = (p: Omit<PassoMano, 'indice'>) =>
    out.push({ ...p, indice: out.length });

  const strade = m.streets ?? [];
  if (!strade.length) return out;

  // ── Ante, poi bui ───────────────────────────────────────────────────
  const preflop = strade[0];
  const ante = preflop.azioni.filter((a) => a.tipo === 'ANTE');
  if (ante.length) {
    spingi({ tipo: 'ANTE', strada: preflop.strada, forzate: ante });
  }
  spingi({
    tipo: 'APERTURA',
    strada: preflop.strada,
    forzate: preflop.azioni.filter(
      (a) => AZIONI_FORZATE.has(a.tipo) && a.tipo !== 'ANTE',
    ),
  });

  /**
   * Chiude una strada: le fiche pareggiate vanno nel piatto e l'eventuale
   * eccedenza torna a chi l'ha messa.
   *
   * ⚠️ **La restituzione va emessa a OGNI strada, non solo all'ultima.** Il
   * primo giro la calcolava solo in chiusura di mano, e in una mano finita
   * all-in preflop l'ultima strada è il river — che di azioni non ne ha
   * nessuna. Risultato: l'eccedenza dell'all-in per meno non tornava **mai**,
   * e chi copriva l'avversario finiva la mano con zero fiche invece che con le
   * sue. Tre mani del corpus lo mostravano come «fiche non conservate».
   */
  const chiudi = (s: (typeof strade)[number]) => {
    // ⚠️ Niente raccolta se non c'è niente da raccogliere: una strada passata a
    // bussare non muove una fiche, e un passo in cui non cambia nulla si legge
    // come un comando che non ha funzionato.
    if (s.raccolto > 0 || s.restituzione) {
      spingi({ tipo: 'RACCOLTA', strada: s.strada });
    }
    if (s.restituzione) {
      spingi({
        tipo: 'RESTITUZIONE',
        strada: s.strada,
        restituzione: s.restituzione,
      });
    }
  };

  let precedente: string[] = [];
  for (let i = 0; i < strade.length; i++) {
    const s = strade[i];

    if (i > 0) {
      // ⚠️ Prima si chiude la strada precedente, poi escono le carte: è
      // l'ordine del tavolo, ed è anche l'ordine che rende leggibile
      // l'animazione (le fiche liberano il centro prima che ci arrivi una carta).
      chiudi(strade[i - 1]);
      const nuove = (s.board ?? []).slice(precedente.length);
      if (nuove.length) {
        spingi({ tipo: 'CARTE', strada: s.strada, carteNuove: nuove });
      }
    }
    if (s.board?.length) precedente = s.board;

    for (const a of s.azioni) {
      if (AZIONI_FORZATE.has(a.tipo)) continue; // già nell'apertura
      spingi({ tipo: 'AZIONE', strada: s.strada, azione: a });
    }
  }

  // ── Chiusura ────────────────────────────────────────────────────────
  const ultima = strade[strade.length - 1];
  chiudi(ultima);
  /**
   * ⚠️ Lo showdown è un passo **solo se qualcuno ha davvero mostrato le carte**:
   * una mano vinta perché tutti hanno passato non ha showdown, e fingerlo
   * insegnerebbe una cosa falsa — oltre a scoprire carte che al tavolo nessuno
   * ha visto.
   *
   * ⚠️ **La domanda si fa ai GIOCATORI, non a `risultati`.** I due parser
   * costruiscono `risultati` filtrando `vinto > 0`, cioè contiene i soli
   * **vincitori**: chiedendo lì «chi ha mostrato» le carte di chi ha perso lo
   * showdown non si scoprivano mai — e sono metà dell'informazione, perché è
   * confrontando le due mani che si capisce se la chiamata era buona. Le carte
   * di un avversario compaiono in `players[].carte` **se e solo se** erano
   * visibili al tavolo, quindi la loro semplice presenza È la prova dello
   * showdown.
   */
  const haPassato = new Set(
    strade.flatMap((s) => s.azioni.filter((a) => a.tipo === 'FOLD').map((a) => a.seat)),
  );
  if (
    (m.players ?? []).some((p) => !p.isHero && p.carte?.length && !haPassato.has(p.seat))
  ) {
    spingi({ tipo: 'SHOWDOWN', strada: ultima.strada });
  }
  spingi({ tipo: 'ASSEGNAZIONE', strada: ultima.strada });

  return out;
}

/**
 * ⚠️ **QUESTA È LA REGOLA PEDAGOGICA DELLA SEZIONE, non un dettaglio.**
 *
 * Le carte dell'eroe si vedono dall'inizio; quelle degli avversari **solo allo
 * showdown**, e solo di chi le ha davvero mostrate. Un replayer che scopre la
 * mano del villain alla prima strada non insegna niente: chi guarda smette di
 * chiedersi «che cosa faccio qui» e comincia a valutare la decisione sapendo la
 * risposta, che è il modo più rapido per imparare male.
 *
 * Il ripiego `mostraTutto` esiste perché a volte si rivede *sapendo già com'è
 * finita* — ma è una scelta esplicita di chi guarda, mai il valore predefinito.
 */
export function carteVisibili(
  p: HandPlayerView,
  mostrate: boolean,
  mostraTutto: boolean,
): string[] {
  if (!p.carte?.length) return [];
  if (p.isHero) return p.carte;
  if (mostraTutto) return p.carte;
  return mostrate ? p.carte : [];
}

/**
 * Lo stato del tavolo **dopo** `passo` eventi. `passo = 0` è l'apertura: carte
 * distribuite, ante e bui già sul feltro.
 *
 * ⚠️ **Il piatto mostrato è quello RACCOLTO**, e le puntate in corso restano
 * davanti a chi le ha fatte. È come sta un tavolo vero, ed è la ragione per cui
 * la raccolta di fine strada è un momento visibile invece che un salto del
 * numero. Il totale «se tutti chiamano» è `pot + inGioco`.
 */
export function statoAlPasso(
  m: HandView,
  passo: number,
  mostraTutto = false,
  sequenza?: readonly PassoMano[],
): StatoTavolo {
  const seq = sequenza ?? passi(m);
  const n = Math.max(0, Math.min(passo, Math.max(0, seq.length - 1)));
  const corrente = seq[n];
  const fatti = seq.slice(0, n + 1);

  const strade = m.streets ?? [];

  const versato = new Map<number, number>(); // tutto ciò che è uscito dallo stack
  const davanti = new Map<number, number>();
  const passato = new Set<number>();
  const ultima = new Map<number, { verbo: string; importo: number | null }>();
  const vinto = new Map<number, number>();
  let pot = 0;
  let board: string[] = [];
  let mostrate = false;
  let daRestituire: { seat: number; importo: number } | null = null;

  for (const p of fatti) {
    switch (p.tipo) {
      case 'ANTE':
        for (const a of p.forzate ?? []) {
          versato.set(a.seat, (versato.get(a.seat) ?? 0) + a.importo);
          // L'ante va **dritta nel piatto**: non sosta davanti al giocatore, o
          // chi ha il grande buio sembrerebbe averne messo più di quanto ha
          // puntato. Ciò che si vede muoversi è il volo, non una pila che resta.
          pot += a.importo;
        }
        break;

      case 'APERTURA':
        for (const a of p.forzate ?? []) {
          versato.set(a.seat, (versato.get(a.seat) ?? 0) + a.importo);
          // L'ante va dritta nel piatto: non sta davanti al giocatore, o chi ha
          // il grande buio sembrerebbe averne messo più di quanto ha puntato.
          if (a.tipo === 'ANTE') pot += a.importo;
          else davanti.set(a.seat, a.totaleStrada);
          ultima.set(a.seat, etichettaAzione(a));
        }
        break;

      case 'AZIONE': {
        const a = p.azione as HandActionView;
        versato.set(a.seat, (versato.get(a.seat) ?? 0) + a.importo);
        if (a.tipo === 'FOLD') passato.add(a.seat);
        else davanti.set(a.seat, a.totaleStrada);
        ultima.set(a.seat, etichettaAzione(a));
        break;
      }

      case 'RACCOLTA': {
        const s = strade.find((x) => x.strada === p.strada);
        davanti.clear();
        if (s) {
          // ⚠️ Si somma il **raccolto** della strada, non ciò che c'era davanti:
          // davanti contiene anche l'eventuale eccedenza non chiamata, che nel
          // piatto non entra mai. È qui che si ripara il piatto gonfiato.
          pot += s.raccolto;
          // ⚠️ L'eccedenza **resta sul feltro** davanti a chi l'ha messa, e se ne
          // va col passo successivo: è esattamente il gesto del tavolo — il
          // mazziere spinge dentro le fiche pareggiate e lascia fuori quelle che
          // nessuno ha coperto, poi gliele ridà. Ma sta in un campo SUO, non in
          // `davanti`: non è più «in gioco», è già decisa.
          daRestituire = s.restituzione;
        }
        ultima.clear(); // le etichette appartengono alla strada che si chiude
        break;
      }

      case 'RESTITUZIONE': {
        const r = p.restituzione as { seat: number; importo: number };
        // Torna nello stack: è denaro che non è mai stato davvero in gioco.
        versato.set(r.seat, (versato.get(r.seat) ?? 0) - r.importo);
        daRestituire = null;
        break;
      }

      case 'SHOWDOWN':
        mostrate = true;
        break;

      case 'ASSEGNAZIONE':
        for (const r of m.risultati ?? []) vinto.set(r.seat, r.vinto);
        break;

      case 'CARTE':
      default:
        break;
    }

    // Il board visibile è quello della strada raggiunta.
    const s = strade.find((x) => x.strada === p.strada);
    if (s?.board?.length) board = s.board;
  }

  const finita = n >= seq.length - 1;
  const inGioco = [...davanti.values()].reduce((a, b) => a + b, 0);
  const daChiamare = davanti.size ? Math.max(...davanti.values()) : 0;

  /**
   * Chi parla adesso è chi compie l'azione **successiva**: si legge in avanti
   * nella sequenza. È così che il replay può fermarsi *prima* di una decisione
   * invece che solo dopo.
   */
  const prossimo =
    seq[n + 1]?.tipo === 'AZIONE' ? (seq[n + 1].azione?.seat ?? null) : null;

  const seggi: SeggioStato[] = (m.players ?? []).map((p) => {
    const fuori = versato.get(p.seat) ?? 0;
    const premio = vinto.get(p.seat) ?? 0;
    const chips = Math.max(0, p.chipsIniziali - fuori) + premio;
    // Vedi il commento sullo showdown: la presenza delle carte nei dati è la
    // prova che al tavolo si sono viste, e vale per chi ha perso quanto per chi
    // ha vinto.
    const haMostrato = mostrate && Boolean(p.carte?.length);
    return {
      seat: p.seat,
      nome: p.nome,
      posizione: p.posizione,
      isHero: p.isHero,
      chips,
      davanti: davanti.get(p.seat) ?? 0,
      attivo: !passato.has(p.seat),
      passato: passato.has(p.seat),
      /**
       * ⚠️ All-in anche quando le fiche finiscono senza che il formato l'abbia
       * detto: nei resoconti iPoker un rilancio che esaurisce lo stack resta
       * `RAISE`. Ma **mai dopo la restituzione**: chi ha rilanciato senza essere
       * chiamato riprende tutto, e chiamarlo all-in era la bugia più visibile
       * della versione precedente.
       */
      allIn: !passato.has(p.seat) && chips <= 0 && fuori > 0,
      carte: carteVisibili(p, haMostrato, mostraTutto),
      diTurno: corrente?.tipo === 'AZIONE' && corrente.azione?.seat === p.seat,
      deveAgire: prossimo === p.seat,
      daPareggiare: Math.max(0, daChiamare - (davanti.get(p.seat) ?? 0)),
      ultimaAzione: ultima.get(p.seat) ?? null,
      vinto: premio || null,
    };
  });

  const chiParla = seggi.find((s) => s.deveAgire);
  const quote =
    chiParla && chiParla.daPareggiare > 0
      ? {
          daChiamare: chiParla.daPareggiare,
          // Le quote del piatto: quanto si mette diviso quanto si porta a casa
          // se si vince — cioè la fetta di volte in cui bisogna avere ragione.
          equityNecessaria:
            chiParla.daPareggiare / (pot + inGioco + chiParla.daPareggiare),
        }
      : null;

  const inPiedi = seggi.filter((s) => s.attivo);
  const stackEffettivo = inPiedi.length
    ? Math.min(...inPiedi.map((s) => s.chips + s.davanti))
    : 0;

  return {
    passo: n,
    tipo: corrente?.tipo ?? 'APERTURA',
    strada: corrente?.strada ?? 'PREFLOP',
    board,
    carteNuove: corrente?.tipo === 'CARTE' ? (corrente.carteNuove ?? []) : [],
    pot,
    inGioco,
    daRestituire,
    seggi,
    finita,
    daChiamare,
    quote,
    stackEffettivo,
    rake: finita ? (m.rake ?? 0) : 0,
  };
}

/**
 * Le posizioni dei posti sull'ovale, in percentuale.
 *
 * ⚠️ **L'eroe sta SEMPRE in basso al centro**, e gli altri gli ruotano intorno
 * mantenendo l'ordine reale del tavolo. È la convenzione di ogni replayer
 * esistente, e non è un vezzo: chi guarda deve riconoscere «io» senza cercarlo,
 * e la posizione relativa degli avversari (chi parla prima, chi dopo) resta
 * quella vera solo se si ruota invece di riordinare.
 *
 * Senza eroe — una mano osservata — si parte dal primo seggio, che è arbitrario
 * ma stabile.
 */

/**
 * Da che lato la scatola del posto è appesa alla sua ancora: `0` a sinistra,
 * `1` a destra, `0.5` centrata. Serve al `translate` del CSS.
 */
export function latoDelPosto(x: number): 0 | 0.5 | 1 {
  return x < 25 ? 0 : x > 75 ? 1 : 0.5;
}

/**
 * Lo stesso, in verticale: `0` appeso in alto, `1` appeso in basso, `0.5`
 * centrato.
 *
 * ⚠️ Serve quanto quello orizzontale, e la prima stesura l'aveva dimenticato:
 * l'ancora dell'eroe sta a y = 86 e la sua scatola è alta un terzo del tavolo,
 * quindi centrata su quell'ancora arrivava a **102,6%** — misurato a 390px, mezza
 * targa fuori dal tavolo. Appesa dal basso finisce esattamente sull'ancora.
 */
export function latoVerticale(y: number): 0 | 0.5 | 1 {
  return y < 25 ? 0 : y > 75 ? 1 : 0.5;
}

/**
 * Da che parte del tavolo sta un posto, e quindi **da che lato della sua scatola
 * vanno appoggiate le fiche puntate**.
 *
 * ⚠️⚠️ **QUESTA FUNZIONE NON CALCOLA UN PUNTO, ED È LA CORREZIONE DI UN GIRO
 * SBAGLIATO (26/08/2026).** La prima stesura metteva le fiche a una coordinata
 * calcolata in percentuale — «cammina dal centro verso il posto finché non sei
 * fuori dall'ellisse del board» — e le misure su un tavolo vero l'hanno bocciata
 * a ogni viewport: le pile finivano **sulle targhe** (1.353 px² a 1280px) e
 * **sul board** (741 px² a 844×390). La ragione è che quel calcolo ha bisogno
 * dell'altezza della scatola di un posto, che dipende da `clamp()` con estremi
 * in `rem` e quindi **non è nota in TypeScript**: a 1280px la scatola è alta il
 * 15,3% del tavolo, su un telefono in orizzontale il 26,7%. Ogni costante
 * scelta a tavolino è giusta per una misura e sbagliata per l'altra.
 *
 * La sede giusta è il CSS, che la scatola ce l'ha davanti: le fiche sono
 * **figlie del posto**, appoggiate al suo bordo interno (`left: calc(100% + …)`
 * e simili). Qui si decide soltanto *quale* bordo — un'informazione che dipende
 * dalle ancore e non dai pixel, quindi è pura e sta con le altre.
 */
export type LatoDelTavolo = 'sinistra' | 'destra' | 'alto' | 'basso';

/**
 * Da che lato vanno le fiche puntate sul tavolo **rettangolare** (telefono in
 * orizzontale, ancore sul superellisse).
 *
 * ⚠️⚠️ **NON è `latoDelleFiche` con altri numeri: è un'altra regola.** Quella
 * decide a **fasce** (prima sopra/sotto, poi sinistra/destra) e su un ovale
 * funziona; su un rettangolo largo produce un bug vero, segnalato dal titolare:
 * il posto in basso a destra (94, 84) cade nella fascia «basso», e la regola
 * «basso ⇒ fiche di lato a destra» le spingeva **fuori dal feltro**, oltre il
 * bordo dello schermo — con tanto di scorrimento orizzontale della pagina.
 *
 * Qui il lato si sceglie **puntando al centro**: si confronta di quanto il posto
 * è spostato in orizzontale con quanto lo è in verticale, e le fiche vanno nella
 * direzione in cui il centro è più lontano. Per costruzione non possono mai
 * uscire dal tavolo, per nessuna posizione e nessun numero di giocatori.
 *
 * ⚠️ Il confronto pesa la verticale (×1,6) perché il tavolo è largo circa tre
 * volte l'altezza: senza, ogni posto sceglierebbe l'orizzontale e i due centrali
 * (eroe in basso, avversario in alto) manderebbero le fiche di traverso invece
 * che verso il piatto, che è sopra o sotto di loro.
 */
export function latoFicheQuadro(x: number, y: number): LatoDelTavolo {
  /**
   * ⚠️⚠️ **SEMPRE DI LATO, MAI SOPRA O SOTTO**, e le due ragioni sono state
   * misurate entrambe:
   *
   * - **sotto/sopra la targa** ci sono le carte del giocatore e, per chi sta in
   *   mezzo, il board: mettendo le fiche in verticale si sovrapponevano
   *   (fino a 386 px² su un feltro da 740×360);
   * - **di lato** lo spazio c'è sempre, perché il tavolo ora è largo tre volte
   *   la sua altezza.
   *
   * Quale lato: quello che punta al **centro**, così le fiche non escono mai dal
   * feltro. Per i posti sulla colonna centrale (dove «verso il centro» in
   * orizzontale non vuol dire niente) si sceglie in base all'altezza: quello in
   * basso manda a destra, quello in alto a sinistra — sfalsati, o in heads-up si
   * guarderebbero in faccia sulla stessa colonna.
   */
  const SOGLIA_COLONNA = 8;
  if (Math.abs(x - 50) > SOGLIA_COLONNA) return x < 50 ? 'sinistra' : 'destra';
  return y < 50 ? 'destra' : 'sinistra';
}

export function latoDelleFiche(x: number, y: number): LatoDelTavolo {
  /**
   * ⚠️ **Il verso VERTICALE ha la precedenza, e vale anche per gli angoli.** La
   * prima stesura guardava prima l'orizzontale, e a sei giocatori le fiche del
   * posto in alto a sinistra (ancora 18/18) finivano **sulla targa** di quello in
   * alto al centro: 540 px² a 1280px, misurati. La scatola è larga un quinto del
   * tavolo, quindi a un posto d'angolo lo spazio libero non sta di fianco — dove
   * c'è il vicino — ma **sotto**, verso il centro. Con questa regola i sei posti
   * escono puliti a tutte e due le misure provate.
   */
  const sopraOSotto = latoVerticale(y);
  if (sopraOSotto !== 0.5) return sopraOSotto === 0 ? 'alto' : 'basso';
  const anc = latoDelPosto(x);
  if (anc === 0) return 'sinistra';
  if (anc === 1) return 'destra';
  // Un posto al centro esatto non esiste in nessuna tabella di ancore, ma un
  // dato inatteso non deve produrre un valore che il CSS non aggancia — meglio
  // il basso, che è dove sta l'eroe.
  return 'basso';
}

/**
 * I raggi dell'ellisse su cui siedono i giocatori, in percentuale del tavolo.
 *
 * ⚠️⚠️ **QUI C'ERANO OTTO TABELLE SCRITTE A MANO, UNA PER OGNI NUMERO DI
 * GIOCATORI, e sono state tolte.** Il feltro è un'**ellisse**
 * (`.rp__feltro { border-radius: 50% }`) dentro un riquadro 16:10, ma quelle
 * ancore erano tarate a occhio sul **rettangolo**: due geometrie diverse,
 * quindi nessuna riga era provabilmente sul bordo e ciascuna andava
 * ricontrollata a mano. Il titolare l'ha visto subito — «i giocatori dovrebbero
 * stare sul margine del tavolo, non schiacciati al centro».
 *
 * Con una sola formula ogni posto è sull'ellisse **per costruzione**, per ogni
 * `n` presente e futuro, e sparisce anche il ramo separato che serviva oltre i
 * nove giocatori.
 *
 * ⚠️ I raggi sono minori di 50 di proposito: le targhe **sporgono verso
 * l'interno** dall'ancora (vedi `latoDelPosto`/`latoVerticale`), quindi un
 * raggio a filo del bordo le farebbe rientrare sul feltro comunque — ma un
 * raggio *oltre* il bordo le porterebbe fuori dall'ovale, su un angolo del
 * riquadro dove non c'è tavolo.
 */
const RAGGIO_X = 46;
const RAGGIO_Y = 42;

/**
 * I raggi e l'esponente del **superellisse**, cioè le ancore per il tavolo
 * RETTANGOLARE del telefono in orizzontale.
 *
 * ⚠️⚠️ **PERCHÉ SERVE UNA SECONDA GEOMETRIA.** Da quando il feltro mobile è un
 * rettangolo largo quanto lo schermo (~3:1), un'ellisse ci sta dentro male: i
 * quattro angoli restano vuoti e i posti si stringono verso il centro. Il
 * titolare l'ha visto su una mano 5-max — due giocatori accalcati in alto al
 * centro mentre gli altri due erano ai lati — e ha chiesto di portarli «ai
 * lati come Tokyo22 e Hitant».
 *
 * Un **superellisse** (|x/a|^p + |y/b|^p = 1) con p alto è la stessa curva
 * chiusa dell'ellisse, ma tesa verso gli angoli: i posti scivolano lungo i lati
 * lunghi invece di restare sull'arco. Misurato a 5 giocatori: i due posti alti
 * passano da (23,16) e (77,16) a **(12,9) e (88,9)**. A sei, quello in alto al
 * centro sale da y=8 a y=5, cioè ~10px su un feltro da 286 — l'altra richiesta
 * del titolare, ottenuta dalla stessa formula invece che da un caso a parte.
 *
 * ⚠️ **NON sostituisce l'ellisse, la affianca.** Su desktop il feltro è ancora
 * un ovale (`border-radius: 50%`) e questi punti cadrebbero **fuori** dal
 * verde. Ogni posto porta entrambe le coppie di coordinate; a scegliere è il
 * CSS, che sa qual è la forma perché è lui a disegnarla — nessun `matchMedia`,
 * nessun listener da ripulire in zoneless.
 */
const RAGGIO_SQ_X = 47;
const RAGGIO_SQ_Y = 45;
const ESPONENTE_SQ = 5;

/** Il segno di `v` per il modulo elevato: tiene il quadrante e tende all'angolo. */
function potenza(v: number): number {
  return Math.sign(v) * Math.pow(Math.abs(v), 2 / ESPONENTE_SQ);
}

/**
 * Un posto al tavolo, con **due** coordinate: `x`/`y` sull'ellisse (desktop) e
 * `sx`/`sy` sul superellisse (telefono in orizzontale, feltro rettangolare).
 */
export interface PostoAlTavolo {
  x: number;
  y: number;
  sx: number;
  sy: number;
}

export function postiSullOvale(
  seggi: readonly { seat: number; isHero: boolean }[],
): Map<number, PostoAlTavolo> {
  const n = seggi.length;
  const out = new Map<number, PostoAlTavolo>();
  if (!n) return out;

  const iEroe = Math.max(
    0,
    seggi.findIndex((s) => s.isHero),
  );
  for (let k = 0; k < n; k++) {
    const s = seggi[(iEroe + k) % n];
    // k = 0 è l'eroe e cade a 90°, cioè **in basso al centro**: si guarda la
    // mano dal proprio posto, come in ogni client e in Hand2Note. I successivi
    // proseguono verso sinistra, che è l'ordine che le vecchie tabelle avevano.
    const ang = Math.PI / 2 + (k * 2 * Math.PI) / n;
    out.set(s.seat, {
      x: 50 + RAGGIO_X * Math.cos(ang),
      y: 50 + RAGGIO_Y * Math.sin(ang),
      sx: 50 + RAGGIO_SQ_X * potenza(Math.cos(ang)),
      sy: 50 + RAGGIO_SQ_Y * potenza(Math.sin(ang)),
    });
  }
  return out;
}
