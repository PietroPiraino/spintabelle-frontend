/**
 * Testi fissi della redazione — l'etichetta IA in calce agli articoli.
 *
 * DOVE STA E PERCHE'. Il progetto tiene le costanti condivise come file piatti
 * sotto `core/` (`core/social-links.ts`): non esiste una cartella
 * `core/constants/`, e inventarla per un file solo vorrebbe dire due convenzioni
 * al posto di una. Il nome `*.constants.ts` è quello del backend
 * (`live.constants.ts`), da cui viene anche l'idea del **testo versionato**.
 *
 * PERCHE' VERSIONATA. È la stessa ragione di `LIVE_RECORDING_CONSENT`: un testo
 * che fa una dichiarazione pubblica deve poter essere ricondotto alla
 * formulazione con cui è uscito. Qui la dichiarazione è quella dell'art. 50(4)
 * AI Act, e la `versione` è la data della stesura: cambiando la frase in modo
 * sostanziale si cambia anche quella.
 *
 * ⚠️ QUESTA È L'ETICHETTA DEL **TESTO**, E NON È QUELLA DELL'IMMAGINE.
 * L'etichetta della copertina generata con l'IA (`imageSource === 'AI'`) è un
 * obbligo diverso, su un campo diverso, e poggia sul **primo** comma dell'art.
 * 50(4) — dove la revisione umana non esonera da niente. Questa invece è
 * **volontaria**: l'esonero del secondo comma è già soddisfatto dalla revisione
 * umana (`revisionatoDa`/`revisionatoAt`) e dalla responsabilità editoriale
 * dichiarata in `/redazione`, quindi la dichiariamo perché è giusto dirlo, non
 * perché siamo obbligati. Da qui l'asimmetria **voluta** fra le due, che non va
 * appiattita: questa vive nel solo renderer Angular, quella dell'immagine dovrà
 * stare in **entrambi** (anche all'edge) perché è l'obbligo in sé. Chi un giorno
 * le unisse in una frase sola farebbe ereditare all'immagine un esonero che non
 * ha (PLAN-news-redazione.md §4.3 e §4.8).
 *
 * ⚠️ `{revisore}` è **`revisionatoDa`, mai `autore`**. Oggi sono la stessa
 * persona perché di ADMIN ce n'è uno solo: è un **fatto di oggi**, non una
 * proprietà del modello dati. Il giorno che le due persone divergono, una
 * etichetta che avesse stampato la byline direbbe il falso — e direbbe il falso
 * proprio nella frase con cui rivendichiamo la revisione umana.
 */

/** Frase fino al collegamento (escluso). */
const APERTURA = (revisore: string) =>
  "Questo articolo è stato redatto con l'ausilio di strumenti di intelligenza " +
  `artificiale ed è stato verificato e approvato da ${revisore} prima della ` +
  'pubblicazione. Segnalazioni ed errori: vedi la ';

/** Il testo del collegamento, e ciò che resta dopo. */
const ANCORA = 'policy editoriale';
const CHIUSURA = '.';

export const AI_DISCLOSURE = {
  versione: '2026-08-19',
  /**
   * Le tre parti rese in pagina: il template compone
   * `apertura(revisore)` + `<a routerLink="…">ancora</a>` + `chiusura`.
   * Sono spezzate qui e non nel template perché `testo()` è **composto dalle
   * stesse tre parti**: così la frase resa e la frase in chiaro non possono
   * divergere, e una spec può confrontarle carattere per carattere.
   */
  apertura: APERTURA,
  ancora: ANCORA,
  ancoraRotta: '/policy-editoriale',
  chiusura: CHIUSURA,
  /** La frase intera, in chiaro (spec, prove, riuso fuori dal template). */
  testo: (revisore: string) => `${APERTURA(revisore)}${ANCORA}${CHIUSURA}`,
} as const;

/**
 * Quanti giorni può durare al massimo la pausa della generazione.
 *
 * ⚠️ **DEVE COINCIDERE con `NEWS_PAUSA_MAX_GIORNI` del backend**
 * (`backend/src/news/news.types.ts`), che è l'AUTORITÀ: qui il numero serve solo
 * a rendere impossibile scegliere una data fuori limite nel selettore del
 * browser — prevenire invece di segnalare. Se i due dovessero divergere, chi
 * vince è il server, e il suo 400 nomina il limite vero.
 *
 * Perché un limite esiste: la pausa è una data libera, e una data libera si
 * sbaglia in un modo che non si vede — 2036 al posto di 2026 ferma la redazione
 * per dieci anni. Oltre i tre mesi non è un'assenza, è una chiusura, e va
 * ridecisa invece che ereditata da un campo compilato una volta.
 */
export const PAUSA_MAX_GIORNI = 90;
