import {
  formattaCent,
  formattaCentBreve,
  formattaDelta,
  formattaEur,
  formattaEurBreve,
  formattaFrazione,
  formattaIntero,
} from './denaro';

/**
 * La grammatica del denaro del pannello, nelle sue unità.
 *
 * ⚠️ Le asserzioni sui separatori sono TOLLERANTI (`/1\.?250/`): il Chrome di
 * Karma rende «1250,50 €» dove un browser vero scrive «1.250,50 €», e pinnare
 * il punto farebbe fallire una formattazione corretta in produzione. Lo
 * spazio prima di «€» è uno spazio unificatore.
 */
describe('denaro — le unità che non si incrociano', () => {
  it('formattaCent e formattaEur dicono la stessa cifra da DUE unità diverse', () => {
    expect(formattaCent(125050)).toMatch(/^1\.?250,50\s€$/);
    expect(formattaEur(1250.5)).toMatch(/^1\.?250,50\s€$/);
    // ⚠️ La trappola che i nomi diversi esistono per evitare: gli stessi
    // 125050 letti come euro sono un altro ordine di grandezza.
    expect(formattaEur(125050)).not.toMatch(/1\.?250,50/);
  });

  it('formattaEur non stampa decimali inutili, formattaCent sempre due', () => {
    expect(formattaEur(80)).toMatch(/^80\s€$/);
    expect(formattaEur(80.5)).toMatch(/^80,50\s€$/);
    expect(formattaCent(8000)).toMatch(/^80,00\s€$/);
  });

  it('le versioni brevi per gli assi tagliano i decimali, arrotondando', () => {
    expect(formattaEurBreve(1250.5)).toMatch(/^1\.?251\s€$/);
    expect(formattaCentBreve(125050)).toMatch(/^1\.?251\s€$/);
    expect(formattaCentBreve(0)).toMatch(/^0\s€$/);
  });

  it('formattaFrazione vuole una frazione 0..1 e stampa al più un decimale', () => {
    expect(formattaFrazione(0.25)).toBe('25%');
    expect(formattaFrazione(1 / 3)).toBe('33,3%');
    expect(formattaFrazione(1)).toBe('100%');
    expect(formattaFrazione(0)).toBe('0%');
  });

  it('formattaDelta vuole punti percentuali già calcolati e porta il segno', () => {
    expect(formattaDelta(12.5)).toBe('+12,5%');
    expect(formattaDelta(-3)).toBe('-3%');
    expect(formattaDelta(0)).toBe('0%');
    // ⚠️ Un delta passato per sbaglio a formattaFrazione sbaglia di 100 volte.
    expect(formattaFrazione(12.5)).not.toBe('+12,5%');
  });

  it('formattaIntero raggruppa le migliaia e non inventa decimali', () => {
    expect(formattaIntero(150000)).toMatch(/^150\.?000$/);
    expect(formattaIntero(7)).toBe('7');
    expect(formattaIntero(2.6)).toBe('3');
  });
});
