/**
 * Art. 9 DL 87/2018 («Decreto Dignità») — il lint dei contenuti PUBBLICI
 * scritti nel frontend: glossario, pagine chart, guide.
 *
 * ⚠️ Le prime due liste sono COPIE LETTERALI di `backend/src/news/news.constants.ts`
 * (`PAROLE_NON_PUBBLICABILI`, `SALE_AFFILIATE`), e `terminiPresenti()` è la
 * copia della funzione che là applica le stesse liste ai titoli delle news.
 * Due repo che non condividono codice (idioma di `functions/lib/guide-links.mjs`):
 * la deriva la tiene `scripts/lib/glossario-lint.test.mjs`, che importa
 * l'originale dal checkout accanto e confronta VALORI e comportamento — e
 * salta, avvisando, dove quel checkout non c'è (Cloudflare).
 *
 * ⚠️ Questo file NON deve importare niente: lo importano Karma, i test
 * `node --test` di `scripts/lib/` e gli script di scrittura (Node 24 legge un
 * `.ts` di sole costanti senza build, purché non abbia import di valori).
 *
 * ⚠️ `PROMESSE_VIETATE` è solo del frontend, e va letta con la regola scritta
 * in `guides.data.ts` e in memoria: il filtro colpisce le PROMESSE AL LETTORE,
 * mai il verbo nudo. «Questa linea guadagna 0,3 bb» è il modo normale di
 * parlare di EV in una guida di strategia; «puoi guadagnare» è un invito.
 */

/** Copia letterale di `PAROLE_NON_PUBBLICABILI` (backend). */
export const PAROLE_NON_PUBBLICABILI = [
  'bonus',
  'deposita',
  'giri gratis',
  'pronostico',
  'casino',
  'scommetti',
] as const;

/** Copia letterale di `SALE_AFFILIATE` (backend): le otto sale con un contratto. */
export const SALE_AFFILIATE = [
  'lottomatica',
  'planetwin',
  'betpassion',
  'goldbet',
  'admiralbet',
  'sisal',
  'snai',
  '888',
] as const;

/**
 * Promesse al lettore. Ristretta di proposito: la prima versione del filtro
 * delle guide cercava `guadagn(a|are|…)` e dava falsi positivi su frasi
 * corrette («non ti fa guadagnare nulla», «spingere più largo guadagna»).
 */
export const PROMESSE_VIETATE = [
  'guadagnerai',
  'guadagnerete',
  'puoi guadagnare',
  'potrai guadagnare',
  'ti fa guadagnare',
  'soldi facili',
  'arrotonda',
  'arrotondare lo stipendio',
  'diventare profittevole',
  'vincita garantita',
  'senza rischi',
] as const;

/** Le tre liste insieme: ciò che una voce di glossario non può contenere. */
export const TERMINI_VIETATI_CONTENUTI: readonly string[] = [
  ...PAROLE_NON_PUBBLICABILI,
  ...SALE_AFFILIATE,
  ...PROMESSE_VIETATE,
];

/**
 * Normalizza il testo prima del confronto: NFD per staccare i diacritici,
 * rimozione dei segni combinanti, minuscole, spazi collassati (i termini di
 * più parole, come «giri gratis», non devono fallire su un a capo).
 */
function normalizza(testo: string): string {
  return (testo ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sempre a confini di parola, mai per sottostringa (`snai` dentro un'altra
 * parola non conta). Per i termini di sole cifre il `\b` non basta: `888.000`
 * è un montepremi e passa, `888poker` e «su 888» no.
 */
function regolaPerTermine(termine: string): RegExp {
  const esc = escapeRegex(termine);
  if (/^\d+$/.test(termine)) {
    return new RegExp(`(?<![\\d.,])${esc}(?![.,]?\\d)`);
  }
  return new RegExp(`\\b${esc}\\b`);
}

const REGOLE_PER_LISTA = new WeakMap<
  readonly string[],
  readonly { termine: string; re: RegExp }[]
>();

function regole(
  termini: readonly string[],
): readonly { termine: string; re: RegExp }[] {
  const memo = REGOLE_PER_LISTA.get(termini);
  if (memo) return memo;
  const compilate = termini.map((termine) => ({
    termine,
    re: regolaPerTermine(termine),
  }));
  REGOLE_PER_LISTA.set(termini, compilate);
  return compilate;
}

/**
 * Quali termini di `elenco` compaiono in `testo`. Torna l'elenco e non un
 * booleano: chi lo mostra (lint, spec) deve poter dire QUALE parola.
 */
export function terminiPresenti(
  testo: string,
  elenco: readonly string[],
): string[] {
  const normalizzato = normalizza(testo);
  if (!normalizzato) return [];
  return regole(elenco)
    .filter(({ re }) => re.test(normalizzato))
    .map(({ termine }) => termine);
}
