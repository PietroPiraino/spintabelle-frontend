import { DrillDifficulty, DrillSpotType } from '../../core/models/api.models';

/**
 * I percorsi di allenamento: configurazioni pronte, un clic e si parte.
 *
 * ⚠️ REGOLA ARCHITETTURALE PORTANTE — un percorso NON è un campo nuovo del
 * payload. Far partire un percorso **scrive i sei signal che il configuratore
 * ha già** e poi chiama lo `start()` di sempre. Conseguenze, tutte volute:
 * `DrillConfigPayload` non guadagna una riga, `configSummary` continua a
 * leggere gli snapshot storici, il pulsante «Ripeti» funziona senza sapere che
 * i percorsi esistono, e aprendo «Personalizza» subito dopo si vede
 * esattamente che cosa ha fatto il percorso — che è anche il modo in cui uno
 * studente impara a comporsi il proprio.
 *
 * ⚠️ Formato e durata NON stanno qui: li decide il contesto della pagina, in
 * cima. Un percorso dice *che cosa* si allena, non *dove* e non *per quanto* —
 * altrimenti «Difesa dal big blind» sarebbe sei percorsi diversi, uno per
 * formato.
 */
export interface Percorso {
  id: string;
  titolo: string;
  /**
   * Perché vale la pena. Compare solo sulla card in evidenza: sulle righe
   * compatte sarebbe rumore, e la riga di dettaglio dice già che cosa parte.
   */
  perche: string;
  /** Estremi in bb (valori MOSTRATI, ante già tolta). Assenti = tutte. */
  minBb?: number;
  maxBb?: number;
  /** Vuoto/assente = tutte, esattamente come nel payload. */
  positions?: readonly string[];
  spotTypes?: readonly DrillSpotType[];
  difficulty?: DrillDifficulty;
  /**
   * Il percorso si costruisce sullo STORICO dell'utente, non su questi campi:
   * formato e profondità arrivano da `worstBuckets`, e con essi la riga di
   * dettaglio. È l'unico che ignora il formato scelto nel contesto — e lo
   * dichiara, nominando il formato vero nella propria riga.
   */
  datiUtente?: boolean;
}

/**
 * ⚠️ Il PRIMO è quello in evidenza. L'ordine è editoriale e non calcolato: è la
 * risposta alla domanda «da dove comincio», che in uno Spin & Go ha una risposta
 * sola — le decisioni a stack corto, perché sono quelle che ricorrono di più.
 *
 * ⚠️ NIENTE «Le mani al fotofinish» (`difficulty: MARGINAL`), tolta il
 * 04/09/2026: nell'elenco si leggeva come un doppione di «Allenamento misto»,
 * perché il conteggio accanto era lo STESSO — `matchedCount` conta
 * combinazioni e la difficoltà filtra le mani DENTRO ogni combinazione, non le
 * combinazioni. La difficoltà resta dove serve, cioè fra i comandi del
 * costruttore.
 *
 * ⚠️ Nessun percorso nomina una sala, un bonus o una cifra: questa pagina è
 * pubblica e prerenderizzata, e anche se il ramo anonimo non li mostra, una
 * stringa che vive nel bundle è una stringa che prima o poi qualcuno rende
 * (art. 9 DL 87/2018, la regola di /negozio e /affiliazioni).
 */
export const PERCORSI: readonly Percorso[] = [
  {
    id: 'push-fold',
    titolo: 'Push or fold sotto i 10 bb',
    perche:
      "Sotto i dieci big blind quasi ogni mano si riduce a due scelte: all-in o fold. È la decisione che in uno Spin & Go ricorre più di ogni altra, ed è anche quella in cui un errore costa subito.",
    maxBb: 10,
  },
  {
    id: 'difesa-bb',
    titolo: 'Difesa dal big blind',
    perche:
      'Il big blind ha già messo dei soldi nel piatto, e quasi tutti lo difendono male: chi troppo poco per paura di giocare fuori posizione, chi troppo perché «tanto ci sono già dentro».',
    positions: ['BB'],
    spotTypes: ['VS_OPEN', 'LIMPED'],
  },
  {
    id: 'apertura',
    titolo: 'Aprire il piatto',
    perche:
      "La prima decisione della mano, e l'unica che si prende senza informazioni. Da qui dipende tutto quello che viene dopo.",
    spotTypes: ['OPEN'],
  },
  {
    id: 'vs-3bet',
    titolo: 'Rispondere al 3-bet',
    perche:
      'Hai aperto e ti hanno rilanciato. È lo spot in cui si buttano via più fiche per orgoglio, e quello in cui la soluzione è meno intuitiva.',
    spotTypes: ['VS_3BET'],
  },
  {
    id: 'misto',
    titolo: 'Allenamento misto',
    perche:
      'Tutto quello che il formato scelto contiene, senza filtri. È il ripasso, non la lezione.',
  },
  {
    id: 'peggiori',
    titolo: 'Le tue situazioni peggiori',
    perche:
      'Le cinque combinazioni in cui, sul tuo storico, perdi più EV. Non è un percorso che abbiamo scelto noi: lo hai scritto tu rispondendo.',
    datiUtente: true,
  },
] as const;

