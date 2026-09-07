/**
 * Denaro del registro staking: lettura e scrittura, funzioni PURE.
 *
 * ⚠️ Sul filo passano CENTESIMI INTERI (vedi `stakings.types.ts` lato server):
 * gli euro esistono solo qui, sul bordo, dove li digita e li legge una persona.
 * Se la conversione vivesse anche altrove, i due punti dovrebbero concordare su
 * un fattore 100 — ed è il modo più rapido di registrare 125.050 € al posto di
 * 1.250,50 €.
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
