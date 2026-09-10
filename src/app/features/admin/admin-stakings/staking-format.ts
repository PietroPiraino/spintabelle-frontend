/**
 * Denaro del registro staking: lettura e scrittura, funzioni PURE.
 *
 * ⚠️ Dal 09/09/2026 `formattaCent` e `parseImportoInCent` NON sono più
 * dichiarate qui: vivono in `../denaro.ts` e questo file le ri-esporta. La
 * ragione è che il pannello ha una seconda sezione di denaro (i conteggi
 * mensili) e il commento originale di quelle funzioni diceva che gli euro
 * esistono «solo qui, sul bordo» — una frase che con due copie sarebbe
 * diventata falsa nel modo peggiore, cioè restando scritta.
 *
 * La ri-esportazione, invece dello spostamento degli import, tiene fermi i
 * call-site esistenti e `staking-format.spec.ts`, che continua a coprire le due
 * funzioni attraverso questo file. È l'idioma di `SUBSCRIPTION_TIERS` in
 * `roles.enum.ts` e di `TZ` in `admin-stats.constants.ts`.
 *
 * Qui resta il solo `testoEv`, che è specifico dell'EV e non ha senso altrove.
 */
export { formattaCent, parseImportoInCent } from '../denaro';

import { formattaCent } from '../denaro';

/**
 * Come si legge un saldo EV, che per costruzione è ≤ 0.
 *
 * ⚠️ Zero NON è una cella vuota: significa «in pari», che è un'informazione, e
 * lasciarlo vuoto lo farebbe leggere come un dato mancante.
 */
export function testoEv(cent: number): string {
  if (cent === 0) return 'In pari';
  // Il valore è negativo: si mostra il DEBITO come quantità positiva, con la
  // parola che dice cosa è. Un «−340,00 €» in una colonna di numeri si legge
  // male e si confonde con una perdita di cassa.
  return `${formattaCent(-cent)} da recuperare`;
}
