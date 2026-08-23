// «Per approfondire»: da un articolo alle guide — SORGENTE CANONICA.
//
// PERCHÉ ESISTE. Il flusso di news serve alla ricerca solo se irrora le pagine
// che possono davvero posizionarsi, e quelle sono le dieci guide evergreen. Al
// 23/08/2026, misurato sugli otto articoli pubblicati, i link interni erano
// **zero**: uno solo in tutto l'archivio, e andava a YouTube. Un articolo di
// cronaca su un dominio nuovo non batterà mai le testate di settore sulla sua
// notizia; ciò che può fare è passare scansione e autorevolezza interna alle
// guide, e dare al lettore il passo successivo.
//
// ⚠️ IL BLOCCO NON STA NEL `body`, E NON È UNA SVISTA. Il disclaimer di §4.9 lo
// appende lo stadio 6 *dentro* il corpo, perché è contenuto editoriale e deve
// far parte della stringa su cui il cancello asserisce (`news.constants.ts`).
// Questo no: è navigazione, come il blocco di condivisione, e per tre ragioni
// che il corpo non può dare.
//   1. **Retroattività.** Reso a valle, compare sugli articoli GIÀ pubblicati e
//      su tutto l'archivio futuro. Scritto nel corpo, coprirebbe solo i pezzi
//      generati dopo il deploy.
//   2. **Una guida nuova entra anche nei pezzi vecchi.** Nel corpo il link è
//      congelato al giorno della generazione.
//   3. **Niente sesta lista tenuta a mano, per giunta FRA DUE REPO.** La mappa
//      vive qui, accanto a `guides.data.ts`, e uno slug inesistente non è
//      deployabile: lo ferma `guide-links.spec.ts`. Con la mappa nel backend un
//      rinomino avrebbe prodotto link a `/guide/<slug>/` che rispondono **404
//      vero** (`PrerenderFallback.None`) su tutto l'archivio, in silenzio.
//
// ⚠️ ESISTE UNA COPIA: `functions/lib/guide-links.mjs`. La Function dell'edge e
// l'app sono due build diverse e non possono importarsi a vicenda (stessa
// ragione di `functions/lib/markdown.mjs` e dei glifi di condivisione). Le due
// stesure della pagina si **sostituiscono**: se il blocco esistesse solo qui
// sparirebbe per chi non esegue il JavaScript e per ogni motore; solo là,
// sparirebbe all'idratazione. A tenerle allineate è
// `scripts/lib/guide-links.test.mjs`, che confronta i due letterali. Se cambi
// qualcosa qui, cambialo lì — o il test te lo dice.

import { NewsCategory } from '../../core/models/api.models';

/** Una guida da proporre in coda a un articolo. */
export interface GuidaCorrelata {
  slug: string;
  /** Testo del collegamento: è il `titolo` della guida, non un'etichetta nuova. */
  titolo: string;
}

/**
 * Quante se ne propongono al massimo. ⚠️ Il tetto non è estetico: un blocco di
 * link identico in coda a ogni articolo è boilerplate, e i moduli di link
 * ripetuti valgono meno di un collegamento che cambia col pezzo. La variazione
 * per articolo è metà del valore di tutto il meccanismo.
 */
export const MAX_GUIDE = 2;

/**
 * Testo confrontabile: minuscole, diacritici staccati, tutto ciò che non è
 * lettera o cifra ridotto a spazio singolo.
 *
 * ⚠️ È anche ciò che rende il confronto **per parola intera** senza espressioni
 * regolari: con gli spazi normalizzati, cercare ` icm ` dentro ` … ` non può
 * agganciare «icmizzare». E come effetto collaterale voluto smonta il Markdown
 * (`##`, `**`, `[]()`), quindi una parola in grassetto aggancia come una nuda.
 */
