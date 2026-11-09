import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import {
  TERMINI_VIETATI_CONTENUTI,
  terminiPresenti,
} from '../../core/art9.constants';
import {
  AWARDS_CATEGORIE,
  AwardsMio,
  EdizioneAwards,
} from '../../core/models/awards.models';
import { AuthService } from '../../core/services/auth.service';
import { AwardsComponent, giornoAwards } from './awards.component';
import {
  CATEGORIE_AWARDS,
  DATE_AWARDS_2026,
  FAQ_AWARDS,
  REGOLE_AWARDS,
} from './awards.data';

const API = `${environment.API_URL}/awards`;

function edizione(over: Partial<{ fase: string; raccoltaAttiva: boolean }> = {}) {
  return {
    disponibile: true,
    anno: 2026,
    fase: 'PROPOSTE',
    raccoltaAttiva: true,
    date: DATE_AWARDS_2026,
    categorie: [],
    ...over,
  } as EdizioneAwards;
}

const MIO_VUOTO: AwardsMio = { proposte: [], voti: [], candidature: [] };

describe('AwardsComponent', () => {
  let fixture: ComponentFixture<AwardsComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  function monta(utente: boolean) {
    TestBed.configureTestingModule({
      imports: [AwardsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(AwardsComponent);
    http = TestBed.inject(HttpTestingController);
    if (utente) {
      TestBed.inject(AuthService).user.set({
        id: 'u1',
        email: 'test@bestfishforever.it',
        role: 'USER',
        verified: true,
      });
    }
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  async function rendi() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('in attesa della risposta mostra lo scheletro, non un blocco vuoto', async () => {
    monta(false);
    await rendi();
    expect(el.querySelector('.aw-fase .scheletro')).not.toBeNull();
    http.expectOne(`${API}/edizione`).flush(edizione());
  });

  it('con l’API giù dice «non disponibile» e mostra comunque calendario e categorie', async () => {
    monta(false);
    http
      .expectOne(`${API}/edizione`)
      .flush('giù', { status: 503, statusText: 'Service Unavailable' });
    await rendi();
    expect(el.querySelector('#aw-fase-titolo')?.textContent).toContain(
      '10 novembre',
    );
    expect(el.querySelectorAll('.aw-cal__passo').length).toBe(4);
    expect(el.querySelectorAll('.aw-cat__voce').length).toBe(9);
  });

  it('⚠️ un anonimo nelle proposte vede il gate, e NON parte alcuna chiamata a /awards/me', async () => {
    monta(false);
    http.expectOne(`${API}/edizione`).flush(edizione());
    await rendi();
    expect(el.querySelector('form.aw-prop')).toBeNull();
    const accedi = Array.from(el.querySelectorAll('a')).find(
      (a) => a.textContent?.trim() === 'Accedi',
    );
    expect(accedi?.getAttribute('href')).toContain('redirect=%2Fawards');
    http.expectNone(`${API}/me`);
  });

  it('un iscritto vede un campo per ciascuna delle nove categorie', async () => {
    monta(true);
    http.expectOne(`${API}/edizione`).flush(edizione());
    http.expectOne(`${API}/me`).flush({
      ...MIO_VUOTO,
      proposte: [{ categoria: 'fish', nickname: 'Pesce' }],
    });
    await rendi();
    const campi = el.querySelectorAll<HTMLInputElement>('form.aw-prop input');
    expect(campi.length).toBe(AWARDS_CATEGORIE.length);
    expect(el.querySelector<HTMLInputElement>('#aw-p-fish')?.value).toBe('Pesce');
    // Ogni campo ha la sua etichetta.
    for (const c of AWARDS_CATEGORIE) {
      expect(el.querySelector(`label[for="aw-p-${c}"]`)).not.toBeNull();
    }
  });

  it('salva SOLO le categorie cambiate; un campo svuotato toglie la proposta', async () => {
    monta(true);
    http.expectOne(`${API}/edizione`).flush(edizione());
    http.expectOne(`${API}/me`).flush({
      ...MIO_VUOTO,
      proposte: [{ categoria: 'fish', nickname: 'Pesce' }],
    });
    await rendi();

    const scrivi = (id: string, v: string) => {
      const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = v;
      input.dispatchEvent(new Event('input'));
    };
    scrivi('aw-p-sng-mid', '  Fish Killer ');
    scrivi('aw-p-fish', '');
    await rendi();

    el.querySelector<HTMLButtonElement>('form.aw-prop button[type="submit"]')!.click();
    const req = http.expectOne(`${API}/proposte`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      proposte: [
        { categoria: 'sng-mid', nickname: 'Fish Killer' },
        { categoria: 'fish', nickname: '' },
      ],
    });
    req.flush([{ categoria: 'sng-mid', nickname: 'Fish Killer' }]);
    await rendi();
    expect(el.querySelector('.aw-prop__stato')?.textContent).toContain(
      'Hai una proposta salvata',
    );
  });

  it('il messaggio d’errore del server si stampa così com’è', async () => {
    monta(true);
    http.expectOne(`${API}/edizione`).flush(edizione());
    http.expectOne(`${API}/me`).flush(MIO_VUOTO);
    await rendi();
    const input = el.querySelector<HTMLInputElement>('#aw-p-fish')!;
    input.value = 'Pesce';
    input.dispatchEvent(new Event('input'));
    await rendi();
    el.querySelector<HTMLButtonElement>('form.aw-prop button[type="submit"]')!.click();
    http
      .expectOne(`${API}/proposte`)
      .flush(
        { message: 'Per partecipare devi prima confermare il tuo indirizzo email.' },
        { status: 403, statusText: 'Forbidden' },
      );
    await rendi();
    expect(el.querySelector('.aw-prop [role="alert"]')?.textContent).toContain(
      'confermare il tuo indirizzo email',
    );
  });

  it('a raccolta sospesa non offre il form, nemmeno a un iscritto', async () => {
    monta(true);
    http.expectOne(`${API}/edizione`).flush(edizione({ raccoltaAttiva: false }));
    http.expectOne(`${API}/me`).flush(MIO_VUOTO);
    await rendi();
    expect(el.querySelector('form.aw-prop')).toBeNull();
    expect(el.textContent).toContain('momentaneamente sospesa');
  });

  it('⚠️ un candidato vede la sua candidatura e può ritirarsi, con conferma', async () => {
    monta(true);
    http.expectOne(`${API}/edizione`).flush(edizione({ fase: 'CONTATTI' }));
    http.expectOne(`${API}/me`).flush({
      ...MIO_VUOTO,
      candidature: [
        {
          id: 'c1',
          nickname: 'Squalo',
          categorie: [
            { categoria: 'fish', stato: 'ACCETTATA', finalista: false, vincitore: false },
            { categoria: 'sng-mid', stato: 'RIFIUTATA', finalista: false, vincitore: false },
          ],
        },
      ],
    });
    await rendi();
    const righe = el.querySelectorAll('.aw-mia__riga');
    expect(righe.length).toBe(1);
    expect(righe[0].textContent).toContain("Fish dell'anno");

    el.querySelector<HTMLButtonElement>('button[aria-label="Ritirati da Fish dell\'anno"]')!.click();
    await rendi();
    http.expectNone(`${API}/candidature/c1/ritira`);
    const si = Array.from(el.querySelectorAll<HTMLButtonElement>('.aw-mia button')).find(
      (b) => b.textContent?.includes('Sì, ritirami'),
    )!;
    si.click();
    const req = http.expectOne(`${API}/candidature/c1/ritira`);
    expect(req.request.body).toEqual({ categorie: ['fish'] });
    req.flush({ ritirate: ['fish'] });
    await rendi();
    expect(el.querySelector('.aw-mia')).toBeNull();
  });

  it('il passo del calendario acceso segue la fase', async () => {
    monta(false);
    http.expectOne(`${API}/edizione`).flush(edizione({ fase: 'ATTESA_VOTO' }));
    await rendi();
    const attivo = el.querySelector('.aw-cal__passo[aria-current="step"]');
    expect(attivo?.textContent).toContain('Candidature');
  });
});

describe('giornoAwards', () => {
  it('⚠️ formatta nel fuso di Roma: la fine delle proposte è il 22, non il 23', () => {
    expect(giornoAwards(DATE_AWARDS_2026.proposteAl)).toBe('22 novembre');
    expect(giornoAwards(DATE_AWARDS_2026.cerimoniaAt, true)).toBe(
      '9 gennaio 2027',
    );
  });
});

describe('i testi statici dei premi (art. 9 DL 87/2018)', () => {
  it('⚠️ nessuna sala, parola non pubblicabile o promessa al lettore', () => {
    const testi = [
      ...CATEGORIE_AWARDS.flatMap((c) => [c.etichetta, c.descrizione]),
      ...REGOLE_AWARDS,
      ...FAQ_AWARDS.flatMap((f) => [f.q, f.a]),
    ];
    for (const t of testi) {
      expect(terminiPresenti(t, TERMINI_VIETATI_CONTENUTI))
        .withContext(t)
        .toEqual([]);
    }
  });

  it('le categorie statiche sono le stesse nove del modello, nello stesso ordine', () => {
    expect(CATEGORIE_AWARDS.map((c) => c.categoria)).toEqual([
      ...AWARDS_CATEGORIE,
    ]);
  });
});