/**
 * Ripulisce ciò che arriva da `worstBuckets` prima di comporre il payload.
 *
 * ⚠️ NON è prudenza generica: `bucketKey` sostituisce ogni `.` con `,` (il
 * punto è il separatore di path in Mongo), e `getStats` ricade sulla chiave
 * quando i campi `format`/`depthLabel` non sono sul documento — cosa vera per
 * ogni riga scritta prima che quei due `$set` esistessero. Dal ripiego escono
 * `"10,17"` e `"spin_ante_2,5x_nolimp"`, che i DTO rifiutano **entrambi**:
 * `DEPTH_RE` vuole il punto decimale e `PREFLOP_FORMAT_PATTERN` pure.
 *
 * Il fallimento sarebbe il peggiore possibile: 400 sull'intera chiamata, per
 * un array che l'utente non ha mai visto, sulla schermata del runner — cioè
 * dopo un cambio di rotta rispetto al punto in cui ha premuto.
 *
 * ⚠️ Le due espressioni sono lo SPECCHIO di quelle del backend
 * (`start-session.dto.ts` e `preflop.types.ts`): due copie, due repo, nessuna
 * guardia che le confronti. Se una delle due cambia, questa va cambiata a mano.
 */
export function bucketSano(b: {
  format: string;
  depthLabel: string;
}): boolean {
  return (
    /^(spin|husng)(_asymmetric)?(_ante)?(_\d+(\.\d+)?x_nolimp)?$/.test(
      b.format,
    ) && /^\d{1,3}(\.\d{1,3})?$/.test(b.depthLabel)
  );
}

/**
 * La riga di dettaglio di un percorso, generata e mai scritta a mano.
 * Es. «da 1 a 10 bb · tutte le posizioni · 104 situazioni».
 *
 * ⚠️ Scritta a mano diventerebbe falsa il giorno in cui l'import cambia i dati,
 * e nessuno se ne accorgerebbe: è una stringa, non un'asserzione.
 */
export function dettaglioPercorso(
  p: Percorso,
  opts: {
    /** Etichette leggibili delle posizioni scelte (vuoto = tutte). */
    posizioni: readonly string[];
    /** Etichette leggibili dei tipi di situazione (vuoto = tutte). */
    situazioni: readonly string[];
    /** Estremi realmente disponibili, in bb mostrati. */
    minDisponibile: number;
    maxDisponibile: number;
  },
): string {
  const parti: string[] = [];

  const min = p.minBb ?? opts.minDisponibile;
  const max = p.maxBb ?? opts.maxDisponibile;
  if (p.minBb === undefined && p.maxBb === undefined) {
    parti.push('tutte le profondità');
  } else if (p.minBb === undefined) {
    parti.push(`fino a ${formattaBb(max)} bb`);
  } else if (p.maxBb === undefined) {
    parti.push(`da ${formattaBb(min)} bb in su`);
  } else {
    parti.push(`da ${formattaBb(min)} a ${formattaBb(max)} bb`);
  }

  parti.push(
    opts.posizioni.length ? opts.posizioni.join(', ') : 'tutte le posizioni',
  );
  if (opts.situazioni.length) parti.push(opts.situazioni.join(', '));
  if (p.difficulty === 'MARGINAL') parti.push('solo i mix al fotofinish');
  if (p.difficulty === 'MIXED_ONLY') parti.push('solo strategie miste');

  return parti.join(' · ');
}

/** «10,5» e non «10.5»: è la virgola decimale italiana, come in `formatBb`. */
function formattaBb(v: number): string {
  return String(Math.round(v * 100) / 100).replace('.', ',');
}
