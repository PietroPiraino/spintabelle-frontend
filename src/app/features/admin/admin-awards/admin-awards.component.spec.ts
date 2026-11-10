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
  RiepilogoVoti,
  RosaAdmin,
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

/** Una rosa con fish completa (3) e sng-mid incompleta (2). */
function rosa(over: Partial<RosaAdmin> = {}): RosaAdmin {
  const voce = (id: string, nickname: string, finalista: boolean) => ({
    id,
    nickname,
    finalista,
  });
  return {
    fase: 'CONTATTI',
    modificabile: true,
    pubblicataAt: null,
    categorie: [
      {
        categoria: 'sng-mid',
        etichetta: 'Miglior giocatore Spin & Go Mid stakes',
        esito: 'POCHI',
        finalisti: 2,
        accettati: [voce('m1', 'Delta', true), voce('m2', 'Epsilon', true)],
      },
      {
        categoria: 'fish',
        etichetta: "Fish dell'anno",
        esito: 'OK',
        finalisti: 3,
        accettati: [
          voce('f1', 'Alfa', true),
          voce('f2', 'Beta', true),
          voce('f3', 'Gamma', true),
          voce('f4', 'Omega', false),
        ],
      },
    ],
    ...over,
  };
}

const VOTI: RiepilogoVoti = {
  generatoIl: '2026-12-10T12:00:00.000Z',
  votoDal: '2026-12-06T23:00:00.000Z',
  votanti: 3,
  votiValidi: 3,
  votiAnnullati: 1,
  votantiNuovi: 1,
  domini: [{ dominio: 'gmail.com', votanti: 2 }],
  categorie: [
    {
      categoria: 'fish',
      etichetta: "Fish dell'anno",
      voti: 3,
      annullati: 1,
      fuoriRosa: 0,
      finalisti: [
        { id: 'f1', nickname: 'Alfa', voti: 2, daNuoviAccount: 1 },
        { id: 'f2', nickname: 'Beta', voti: 1, daNuoviAccount: 0 },
      ],
    },
  ],
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
    http.expectOne(`${API}/spoglio/persone`).flush({ persone: 4 });
    http.expectOne(`${API}/candidati`).flush([]);
    await rendi();
  });

  it('accanto alle proposte dice quante PERSONE hanno proposto', () => {
    expect(el.querySelector('.admin-barra__conta')?.textContent).toContain('4 persone');
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

  const scheda = async (nome: string) => {
    Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find((b) => b.textContent?.includes(nome))!
      .click();
    await rendi();
  };
  const bottoneDi = (radice: ParentNode, testo: string) =>
    Array.from(radice.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(testo),
    );

  describe('rosa finale', () => {
    it('si legge entrando nella scheda e mostra l’esito per categoria', async () => {
      http.expectNone(`${API}/rosa`);
      await scheda('Rosa finale');
      http.expectOne(`${API}/rosa`).flush(rosa());
      await rendi();
      const stati = Array.from(el.querySelectorAll('.admin-piega__sum .admin-stato')).map(
        (s) => s.textContent?.trim(),
      );
      expect(stati).toEqual(['2 finalisti: pochi', '3 finalisti']);
    });

    it('⚠️ con una categoria a 1-2 finalisti la pubblicazione è spenta e lo dice', async () => {
      await scheda('Rosa finale');
      http.expectOne(`${API}/rosa`).flush(rosa());
      await rendi();
      expect(bottoneDi(el, 'Pubblica la rosa finale')!.disabled).toBeTrue();
      expect(el.textContent).toContain('Da sistemare prima di pubblicare');
    });

    it('la casella «Finalista» manda il PATCH e rilegge la rosa dal server', async () => {
      await scheda('Rosa finale');
      http.expectOne(`${API}/rosa`).flush(rosa());
      await rendi();
      const omega = Array.from(
        el.querySelectorAll<HTMLTableRowElement>('tbody tr'),
      ).find((r) => r.textContent?.includes('Omega'))!;
      omega.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
      const req = http.expectOne(`${API}/candidati/f4/finalista`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ categoria: 'fish', finalista: true });
      req.flush({ ...CANDIDATO, id: 'f4' });
      http.expectOne(`${API}/rosa`).flush(rosa());
      await rendi();
    });

    it('⚠️ un rifiuto del server rimette la casella com’era e dice perché', async () => {
      await scheda('Rosa finale');
      http.expectOne(`${API}/rosa`).flush(rosa());
      await rendi();
      const omega = Array.from(
        el.querySelectorAll<HTMLTableRowElement>('tbody tr'),
      ).find((r) => r.textContent?.includes('Omega'))!;
      const casella = omega.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
      casella.click();
      http
        .expectOne(`${API}/candidati/f4/finalista`)
        .flush(
          { message: "La rosa di «Fish dell'anno» ha già 5 finalisti." },
          { status: 409, statusText: 'Conflict' },
        );
      await rendi();
      expect(casella.checked).toBeFalse();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('già 5 finalisti');
    });

    it('pubblica con conferma in linea, poi rilegge rosa ed edizione', async () => {
      await scheda('Rosa finale');
      const r = rosa();
      r.categorie[0] = { ...r.categorie[0], esito: 'NON_ASSEGNATA', finalisti: 0, accettati: [] };
      http.expectOne(`${API}/rosa`).flush(r);
      await rendi();
      bottoneDi(el, 'Pubblica la rosa finale')!.click();
      await rendi();
      http.expectNone(`${API}/finalisti/pubblica`);
      expect(el.textContent).toContain('non si ripubblica');
      bottoneDi(el, 'Sì, pubblica')!.click();
      const req = http.expectOne(`${API}/finalisti/pubblica`);
      expect(req.request.method).toBe('POST');
      req.flush({ pubblicataAt: '2026-12-05T10:00:00.000Z' });
      http.expectOne(`${API}/rosa`).flush({ ...r, pubblicataAt: '2026-12-05T10:00:00.000Z' });
      http.expectOne(`${API}/edizione`).flush(EDIZIONE);
      await rendi();
      expect(el.textContent).toContain('Pubblicata il');
    });

    it('a voto aperto le caselle sono spente', async () => {
      await scheda('Rosa finale');
      http.expectOne(`${API}/rosa`).flush(rosa({ fase: 'VOTO', modificabile: false }));
      await rendi();
      const caselle = el.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]');
      expect(caselle.length).toBeGreaterThan(0);
      caselle.forEach((c) => expect(c.disabled).toBeTrue());
    });
  });

  describe('voti', () => {
    async function apriVoti() {
      await scheda('Voti');
      http.expectOne(`${API}/voti`).flush(VOTI);
      await rendi();
    }

    it('mostra i conteggi per finalista e i segnali antifrode', async () => {
      await apriVoti();
      const testo = el.textContent ?? '';
      expect(testo).toContain('Account nuovi');
      expect(testo).toContain('gmail.com');
      const alfa = Array.from(el.querySelectorAll('tbody tr')).find((r) =>
        r.querySelector('th')?.textContent?.includes('Alfa'),
      )!;
      expect(
        Array.from(alfa.querySelectorAll('td.is-num')).map((c) => c.textContent?.trim()),
      ).toEqual(['2', '1']);
    });

    it('⚠️ annullare un voto chiede il motivo, e si legge nella modale', async () => {
      await apriVoti();
      el.querySelector<HTMLButtonElement>(
        'button[aria-label="Votanti di Alfa in Fish dell\'anno"]',
      )!.click();
      await rendi();
      const req = http.expectOne(
        (r) => r.url === `${API}/voti/votanti` && r.params.get('candidatoId') === 'f1',
      );
      expect(req.request.params.get('categoria')).toBe('fish');
      req.flush([
        {
          votoId: 'v1',
          account: { nickname: 'nuovo', email: 'n@usaegetta.it', iscrittoIl: '2026-12-08T10:00:00.000Z' },
          votatoIl: '2026-12-08T11:00:00.000Z',
          annullato: null,
        },
      ]);
      await rendi();
      const dialogo = document.querySelector('dialog')!;
      expect(dialogo.textContent).toContain('n@usaegetta.it');
      bottoneDi(dialogo, 'Annulla…')!.click();
      await rendi();
      const annulla = bottoneDi(dialogo, 'Annulla il voto')!;
      expect(annulla.disabled).toBeTrue();
      const motivo = dialogo.querySelector<HTMLInputElement>('.aw-ad__annulla input')!;
      motivo.value = 'account usa e getta';
      motivo.dispatchEvent(new Event('input'));
      await rendi();
      annulla.click();
      const post = http.expectOne(`${API}/voti/v1/annulla`);
      expect(post.request.body).toEqual({ motivo: 'account usa e getta' });
      post.flush({ ok: true });
      http.expectOne((r) => r.url === `${API}/voti/votanti`).flush([]);
      http.expectOne(`${API}/voti`).flush(VOTI);
      await rendi();
    });
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

    it('il selettore cambia email e ne rilegge lo stato', async () => {
      await apriEdizione();
      const select = el.querySelector<HTMLSelectElement>('.aw-ad__quale select')!;
      select.value = 'voto-aperto';
      select.dispatchEvent(new Event('change'));
      await rendi();
      http.expectOne(`${API}/annunci/voto-aperto`).flush({
        ...ANNUNCIO,
        tipo: 'voto-aperto',
        inviabile: false,
        motivo: 'Il voto non è ancora aperto: questa email si manda da quando si apre.',
      });
      await rendi();
      expect(el.textContent).toContain('Il voto non è ancora aperto');
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
