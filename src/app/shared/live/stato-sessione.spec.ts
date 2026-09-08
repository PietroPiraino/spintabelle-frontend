import { ANTICIPO_APERTURA_MIN, isLiveNow, quandoManca, statoSessione } from './stato-sessione';

/**
 * ⚠️ Queste funzioni vivevano DENTRO `LiveComponent` come metodi `protected`, e
 * dall'08/09/2026 hanno due consumatori: la pagina pubblica e il pannello
 * admin. La spec esiste per pinnare il comportamento al momento del trasloco:
 * la tentazione di «migliorare» la soglia dei 60 minuti mentre si sposta il
 * codice è il modo con cui le due schermate divergono senza che nessuno se ne
 * accorga.
 */
describe('stato-sessione', () => {
  const T = new Date('2026-09-08T20:00:00.000Z').getTime();
  const fra = (min: number) => new Date(T + min * 60_000).toISOString();

  describe('statoSessione', () => {
    it('«ora» dall’inizio fino alla durata dichiarata', () => {
      expect(statoSessione({ startsAt: fra(0), durationMin: 60 }, T)).toBe('ora');
      expect(statoSessione({ startsAt: fra(-59), durationMin: 60 }, T)).toBe('ora');
    });

    it('«terminata» appena la durata è passata', () => {
      expect(statoSessione({ startsAt: fra(-61), durationMin: 60 }, T)).toBe('terminata');
    });

    it('⚠️ senza durata dichiarata la finestra è di 90 minuti', () => {
      // Il ripiego non è un dettaglio: `durationMin` è opzionale sullo schema, e
      // senza questo ramo una sessione che non la dichiara risulterebbe
      // terminata nell'istante stesso in cui comincia.
      expect(statoSessione({ startsAt: fra(-89) }, T)).toBe('ora');
      expect(statoSessione({ startsAt: fra(-91) }, T)).toBe('terminata');
    });

    it('«imminente» entro la soglia, «programmata» oltre', () => {
      expect(statoSessione({ startsAt: fra(ANTICIPO_APERTURA_MIN - 1) }, T)).toBe('imminente');
      expect(statoSessione({ startsAt: fra(ANTICIPO_APERTURA_MIN + 1) }, T)).toBe('programmata');
    });

    it('⚠️ la soglia è 60: è lo stesso numero di LIVE_REMINDER_MINUTES', () => {
      // Due anticipi diversi vorrebbero dire che l'avviso Discord «live in
      // arrivo» parte quando il sito dice ancora di no.
      expect(ANTICIPO_APERTURA_MIN).toBe(60);
    });

    it('`ended` vince su tutto, anche su una sessione in corso', () => {
      expect(statoSessione({ startsAt: fra(0), durationMin: 60, ended: true }, T)).toBe('terminata');
      expect(isLiveNow({ startsAt: fra(0), durationMin: 60, ended: true }, T)).toBe(false);
    });
  });

  describe('quandoManca', () => {
    it('minuti, ore, domani, giorni', () => {
      expect(quandoManca({ startsAt: fra(42) }, T)).toBe('fra 42 minuti');
      expect(quandoManca({ startsAt: fra(1) }, T)).toBe('fra 1 minuto');
      expect(quandoManca({ startsAt: fra(180) }, T)).toBe('fra 3 ore');
      expect(quandoManca({ startsAt: fra(60) }, T)).toBe('fra 1 ora');
      expect(quandoManca({ startsAt: fra(60 * 24) }, T)).toBe('domani');
      expect(quandoManca({ startsAt: fra(60 * 24 * 5) }, T)).toBe('fra 5 giorni');
    });

    it('su una sessione già cominciata non dice niente', () => {
      expect(quandoManca({ startsAt: fra(-1) }, T)).toBe('');
    });
  });
});
