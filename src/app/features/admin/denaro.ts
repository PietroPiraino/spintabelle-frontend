/**
 * Il denaro del pannello: lettura e scrittura, funzioni PURE.
 *
 * ⚠️ Sul filo passano CENTESIMI INTERI (vedi `stakings.types.ts` e
 * `conteggi.types.ts` lato server): gli euro esistono solo qui, sul bordo, dove
 * li digita e li legge una persona. Se la conversione vivesse anche altrove, i
 * due punti dovrebbero concordare su un fattore 100 — ed è il modo più rapido
 * di registrare 125.050 € al posto di 1.250,50 €.
 *
 * ⚠️ Questo file nasce il 09/09/2026 da un'ESTRAZIONE di
 * `admin-stakings/staking-format.ts`, che ora lo ri-esporta: alla SECONDA
 * sezione che li usa (i conteggi mensili) due copie sarebbero state due
 * grammatiche del denaro nello stesso pannello. Il corpo delle funzioni non è
 * cambiato di un carattere, e `staking-format.spec.ts` continua a coprirle
 * attraverso la ri-esportazione.
 *
 * ⚠️ Il pannello NON ha ancora una grammatica unica: `/admin/richieste` stampa
 * `€{{ eur }}` grezzo (float col punto inglese, nessun raggruppamento) e
 * `/admin/statistiche` usa `Intl` su euro float. Chi scrive una schermata nuova
 * passa da qui; chi tocca quelle due può finalmente allinearle.
 */

/** Un importo in centesimi, in euro all'italiana: «1.250,50 €». */
export function formattaCent(cent: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(cent / 100);
}

/**
 * Interpreta quello che una persona ha digitato in un campo importo, e torna i
 * CENTESIMI interi (o `null` se non è un importo).
 *
 * ⚠️ Il punto è ambiguo in italiano: in «1.250» separa le migliaia, in «12.50»
 * i decimali. Cancellare tutti i punti prima di convertire — la scorciatoia
 * ovvia — trasforma «12.50» in 1250 centesimi, cioè moltiplica per cento un
 * importo su due. La regola qui è: se c'è una virgola, i punti sono migliaia e
 * la virgola è il decimale; altrimenti UN punto seguito da una o due cifre è un
 * decimale, e tutto il resto sono migliaia.
 *
 * ⚠️ `Number()` accetta «0x10» (16), «0b11» (3) e « 12 » (12): su un campo di
 * denaro sono tutte stringhe che un utente non ha inteso scrivere, e passarle
 * in silenzio è peggio che rifiutarle. Di qui il controllo di forma esplicito
 * invece di affidarsi alla conversione.
 */
export function parseImportoInCent(raw: string): number | null {
  const testo = raw.trim().replace(/\s|€/g, '');
  if (!testo) return null;

  const segno = testo.startsWith('-') ? -1 : 1;
  const corpo = testo.replace(/^[+-]/, '');

  let normalizzato: string;
  if (corpo.includes(',')) {
    // C'è una virgola: è LEI il decimale, i punti sono migliaia.
    normalizzato = corpo.replace(/\./g, '').replace(',', '.');
  } else {
    const punti = corpo.split('.').length - 1;
    const decimaliDopoIlPunto = /\.(\d{1,2})$/.exec(corpo)?.[1];
    normalizzato =
      punti === 1 && decimaliDopoIlPunto
        ? corpo // un punto con 1-2 cifre dopo: è un decimale
        : corpo.replace(/\./g, ''); // zero, o più d'uno: migliaia
  }

  // Forma ammessa: cifre, al più un punto decimale con al più due cifre.
  if (!/^\d+(\.\d{1,2})?$/.test(normalizzato)) return null;

  // ⚠️ `Math.round` sul prodotto e non un troncamento: `12.35 * 100` in
  // IEEE754 vale 1234.9999999999998, e `Math.trunc` perderebbe un centesimo a
  // ogni movimento. In un libro mastro un centesimo perso non torna più
  // indietro. Stessa lezione di `prezzoInPunti` lato server.
  return segno * Math.round(Number(normalizzato) * 100);
}

/**
 * Una percentuale in PUNTI BASE (5700 = 57,00%), all'italiana: «57 %».
 *
 * ⚠️ Nel progetto convivono DUE convenzioni di percentuale e formattarle con lo
 * stesso helper sbaglia di un fattore 100: `PCT` di `admin-stats.component.ts`
 * (`style: 'percent'`) vuole una FRAZIONE 0..1, mentre `delta()` vuole già
 * punti percentuali. I punti base non sono né l'una né l'altra — si dividono
 * per 10.000 — e per questo hanno una funzione propria invece di riusare una
 * delle due a occhio.
 */
export function formattaBp(bp: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'percent',
    maximumFractionDigits: 2,
  }).format(bp / 10_000);
}

/**
 * Interpreta una percentuale digitata («57», «57,5», «57 %») e torna i PUNTI
 * BASE interi, o `null`.
 *
 * ⚠️ Gemella di `parseImportoInCent` e con le stesse due trappole: il punto
 * ambiguo e ciò che `Number()` accetterebbe di nascosto. Qui i decimali ammessi
 * sono due (57,25% = 5725 bp), oltre i quali il punto base non saprebbe
 * rappresentare il valore e arrotondare in silenzio sarebbe peggio che
 * rifiutare.
 */
export function parsePercentualeInBp(raw: string): number | null {
  const testo = raw.trim().replace(/\s|%/g, '');
  if (!testo) return null;
  if (testo.startsWith('-') || testo.startsWith('+')) return null;

  const normalizzato = testo.includes(',')
    ? testo.replace(/\./g, '').replace(',', '.')
    : testo;
  if (!/^\d+(\.\d{1,2})?$/.test(normalizzato)) return null;

  const bp = Math.round(Number(normalizzato) * 100);
  return bp > 10_000 ? null : bp;
}
