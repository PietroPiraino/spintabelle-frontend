import { HandView } from '../../../core/models/api.models';
import {
  carteVisibili,
  passi,
  postiSullOvale,
  statoAlPasso,
} from './replay-state';

/**
 * Prove della logica del replayer.
 *
 * ⚠️ **Sono funzioni pure e si provano senza montare nulla**: è la parte che
 * deve essere *giusta* — il piatto, le fiche davanti a ciascuno, gli stack,
 * quali carte è lecito mostrare — e un test che dovesse istanziare un
 * componente per verificarla finirebbe per provare il template invece della
 * regola.
 *
 * ⚠️⚠️ **I tre gruppi marcati «REGRESSIONE» pinnano difetti MISURATI su 17 mani
 * vere il 26/08/2026**, non ipotesi. La versione precedente li aveva tutti e
 * tre, e questa stessa spec li lasciava passare perché la mano finta qui sotto
 * era costruita male: dichiarava `potFinale: 190` dove il piatto vero è **130**,
 * cioè conteneva essa stessa l'errore che avrebbe dovuto cogliere. Una fixture
 * è un'affermazione sul mondo, e va verificata come tutte le altre.
 */

/**
 * Uno Spin & Go 3-max ridotto all'osso, con numeri verificabili a mano.
 *
 * Preflop: SB 10, BB 20, il bottone rilancia a 60, SB passa, BB chiama.
 *   → nel piatto 10 + 60 + 60 = **130**.
 * Flop: BB bussa, il bottone punta 60, BB passa.
 *   → nessuno ha coperto quei 60: **tornano al bottone**, il piatto resta 130.
 */
function mano(): HandView {
  return {
    publicId: 'ABCDEFGHJK',
    ogImageUrl: '',
    room: 'pokerstars',
    roomLabel: 'PokerStars',
    network: 'POKERSTARS',
    gameType: 'SPIN',
    gameTypeLabel: 'Spin & Go',
    playedAt: null,
    tableSize: 3,
    tableMax: 3,
    decimali: 0,
    currency: null,
    smallBlind: 10,
    bigBlind: 20,
    ante: 0,
    heroSeat: 1,
    players: [
      { seat: 1, nome: 'Hero', chipsIniziali: 500, posizione: 'BTN', isHero: true, carte: ['As', 'Kd'] },
      { seat: 2, nome: 'Villain2', chipsIniziali: 500, posizione: 'SB', isHero: false },
      { seat: 3, nome: 'Villain3', chipsIniziali: 500, posizione: 'BB', isHero: false, carte: ['Th', 'Tc'] },
    ],
    streets: [
      {
        strada: 'PREFLOP',
        board: [],
        // 10 + 60 + 60 = 130 nel piatto; nessuno scoperto.
        pot: 0,
        raccolto: 130,
        restituzione: null,
        azioni: [
          { seat: 2, tipo: 'SB', importo: 10, totaleStrada: 10, potDopo: 10 },
          { seat: 3, tipo: 'BB', importo: 20, totaleStrada: 20, potDopo: 30 },
          { seat: 1, tipo: 'RAISE', importo: 60, totaleStrada: 60, potDopo: 90 },
          { seat: 2, tipo: 'FOLD', importo: 0, totaleStrada: 10, potDopo: 90 },
          { seat: 3, tipo: 'CALL', importo: 40, totaleStrada: 60, potDopo: 130 },
        ],
      },
      {
        strada: 'FLOP',
        board: ['7h', '2c', 'Ts'],
        // ⚠️ Nessuno ha coperto i 60 del bottone: nel piatto non entra nulla e
        // quei 60 tornano indietro. `potDopo` dice 190 e ha torto — è
        // l'accumulatore che comprende la puntata non chiamata.
        pot: 130,
        raccolto: 0,
        restituzione: { seat: 1, importo: 60 },
        azioni: [
          { seat: 3, tipo: 'CHECK', importo: 0, totaleStrada: 0, potDopo: 130 },
          { seat: 1, tipo: 'BET', importo: 60, totaleStrada: 60, potDopo: 190 },
          { seat: 3, tipo: 'FOLD', importo: 0, totaleStrada: 0, potDopo: 190 },
        ],
      },
    ],
    board: ['7h', '2c', 'Ts'],
    potFinale: 130,
    rake: 0,
    risultati: [{ seat: 1, vinto: 130 }],
    // La mano non ha showdown e non ha all-in: niente punto, niente EV.
    punto: null,
    equityEroe: null,
    chipsAttese: null,
    evDiff: null,
    evStima: false,
    // Il bottone mette 120 in tutto, ne riprende 60 e ne vince 130: +70.
    netti: [
      { seat: 1, netto: 70 },
      { seat: 2, netto: -10 },
      { seat: 3, netto: -60 },
    ],
    anonimizzata: false,
    likes: 0,
    dislikes: 0,
    createdAt: '2026-08-25T00:00:00.000Z',
  };
}

