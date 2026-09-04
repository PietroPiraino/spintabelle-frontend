import { PERCORSI, dettaglioPercorso } from './drill-percorsi';

/**
 * ⚠️ Prima di questo file, sotto `features/drills/` non esisteva UNA sola spec:
 * l'espansione delle profondità, la potatura co-dipendente e la derivazione dei
 * formati non erano coperte da niente, e le uniche guardie automatiche che
 * toccano /allenamento (parole, un solo h1, canonical, classi FAQ) guardano il
 * ramo ANONIMO, che nessuno di questi cambiamenti sfiora. Tradotto: si poteva
 * rompere l'intero configuratore con `npm run build` verde e Karma verde.
 */
describe('drill-percorsi', () => {
  const opts = {
    posizioni: [] as string[],
    situazioni: [] as string[],
    minDisponibile: 1,
    maxDisponibile: 33,
  };

  it('il primo percorso è quello in evidenza, e l’ordine è editoriale', () => {
    // La card grande legge `PERCORSI[0]`: cambiando l'ordine cambia la pagina.
    expect(PERCORSI[0].id).toBe('push-fold');
    expect(PERCORSI.length).toBeGreaterThanOrEqual(5);
  });

  it('ogni percorso ha un «perché» scritto: è ciò che la card in evidenza mostra', () => {
    for (const p of PERCORSI) {
      expect(p.perche.length).toBeGreaterThan(40);
      expect(p.titolo.length).toBeGreaterThan(3);
    }
  });

  it('⚠️ nessun percorso nomina una sala, un bonus o una cifra in euro', () => {
    // Art. 9 DL 87/2018: /allenamento è pubblica e prerenderizzata. Anche se il
    // ramo anonimo non mostra i percorsi, una stringa che vive nel bundle è una
    // stringa che prima o poi qualcuno rende.
    const vietate = /€|\beuro\b|bonus|deposit|pokerstars|888|winamax|sisal|snai/i;
    for (const p of PERCORSI) {
      expect(`${p.titolo} ${p.perche}`).not.toMatch(vietate);
    }
  });

  it('senza estremi dice «tutte le profondità», non un intervallo inventato', () => {
    const d = dettaglioPercorso({ id: 'x', titolo: 'x', perche: 'x' }, opts);
    expect(d).toContain('tutte le profondità');
    expect(d).toContain('tutte le posizioni');
  });

  it('con il solo tetto dice «fino a N bb»; col solo pavimento «da N bb in su»', () => {
    expect(
      dettaglioPercorso({ id: 'x', titolo: 'x', perche: 'x', maxBb: 10 }, opts),
    ).toContain('fino a 10 bb');
    expect(
      dettaglioPercorso({ id: 'x', titolo: 'x', perche: 'x', minBb: 20 }, opts),
    ).toContain('da 20 bb in su');
  });

  it('con entrambi gli estremi dice «da A a B bb», con la virgola decimale italiana', () => {
    const d = dettaglioPercorso(
      { id: 'x', titolo: 'x', perche: 'x', minBb: 2.5, maxBb: 7.5 },
      opts,
    );
    expect(d).toContain('da 2,5 a 7,5 bb');
    expect(d).not.toContain('2.5');
  });

  it('elenca posizioni e situazioni quando ci sono, e le tace quando non ci sono', () => {
    const conFiltri = dettaglioPercorso(
      { id: 'x', titolo: 'x', perche: 'x', positions: ['BB'] },
      { ...opts, posizioni: ['BB'], situazioni: ["Risposta all'apertura"] },
    );
    expect(conFiltri).toContain('BB');
    expect(conFiltri).toContain("Risposta all'apertura");
    expect(conFiltri).not.toContain('tutte le posizioni');
  });

  it('la difficoltà entra nella riga solo quando non è quella standard', () => {
    expect(
      dettaglioPercorso(
        { id: 'x', titolo: 'x', perche: 'x', difficulty: 'MARGINAL' },
        opts,
      ),
    ).toContain('solo i mix al fotofinish');
    expect(
      dettaglioPercorso(
        { id: 'x', titolo: 'x', perche: 'x', difficulty: 'STANDARD' },
        opts,
      ),
    ).not.toContain('fotofinish');
  });
});
