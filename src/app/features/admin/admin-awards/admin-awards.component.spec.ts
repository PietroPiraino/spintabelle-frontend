import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import {
  CandidatoAdmin,
  CategoriaSpoglio,
  EdizioneAwardsAdmin,
  StatoAnnuncio,
} from '../../../core/models/awards.models';
import { AdminAwardsComponent, aDataLocale } from './admin-awards.component';

const API = `${environment.API_URL}/admin/awards`;

const EDIZIONE: EdizioneAwardsAdmin = {
  anno: 2026,
  fase: 'CONTATTI',
  proposteDal: '2026-11-09T23:00:00.000Z',
  proposteAl: '2026-11-22T22:59:59.999Z',
  contattiAl: '2026-12-03T22:59:59.999Z',
  votoDal: '2026-12-06T23:00:00.000Z',
  votoAl: '2027-01-04T22:59:59.999Z',
  cerimoniaAt: '2027-01-09T20:00:00.000Z',
  finalistiPubblicatiAt: null,
  risultatiPubblicatiAt: null,
};

const SPOGLIO: CategoriaSpoglio[] = [
  {
    categoria: 'sng-mid',
    etichetta: 'Miglior giocatore Spin & Go Mid stakes',
    totale: 3,
    voci: [{ nickname: 'Squalo', nicknameKey: 'squalo', proposte: 3, candidato: null }],
  },
  {
    categoria: 'fish',
    etichetta: "Fish dell'anno",
    totale: 1,
    voci: [{ nickname: 'Squalo', nicknameKey: 'squalo', proposte: 1, candidato: null }],
  },
];

const CANDIDATO: CandidatoAdmin = {
  id: 'c1',
  nickname: 'Squalo',
  categorie: [
    { categoria: 'sng-mid', etichetta: 'Mid', stato: 'INVITATO', finalista: false, vincitore: false },
    { categoria: 'fish', etichetta: 'Fish', stato: 'INVITATO', finalista: false, vincitore: false },
  ],
  invito: { stato: 'VALIDO', scadeAt: '2026-12-03T22:59:59.999Z' },
  account: null,
  consenso: null,
};

const LINK = `https://bestfishforever.it/awards/invito#${'a'.repeat(24)}.${'S'.repeat(32)}`;

const ANNUNCIO: StatoAnnuncio = {
  tipo: 'proposte-aperte',
  destinatariTotali: 250,
  giaInviati: 0,
  restanti: 250,
  inviatiTotali: 0,
  ultimoInvioAt: null,
  ultimoErrore: null,
  inCorso: false,
  inviabile: true,
  motivo: null,
};

