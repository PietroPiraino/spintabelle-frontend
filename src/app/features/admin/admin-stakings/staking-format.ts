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
 * Qui restano `testoEv`, specifico dell'EV, e — dal 19/09/2026 — la tabella
 * delle VOCI di movimento, cioè il verso di ogni scrittura sul registro.
 */
export { formattaCent, parseImportoInCent } from '../denaro';

import type { StakingTipo } from '../../../core/models/api.models';
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

// ── Le voci di movimento: il VERSO lo porta la voce, mai il meno digitato ────
//
// ⚠️⚠️ Il registro ha tre assi (`FONDI`, `EV`, `PERDITA`) e su ognuno il segno
// dell'importo dice la direzione: un FONDI positivo è denaro anticipato al
// giocatore, uno negativo è denaro RIENTRATO (`stakings.types.ts` lato server,
// e `riepilogoCapitale` li somma col segno per cassa). Fino al 19/09/2026 il
// form chiedeva quel segno a chi digitava — «es. 250 oppure -80,50» — e l'owner
// non ha trovato come registrare un roll che rientra: l'etichetta della tasca
// diceva «Da quale portafoglio», la nota «chi ha messo il denaro», e nessuna
// parola dello schermo diceva «rientro». È la regola già scritta per il libro
// cassa il 12/09/2026: «chiedere un meno su un bonifico in uscita è il modo più
// rapido per registrare il verso sbagliato di un movimento di denaro». Qui la
// voce porta tipo E segno, e l'importo si scrive sempre positivo.
//
// ⚠️ Sei voci e non cinque: il registro è append-only, quindi ogni scrittura
// deve avere la propria compensativa dall'interfaccia, o un errore diventa
// permanente. Lo storno di una perdita (PERDITA positiva) è un'operazione che
// il server documenta e prevede (`perditeCapitalePerMese`: «uno storno lo
// riduce, e può portarlo sotto zero nel mese dello storno»), e prima di oggi
// era possibile solo digitando un positivo su «Capitale perso».
//
// ⚠️ È la fonte UNICA per il select del form E per il badge dello storico
// (`voceDaMovimento`): due tabelle direbbero due nomi per lo stesso movimento.

export const CODICI_MOVIMENTO_STAKING = [
  'ANTICIPO',
  'RIENTRO',
  'RECUPERO_EV',
  'DEBITO_EV',
  'PERDITA',
  'STORNO_PERDITA',
] as const;
export type CodiceMovimentoStaking = (typeof CODICI_MOVIMENTO_STAKING)[number];

export interface VoceMovimentoStaking {
  readonly codice: CodiceMovimentoStaking;
  /** L'asse del registro su cui scrive: è il `tipo` che parte verso l'API. */
  readonly tipo: StakingTipo;
  /** Il segno che il client applica all'importo digitato (sempre positivo). */
  readonly segno: 1 | -1;
  /** Nel select del form. */
  readonly label: string;
  /** Nel badge dello storico, dove c'è meno spazio e accanto sta la tasca. */
  readonly breve: string;
  /**
   * Etichetta del campo tasca: «da quale» esce o «in quale» rientra. Assente
   * sulle voci che non muovono denaro — lì la tasca non si chiede affatto, e il
   * server la rifiuta con un 400.
   */
  readonly etichettaCassa?: 'Da quale portafoglio' | 'In quale portafoglio';
  /** Segnaposto della causale, che il giocatore legge nel suo account. */
  readonly esempioCausale: string;
}

export const MOVIMENTI_STAKING: readonly VoceMovimentoStaking[] = [
  {
    codice: 'ANTICIPO',
    tipo: 'FONDI',
    segno: 1,
    label: 'Anticipo al giocatore',
    breve: 'Anticipo',
    etichettaCassa: 'Da quale portafoglio',
    esempioCausale: 'es. reload di settembre',
  },
  {
    codice: 'RIENTRO',
    tipo: 'FONDI',
    segno: -1,
    label: 'Rientro dal giocatore',
    breve: 'Rientro',
    etichettaCassa: 'In quale portafoglio',
    esempioCausale: 'es. rientro parziale del roll',
  },
  {
    codice: 'RECUPERO_EV',
    tipo: 'EV',
    segno: 1,
    label: 'Recupero EV',
    breve: 'Recupero EV',
    esempioCausale: 'es. recupero dal conteggio di agosto',
  },
  {
    codice: 'DEBITO_EV',
    tipo: 'EV',
    segno: -1,
    label: 'Nuovo debito EV',
    breve: 'Debito EV',
    esempioCausale: 'es. passivo del conteggio di agosto',
  },
  {
    codice: 'PERDITA',
    tipo: 'PERDITA',
    segno: -1,
    label: 'Capitale perso',
    breve: 'Perso',
    esempioCausale: 'es. giocatore non più raggiungibile',
  },
  {
    codice: 'STORNO_PERDITA',
    tipo: 'PERDITA',
    segno: 1,
    label: 'Storno di una perdita',
    breve: 'Storno perdita',
    esempioCausale: 'es. storno della perdita del 12/09',
  },
];

/** La voce scelta nel form. Un codice ignoto è un errore di programmazione. */
export function voceMovimento(
  codice: CodiceMovimentoStaking,
): VoceMovimentoStaking {
  const voce = MOVIMENTI_STAKING.find((v) => v.codice === codice);
  if (!voce) throw new Error(`Voce di movimento sconosciuta: ${codice}`);
  return voce;
}

/**
 * La voce di un movimento GIÀ scritto, dal suo tipo e dal segno dell'importo:
 * è quello che lo storico stampa nel badge («Rientro · Pietro» e non «Fondi ·
 * Pietro −750,00 €», dove il verso andava dedotto dal meno).
 *
 * ⚠️ Lo `switch` sul tipo è esaustivo: un quarto asse lato server non compila
 * qui finché non gli si dà un nome nei due versi. Il segno non è mai zero
 * (`@NotEquals(0)` sul DTO), quindi «non negativo» basta.
 */
export function voceDaMovimento(
  tipo: StakingTipo,
  importoCent: number,
): VoceMovimentoStaking {
  const segno: 1 | -1 = importoCent < 0 ? -1 : 1;
  switch (tipo) {
    case 'FONDI':
      return voceMovimento(segno === 1 ? 'ANTICIPO' : 'RIENTRO');
    case 'EV':
      return voceMovimento(segno === 1 ? 'RECUPERO_EV' : 'DEBITO_EV');
    case 'PERDITA':
      return voceMovimento(segno === 1 ? 'STORNO_PERDITA' : 'PERDITA');
    default: {
      const _mai: never = tipo;
      throw new Error(`Tipo di movimento sconosciuto: ${String(_mai)}`);
    }
  }
}
