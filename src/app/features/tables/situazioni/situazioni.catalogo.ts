/**
 * Il catalogo delle situazioni PUBBLICHE: le pagine statiche `/tabelle/<slug>/`
 * con la griglia GTO dentro.
 *
 * ⚠️ QUESTA COSTANTE E' LA DECISIONE DELL'OWNER (20/09/2026): 24 nodi radice
 * del dataset — push/fold e aperture alle profondita' chiave, Spin & Go a tre
 * e heads-up — resi pubblici; l'albero intero (23.148 nodi) resta dietro il
 * login, nel visualizzatore. Aggiungere una riga qui = rendere pubblico un
 * altro nodo: e' una scelta di prodotto, non una modifica tecnica.
 *
 * PERCHE' ESISTONO, misurato (autocompletamento Google, 20/09/2026): `push fold
 * chart 10bb/15bb/20bb`, `push fold chart spin and go`, `spin and go range
 * chart`, `range open spin and go`, `open shove range`, `nash push fold chart
 * hu`, `heads up push fold chart`, `small blind range chart`. Il sito aveva i
 * dati e nessuna pagina statica che rispondesse.
 *
 * L'esportatore (`backend/scripts/export-situazioni.mjs`) legge QUESTO file
 * (Node 24 importa un `.ts` di sole costanti) per sapere cosa estrarre; il
 * prerender legge `slugSituazioni()`; il resolver carica `nodi/<slug>.ts`.
 * ⚠️ Solo `import type` qui dentro.
 *
 * ⚠️ VINCOLO LEGALE (art. 9 DL 87/2018) su ogni testo: nessun nome di sala,
 * nessuna promessa. `scripts/lib/situazioni.test.mjs` applica il lint.
 */

export type PosizioneSituazione = 'BTN' | 'SB' | 'BB';

export interface Situazione {
  /** Segmento di URL: /tabelle/<slug>/. ⚠️ Immutabile una volta pubblicata. */
  slug: string;
  /** Identita' del nodo nel database: la stessa chiave di `PreflopService.getNode`. */
  format: 'spin' | 'husng';
  /** ESATTA come nel database ('10', non 10). */
  depth_label: string;
  /** '' = radice; 'F' = dopo il fold del bottone; 'RAI' = contro l'all-in… */
  preflop_actions: string;
  posizione: PosizioneSituazione;
  /** <title> senza il suffisso del marchio, ≤ 60 caratteri, con la query dentro. */
  titolo: string;
  h1: string;
  /** meta description, ≤ 160 caratteri. */
  descrizione: string;
  /** La situazione in due parole, usata nel testo generato («a piatto non aperto»). */
  contesto: string;
  /** Chi ha gia' agito, per il testo («il bottone ha passato»). */
  premessa: string;
}

const NOME_POSIZIONE: Record<PosizioneSituazione, string> = {
  BTN: 'bottone',
  SB: 'small blind',
  BB: 'big blind',
};

/** Le profondita' del catalogo, gruppo per gruppo (decisione owner). */
const SPIN_BTN = ['8', '10', '12', '15', '20', '25'] as const;
const SPIN_SB_DOPO_FOLD = ['8', '10', '12', '15'] as const;
const SPIN_BB_VS_PUSH_SB = ['8', '10', '12', '15'] as const;
const SPIN_SB_VS_PUSH_BTN = ['8', '10', '12'] as const;
const HU_SB = ['8', '10', '12', '15', '20', '25'] as const;
const HU_BB_VS_PUSH = ['10'] as const;

/** Sotto le 15 big blind l'apertura e' quasi solo push/fold; da 15 in su torna il min-raise. */
const soloPushFold = (bb: string) => Number(bb) < 15;

function spinBtn(bb: string): Situazione {
  const pf = soloPushFold(bb);
  return {
    slug: `spin-and-go-btn-${bb}bb`,
    format: 'spin',
    depth_label: bb,
    preflop_actions: '',
    posizione: 'BTN',
    titolo: pf
      ? `Push/fold chart ${bb} bb dal bottone: Spin & Go a 3`
      : `Range di apertura a ${bb} bb dal bottone: Spin & Go`,
    h1: pf
      ? `Push/fold chart a ${bb} big blind dal bottone (Spin & Go a tre)`
      : `Range di apertura a ${bb} big blind dal bottone (Spin & Go a tre)`,
    descrizione: `La strategia GTO del bottone a ${bb} big blind in uno Spin & Go a tre, mano per mano: con cosa si va all-in, si rilancia o si passa, con le frequenze.`,
    contesto: 'a piatto non aperto',
    premessa: 'Il bottone parla per primo: nel piatto ci sono solo i bui.',
  };
}

function spinSbDopoFold(bb: string): Situazione {
  return {
    slug: `spin-and-go-sb-${bb}bb-dopo-fold`,
    format: 'spin',
    depth_label: bb,
    preflop_actions: 'F',
    posizione: 'SB',
    titolo: `Small blind a ${bb} bb dopo il fold del bottone: range`,
    h1: `Small blind a ${bb} big blind dopo il fold del bottone: push, limp o fold`,
    descrizione: `Il range GTO dello small blind a ${bb} big blind quando il bottone ha passato, in uno Spin & Go: all-in, limp, rilancio e fold mano per mano, con le frequenze.`,
    contesto: 'contro il solo big blind',
    premessa: 'Il bottone ha passato: resta un avversario, e il piatto morto è già per un terzo dello small blind.',
  };
}

