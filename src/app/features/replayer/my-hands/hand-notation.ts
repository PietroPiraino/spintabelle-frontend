import { HandActionView, HandStreetView } from '../../../core/models/api.models';

/**
 * La **notazione compatta** delle azioni: da una strada a una manciata di
 * gettoni leggibili di traverso — `R2 C1`, `X X`, `B2 F`, `X B1 R4 C3`.
 *
 * ⚠️ **Modulo puro, nessun Angular**, e provato da solo (`hand-notation.spec.ts`):
 * è la parte che deve essere *giusta*. Una tabella densa vive o muore su questa
 * stringa — è l'unica cosa che, in una riga alta 44px, racconta come è andata la
 * mano senza aprirla.
 *
 * ⚠️ **L'alfabeto è quello che il progetto usa GIÀ**: `PreflopAction.code` in
 * `backend/src/preflop/preflop.types.ts` vale `F`, `C`, `X`, `R2.5`. Da lì
 * arrivano tre vincoli che non vanno «migliorati»:
 *
 * 1. la lettera è quella (`F` passa, `C` chiama, `X` bussa, `R` rilancia), più
 *    `B` per la puntata e `A` per l'all-in, che nel preflop non esistono;
 * 2. il separatore decimale è il **punto**, non la virgola italiana. In una
 *    sequenza di gettoni separati da spazi, `R2,5 C1,5` si legge come un elenco
 *    di quattro cose invece che di due: la virgola è già il separatore che
 *    l'occhio si aspetta *fra* i gettoni. Il piatto della strada, che è una
 *    *misura* e non un codice, resta invece nella forma italiana di `formatBui`;
 * 3. una cifra decimale al massimo, e solo sotto i 10 bb — è la stessa regola di
 *    `formatBui`, e sopra i 10 bb il decimo di buio è rumore.
 */

/**
 * ⚠️ **Le azioni forzate non sono azioni**: nessuno le ha *scelte*. Ante, bui e
 * straddle stanno in ogni preflop di ogni mano, e stamparle darebbe a tutte le
 * righe della tabella lo stesso identico prefisso — cioè zero informazione al
 * prezzo di mezza colonna. Il loro contributo al piatto non si perde: arriva
 * dentro `pot` della strada, che il server calcola già ante comprese.
 */
const AZIONI_FORZATE = new Set(['SB', 'BB', 'ANTE', 'STRADDLE']);

/** Un'azione ridotta al suo codice. */
export interface GettoneAzione {
  /** `F`, `X`, `C1`, `B2`, `R2.5`, `A12`. */
  codice: string;
  /** Il posto di chi ha agito: serve solo a riconoscere l'eroe. */
  seat: number;
  /**
   * ⚠️ **La sola cosa che rende leggibile la sequenza a colpo d'occhio.** Senza
   * distinguere l'eroe, `X B1 R4 C3` non dice chi ha fatto che cosa e la colonna
   * diventa decorazione. Chi stampa gli dà peso e colore (Hand2Note usa una
   * sottolineatura colorata, ed è la stessa scelta fatta qui).
   */
  eroe: boolean;
  /** Per chi legge con lo screen reader: «rilancia a 2.5 grandi bui». */
  etichetta: string;
}

/**
 * L'importo in **grandi bui**, nella forma dei codici (`2`, `2.5`, `12`).
 *
 * ⚠️ Torna la stringa **vuota** quando il grande buio non è noto (vale 0) o
 * quando l'arrotondamento porta a zero: un gettone `RInfinity` o `C0` è peggio
 * di un gettone senza misura, che resta comunque vero (`R` = «ha rilanciato»).
 */
export function misuraInBui(valore: number, bigBlind: number): string {
  if (!bigBlind || !Number.isFinite(valore) || valore <= 0) return '';
  const bui = valore / bigBlind;
  // Stessa soglia di `formatBui`: un decimo di buio conta sotto i 10 bb, sopra no.
  const arrotondato = bui < 10 ? Math.round(bui * 10) / 10 : Math.round(bui);
  if (arrotondato <= 0) return '';
  // ⚠️ `String()` scrive il punto: è esattamente la forma di `R2.5`. Un
  // `Intl.NumberFormat('it-IT')` qui rimetterebbe la virgola (vedi il punto 2).
  return String(arrotondato);
}

