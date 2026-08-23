// «Per approfondire» all'edge — COPIA DELIBERATA di
// `src/app/features/guides/guide-links.ts`.
//
// CHI LO USA: `functions/lib/render-news.mjs`, cioe' il blocco in coda a ogni
// articolo reso all'edge.
//
// PERCHE' UNA COPIA E NON UN IMPORT. Il bundle della Pages Function e il chunk
// del browser sono due build diverse: la Function e' compilata da esbuild di
// Cloudflare a partire da `functions/`, l'app da Angular a partire da `src/`.
// Il modulo canonico e' TypeScript e importa `api.models`; qui dentro non puo'
// entrare. E' la stessa ragione di `functions/lib/markdown.mjs` e dei glifi di
// condivisione in `render-news.mjs`. Il prezzo della duplicazione lo paga un
// test: `scripts/lib/guide-links.test.mjs` rilegge i due sorgenti e confronta i
// letterali. Se cambi qualcosa qui, cambialo li' — o il test te lo dice.
//
// ⚠️ PERCHE' IL BLOCCO DEVE ESISTERE IN ENTRAMBE LE STESURE. La pagina di un
// articolo ne ha due che si sostituiscono: questa, che ricevono il lettore al
// primo colpo e ogni motore, e quella del componente Angular al montaggio. Solo
// qui, sparirebbe all'idratazione (e con essa l'ingombro: uno spostamento di
// layout in fondo alla pagina). Solo di la', non esisterebbe per nessun crawler
// — cioe' verrebbe meno **l'unica ragione per cui il blocco e' stato scritto**.

/** Quante guide al massimo. ⚠️ Il tetto e' anti-boilerplate, non estetico. */
export const MAX_GUIDE = 2;

/** ⚠️ Copia esatta di `normalizzaTesto` nel modulo canonico. */
export function normalizzaTesto(valore) {
  return String(valore ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Parola intera dentro un testo gia' normalizzato. */
function contiene(testo, parola) {
  if (!testo || !parola) return false;
  return ` ${testo} `.includes(` ${parola} `);
}

/**
 * ⚠️ COPIA ESATTA del letterale in `guide-links.ts`, confronto compreso il
 * `titolo`: qui `guides.data.ts` non si puo' importare, quindi il testo del
 * collegamento vive scritto due volte. Che i dieci titoli siano ancora quelli
 * delle guide lo verifica una spec Karma di la'; che le due copie non divergano,
 * il test di deriva.
 */
export const GUIDE_CORRELABILI = [
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

/** ⚠️ Copia esatta. Un ripiego solo, mai due: vedi il modulo canonico. */
export const RIPIEGO_CATEGORIA = {
  live: 'icm-spin-and-go',
  online: 'come-giocare-spin-and-go',
  mtt: 'icm-spin-and-go',
  cash: 'come-giocare-spin-and-go',
  industry: 'come-giocare-spin-and-go',
  regolamentazione: 'come-giocare-spin-and-go',
  strategia: 'perche-il-3max-hyper-turbo-si-decide-preflop',
  'la-scuola': 'scegliere-scuola-poker-spin-and-go',
};

/** ⚠️ Copia esatta: `categoria` puo' arrivare assente. */
export const RIPIEGO_PREDEFINITO = 'come-giocare-spin-and-go';

/**
 * Le guide da proporre per un articolo: 1 o 2, mai zero.
 *
 * ⚠️ Deterministica, e non e' un vezzo: le due stesure devono proporre le stesse
 * guide nello stesso ordine, o il blocco cambia all'idratazione.
 */
export function guideCorrelate(articolo) {
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
  const slug = RIPIEGO_CATEGORIA[categoria] ?? RIPIEGO_PREDEFINITO;
  const guida = GUIDE_CORRELABILI.find((g) => g.slug === slug);
  return guida ? [{ slug: guida.slug, titolo: guida.titolo }] : [];
}
