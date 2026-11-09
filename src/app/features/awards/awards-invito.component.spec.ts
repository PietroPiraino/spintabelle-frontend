import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AnteprimaInvito } from '../../core/models/awards.models';
import { AuthService } from '../../core/services/auth.service';
import {
  AwardsInvitoComponent,
  CHIAVE_INVITO,
} from './awards-invito.component';

const API = `${environment.API_URL}/awards`;
const TOKEN = `${'a'.repeat(24)}.${'S'.repeat(32)}`;

const ANTEPRIMA: AnteprimaInvito = {
  nickname: 'FishKiller',
  categorie: [
    { categoria: 'sng-mid', etichetta: 'Miglior giocatore Spin & Go Mid stakes', descrizione: 'd' },
    { categoria: 'fish', etichetta: "Fish dell'anno", descrizione: 'd' },
  ],
  giaAccettate: [],
  consenso: { versione: '2026-10-30', testo: 'TESTO DEL CONSENSO' },
  scadeAt: '2026-12-03T22:59:59.999Z',
};

describe('AwardsInvitoComponent', () => {
  let fixture: ComponentFixture<AwardsInvitoComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  const percorso = window.location.pathname;

  function monta(utente: boolean, hash = `#${TOKEN}`) {
    history.replaceState(null, '', `${percorso}${hash}`);
    TestBed.configureTestingModule({
      imports: [AwardsInvitoComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    if (utente) {
      TestBed.inject(AuthService).user.set({
        id: 'u1',
        email: 'test@bestfishforever.it',
        role: 'USER',
        verified: true,
      });
    }
    fixture = TestBed.createComponent(AwardsInvitoComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  async function rendi() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => localStorage.removeItem(CHIAVE_INVITO));
  afterEach(() => {
    http.verify();
    localStorage.removeItem(CHIAVE_INVITO);
    history.replaceState(null, '', percorso);
  });

  it('⚠️ legge il token dal frammento, lo mette da parte e lo TOGLIE dall’indirizzo', async () => {
    monta(false);
    expect(window.location.hash).toBe('');
    expect(JSON.parse(localStorage.getItem(CHIAVE_INVITO)!).token).toBe(TOKEN);
    const req = http.expectOne(`${API}/invito/anteprima`);
    // ⚠️ Il token viaggia nel CORPO, mai nell'URL.
    expect(req.request.body).toEqual({ token: TOKEN });
    req.flush(ANTEPRIMA);
    await rendi();
  });

  it('dopo il giro di registrazione il token si recupera da localStorage', async () => {
    localStorage.setItem(
      CHIAVE_INVITO,
      JSON.stringify({ token: TOKEN, scade: Date.now() + 60_000 }),
    );
    monta(false, '');
    http.expectOne(`${API}/invito/anteprima`).flush(ANTEPRIMA);
    await rendi();
    expect(el.textContent).toContain('FishKiller');
  });

  it('⚠️ un secondo link nella stessa scheda ricarica l’invito giusto', async () => {
    monta(false);
    http.expectOne(`${API}/invito/anteprima`).flush(ANTEPRIMA);
    await rendi();
    const altro = `${'b'.repeat(24)}.${'T'.repeat(32)}`;
    history.replaceState(null, '', `${percorso}#${altro}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    const req = http.expectOne(`${API}/invito/anteprima`);
    expect(req.request.body).toEqual({ token: altro });
    req.flush({ ...ANTEPRIMA, nickname: 'Altro Nick' });
    await rendi();
    expect(el.textContent).toContain('Altro Nick');
  });

  it('senza token dice come rimediare, senza chiamare il server', async () => {
    monta(false, '');
    await rendi();
    expect(el.textContent).toContain('Non troviamo il tuo invito');
    http.expectNone(`${API}/invito/anteprima`);
  });

  it('un anonimo vede consenso e gate, e può RIFIUTARE senza account', async () => {
    monta(false);
    http.expectOne(`${API}/invito/anteprima`).flush(ANTEPRIMA);
    await rendi();
    expect(el.textContent).toContain('TESTO DEL CONSENSO');
    expect(el.querySelector('input[type="checkbox"]')).toBeNull();
    const accedi = Array.from(el.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Accedi per accettare'),
    );
    expect(accedi?.getAttribute('href')).toContain('redirect=%2Fawards%2Finvito');

    const no = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Non voglio partecipare'),
    )!;
    no.click();
    await rendi();
    const si = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Sì, non voglio partecipare'),
    )!;
    si.click();
    const req = http.expectOne(`${API}/invito/rifiuta`);
    expect(req.request.body).toEqual({ token: TOKEN });
    req.flush(null);
    await rendi();
    expect(el.textContent).toContain('non comparirà da nessuna parte');
    expect(localStorage.getItem(CHIAVE_INVITO)).toBeNull();
  });

  it('⚠️ categorie e consenso nascono NON spuntati, e senza entrambi non si accetta', async () => {
    monta(true);
    http.expectOne(`${API}/invito/anteprima`).flush(ANTEPRIMA);
    await rendi();
    const caselle = Array.from(
      el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );
    expect(caselle.length).toBe(3);
    expect(caselle.every((c) => !c.checked)).toBe(true);
    const accetta = () =>
      Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
        b.textContent?.includes('Accetto di partecipare'),
      )!;
    expect(accetta().disabled).toBe(true);

    caselle[1].click(); // fish
    await rendi();
    expect(accetta().disabled).toBe(true); // manca il consenso
    caselle[2].click(); // consenso
    await rendi();
    expect(accetta().disabled).toBe(false);

    accetta().click();
    const req = http.expectOne(`${API}/invito/accetta`);
    expect(req.request.body).toEqual({
      token: TOKEN,
      categorie: ['fish'],
      consenso: true,
    });
    req.flush({ accettate: ['fish'] });
    await rendi();
    expect(el.textContent).toContain('Fatto: sei candidato');
    expect(el.textContent).toContain("Fish dell'anno");
  });

  it('il messaggio del server si stampa così com’è', async () => {
    monta(false);
    http
      .expectOne(`${API}/invito/anteprima`)
      .flush(
        { message: 'Questo invito è scaduto: chiedi allo staff un nuovo collegamento.' },
        { status: 400, statusText: 'Bad Request' },
      );
    await rendi();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Questo invito è scaduto',
    );
  });
});