/**
 * Lettera, misura e verbo di una singola azione.
 *
 * ⚠️ **Quale numero**, che è la parte che si sbaglia in silenzio: l'aggressione
 * si cita col **totale della strada** («raises 22 *to* 23», la convenzione di
 * ogni hand history), la chiamata con l'**incremento** — cioè quanto quel
 * giocatore ha tirato fuori *adesso*. È ciò che rende vero `X B1 R4 C3`: chi
 * aveva puntato 1 e chiama un rilancio a 4 mette altri 3, e stampare `C4` direbbe
 * che ha pagato quattro grandi bui quando ne ha pagati tre.
 * `etichettaAzione` in `hand-replay/replay-state.ts` applica la stessa scelta per
 * il replayer: sono due alfabeti diversi (parole là, codici qui) sopra la stessa
 * regola, ed è l'unica cosa che le due sedi condividono.
 */
function componi(a: HandActionView): {
  lettera: string;
  grezzo: number | null;
  verbo: string;
} {
  switch (a.tipo) {
    case 'FOLD':
      return { lettera: 'F', grezzo: null, verbo: 'passa' };
    case 'CHECK':
      return { lettera: 'X', grezzo: null, verbo: 'bussa' };
    case 'CALL':
      return { lettera: 'C', grezzo: a.importo, verbo: 'chiama' };
    /**
     * ⚠️ Per una puntata `importo` e `totaleStrada` coincidono (è la prima fiche
     * della strada), ma si legge `totaleStrada` **lo stesso**: il giorno in cui
     * un parser emettesse un BET dopo un versamento parziale, la regola scritta
     * qui sopra continuerebbe a valere senza che nessuno debba accorgersene.
     */
    case 'BET':
      return { lettera: 'B', grezzo: a.totaleStrada, verbo: 'punta' };
    case 'RAISE':
      return { lettera: 'R', grezzo: a.totaleStrada, verbo: 'rilancia a' };
    /**
     * ⚠️ **Un all-in di CHIAMATA non è un all-in di rilancio**, e la misura segue
     * il tipo di partenza — che i parser conservano in `tipoOriginale` apposta.
     * Con la stessa misura per entrambi, chi ha messo la pressione e chi l'ha
     * subita si scriverebbero identici.
     */
    case 'ALLIN':
      return a.tipoOriginale === 'CALL'
        ? { lettera: 'A', grezzo: a.importo, verbo: 'chiama all-in per' }
        : { lettera: 'A', grezzo: a.totaleStrada, verbo: 'all-in a' };
    default:
      // Un tipo che non conosciamo si stampa com'è: meglio un gettone strano che
      // una strada che sembra non aver avuto azioni.
      return {
        lettera: a.tipo.toUpperCase(),
        grezzo: null,
        verbo: a.tipo.toLowerCase(),
      };
  }
}

/** Il gettone di una singola azione, o `null` se l'azione è forzata. */
export function gettoneAzione(
  a: HandActionView,
  heroSeat: number | null,
  bigBlind: number,
): GettoneAzione | null {
  if (AZIONI_FORZATE.has(a.tipo)) return null;
  const { lettera, grezzo, verbo } = componi(a);
  const misura = grezzo === null ? '' : misuraInBui(grezzo, bigBlind);
  return {
    codice: `${lettera}${misura}`,
    seat: a.seat,
    eroe: heroSeat !== null && a.seat === heroSeat,
    etichetta: misura ? `${verbo} ${misura} grandi bui` : verbo,
  };
}

/**
 * La notazione di un'intera strada.
 *
 * ⚠️ Un elenco **vuoto è un esito legittimo e frequente**, non un errore: negli
 * Spin & Go e nei Twister l'all-in preflop è il caso tipico, e flop, turn e river
 * arrivano lo stesso — con le carte e senza una sola azione. Chi stampa deve
 * mostrare comunque le carte e il piatto di quella strada.
 */
export function notazioneStrada(
  strada: HandStreetView,
  heroSeat: number | null,
  bigBlind: number,
): GettoneAzione[] {
  const gettoni: GettoneAzione[] = [];
  for (const a of strada.azioni) {
    const g = gettoneAzione(a, heroSeat, bigBlind);
    if (g) gettoni.push(g);
  }
  return gettoni;
}

/**
 * Le carte **nuove** di una strada.
 *
 * ⚠️ `board` è **cumulativo** (3 al flop, 4 al turn, 5 al river): stampandolo
 * tale e quale la colonna River ripeterebbe flop e turn, e la riga porterebbe
 * dodici carte per dirne cinque. Il flop è l'unica strada con più di una carta
 * nuova.
 */
export function carteNuove(strada: HandStreetView): string[] {
  switch (strada.strada) {
    case 'FLOP':
      return strada.board.slice(0, 3);
    case 'TURN':
      return strada.board.slice(3, 4);
    case 'RIVER':
      return strada.board.slice(4, 5);
    default:
      return [];
  }
}
