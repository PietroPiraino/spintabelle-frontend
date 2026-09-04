import {
  DatiFrase,
  frasePoolVuoto,
  frasePreparazione,
  testoProfondita,
} from './drill-frase';

/** Scala finta ma con la forma di quella vera: interi e mezzi valori. */
const SCALA = [
  { display: '1', base: 1 },
  { display: '1,5', base: 1.5 },
  { display: '2', base: 2 },
  { display: '8', base: 8 },
  { display: '10', base: 10 },
  { display: '15', base: 15 },
  { display: '20', base: 20 },
];

describe('testoProfondita', () => {
  it('nessuna scelta = tutte, e lo dice con `null` invece di inventare un intervallo', () => {
    expect(testoProfondita(new Set(), SCALA)).toBeNull();
  });

  it('⚠️ un tratto CONTIGUO si dice «da X a Y bb», che è come un giocatore pensa', () => {
    expect(testoProfondita(new Set(['8', '10', '15']), SCALA)).toBe(
      'da 8 a 15 bb',
    );
    // due valori adiacenti sono già un tratto
    expect(testoProfondita(new Set(['15', '20']), SCALA)).toBe('da 15 a 20 bb');
  });

  it('un insieme SPARSO si elenca: l’intervallo mentirebbe', () => {
    expect(testoProfondita(new Set(['1', '10', '20']), SCALA)).toBe(
      '1, 10 e 20 bb',
    );
  });

  it('un valore solo si dice per intero; oltre tre si conta', () => {
    expect(testoProfondita(new Set(['10']), SCALA)).toBe('10 bb');
    expect(testoProfondita(new Set(['1', '2', '10', '20']), SCALA)).toBe(
      '4 profondità',
    );
  });

  it('⚠️ la chiave resta la stringa MOSTRATA, virgola decimale compresa', () => {
    // Mai un indice numerico né un float: `1.17 − 0.17` fa
    // `0.9999999999999999`, e su questa scala i decimali sono la metà.
    expect(testoProfondita(new Set(['1', '1,5', '2']), SCALA)).toBe(
      'da 1 a 2 bb',
    );
  });

  it('una scelta che non esiste più nella scala non produce testo', () => {
    // succede fra un cambio di formato e la potatura
    expect(testoProfondita(new Set(['999']), SCALA)).toBeNull();
  });
});

describe('frasePreparazione', () => {
  const base: DatiFrase = {
    mani: 20,
    formati: ['Spin & Go'],
    profondita: null,
    posizioni: [],
    situazioni: [],
    difficolta: 'STANDARD',
  };

  it('la forma «tutto aperto» è una frase italiana leggibile', () => {
    expect(frasePreparazione(base)).toBe(
      'Ti proporremo 20 mani di Spin & Go, a qualsiasi profondità, da qualsiasi posizione e in qualsiasi situazione, escludendo i fold scontati.',
    );
  });

  it('⚠️ dice «ti PROPORREMO», mai «ti serviremo»', () => {
    // «servire una mano» in italiano non si dice: è un calco da *we'll serve
    // you*. Ed è la stringa più letta della pagina.
    expect(frasePreparazione(base)).toContain('Ti proporremo');
    expect(frasePreparazione(base)).not.toContain('serviremo');
  });

  it('la forma piena nomina ogni asse scelto', () => {
    expect(
      frasePreparazione({
        ...base,
        mani: 50,
        formati: ['Spin & Go · Ante'],
        profondita: 'da 8 a 15 bb',
        posizioni: ['BB'],
        situazioni: ['Apertura (RFI)', "Risposta all'apertura"],
      }),
      // ⚠️ «dal BB, su …» e non «dal BB e su …»: l'ultima parte contiene già
      // una sua «e» («apertura e risposta»), e la congiunzione esterna dava
      // due «e» di fila. E «(RFI)» resta MAIUSCOLO dentro la frase.
    ).toBe(
      "Ti proporremo 50 mani di Spin & Go · Ante, da 8 a 15 bb, dal BB, su apertura (RFI) e risposta all'apertura, escludendo i fold scontati.",
    );
  });

  it('più formati e più posizioni si legano con «e», non con una virgola secca', () => {
    const f = frasePreparazione({
      ...base,
      formati: ['Spin & Go', 'Heads-Up'],
      posizioni: ['SB', 'BB'],
    });
    expect(f).toContain('Spin & Go e Heads-Up');
    expect(f).toContain('dai SB e BB');
  });

  it('la coda cambia con la difficoltà, riprendendo le frasi già a schermo', () => {
    expect(frasePreparazione({ ...base, difficolta: 'MARGINAL' })).toContain(
      'solo sui mix al fotofinish',
    );
    expect(frasePreparazione({ ...base, difficolta: 'MIXED_ONLY' })).toContain(
      'solo dove la strategia è mista',
    );
    expect(frasePreparazione({ ...base, difficolta: 'ALL' })).toContain(
      'senza escludere nessuna mano',
    );
  });
});

describe('frasePoolVuoto', () => {
  const base: DatiFrase = {
    mani: 20,
    formati: ['Spin & Go'],
    profondita: null,
    posizioni: [],
    situazioni: [],
    difficolta: 'STANDARD',
  };

  it('⚠️ nomina l’asse che ha svuotato il pool, non un generico «cambia qualcosa»', () => {
    // Il vecchio «cambia posizione o tipo di spot» era vero solo a volte.
    expect(
      frasePoolVuoto({ ...base, situazioni: ['4-bet e oltre'] }),
    ).toContain('togliere «4-bet e oltre»');
    expect(frasePoolVuoto({ ...base, posizioni: ['BTN'] })).toContain(
      'aggiungere una posizione',
    );
    expect(frasePoolVuoto({ ...base, profondita: 'da 1 a 2 bb' })).toContain(
      'allargare l’intervallo',
    );
    expect(frasePoolVuoto(base)).toContain('cambiare formato');
  });
});