export function normalizzaTesto(valore: string | null | undefined): string {
  return String(valore ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Parola intera dentro un testo già normalizzato. */
function contiene(testo: string, parola: string): boolean {
  if (!testo || !parola) return false;
  return ` ${testo} `.includes(` ${parola} `);
}

/**
 * Le dieci guide con le parole che le agganciano.
 *
 * ⚠️ LE PAROLE SONO SPECIFICHE DI PROPOSITO. La tentazione è mettere «spin go»
 * sulla guida introduttiva: aggancerebbe **ogni** articolo di questo sito, cioè
 * riporterebbe esattamente il boilerplate che il tetto di due serve a evitare.
 * Il caso generico lo copre il ripiego per categoria, qui sotto.
 *
 * ⚠️ NIENTE STEMMING: «errore» ed «errori» sono due voci. Un troncamento
 * aggancerebbe parole che non c'entrano, e questo elenco si legge a occhio.
 *
 * ⚠️ `titolo` è duplicato da `guides.data.ts` e NON va scritto a mano diverso:
 * serve alla copia dell'edge, che `GUIDE` non può importarlo. Che i dieci
 * combacino lo verifica `guide-links.spec.ts`.
 */
export const GUIDE_CORRELABILI: readonly {
  slug: string;
  titolo: string;
  parole: readonly string[];
}[] = [
  {
    slug: 'come-giocare-spin-and-go',
    titolo: 'Come giocare gli Spin & Go: guida al 3-max hyper turbo',
    parole: [
      'hyper turbo',
      '3 max',
      'moltiplicatore',
      'moltiplicatori',
      'x1000',
      'winner takes all',
    ],
  },
  {
    slug: 'bankroll-spin-and-go',
    titolo: 'Bankroll Spin & Go: quanti buy-in servono davvero',
    parole: ['bankroll', 'gestione del capitale', 'gestione della cassa'],
  },
  {
    slug: 'push-fold-spin-and-go',
    titolo: 'Push or fold: come si legge una tabella preflop',
    parole: [
      'push fold',
      'push or fold',
      'tabella preflop',
      'nash',
      'all in preflop',
    ],
  },
  {
    slug: 'varianza-spin-and-go',
    titolo: 'Varianza negli Spin & Go: quanto dura un downswing',
    parole: [
      'varianza',
      'downswing',
      'upswing',
      'rischio di rovina',
      'striscia',
    ],
  },
  {
    slug: 'icm-spin-and-go',
    titolo: 'ICM negli Spin & Go: quando conta e quando no',
    parole: ['icm', 'bolla', 'tavolo finale', 'chip ev'],
  },
  {
    slug: 'spin-and-go-vs-twister',
    titolo: 'Spin & Go e Twister: cosa cambia davvero',
    parole: ['twister', 'lottomatica', 'ipoker'],
  },
  {
    slug: 'scegliere-scuola-poker-spin-and-go',
    titolo: 'Scuola di poker Spin & Go: come sceglierne una',
    parole: [
      'scuola di poker',
      'coaching',
      'allenamento',
      'imparare a giocare',
    ],
  },
  {
    slug: 'errori-comuni-spin-and-go',
    titolo: 'Errori comuni negli Spin & Go: i sette più costosi',
    parole: ['errore', 'errori'],
  },
  {
    slug: 'heads-up-spin-and-go',
    titolo: 'Heads-up negli Spin & Go: cosa cambia quando resti in due',
    parole: ['heads up', 'testa a testa'],
  },
  {
    slug: 'perche-il-3max-hyper-turbo-si-decide-preflop',
    titolo: '3-max hyper turbo: perché si decide prima del flop',
    parole: ['preflop', 'range di apertura', 'open raise', 'limp'],
  },
];

/**
 * La guida di ripiego quando nessuna parola aggancia, una per categoria.
 *
 * ⚠️ IL RIPIEGO PROPONE **UNA SOLA** GUIDA, mai due, ed è la regola decisa il
 * 23/08/2026: il secondo collegamento compare solo se ha agganciato davvero il
 * testo. Due ripieghi sarebbero due link identici su ogni pezzo che non aggancia
 * niente — cioè il boilerplate, per un'altra strada.
 */
export const RIPIEGO_CATEGORIA: Readonly<Record<NewsCategory, string>> = {
  live: 'icm-spin-and-go',
  online: 'come-giocare-spin-and-go',
  mtt: 'icm-spin-and-go',
  cash: 'come-giocare-spin-and-go',
  industry: 'come-giocare-spin-and-go',
  regolamentazione: 'come-giocare-spin-and-go',
  strategia: 'perche-il-3max-hyper-turbo-si-decide-preflop',
  'la-scuola': 'scegliere-scuola-poker-spin-and-go',
};

/**
 * Quando la categoria manca o non è fra le otto.
 *
 * ⚠️ Non è teorico: `listAdmin` legge con `.lean()`, che **non applica i default
 * di schema**, quindi una riga anteriore al campo arriva con `categoria`
 * assente. Un accesso non guardato darebbe `undefined` e il blocco sparirebbe
 * senza che nulla si rompa a vista.
 */
export const RIPIEGO_PREDEFINITO = 'come-giocare-spin-and-go';

/**
 * Le guide da proporre per un articolo: 1 o 2, mai zero.
 *
 * Punteggio: una parola nel **titolo** vale 3, nel corpo 1, e ogni parola conta
 * una volta sola — così un pezzo che ripete venti volte «preflop» non scavalca
 * uno che aggancia tre concetti diversi. A parità vince l'ordine di
 * `GUIDE_CORRELABILI`, così la scelta è **deterministica**: le due stesure della
 * pagina devono proporre le stesse guide, o il blocco cambia sotto gli occhi di
 * chi legge un secondo dopo l'apertura.
 */
export function guideCorrelate(articolo: {
  titolo?: string | null;
  corpo?: string | null;
  categoria?: string | null;
}): GuidaCorrelata[] {
  const titolo = normalizzaTesto(articolo?.titolo);
  const corpo = normalizzaTesto(articolo?.corpo);

  const agganciate = GUIDE_CORRELABILI.map((guida, ordine) => {
    let punti = 0;
    for (const parola of guida.parole) {
      const p = normalizzaTesto(parola);
      if (contiene(titolo, p)) punti += 3;
      else if (contiene(corpo, p)) punti += 1;
    }
    return { guida, punti, ordine };
  })
    .filter((v) => v.punti > 0)
    .sort((a, b) => b.punti - a.punti || a.ordine - b.ordine);

  if (agganciate.length) {
    return agganciate
      .slice(0, MAX_GUIDE)
      .map(({ guida }) => ({ slug: guida.slug, titolo: guida.titolo }));
  }

  const categoria = String(articolo?.categoria ?? '');
  const slug =
    (RIPIEGO_CATEGORIA as Record<string, string | undefined>)[categoria] ??
    RIPIEGO_PREDEFINITO;
  const guida = GUIDE_CORRELABILI.find((g) => g.slug === slug);
  return guida ? [{ slug: guida.slug, titolo: guida.titolo }] : [];
}