/**
 * La stessa mano finita **all-in preflop**, col run-out fino al river e
 * **nessuna azione** dopo il preflop: è la forma di un terzo del corpus, ed è
 * la forma su cui il replayer precedente si rompeva del tutto.
 */
function manoAllIn(): HandView {
  return {
    ...mano(),
    publicId: 'RUNOUTAAAA',
    ante: 5,
    streets: [
      {
        strada: 'PREFLOP',
        board: [],
        // ⚠️ Le ante (15) sono già nel piatto all'apertura, quindi `pot` a
        // inizio strada vale 15; il raccolto sono le sole puntate: 495 + 495.
        pot: 15,
        raccolto: 990,
        restituzione: null,
        azioni: [
          { seat: 1, tipo: 'ANTE', importo: 5, totaleStrada: 5, potDopo: 5 },
          { seat: 2, tipo: 'ANTE', importo: 5, totaleStrada: 5, potDopo: 10 },
          { seat: 3, tipo: 'ANTE', importo: 5, totaleStrada: 5, potDopo: 15 },
          { seat: 2, tipo: 'SB', importo: 10, totaleStrada: 10, potDopo: 25 },
          { seat: 3, tipo: 'BB', importo: 20, totaleStrada: 20, potDopo: 45 },
          { seat: 1, tipo: 'FOLD', importo: 0, totaleStrada: 0, potDopo: 45 },
          { seat: 2, tipo: 'ALLIN', importo: 485, totaleStrada: 495, potDopo: 540 },
          { seat: 3, tipo: 'CALL', importo: 475, totaleStrada: 495, potDopo: 1015 },
        ],
      },
      { strada: 'FLOP', board: ['7h', '2c', 'Ts'], pot: 1005, raccolto: 0, restituzione: null, azioni: [] },
      { strada: 'TURN', board: ['7h', '2c', 'Ts', 'Qd'], pot: 1005, raccolto: 0, restituzione: null, azioni: [] },
      { strada: 'RIVER', board: ['7h', '2c', 'Ts', 'Qd', '3s'], pot: 1005, raccolto: 0, restituzione: null, azioni: [] },
    ],
    board: ['7h', '2c', 'Ts', 'Qd', '3s'],
    potFinale: 1005, // 15 di ante + 495 + 495
    risultati: [{ seat: 3, vinto: 1005, mostrate: ['Th', 'Tc'] }],
    netti: [
      { seat: 1, netto: -5 },
      { seat: 2, netto: -500 },
      { seat: 3, netto: 505 },
    ],
  };
}

const tipi = (m: HandView) => passi(m).map((p) => p.tipo);
const fine = (m: HandView, mostraTutto = false) =>
  statoAlPasso(m, passi(m).length - 1, mostraTutto);

