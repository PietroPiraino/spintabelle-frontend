import {
  METODI_PAGAMENTO,
  incassanteLabel,
  metodoLabelDaSlug,
  metodoPagamentoLabel,
  motivoSenzaCassa,
} from './metodo-pagamento';

describe('metodo-pagamento', () => {
  it('⚠️ NESSUN metodo torna lo slug grezzo, ed è il test che mancava', () => {
    // ⚠️⚠️ È la guardia che il difetto in produzione non aveva: `methodLabel`
    // era una catena di `if` con `return 'PayPal'` in fondo, quindi `contanti`
    // — aggiunto dopo — si leggeva **«PayPal»** in `/admin/richieste`. Nessun
    // test iterava sull'elenco, quindi nessuno lo ha visto.
    for (const m of METODI_PAGAMENTO) {
      const etichetta = metodoPagamentoLabel(m);
      expect(etichetta.length).toBeGreaterThan(0);
      expect(etichetta).not.toBe(m);
    }
  });

  it('le cinque etichette sono quelle attese', () => {
    expect(metodoPagamentoLabel('paypal')).toBe('PayPal');
    expect(metodoPagamentoLabel('skrill')).toBe('Skrill');
    expect(metodoPagamentoLabel('contanti')).toBe('Contanti');
    expect(metodoPagamentoLabel('punti')).toBe('Punti BFF');
    expect(metodoPagamentoLabel('manuale')).toBe('Concesso da admin');
  });

  it('da una stringa ignota torna la stringa, non un metodo plausibile', () => {
    expect(metodoLabelDaSlug('contanti')).toBe('Contanti');
    // ⚠️ Il ripiego è lo SLUG e non «PayPal»: davanti a un valore che non
    // conosciamo, mostrare un metodo sarebbe un'affermazione falsa; mostrare la
    // stringa è una domanda, e chi legge capisce che c'è da guardare.
    expect(metodoLabelDaSlug('bonifico_futuro')).toBe('bonifico_futuro');
  });

  it('i due incassanti hanno un nome', () => {
    expect(incassanteLabel('PIETRO')).toBe('Pietro');
    expect(incassanteLabel('EXIVEZZZ')).toBe('Exivezzz');
  });

  it('il motivo «senza cassa» distingue punti, concessione e omaggio', () => {
    expect(motivoSenzaCassa('contanti', true)).toBeNull();
    expect(motivoSenzaCassa('punti', false)).toBe('punti');
    expect(motivoSenzaCassa('manuale', false)).toBe('concessione');
    // ⚠️ Il caso non ovvio: metodo di CASSA ma zero euro dovuti — un buono al
    // 100%. Non è né punti né concessione, ed è la ragione per cui le
    // Statistiche hanno una terza colonna.
    expect(motivoSenzaCassa('paypal', false)).toBe('omaggio');
  });
});
