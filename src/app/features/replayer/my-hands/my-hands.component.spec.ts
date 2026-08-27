import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import {
  HandActionView,
  HandMineView,
  HandStreetName,
  HandStreetView,
} from '../../../core/models/api.models';
import { AuthService } from '../../../core/services/auth.service';
import { HandsService } from '../../../core/services/hands.service';
import { MyHandsComponent } from './my-hands.component';

/**
 * Le tre cose che questa tabella deve garantire e che nessun test puro può
 * vedere, perché vivono nel montaggio:
 *
 * 1. ⚠️ **Una riga senza `punto` e senza `evDiff` resta CORRETTA.** I due campi
 *    li stanno costruendo altri due lotti e possono non esserci: la cella deve
 *    restare vuota, non stampare `undefined` né far saltare la riga.
 * 2. ⚠️ **Le azioni dell'eroe si distinguono**: senza la marcatura, la colonna
 *    delle strade è decorazione.
 * 3. ⚠️ **La selezione si azzera quando cambia ciò che si vede**: tenerla viva
 *    su righe non più a schermo vuol dire cancellare a scatola chiusa.
 */

const az = (
  seat: number,
  tipo: string,
  importo: number,
  totaleStrada: number,
): HandActionView => ({ seat, tipo, importo, totaleStrada, potDopo: 0 });

const strada = (
  nome: HandStreetName,
  board: string[],
  azioni: HandActionView[],
  pot: number,
): HandStreetView => ({
  strada: nome,
  board,
  azioni,
  pot,
  raccolto: 0,
  restituzione: null,
});

function mano(id: string, extra: Partial<HandMineView> = {}): HandMineView {
  return {
    id,
    publicId: `PUB${id}`,
    uploadId: 'u1',
    // La mano di base non ha punto né all-in: sono i due casi che la
    // tabella deve rendere come cella vuota senza rompersi.
    punto: null,
    equityEroe: null,
    chipsAttese: null,
    evDiff: null,
    evStima: false,
    room: 'altra',
    roomLabel: 'Altra sala',
    network: 'IPOKER',
    gameType: 'TWISTER',
    gameTypeLabel: 'Twister',
    playedAt: '2026-06-15T22:44:59.000Z',
    tableSize: 3,
    tableMax: 3,
    decimali: 0,
    currency: 'EUR',
    smallBlind: 15,
    bigBlind: 30,
    ante: 5,
    players: [
      {
        seat: 3,
        nome: 'Eroe',
        chipsIniziali: 550,
        posizione: 'BTN',
        isHero: true,
        carte: ['7h', 'Qc'],
      },
      { seat: 6, nome: 'Tizio', chipsIniziali: 278, posizione: 'SB', isHero: false },
    ],
    heroSeat: 3,
    streets: [
      strada('PREFLOP', [], [az(6, 'SB', 15, 15), az(3, 'RAISE', 60, 60), az(6, 'FOLD', 0, 0)], 15),
      strada('FLOP', ['Kh', '3h', '7d'], [], 135),
    ],
    board: ['Kh', '3h', '7d'],
    potFinale: 135,
    rake: 0,
    risultati: [],
    netti: [{ seat: 3, netto: -60 }],
    anonimizzata: false,
    likes: 0,
    dislikes: 0,
    createdAt: '2026-06-15T22:44:59.000Z',
    ogImageUrl: '',
    inVetrina: false,
    ...extra,
  };
}

function risposta(items: HandMineView[]) {
  return {
    items,
    total: items.length,
    page: 1,
    limit: 50,
    totalPages: 1,
    quota: { tetto: 200, usate: items.length, residue: 200 - items.length },
  };
}

