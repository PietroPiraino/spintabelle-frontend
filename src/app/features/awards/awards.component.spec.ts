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

function edizione(
  over: Partial<{
    fase: string;
    raccoltaAttiva: boolean;
    categorie: unknown[];
  }> = {},
) {
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

/** Le nove categorie come le dà l'API, con la rosa pubblicata. */
function categorieConRosa(): unknown[] {
  return CATEGORIE_AWARDS.map((c) => ({
    categoria: c.categoria,
    etichetta: c.etichetta,
    descrizione: c.descrizione,
    formato: c.formato,
    finalisti:
      c.categoria === 'fish'
        ? [
            { id: 'f1', nickname: 'Alfa' },
            { id: 'f2', nickname: 'Beta' },
            { id: 'f3', nickname: 'Gamma' },
          ]
        : c.categoria === 'sng-mid'
          ? [
              { id: 'm1', nickname: 'Delta' },
              { id: 'm2', nickname: 'Epsilon' },
              { id: 'm3', nickname: 'Zeta' },
            ]
          : [],
    vincitori: null,
  }));
}

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
    const link = (testo: string) =>
      Array.from(el.querySelectorAll('a')).find(
        (a) => a.textContent?.trim() === testo,
      );
    // ⚠️ ENTRAMBI con la destinazione: senza, chi si registra finisce in home
    // dopo la conferma dell'email e non torna mai al modulo.
    const accedi = link('Accedi e proponi');
    expect(accedi?.getAttribute('href')).toContain('/login');
    expect(accedi?.getAttribute('href')).toContain('redirect=%2Fawards');
    expect(accedi?.classList).toContain('btn--primary');
    const registrati = link('Registrati gratis');
    expect(registrati?.getAttribute('href')).toContain('/registrazione');
    expect(registrati?.getAttribute('href')).toContain('redirect=%2Fawards');
    // I tre passi in chiaro, con la data di chiusura.
    const passi = el.querySelectorAll('.aw-passi li');
    expect(passi.length).toBe(3);
    expect(passi[0].textContent).toContain('Accedi al sito');
    expect(passi[2].textContent).toContain('22 novembre');
    http.expectNone(`${API}/me`);
  });

  it('l’hero porta al blocco della fase con un’àncora, uguale per tutti', async () => {
    monta(false);
    http.expectOne(`${API}/edizione`).flush(edizione());
    await rendi();
    const hero = el.querySelector<HTMLAnchorElement>('.aw-hero__azioni a');
    expect(hero?.textContent?.trim()).toBe('Proponi i tuoi candidati');
    expect(hero?.getAttribute('href')).toContain('#aw-fase');
    expect(el.querySelector('section#aw-fase')).not.toBeNull();
  });

  it('a un iscritto dice dove sta il pulsante per salvare', async () => {
    monta(true);
    http.expectOne(`${API}/edizione`).flush(edizione());
    http.expectOne(`${API}/me`).flush(MIO_VUOTO);
    await rendi();
    expect(el.querySelector('.aw-fase')?.textContent).toContain(
      'poi premi Salva le proposte in fondo',
    );
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

describe('AwardsComponent — rosa finale e voto', () => {
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

  it('⚠️ un anonimo a voto aperto vede la rosa e il gate, senza chiamare /me', async () => {
    monta(false);
    http
      .expectOne(`${API}/edizione`)
      .flush(edizione({ fase: 'VOTO', categorie: categorieConRosa() }));
    await rendi();
    expect(el.querySelector('form.aw-voto')).toBeNull();
    const nick = Array.from(el.querySelectorAll('.aw-rosa__nick')).map(
      (n) => n.textContent?.trim(),
    );
    expect(nick).toEqual(['Delta', 'Epsilon', 'Zeta', 'Alfa', 'Beta', 'Gamma']);
    const accedi = Array.from(el.querySelectorAll('a')).find(
      (a) => a.textContent?.trim() === 'Accedi e vota',
    );
    expect(accedi?.getAttribute('href')).toContain('redirect=%2Fawards');
    // Una categoria pubblicata senza finalisti lo dice, non resta vuota.
    expect(el.textContent).toContain("Quest'anno la categoria non si assegna.");
    http.expectNone(`${API}/me`);
  });

  it('a voto aperto ma rosa non pubblicata: niente form, un avviso', async () => {
    monta(true);
    http.expectOne(`${API}/edizione`).flush(edizione({ fase: 'VOTO' }));
    http.expectOne(`${API}/me`).flush(MIO_VUOTO);
    await rendi();
    expect(el.querySelector('form.aw-voto')).toBeNull();
    expect(el.textContent).toContain('La rosa finale sta per uscire');
  });

  it('un iscritto vota con radio native per categoria e salva SOLO ciò che ha cambiato', async () => {
    monta(true);
    http
      .expectOne(`${API}/edizione`)
      .flush(edizione({ fase: 'VOTO', categorie: categorieConRosa() }));
    http.expectOne(`${API}/me`).flush({
      ...MIO_VUOTO,
      voti: [{ categoria: 'sng-mid', candidatoId: 'm2', annullato: false }],
    });
    await rendi();

    const fish = el.querySelectorAll<HTMLInputElement>('input[name="aw-v-fish"]');
    // Tre finalisti più «Nessun voto».
    expect(fish.length).toBe(4);
    const mid = el.querySelector<HTMLInputElement>(
      'input[name="aw-v-sng-mid"][value="m2"]',
    )!;
    expect(mid.checked).toBeTrue();

    fish[1].click();
    await rendi();
    el.querySelector<HTMLButtonElement>('form.aw-voto button[type="submit"]')!.click();
    const req = http.expectOne(`${API}/voti`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      voti: [{ categoria: 'fish', candidatoId: 'f2' }],
    });
    req.flush([
      { categoria: 'sng-mid', candidatoId: 'm2', annullato: false },
      { categoria: 'fish', candidatoId: 'f2', annullato: false },
    ]);
    await rendi();
    expect(el.querySelector('.aw-voto__stato')?.textContent).toContain(
      'Hai votato in 2 categorie su 2',
    );
  });

  it('«Nessun voto» toglie il voto: si manda un id vuoto', async () => {
    monta(true);
    http
      .expectOne(`${API}/edizione`)
      .flush(edizione({ fase: 'VOTO', categorie: categorieConRosa() }));
    http.expectOne(`${API}/me`).flush({
      ...MIO_VUOTO,
      voti: [{ categoria: 'fish', candidatoId: 'f1', annullato: false }],
    });
    await rendi();
    el.querySelector<HTMLInputElement>('input[name="aw-v-fish"][value=""]')!.click();
    await rendi();
    el.querySelector<HTMLButtonElement>('form.aw-voto button[type="submit"]')!.click();
    const req = http.expectOne(`${API}/voti`);
    expect(req.request.body).toEqual({
      voti: [{ categoria: 'fish', candidatoId: '' }],
    });
    req.flush([]);
    await rendi();
  });

  it('⚠️ un voto annullato dallo staff: categoria bloccata e detto perché', async () => {
    monta(true);
    http
      .expectOne(`${API}/edizione`)
      .flush(edizione({ fase: 'VOTO', categorie: categorieConRosa() }));
    http.expectOne(`${API}/me`).flush({
      ...MIO_VUOTO,
      voti: [{ categoria: 'fish', candidatoId: 'f1', annullato: true }],
    });
    await rendi();
    const campo = Array.from(
      el.querySelectorAll<HTMLFieldSetElement>('fieldset.aw-voto__cat'),
    ).find((f) => f.querySelector('legend')?.textContent?.includes("Fish dell'anno"))!;
    expect(campo.disabled).toBeTrue();
    expect(campo.textContent).toContain('annullato dallo staff');
  });

  it('il messaggio d’errore del voto si stampa così com’è', async () => {
    monta(true);
    http
      .expectOne(`${API}/edizione`)
      .flush(edizione({ fase: 'VOTO', categorie: categorieConRosa() }));
    http.expectOne(`${API}/me`).flush(MIO_VUOTO);
    await rendi();
    el.querySelector<HTMLInputElement>('input[name="aw-v-fish"][value="f3"]')!.click();
    await rendi();
    el.querySelector<HTMLButtonElement>('form.aw-voto button[type="submit"]')!.click();
    http.expectOne(`${API}/voti`).flush(
      { message: "Puoi votare solo uno dei finalisti di «Fish dell'anno»." },
      { status: 400, statusText: 'Bad Request' },
    );
    await rendi();
    expect(el.querySelector('form.aw-voto [role="alert"]')?.textContent).toContain(
      'Puoi votare solo uno dei finalisti',
    );
  });

  it('⚠️ il finalista, a rosa pubblicata, scarica le card via XHR', async () => {
    const creati: string[] = [];
    spyOn(URL, 'createObjectURL').and.callFake(() => {
      creati.push('blob:finto');
      return 'blob:finto';
    });
    spyOn(URL, 'revokeObjectURL');
    // Niente download vero in ChromeHeadless.
    spyOn(HTMLAnchorElement.prototype, 'click');
    monta(true);
    http
      .expectOne(`${API}/edizione`)
      .flush(edizione({ fase: 'ATTESA_VOTO', categorie: categorieConRosa() }));
    http.expectOne(`${API}/me`).flush({
      ...MIO_VUOTO,
      candidature: [
        {
          id: 'c1',
          nickname: 'Alfa',
          categorie: [
            { categoria: 'fish', stato: 'ACCETTATA', finalista: true, vincitore: false },
          ],
        },
      ],
    });
    await rendi();
    expect(el.querySelector('.aw-mia')?.textContent).toContain('finalista');
    el.querySelector<HTMLButtonElement>(
      'button[aria-label="Scarica la card per le storie: Fish dell\'anno"]',
    )!.click();
    const req = http.expectOne(
      (r) => r.url === `${API}/candidature/c1/card`,
    );
    expect(req.request.params.get('categoria')).toBe('fish');
    expect(req.request.params.get('formato')).toBe('storia');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['png'], { type: 'image/png' }));
    await rendi();
    expect(creati.length).toBe(1);
  });

  it('⚠️ l’errore di una card si legge dal corpo del Blob', async () => {
    monta(true);
    http
      .expectOne(`${API}/edizione`)
      .flush(edizione({ fase: 'ATTESA_VOTO', categorie: categorieConRosa() }));
    http.expectOne(`${API}/me`).flush({
      ...MIO_VUOTO,
      candidature: [
        {
          id: 'c1',
          nickname: 'Alfa',
          categorie: [
            { categoria: 'fish', stato: 'ACCETTATA', finalista: true, vincitore: false },
          ],
        },
      ],
    });
    await rendi();
    el.querySelector<HTMLButtonElement>(
      'button[aria-label="Scarica la card per i post: Fish dell\'anno"]',
    )!.click();
    http
      .expectOne((r) => r.url === `${API}/candidature/c1/card`)
      .flush(
        new Blob([JSON.stringify({ message: 'Alfa non è in rosa in «Fish».' })], {
          type: 'application/json',
        }),
        { status: 409, statusText: 'Conflict' },
      );
    // `Blob.text()` è asincrona: si aspetta che il messaggio arrivi.
    for (let i = 0; i < 20 && !el.querySelector('.aw-mia [role="alert"]'); i++) {
      await new Promise((r) => setTimeout(r, 10));
      await rendi();
    }
    expect(el.querySelector('.aw-mia [role="alert"]')?.textContent).toContain(
      'non è in rosa',
    );
  });

  it('senza rosa pubblicata il candidato non vede le card', async () => {
    monta(true);
    http.expectOne(`${API}/edizione`).flush(edizione({ fase: 'CONTATTI' }));
    http.expectOne(`${API}/me`).flush({
      ...MIO_VUOTO,
      candidature: [
        {
          id: 'c1',
          nickname: 'Alfa',
          categorie: [
            { categoria: 'fish', stato: 'ACCETTATA', finalista: true, vincitore: false },
          ],
        },
      ],
    });
    await rendi();
    expect(el.querySelector('.aw-mia__card')).toBeNull();
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