function spinBbVsPushSb(bb: string): Situazione {
  return {
    slug: `spin-and-go-bb-${bb}bb-vs-push-sb`,
    format: 'spin',
    depth_label: bb,
    preflop_actions: 'F-RAI',
    posizione: 'BB',
    titolo: `Big blind a ${bb} bb contro l’all-in dello small blind`,
    h1: `Big blind a ${bb} big blind contro l’all-in dello small blind: con cosa chiamare`,
    descrizione: `Il range di call GTO del big blind a ${bb} big blind davanti all’all-in dello small blind, dopo il fold del bottone, in uno Spin & Go: mano per mano.`,
    contesto: 'davanti a un all-in',
    premessa: 'Il bottone ha passato e lo small blind è andato all-in: la scelta è fra chiamare e passare.',
  };
}

function spinSbVsPushBtn(bb: string): Situazione {
  return {
    slug: `spin-and-go-sb-${bb}bb-vs-push-btn`,
    format: 'spin',
    depth_label: bb,
    preflop_actions: 'RAI',
    posizione: 'SB',
    titolo: `Small blind a ${bb} bb contro l’all-in del bottone`,
    h1: `Small blind a ${bb} big blind contro l’all-in del bottone: con cosa chiamare`,
    descrizione: `Il range di call GTO dello small blind a ${bb} big blind davanti all’all-in del bottone, con il big blind ancora da parlare, in uno Spin & Go a tre: mano per mano.`,
    contesto: 'davanti a un all-in, con un giocatore ancora da parlare',
    premessa: 'Il bottone è andato all-in e il big blind deve ancora parlare: chiamare qui vale meno che chiamare da ultimi.',
  };
}

function huSb(bb: string): Situazione {
  const pf = soloPushFold(bb);
  return {
    slug: `heads-up-sb-${bb}bb`,
    format: 'husng',
    depth_label: bb,
    preflop_actions: '',
    posizione: 'SB',
    // ⚠️ NON «push/fold chart»: misurato sul dataset, in heads-up lo small
    // blind LIMPA piu' di quanto spinga (65% a 10 bb, 78% a 12): e' la
    // differenza fra queste tabelle e quelle di Nash, che conoscono solo
    // push e fold. Il titolo promette quello che la griglia mostra.
    titolo: pf
      ? `Heads-up a ${bb} bb: limp, push o fold dallo small blind`
      : `Range di apertura heads-up a ${bb} bb (small blind)`,
    h1: pf
      ? `Heads-up a ${bb} big blind: limp, all-in o fold dallo small blind`
      : `Range di apertura heads-up a ${bb} big blind dallo small blind`,
    descrizione: `La strategia GTO dello small blind a ${bb} big blind in heads-up, mano per mano: limp, all-in, rilancio o fold con le frequenze, e perché non è la chart di Nash.`,
    contesto: 'a piatto non aperto, testa a testa',
    premessa: 'In heads-up lo small blind è anche il bottone: parla per primo preflop e per ultimo dopo il flop.',
  };
}

function huBbVsPush(bb: string): Situazione {
  return {
    slug: `heads-up-bb-${bb}bb-vs-push`,
    format: 'husng',
    depth_label: bb,
    preflop_actions: 'RAI',
    posizione: 'BB',
    titolo: `Heads-up: big blind a ${bb} bb contro l’all-in`,
    h1: `Heads-up a ${bb} big blind: con cosa il big blind chiama l’all-in dello small blind`,
    descrizione: `Il range di call GTO del big blind a ${bb} big blind davanti all’all-in dello small blind in heads-up: la colonna «call» delle tabelle di Nash, mano per mano.`,
    contesto: 'davanti a un all-in, testa a testa',
    premessa: 'Lo small blind è andato all-in: la scelta è fra chiamare e passare, e nel piatto c’è già il proprio big blind.',
  };
}

export const SITUAZIONI: readonly Situazione[] = [
  ...SPIN_BTN.map(spinBtn),
  ...SPIN_SB_DOPO_FOLD.map(spinSbDopoFold),
  ...SPIN_BB_VS_PUSH_SB.map(spinBbVsPushSb),
  ...SPIN_SB_VS_PUSH_BTN.map(spinSbVsPushBtn),
  ...HU_SB.map(huSb),
  ...HU_BB_VS_PUSH.map(huBbVsPush),
];

export function situazioneBySlug(slug: string): Situazione | undefined {
  return SITUAZIONI.find((s) => s.slug === slug);
}

export function slugSituazioni(): string[] {
  return SITUAZIONI.map((s) => s.slug);
}

export function nomePosizione(p: PosizioneSituazione): string {
  return NOME_POSIZIONE[p];
}

/** Tutto il testo pubblico di una situazione (per il lint art. 9). */
export function testiDiSituazione(s: Situazione): string[] {
  return [s.titolo, s.h1, s.descrizione, s.contesto, s.premessa];
}