describe('MyHandsComponent — la tabella', () => {
  let fixture: ComponentFixture<MyHandsComponent>;
  let chiamate: number;

  async function monta(
    items: HandMineView[],
    utente: { id: string; email: string } | null = { id: 'u1', email: 'a@b.c' },
  ): Promise<void> {
    chiamate = 0;
    await TestBed.configureTestingModule({
      imports: [MyHandsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { user: signal(utente) },
        },
        {
          provide: HandsService,
          useValue: {
            mie: () => {
              chiamate += 1;
              return of(risposta(items));
            },
            cancella: () => of({ ok: true }),
            anonimizza: () => of({ ok: true }),
            vetrinaSet: () => of({ ok: true }),
            svuota: () => of({ cancellate: 0 }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MyHandsComponent);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('stampa una riga per mano e dieci colonne', async () => {
    await monta([mano('a'), mano('b')]);
    expect(el().querySelectorAll('.mh__tab tbody tr').length).toBe(2);
    expect(el().querySelectorAll('.mh__tab thead th').length).toBe(10);
  });

  /**
   * ⚠️ **La prova che il `colspan` non può più divergere.** Era scritto a mano
   * in tre punti e si è rotto davvero passando da tredici colonne a dieci: un
   * `colspan` sbagliato non dà errore, il browser inventa una colonna in più e
   * la tabella si disallinea di poco — cioè nel modo che nessuno nota.
   */
  it('⚠️ il colspan delle righe aggiuntive vale quanto le colonne vere', async () => {
    await monta([mano('a')]);
    const colonne = el().querySelectorAll('.mh__tab thead th').length;
    el().querySelector<HTMLButtonElement>('.mh__ico--apri')!.click();
    fixture.detectChanges();
    const dett = el().querySelector('.mh__riga-dett td')!;
    expect(Number(dett.getAttribute('colspan'))).toBe(colonne);
  });

  it('⚠️ il dettaglio per strada si apre e si richiude, uno per volta', async () => {
    await monta([mano('a'), mano('b')]);
    const apri = el().querySelectorAll<HTMLButtonElement>('.mh__ico--apri');
    apri[0].click();
    fixture.detectChanges();
    expect(el().querySelectorAll('.mh__riga-dett').length).toBe(1);
    expect(apri[0].getAttribute('aria-expanded')).toBe('true');

    // Aprendone un'altra la prima si chiude: due righe alte in mezzo alla
    // tabella rendono illeggibili le colonne in verticale.
    apri[1].click();
    fixture.detectChanges();
    expect(el().querySelectorAll('.mh__riga-dett').length).toBe(1);

    apri[1].click();
    fixture.detectChanges();
    expect(el().querySelectorAll('.mh__riga-dett').length).toBe(0);
  });

  it('⚠️ una mano SENZA punto ed evDiff lascia le celle vuote e non si rompe', async () => {
    await monta([mano('a')]);
    const riga = el().querySelector('.mh__tab tbody tr')!;
    expect(riga.querySelector('.mh__c-punto')!.textContent!.trim()).toBe('');
    // Le due colonne numeriche sono l'ultima coppia `.is-num` della riga.
    const numeriche = riga.querySelectorAll('td.is-num');
    expect(numeriche.length).toBe(2);
    // Il netto c'è (viene da `netti`), la differenza di EV no.
    expect(numeriche[0].textContent!.trim()).toContain('-2');
    // ⚠️ Non più vuota: un trattino, che dice «qui non si applica». Il vuoto
    // si leggeva come «la colonna non funziona» — l'EV Diff esiste solo sulle
    // mani andate all-in e chiamate, con le carte di tutti note.
    expect(numeriche[1].textContent!.trim()).toBe('—');
  });

  it('stampa punto ed evDiff quando ci sono, col segno', async () => {
    const conCampi: HandMineView = {
      ...mano('a'),
      // ⚠️ `punto` è un OGGETTO, non una stringa: `etichetta` è già in italiano
      // e già adatta alla cella. La prima stesura lo dava per stringa e la
      // colonna restava vuota su ogni riga pur essendoci il dato.
      punto: { categoria: 'DOPPIA_COPPIA', rango: 2_500_000, etichetta: 'Doppia coppia' },
      evDiff: 60,
    };
    await monta([conCampi]);
    const riga = el().querySelector('.mh__tab tbody tr')!;
    expect(riga.querySelector('.mh__c-punto')!.textContent!.trim()).toBe('Doppia coppia');
    const numeriche = riga.querySelectorAll('td.is-num');
    // ⚠️ «+2,0 bb» e non «+2 bb»: sotto i 10 bb `formatBui` tiene un decimale,
    // ed è la regola del progetto — la colonna la eredita, non la reinventa.
    expect(numeriche[1].textContent!.trim()).toBe('+2,0 bb');
    expect(numeriche[1].querySelector('.mh__cifra--pos')).toBeTruthy();
  });

  it('⚠️ un evDiff di forma inattesa non stampa nulla (mai «[object Object]»)', async () => {
    const strano = { ...mano('a'), evDiff: { valore: 3 } } as unknown as HandMineView;
    await monta([strano]);
    const numeriche = el().querySelectorAll('.mh__tab tbody tr td.is-num');
    // ⚠️ Non più vuota: un trattino, che dice «qui non si applica». Il vuoto
    // si leggeva come «la colonna non funziona» — l'EV Diff esiste solo sulle
    // mani andate all-in e chiamate, con le carte di tutti note.
    expect(numeriche[1].textContent!.trim()).toBe('—');
  });

  it('⚠️ marca le azioni dell’eroe e non quelle degli avversari', async () => {
    await monta([mano('a')]);
    // ⚠️ Le sequenze vivono nella riga di dettaglio da quando le quattro
    // colonne di strada sono state tolte per far entrare la tabella nello
    // schermo: senza aprirla non c'è alcun gettone da guardare.
    el().querySelector<HTMLButtonElement>('.mh__ico--apri')!.click();
    fixture.detectChanges();
    const gettoni = [...el().querySelectorAll('.mh__gett')].map((g) => ({
      codice: g.textContent!.trim(),
      eroe: g.classList.contains('mh__gett--eroe'),
    }));
    // Il piccolo buio è forzato e non compare; restano il rilancio dell'eroe e
    // il passo dell'avversario.
    expect(gettoni).toEqual([
      { codice: 'R2', eroe: true },
      { codice: 'F', eroe: false },
    ]);
  });

  it('le carte si disegnano con app-playing-card, non con testo', async () => {
    await monta([mano('a')]);
    // ⚠️ `tbody`: la stessa classe sta anche sull'intestazione, che di carte
    // non ne ha — senza il prefisso il test misura la cella sbagliata.
    const cella = el().querySelector('tbody .mh__c-mano')!;
    expect(cella.querySelectorAll('app-playing-card').length).toBe(2);
    // Il segno che è il componente vero: rango e seme, non due caratteri.
    expect(cella.querySelector('app-playing-card .pc__rango')).toBeTruthy();
  });

  it('la data è esatta, con l’ora', async () => {
    await monta([mano('a')]);
    const testo = el().querySelector('.mh__c-data')!.textContent!.trim();
    expect(testo).toMatch(/^\d{2} \w+ \d{4}, \d{2}:\d{2}$/);
  });

  it('⚠️ la selezione si azzera a ogni caricamento', async () => {
    await monta([mano('a'), mano('b')]);
    const c = fixture.componentInstance as unknown as {
      cambiaTutte(v: boolean): void;
      nSelezionate(): number;
      carica(p: number): void;
    };
    c.cambiaTutte(true);
    expect(c.nSelezionate()).toBe(2);
    c.carica(1);
    await fixture.whenStable();
    expect(c.nSelezionate()).toBe(0);
  });

  it('⚠️ la cancellazione di gruppo chiede conferma PRIMA di chiamare', async () => {
    await monta([mano('a')]);
    const cancellate: string[] = [];
    TestBed.inject(HandsService).cancella = ((id: string) => {
      cancellate.push(id);
      return of({ ok: true as const });
    }) as HandsService['cancella'];
    const c = fixture.componentInstance as unknown as {
      cambiaTutte(v: boolean): void;
      confermaGruppo: { set(v: string | null): void; (): string | null };
      eliminaSelezionate(): void;
    };
    c.cambiaTutte(true);
    fixture.detectChanges();
    // Il primo clic arma soltanto: nessuna chiamata.
    c.confermaGruppo.set('elimina');
    expect(cancellate).toEqual([]);
    c.eliminaSelezionate();
    expect(cancellate).toEqual(['a']);
  });

  it('⚠️ senza utente non chiama l’API né stampa la tabella', async () => {
    // La rotta è guardata, ma durante il ripristino della sessione il
    // componente esiste con `user()` a `null`: una chiamata partita lì prende
    // 401 e manda l'interceptor in un refresh che senza cookie non si chiude.
    await monta([mano('a')], null);
    expect(chiamate).toBe(0);
    expect(el().querySelector('.mh__tab')).toBeNull();
  });
});
