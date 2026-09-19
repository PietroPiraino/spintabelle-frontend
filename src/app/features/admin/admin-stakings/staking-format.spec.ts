import type { StakingTipo } from '../../../core/models/api.models';
import {
  CODICI_MOVIMENTO_STAKING,
  MOVIMENTI_STAKING,
  formattaCent,
  parseImportoInCent,
  testoEv,
  voceDaMovimento,
  voceMovimento,
} from './staking-format';

describe('staking-format', () => {
  describe('parseImportoInCent — il punto è ambiguo in italiano', () => {
    it('la virgola è sempre il decimale', () => {
      expect(parseImportoInCent('1.250,50')).toBe(125_050);
      expect(parseImportoInCent('12,5')).toBe(1_250);
      expect(parseImportoInCent('0,01')).toBe(1);
    });

    it('⚠️ un punto con una o due cifre dopo è un DECIMALE, non migliaia', () => {
      // La scorciatoia «cancella tutti i punti» trasformerebbe 12.50 in 1250
      // centesimi: cioè moltiplicherebbe per cento un importo su due, in
      // silenzio, su un campo di denaro.
      expect(parseImportoInCent('12.50')).toBe(1_250);
      expect(parseImportoInCent('12.5')).toBe(1_250);
    });

    it('un punto con tre cifre dopo sono MIGLIAIA', () => {
      expect(parseImportoInCent('1.250')).toBe(125_000);
      expect(parseImportoInCent('1.250.000')).toBe(125_000_000);
    });

    it('regge segno, spazi e simbolo di valuta', () => {
      expect(parseImportoInCent('-340')).toBe(-34_000);
      expect(parseImportoInCent(' 340 € ')).toBe(34_000);
      expect(parseImportoInCent('+12,00')).toBe(1_200);
    });

    it('⚠️ rifiuta ciò che Number() accetterebbe di nascosto', () => {
      // `Number('0x10')` vale 16 e `Number('0b11')` vale 3: su un campo importo
      // sono stringhe che nessuno ha inteso scrivere, e passarle in silenzio è
      // peggio che rifiutarle.
      expect(parseImportoInCent('0x10')).toBeNull();
      expect(parseImportoInCent('0b11')).toBeNull();
      expect(parseImportoInCent('1e3')).toBeNull();
      expect(parseImportoInCent('abc')).toBeNull();
      expect(parseImportoInCent('')).toBeNull();
      expect(parseImportoInCent('12,345')).toBeNull(); // tre decimali
    });

    it('non perde centesimi per colpa della virgola mobile', () => {
      // `12.35 * 100` in IEEE754 vale 1234.9999999999998: con un troncamento si
      // perderebbe un centesimo a ogni movimento, e in un libro mastro non
      // torna più indietro.
      for (const [testo, atteso] of [
        ['12,35', 1_235],
        ['8,29', 829],
        ['1,15', 115],
        ['70,07', 7_007],
      ] as const) {
        expect(parseImportoInCent(testo)).toBe(atteso);
      }
    });
  });

  describe('formattaCent scrive gli euro all’italiana', () => {
    // Lo spazio prima del simbolo è un no-break: normalizzato per confrontarlo.
    const f = (cent: number) => formattaCent(cent).replace(/\s/g, ' ');

    it('virgola decimale e simbolo in coda', () => {
      expect(f(0)).toBe('0,00 €');
      expect(f(34_000)).toBe('340,00 €');
    });

    it('⚠️ l’italiano NON raggruppa i numeri a quattro cifre', () => {
      // `minimumGroupingDigits: 2` per questo locale: «1250,50 €» è corretto e
      // «1.250,50 €» sarebbe sbagliato. Verificato con Intl, non dedotto — ed è
      // il tipo di dettaglio su cui si scrive un'asserzione sbagliata e poi si
      // "corregge" il codice che invece funzionava.
      expect(f(125_050)).toBe('1250,50 €');
      expect(f(1_250_050)).toBe('12.500,50 €');
    });
  });

  describe('testoEv', () => {
    it('zero è «In pari», non una cella vuota', () => {
      // Il vuoto si legge come dato mancante e manda a cercare un guasto.
      expect(testoEv(0)).toBe('In pari');
    });

    it('un debito si mostra come quantità positiva, con la parola che lo spiega', () => {
      // Un «−340,00 €» in una colonna di numeri si legge male e si confonde con
      // una perdita di cassa.
      expect(testoEv(-34_000)).toContain('340,00');
      expect(testoEv(-34_000)).toContain('da recuperare');
      expect(testoEv(-34_000)).not.toContain('-');
    });
  });

  describe('MOVIMENTI_STAKING — il verso lo porta la voce, non il meno digitato', () => {
    it('sei voci: ogni asse nei due versi, ogni coppia una volta sola', () => {
      // Il registro è append-only: se una coppia (tipo, segno) mancasse, quella
      // scrittura non avrebbe compensativa dall'interfaccia e un errore
      // diventerebbe permanente. Se fosse doppia, lo storico avrebbe due nomi
      // per lo stesso movimento.
      expect(MOVIMENTI_STAKING.length).toBe(6);
      expect(MOVIMENTI_STAKING.map((v) => v.codice)).toEqual([
        ...CODICI_MOVIMENTO_STAKING,
      ]);
      const coppie = new Set(MOVIMENTI_STAKING.map((v) => `${v.tipo}${v.segno}`));
      expect(coppie.size).toBe(6);
      for (const tipo of ['FONDI', 'EV', 'PERDITA'] as const) {
        expect(coppie.has(`${tipo}1`)).withContext(`${tipo} in positivo`).toBeTrue();
        expect(coppie.has(`${tipo}-1`)).withContext(`${tipo} in negativo`).toBeTrue();
      }
    });

    it('⚠️ la tasca si chiede SOLO sui fondi, nei due versi', () => {
      // Il server rifiuta la cassa con un 400 su EV e PERDITA: un'etichetta su
      // quelle voci farebbe comparire un campo che porta dritto a un errore.
      for (const v of MOVIMENTI_STAKING) {
        expect(v.etichettaCassa !== undefined)
          .withContext(v.codice)
          .toBe(v.tipo === 'FONDI');
      }
      expect(voceMovimento('ANTICIPO').etichettaCassa).toBe('Da quale portafoglio');
      expect(voceMovimento('RIENTRO').etichettaCassa).toBe('In quale portafoglio');
    });

    it('voceDaMovimento ritrova la voce da tipo e segno, per ogni voce', () => {
      // L'andata-ritorno è ciò che tiene allineati il select e il badge dello
      // storico: sono la stessa tabella letta nei due versi.
      for (const v of MOVIMENTI_STAKING) {
        expect(voceDaMovimento(v.tipo, v.segno * 100)).withContext(v.codice).toBe(v);
      }
    });

    it('lo storico chiama un FONDI negativo «Rientro» e una PERDITA positiva «Storno perdita»', () => {
      // Prima diceva «Fondi −750,00 €»: il verso andava dedotto dal meno, cioè
      // esattamente il difetto che il form aveva in scrittura.
      expect(voceDaMovimento('FONDI', -75_000).breve).toBe('Rientro');
      expect(voceDaMovimento('FONDI', 45_000).breve).toBe('Anticipo');
      expect(voceDaMovimento('EV', -10_000).breve).toBe('Debito EV');
      expect(voceDaMovimento('EV', 10_000).breve).toBe('Recupero EV');
      expect(voceDaMovimento('PERDITA', -40_000).breve).toBe('Perso');
      expect(voceDaMovimento('PERDITA', 40_000).breve).toBe('Storno perdita');
    });

    it('un tipo ignoto è un errore, non un badge vuoto', () => {
      // Lo `switch` è esaustivo per il compilatore; a runtime un valore fuori
      // dall'enum (un asse nuovo lato server) deve gridare, non stampare niente.
      expect(() => voceDaMovimento('ALTRO' as StakingTipo, 100)).toThrow();
    });
  });
});