describe('AdminAwardsComponent', () => {
  let fixture: ComponentFixture<AdminAwardsComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  async function rendi() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AdminAwardsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(AdminAwardsComponent);
    http = TestBed.inject(HttpTestingController);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    http.expectOne(`${API}/edizione`).flush(EDIZIONE);
    http.expectOne(`${API}/spoglio`).flush(SPOGLIO);
    http.expectOne(`${API}/candidati`).flush([]);
    await rendi();
  });

  afterEach(() => {
    // Chiude eventuali modali rimaste aperte (top layer) prima della verifica.
    fixture.destroy();
    http.verify();
  });

  it('lo spoglio mostra un «Invita» che nomina la riga', () => {
    const invita = el.querySelector<HTMLButtonElement>('button[aria-label="Invita Squalo"]');
    expect(invita).not.toBeNull();
    expect(invita!.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('⚠️ «Invita» precompila le categorie in cui il nickname è stato proposto, e il link si vede una volta', async () => {
    el.querySelector<HTMLButtonElement>('button[aria-label="Invita Squalo"]')!.click();
    await rendi();
    const spuntate = Array.from(
      document.querySelectorAll<HTMLInputElement>('dialog fieldset input[type="checkbox"]'),
    )
      .filter((c) => c.checked)
      .map((c) => c.parentElement?.textContent?.trim());
    expect(spuntate).toEqual(['Miglior giocatore Spin & Go Mid stakes', "Fish dell'anno"]);

    document.querySelector<HTMLButtonElement>('dialog button[type="submit"]')!.click();
    const req = http.expectOne(`${API}/candidati`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      nickname: 'Squalo',
      categorie: ['sng-mid', 'fish'],
    });
    req.flush({ candidato: CANDIDATO, link: LINK });
    http.expectOne(`${API}/spoglio`).flush(SPOGLIO);
    await rendi();
    const campo = document.querySelector<HTMLInputElement>('dialog input[readonly]');
    expect(campo?.value).toBe(LINK);
    expect(document.querySelector('dialog')?.textContent).toContain(
      'Questo link si vede solo ora',
    );
  });

  it('il datetime-local mostra l’ora del browser, al minuto', () => {
    const d = new Date('2026-11-09T23:00:00.000Z');
    const atteso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    expect(aDataLocale('2026-11-09T23:00:00.000Z')).toBe(atteso);
  });

  it('salvando le date manda SOLO quelle toccate', async () => {
    const scheda = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
      (b) => b.textContent?.includes('Edizione'),
    )!;
    scheda.click();
    await rendi();
    http.expectOne(`${API}/annunci/proposte-aperte`).flush(ANNUNCIO);
    await rendi();
    const campi = el.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
    expect(campi.length).toBe(6);
    campi[1].value = '2026-11-29T23:59';
    campi[1].dispatchEvent(new Event('input'));
    await rendi();
    el.querySelector<HTMLButtonElement>('form button[type="submit"]')!.click();
    const req = http.expectOne(`${API}/edizione`);
    expect(req.request.method).toBe('PATCH');
    expect(Object.keys(req.request.body as object)).toEqual(['proposteAl']);
    req.flush(EDIZIONE);
    await rendi();
  });

  describe('email agli iscritti (scheda Edizione)', () => {
    async function apriEdizione(stato: StatoAnnuncio = ANNUNCIO) {
      Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
        .find((b) => b.textContent?.includes('Edizione'))!
        .click();
      await rendi();
      const req = http.expectOne(`${API}/annunci/proposte-aperte`);
      expect(req.request.method).toBe('GET');
      req.flush(stato);
      await rendi();
    }
    const bottone = (testo: string) =>
      Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
        b.textContent?.includes(testo),
      );

    it('lo stato si legge entrando nella scheda, non all’avvio', async () => {
      http.expectNone(`${API}/annunci/proposte-aperte`);
      await apriEdizione();
      const testo = el.textContent ?? '';
      expect(testo).toContain('Destinatari');
      expect(testo).toContain('250');
      expect(bottone('Invia ai prossimi 90')).toBeDefined();
    });

    it('la prova va solo a chi preme, e l’esito lo dice', async () => {
      await apriEdizione();
      bottone('Manda una prova a me')!.click();
      const req = http.expectOne(`${API}/annunci/proposte-aperte`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ prova: true });
      req.flush({ tipo: 'proposte-aperte', prova: true, inviati: 1, errore: null, stato: ANNUNCIO });
      await rendi();
      expect(el.querySelector('.form-feedback.is-success')?.textContent).toContain(
        'Prova inviata',
      );
    });

    it('⚠️ l’invio vero chiede conferma in linea, e manda il numero scelto', async () => {
      await apriEdizione();
      const quante = el.querySelector<HTMLInputElement>('input[type="number"]')!;
      quante.value = '40';
      quante.dispatchEvent(new Event('input'));
      await rendi();
      bottone('Invia ai prossimi 40')!.click();
      await rendi();
      http.expectNone(`${API}/annunci/proposte-aperte`);
      expect(el.textContent).toContain("Un'email partita non si ritira");
      bottone('Sì, invia 40 email')!.click();
      const req = http.expectOne(`${API}/annunci/proposte-aperte`);
      expect(req.request.body).toEqual({ limite: 40 });
      req.flush({
        tipo: 'proposte-aperte',
        prova: false,
        inviati: 40,
        errore: null,
        stato: { ...ANNUNCIO, giaInviati: 40, restanti: 210, inviatiTotali: 40 },
      });
      await rendi();
      expect(el.querySelector('.form-feedback.is-success')?.textContent).toContain(
        '40 email inviate. Ne restano 210.',
      );
      expect(bottone('Sì, invia')).toBeUndefined();
    });

    it('⚠️ il messaggio di Resend e quello del server si leggono così come sono', async () => {
      const quota = 'You have reached your daily email sending quota.';
      await apriEdizione({ ...ANNUNCIO, ultimoErrore: quota });
      expect(el.querySelector('[role="alert"]')?.textContent).toContain(quota);

      bottone('Invia ai prossimi')!.click();
      await rendi();
      bottone('Sì, invia')!.click();
      http
        .expectOne(`${API}/annunci/proposte-aperte`)
        .flush(
          { message: 'Un invio di questa email è già in corso: aspetta che finisca e ricarica.' },
          { status: 409, statusText: 'Conflict' },
        );
      await rendi();
      expect(el.querySelector('.form-feedback.is-error[role="status"]')?.textContent).toContain(
        'già in corso',
      );
    });

    it('fuori dalle proposte il pulsante è spento e dice perché', async () => {
      await apriEdizione({
        ...ANNUNCIO,
        inviabile: false,
        motivo: 'Le proposte sono chiuse: questa email direbbe una cosa non più vera.',
      });
      expect(bottone('Invia ai prossimi')!.disabled).toBe(true);
      expect(el.textContent).toContain('Le proposte sono chiuse');
    });
  });
});
