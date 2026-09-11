/**
 * Come è stato pagato un abbonamento, in italiano. Funzioni PURE.
 *
 * ⚠️ Questo file nasce il 10/09/2026 da un'ESTRAZIONE, e la ragione è un difetto
 * vero finito in produzione: le etichette del metodo erano scritte a mano in DUE
 * punti del pannello, e nessuno dei due conosceva `contanti` —
 * `admin-subscription-requests` cadeva nel `return 'PayPal'` finale, quindi **un
 * incasso in contanti si leggeva «PayPal»**, e `admin-stats` ripiegava sullo
 * slug grezzo. È esattamente il difetto che il commento dentro quella funzione
 * descriveva per `punti`, ripetuto sul metodo successivo: la prova che una copia
 * a mano non si tiene allineata perché qualcuno se lo ricorda.
 *
 * ⚠️ Alla TERZA copia si promuove — è la regola già applicata a `denaro.ts` e a
 * `.admin-totali`, e qui la terza copia sarebbe stata la scheda «Abbonamenti».
 *
 * ⚠️ Resta una copia a mano del gemello di server (`subscriptions.types.ts`), e
 * non può essere altrimenti: i due repo non condividono una riga. Ma da qui in
 * poi è UNA copia sola, e la guardia di completezza qui sotto non lascia
 * aggiungere un metodo senza deciderne l'etichetta.
 */
import {
  Cassa,
  FonteBack,
  Incassante,
  PaymentMethod,
  Skin,
} from '../../core/models/api.models';

export const METODI_PAGAMENTO = [
  'paypal',
  'skrill',
  'contanti',
  'punti',
  'manuale',
] as const satisfies readonly PaymentMethod[];

type MetodiFuoriElenco = Exclude<PaymentMethod, (typeof METODI_PAGAMENTO)[number]>;
/**
 * ⚠️ Guardia di completezza, idioma di `ROLE_ORDER` in `core/models/roles.ts`.
 * Un elenco scritto a mano è tipizzato `PaymentMethod[]` anche quando ne
 * dimentica uno: compila, il build è verde, e il metodo nuovo non compare da
 * nessuna parte. Questa riga NON compila se ne manca uno, e l'errore lo nomina.
 */
const _tuttiIMetodiSonoInElenco: [MetodiFuoriElenco] extends [never]
  ? true
  : MetodiFuoriElenco = true;
void _tuttiIMetodiSonoInElenco;

/**
 * ⚠️ `switch` ESAUSTIVO senza `default`, come il gemello del server: un metodo
 * nuovo non compila finché non gli si dà un'etichetta. Un `default` che ripiega
 * su qualcosa è il modo più rapido di mostrare una cosa falsa senza che niente
 * si rompa — e su questa funzione è già successo.
 */
export function metodoPagamentoLabel(m: PaymentMethod): string {
  switch (m) {
    case 'paypal':
      return 'PayPal';
    case 'skrill':
      return 'Skrill';
    case 'contanti':
      return 'Contanti';
    case 'punti':
      return 'Punti BFF';
    case 'manuale':
      return 'Concesso da admin';
  }
}

/**
 * La stessa etichetta partendo da una stringa non tipizzata.
 *
 * ⚠️ Esiste per `/admin/statistiche`, dove il metodo arriva dentro aggregazioni
 * come `string` e non come `PaymentMethod`. Il ripiego è lo **slug grezzo** e
 * non un metodo plausibile: davanti a un valore che non conosciamo, mostrare
 * `paypal` sarebbe un'affermazione; mostrare la stringa così com'è è una
 * domanda, e chi legge capisce che c'è qualcosa da guardare.
 */
export function metodoLabelDaSlug(m: string): string {
  return (METODI_PAGAMENTO as readonly string[]).includes(m)
    ? metodoPagamentoLabel(m as PaymentMethod)
    : m;
}

/**
 * Chi ha materialmente incassato i contanti.
 *
 * ⚠️ Gemello a mano di `incassanteLabel` in `subscriptions.types.ts`: i due repo
 * non condividono nulla. Le due voci sono persone fisiche note e stabili, non un
 * elenco che cresce — ed è la ragione per cui lato server è un enum chiuso e non
 * un id utente, che entrerebbe nella cascata GDPR.
 */
export function incassanteLabel(i: Incassante): string {
  switch (i) {
    case 'PIETRO':
      return 'Pietro';
    case 'EXIVEZZZ':
      return 'Exivezzz';
  }
}

/**
 * Perché una riga NON porta cassa. `null` se invece la porta.
 *
 * ⚠️ Il vocabolario è quello che `/admin/statistiche` usa già in
 * `senzaCassaMensile` (punti · manuale · omaggio): tre parole per tre cose
 * diverse, e inventarne un quarto insieme di nomi per la stessa distinzione
 * avrebbe reso le due schermate non confrontabili.
 *
 * ⚠️ «Omaggio» è il caso non ovvio: metodo di cassa (paypal/skrill/contanti) ma
 * euro dovuti a zero, cioè un buono al 100%. Non appartiene né ai punti né alle
 * concessioni, ed è per questo che le Statistiche hanno una terza colonna.
 */
export function motivoSenzaCassa(
  metodo: PaymentMethod,
  portaCassa: boolean,
): string | null {
  if (portaCassa) return null;
  if (metodo === 'punti') return 'punti';
  if (metodo === 'manuale') return 'concessione';
  return 'omaggio';
}

/**
 * Il nome del portafoglio da cui il denaro si muove.
 *
 * ⚠️ Vive qui e non in `denaro.ts`: quello converte centesimi in euro e non sa
 * niente di chi maneggia il denaro, mentre in questo file c'e' gia' il
 * vocabolario di «chi ha preso i soldi» (`incassanteLabel`). Tenerli insieme e'
 * cio' che impedisce la quarta copia a mano — ne sono gia' state trovate tre
 * per il metodo di pagamento, di cui una rotta.
 *
 * ⚠️ `switch` esaustivo senza `default`: aggiungere una cassa senza deciderne
 * l'etichetta non compila. E' l'unica difesa possibile, visto che la tupla e'
 * ricalcata a mano dall'altro repo.
 */
export function cassaLabel(c: Cassa): string {
  switch (c) {
    case 'PIETRO':
      return 'Pietro';
    case 'EXIVEZZZ':
      return 'Exivezzz';
    case 'COMUNE':
      return 'Cassa comune';
  }
}

/**
 * Dove gioca uno stakato che non ha un conto presso il nostro agente.
 *
 * ⚠️ `switch` esaustivo: aggiungere una skin senza deciderne l'etichetta non
 * compila. E' l'unica difesa possibile, visto che la tupla e' ricalcata a mano
 * dall'altro repo.
 */
export function skinLabel(s: Skin): string {
  switch (s) {
    case 'LOTTOMATICA':
      return 'Lottomatica';
    case 'GOLDBET':
      return 'Goldbet';
    case 'SISAL':
      return 'Sisal';
    case 'SNAI':
      return 'Snai';
    case 'PLANETWIN':
      return 'Planetwin365';
    case 'ADMIRALBET':
      return 'AdmiralBet';
    case 'BETPASSION':
      return 'BetPassion';
    case 'POKERSTARS':
      return 'PokerStars';
    case 'ALTRA':
      return 'Altra skin';
  }
}

export function fonteBackLabel(f: FonteBack): string {
  switch (f) {
    case 'CONTO':
      return 'Dal conto rakeback';
    case 'MANUALE':
      return 'Rake inserito a mano';
  }
}
