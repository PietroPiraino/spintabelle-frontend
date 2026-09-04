import { DrillDifficulty } from '../../core/models/api.models';

/**
 * La frase che dichiara, prima di partire, che cosa sta per succedere — e il
 * testo del selettore delle profondità.
 *
 * Sono funzioni PURE e stanno fuori dal componente perché sono la cosa più
 * facile da rompere senza accorgersene: una stringa sbagliata non fallisce
 * nulla, si legge male e basta. Qui hanno una spec che le enumera.
 */

/** Voce della scala delle profondità, nell'ordine crescente in cui è mostrata. */
export interface GradinoProfondita {
  display: string;
  base: number;
}

/**
 * Come si legge la scelta delle profondità sul trigger chiuso.
 * `null` = nessuna scelta, cioè **tutte**.
 *
 * ⚠️ Il tratto CONTIGUO si dice «da X a Y bb» e non elencando i valori: è la
 * forma in cui un giocatore pensa («allenami fra 8 e 15 bb»), ed è anche la
 * scelta che l'owner ha indicato come principale. Le eccezioni restano
 * possibili, e allora la frase cambia forma invece di mentire.
 */
export function testoProfondita(
  scelte: ReadonlySet<string>,
  scala: readonly GradinoProfondita[],
): string | null {
  if (scelte.size === 0) return null;
  const indici = scala
    .map((g, i) => (scelte.has(g.display) ? i : -1))
    .filter((i) => i >= 0);
  if (indici.length === 0) return null;

  const contiguo =
    indici.length > 1 &&
    indici[indici.length - 1] - indici[0] === indici.length - 1;
  if (contiguo) {
    return `da ${scala[indici[0]].display} a ${
      scala[indici[indici.length - 1]].display
    } bb`;
  }

  const et = indici.map((i) => scala[i].display);
  if (et.length === 1) return `${et[0]} bb`;
  if (et.length <= 3) {
    return `${et.slice(0, -1).join(', ')} e ${et[et.length - 1]} bb`;
  }
  return `${et.length} profondità`;
}

/** Coda della frase che dipende dalla difficoltà. Riprende `DIFFICULTY_HINTS`. */
function codaDifficolta(d: DrillDifficulty): string {
  switch (d) {
    case 'STANDARD':
      return 'escludendo i fold scontati';
    case 'MIXED_ONLY':
      return 'solo dove la strategia è mista';
    case 'MARGINAL':
      return 'solo sui mix al fotofinish';
    case 'ALL':
      return 'senza escludere nessuna mano';
  }
}

export interface DatiFrase {
  mani: number;
  /** Etichette leggibili dei formati scelti (almeno uno: `canStart` lo esige). */
  formati: readonly string[];
  /** Testo già composto da `testoProfondita`; `null` = tutte. */
  profondita: string | null;
  posizioni: readonly string[];
  /** Etichette leggibili dei tipi di situazione; vuoto = tutte. */
  situazioni: readonly string[];
  difficolta: DrillDifficulty;
}

/**
 * «Ti proporremo 20 mani di Spin & Go, a qualsiasi profondità, da qualsiasi
 * posizione e in qualsiasi situazione, escludendo i fold scontati.»
 *
 * ⚠️ «Ti PROPORREMO» e non «ti serviremo»: «servire una mano» in italiano non
 * si dice, è un calco da *we'll serve you*. Ed è la stringa più letta della
 * pagina — compare a ogni configurazione.
 */
export function frasePreparazione(d: DatiFrase): string {
  const parti: string[] = [];
  parti.push(`Ti proporremo ${d.mani} mani di ${elenco(d.formati)}`);
  parti.push(d.profondita ?? 'a qualsiasi profondità');
  parti.push(
    d.posizioni.length
      ? `da${d.posizioni.length === 1 ? 'l' : 'i'} ${elenco(d.posizioni)}`
      : 'da qualsiasi posizione',
  );
  parti.push(
    d.situazioni.length
      ? // ⚠️ Si abbassa solo la PRIMA lettera di ogni etichetta, non l'intera
        // stringa: dentro la frase «su apertura…» ci vuole la minuscola, ma un
        // `toLowerCase()` secco trasformava «Apertura (RFI)» in
        // «apertura (rfi)» — e un acronimo in minuscolo si legge come un refuso.
        `su ${elenco(d.situazioni.map(minuscolaIniziale))}`
      : 'in qualsiasi situazione',
  );
  // ⚠️ Le ultime due parti si legano con «e», come in una frase italiana vera —
  // MA solo se l'ultima non ne contiene già uno suo. Con due situazioni scelte
  // la coda è «apertura e risposta all'apertura», e la congiunzione esterna
  // produceva «dal BB **e** su apertura **e** risposta all'apertura»: due «e»
  // di fila, che si legge come un errore di battitura. Preso da una spec, non
  // guardando la pagina.
  const ultima = parti[parti.length - 1];
  const testa = parti.slice(0, -1).join(', ');
  const legame = ultima.includes(' e ') ? ',' : ' e';
  return `${testa}${legame} ${ultima}, ${codaDifficolta(d.difficolta)}.`;
}

/**
 * Che cosa dire quando la combinazione non ha nessuno spot.
 *
 * ⚠️ Nomina l'asse che con ogni probabilità ha svuotato il pool, invece del
 * generico «cambia posizione o tipo di spot» di prima, che era vero solo a
 * volte. L'ordine dei sospetti va dal più restrittivo al meno.
 */
export function frasePoolVuoto(d: DatiFrase): string {
  const testa = 'Con questa combinazione non c’è nessuna situazione da allenare';
  if (d.situazioni.length) {
    return `${testa}: prova a togliere «${
      d.situazioni[d.situazioni.length - 1]
    }».`;
  }
  if (d.posizioni.length) {
    return `${testa}: prova ad aggiungere una posizione.`;
  }
  if (d.profondita) {
    return `${testa}: prova ad allargare l’intervallo di profondità.`;
  }
  return `${testa}: prova a cambiare formato.`;
}

/** «Apertura (RFI)» → «apertura (RFI)»: solo l'iniziale, l'acronimo resta. */
function minuscolaIniziale(v: string): string {
  return v.charAt(0).toLowerCase() + v.slice(1);
}

/** «a», «a e b», «a, b e c» — la congiunzione italiana, non un `join(', ')`. */
function elenco(v: readonly string[]): string {
  if (v.length === 0) return '';
  if (v.length === 1) return v[0];
  return `${v.slice(0, -1).join(', ')} e ${v[v.length - 1]}`;
}