describe('replay-state', () => {
  const m = mano();

  describe('la sequenza degli eventi', () => {
    it('apre con ante e bui, non con un tavolo vuoto', () => {
      const p = passi(m);
      expect(p[0].tipo).toBe('APERTURA');
      expect(p[0].forzate?.map((a) => a.tipo)).toEqual(['SB', 'BB']);

      // ⚠️ Al passo 0 i soldi morti sono GIÀ sul feltro. Prima il passo 0 era un
      // fotogramma morto — piatto a zero e feltro pulito — e una mano non
      // comincia così: comincia con i bui in mezzo, che sono la ragione per cui
      // la si gioca.
      const st = statoAlPasso(m, 0);
      expect(st.inGioco).toBe(30);
      expect(st.seggi.find((s) => s.seat === 2)!.davanti).toBe(10);
      expect(st.seggi.find((s) => s.seat === 3)!.davanti).toBe(20);
    });

    it('chiude ogni strada raccogliendo, e apre la successiva scoprendo le carte', () => {
      const t = tipi(m);
      const iRaccolta = t.indexOf('RACCOLTA');
      const iCarte = t.indexOf('CARTE');
      expect(iRaccolta).toBeGreaterThan(-1);
      // ⚠️ Prima si raccoglie, poi escono le carte: è l'ordine del tavolo.
      expect(iCarte).toBeGreaterThan(iRaccolta);
    });

    it('finisce con l’assegnazione del piatto', () => {
      expect(tipi(m).at(-1)).toBe('ASSEGNAZIONE');
    });

    it('⚠️ niente showdown se nessuno ha mostrato le carte', () => {
      // Fingerlo insegnerebbe una cosa falsa, e scoprirebbe carte che al tavolo
      // nessuno ha visto.
      expect(tipi(m)).not.toContain('SHOWDOWN');
      expect(tipi(manoAllIn())).toContain('SHOWDOWN');
    });

    it('non emette raccolte a vuoto', () => {
      // Una strada passata a bussare non muove una fiche, e un passo in cui non
      // cambia niente si legge come un comando che non ha funzionato.
      const soloCheck: HandView = {
        ...m,
        streets: [
          m.streets[0],
          {
            strada: 'FLOP',
            board: ['7h', '2c', 'Ts'],
            // Bussano entrambi: non si muove una fiche.
            pot: 130,
            raccolto: 0,
            restituzione: null,
            azioni: [
              { seat: 3, tipo: 'CHECK', importo: 0, totaleStrada: 0, potDopo: 130 },
              { seat: 1, tipo: 'CHECK', importo: 0, totaleStrada: 0, potDopo: 130 },
            ],
          },
        ],
        potFinale: 130,
        risultati: [{ seat: 1, vinto: 130 }],
      };
      expect(tipi(soloCheck).filter((x) => x === 'RACCOLTA').length).toBe(1);
    });
  });

  describe('⚠️ REGRESSIONE — il run-out di una mano finita all-in', () => {
    const allIn = manoAllIn();

    it('le carte comuni ESCONO, una strada alla volta', () => {
      // Il difetto: `passi()` emetteva un passo per ogni AZIONE, e una strada
      // con `azioni: []` non ne produceva nessuno. In una mano all-in preflop il
      // flop, il turn e il river non comparivano MAI: il tavolo restava con
      // cinque caselle vuote fino alla fine. Erano 5 mani su 17 del corpus, e
      // negli Spin & Go l'all-in preflop è il caso tipico.
      expect(tipi(allIn).filter((x) => x === 'CARTE').length).toBe(3);
      expect(fine(allIn).board).toEqual(allIn.board);
    });

    it('ogni strada è visibile a un qualche passo', () => {
      const viste = passi(allIn).map((_, i) =>
        statoAlPasso(allIn, i, false).board.join(','),
      );
      for (const s of allIn.streets) {
        expect(viste).toContain((s.board ?? []).join(','));
      }
    });
  });

  describe('⚠️ REGRESSIONE — la puntata non chiamata torna indietro', () => {
    it('il piatto finale è quello VERO, non `potDopo`', () => {
      // Il difetto: si mostrava `azione.potDopo`, che comprende anche la puntata
      // che nessuno ha coperto. Su 15 mani su 17 il piatto finale usciva
      // gonfiato, fino a 4,3 volte il vero.
      expect(fine(m).pot).toBe(130);
      expect(fine(m).pot).not.toBe(190); // ← il numero sbagliato di prima
    });

    it('c’è un passo in cui le fiche non coperte tornano allo stack', () => {
      expect(tipi(m)).toContain('RESTITUZIONE');
      const st = fine(m);
      // Il bottone ha messo 60 preflop e 60 sul flop; i 60 del flop tornano, poi
      // vince 130. 500 − 60 + 130 = 570.
      expect(st.seggi.find((s) => s.seat === 1)!.chips).toBe(570);
      expect(st.inGioco).toBe(0);
    });

    it('⚠️ chi non è stato chiamato NON è all-in', () => {
      // Era la bugia più visibile: un rilancio non chiamato azzerava lo stack
      // calcolato e il posto annunciava «all-in» a chi aveva ancora tutto.
      // ⚠️ Cambiando l'azione va cambiata **anche** la riga del denaro: da
      // quando il piatto lo calcola il server, mutare un'azione non aggiorna
      // più i totali della strada — e una fixture incoerente è il modo più
      // rapido per far passare un test che dovrebbe fallire.
      const grosso = mano();
      grosso.streets[1] = {
        ...grosso.streets[1],
        raccolto: 0,
        restituzione: { seat: 1, importo: 440 },
        azioni: [
          grosso.streets[1].azioni[0],
          { seat: 1, tipo: 'BET', importo: 440, totaleStrada: 440, potDopo: 570 },
          grosso.streets[1].azioni[2],
        ],
      };
      const st = fine(grosso);
      expect(st.seggi.find((s) => s.seat === 1)!.allIn).toBe(false);
      expect(st.seggi.find((s) => s.seat === 1)!.chips).toBeGreaterThan(0);
    });

    it('le ante entrano nel piatto UNA volta sola', () => {
      // Contarle sia all'apertura sia alla raccolta gonfiava il piatto di
      // esattamente il loro totale.
      expect(fine(manoAllIn()).pot).toBe(1005);
    });
  });

  describe('⚠️ REGRESSIONE — il denaro si conserva', () => {
    it('la somma delle fiche a fine mano è quella di partenza', () => {
      for (const h of [mano(), manoAllIn()]) {
        const iniziale = h.players.reduce((a, p) => a + p.chipsIniziali, 0);
        const finale = fine(h).seggi.reduce((a, s) => a + s.chips, 0);
        expect(finale + h.rake).toBe(iniziale);
      }
    });

    it('nessuno stack va sotto zero, a nessun passo', () => {
      for (const h of [mano(), manoAllIn()]) {
        for (let i = 0; i < passi(h).length; i++) {
          const st = statoAlPasso(h, i);
          expect(st.seggi.every((s) => s.chips >= 0)).toBe(true);
          expect(st.pot).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('il momento della decisione', () => {
    it('⚠️ dice chi DEVE agire, non solo chi ha agito', () => {
      // Senza questo il replayer sa raccontare una risposta ma non sa mai porre
      // la domanda — e la domanda è l'unico momento in cui si impara.
      const st = statoAlPasso(m, 0);
      expect(st.seggi.find((s) => s.deveAgire)?.seat).toBe(1); // parla il bottone
      expect(st.seggi.some((s) => s.diTurno)).toBe(false); // nessuno ha ancora agito
    });

    it('dice quanto manca da chiamare e che equity serve', () => {
      const st = statoAlPasso(m, 0);
      // Sul feltro ci sono 30 (10 + 20); il bottone deve pareggiare i 20 del BB.
      expect(st.seggi.find((s) => s.seat === 1)!.daPareggiare).toBe(20);
      expect(st.quote?.daChiamare).toBe(20);
      // 20 da mettere per vincerne 30 + 20 → serve avere ragione il 40% delle volte.
      expect(st.quote?.equityNecessaria).toBeCloseTo(0.4, 3);
    });

    it('nessuna quota quando non c’è niente da chiamare', () => {
      const soloCheck: HandView = {
        ...m,
        streets: [
          m.streets[0],
          {
            strada: 'FLOP',
            board: ['7h', '2c', 'Ts'],
            // Bussano entrambi: non si muove una fiche.
            pot: 130,
            raccolto: 0,
            restituzione: null,
            azioni: [
              { seat: 3, tipo: 'CHECK', importo: 0, totaleStrada: 0, potDopo: 130 },
              { seat: 1, tipo: 'CHECK', importo: 0, totaleStrada: 0, potDopo: 130 },
            ],
          },
        ],
      };
      const iCarte = tipi(soloCheck).indexOf('CARTE');
      expect(statoAlPasso(soloCheck, iCarte).quote).toBeNull();
    });

    it('lo stack effettivo è il più piccolo fra chi è ancora in gioco', () => {
      const corto = mano();
      corto.players[2].chipsIniziali = 120;
      // Dopo il fold della SB restano bottone (500) e BB (120).
      const st = statoAlPasso(corto, 2);
      expect(st.stackEffettivo).toBe(120);
    });
  });

  describe('stato al passo', () => {
    it('il piatto e gli stack seguono le azioni', () => {
      const st = statoAlPasso(m, tipi(m).indexOf('RACCOLTA'));
      expect(st.pot).toBe(130);
      expect(st.seggi.find((s) => s.seat === 1)!.chips).toBe(440); // 500 − 60
      expect(st.seggi.find((s) => s.seat === 3)!.chips).toBe(440);
      expect(st.seggi.find((s) => s.seat === 2)!.chips).toBe(490); // 500 − 10
    });

    it('⚠️ le fiche davanti si AZZERANO quando la strada si chiude', () => {
      // Senza l'azzeramento resterebbero davanti a chi le ha messe, e
      // sembrerebbe che abbia puntato di nuovo sulla strada nuova.
      const iRacc = tipi(m).indexOf('RACCOLTA');
      expect(statoAlPasso(m, iRacc - 1).seggi.find((s) => s.seat === 3)!.davanti).toBe(60);
      expect(statoAlPasso(m, iRacc).seggi.find((s) => s.seat === 3)!.davanti).toBe(0);
    });

    it('⚠️ il board di una strada è visibile dal suo PRIMO istante', () => {
      // Girare il flop solo dopo la prima azione mostrerebbe un tavolo vuoto
      // mentre qualcuno ci sta puntando sopra.
      const st = statoAlPasso(m, tipi(m).indexOf('CARTE'));
      expect(st.board).toEqual(['7h', '2c', 'Ts']);
    });

    it('chi passa resta al tavolo ma marcato', () => {
      const sb = statoAlPasso(m, 2).seggi.find((s) => s.seat === 2)!;
      expect(sb.passato).toBe(true);
      expect(sb.attivo).toBe(false);
    });

    it('⚠️ all-in quando lo stack finisce senza che il formato lo dica', () => {
      // Nei resoconti iPoker un rilancio che esaurisce lo stack resta `RAISE`.
      const tutta = mano();
      const az = [...tutta.streets[0].azioni];
      az[2] = { seat: 1, tipo: 'RAISE', importo: 500, totaleStrada: 500, potDopo: 530 };
      az[4] = { seat: 3, tipo: 'CALL', importo: 480, totaleStrada: 500, potDopo: 1010 };
      // 500 + 500 + i 10 del piccolo buio che ha passato.
      tutta.streets = [{ ...tutta.streets[0], raccolto: 1010, restituzione: null, azioni: az }];
      expect(statoAlPasso(tutta, 1).seggi.find((s) => s.seat === 1)!.allIn).toBe(true);
    });

    it('a mano finita il vincitore ha incassato', () => {
      const st = fine(m);
      expect(st.finita).toBe(true);
      expect(st.seggi.find((s) => s.seat === 1)!.vinto).toBe(130);
      expect(st.seggi.filter((s) => s.vinto).length).toBe(1);
    });
  });

  describe('⚠️ carte visibili — la regola pedagogica della sezione', () => {
    it('l’eroe vede le sue carte dall’inizio', () => {
      expect(carteVisibili(m.players[0], false, false)).toEqual(['As', 'Kd']);
    });

    it('⚠️ le carte del villain NON si vedono prima dello showdown', () => {
      // Un replayer che scopre la mano del villain alla prima strada non insegna
      // niente: chi guarda valuta la decisione sapendo già la risposta.
      expect(carteVisibili(m.players[2], false, false)).toEqual([]);
    });

    it('allo showdown si scoprono, ma solo di chi ha mostrato', () => {
      const st = fine(manoAllIn());
      expect(st.seggi.find((s) => s.seat === 3)!.carte).toEqual(['Th', 'Tc']);
      expect(st.seggi.find((s) => s.seat === 2)!.carte).toEqual([]);
    });

    it('«mostra tutto» le scopre subito, ma è una scelta esplicita', () => {
      expect(carteVisibili(m.players[2], false, true)).toEqual(['Th', 'Tc']);
    });

    it('chi non ha mostrato non ha carte da mostrare nemmeno alla fine', () => {
      expect(carteVisibili(m.players[1], true, true)).toEqual([]);
    });
  });

  describe('⚠️ posizione dei posti: l’eroe sta SEMPRE in basso', () => {
    it('l’eroe è il posto più in basso', () => {
      const posti = postiSullOvale(m.players);
      const yEroe = posti.get(1)!.y;
      for (const p of m.players.filter((x) => !x.isHero)) {
        expect(posti.get(p.seat)!.y).toBeLessThan(yEroe);
      }
    });

    it('⚠️ gli altri RUOTANO, non si riordinano: l’ordine reale resta', () => {
      // Riordinare invece di ruotare distruggerebbe l'informazione «chi parla
      // prima di chi», che è metà del senso di una mano.
      const posti = postiSullOvale(m.players);
      expect(posti.size).toBe(3);
      expect(new Set([...posti.values()].map((p) => `${p.x}|${p.y}`)).size).toBe(3);
    });

    it('regge una mano senza eroe (osservata) senza lanciare', () => {
      const senza = m.players.map((p) => ({ seat: p.seat, isHero: false }));
      expect(() => postiSullOvale(senza)).not.toThrow();
      expect(postiSullOvale(senza).size).toBe(3);
    });

    it('regge l’heads-up', () => {
      const due = [
        { seat: 1, isHero: true },
        { seat: 2, isHero: false },
      ];
      expect(postiSullOvale(due).size).toBe(2);
    });
  });
});
