import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import {
  Paginated,
  SubscriptionRequest,
} from '../../../core/models/api.models';
import { AdminSubscriptionRequestsComponent } from './admin-subscription-requests.component';

const API = environment.API_URL;
const ROTTA = `${API}/admin/subscription-requests`;

const richiesta = (
  over: Partial<SubscriptionRequest> = {},
): SubscriptionRequest =>
  ({
    id: 'r1',
    userEmail: 'mario@bff.it',
    userNickname: 'Mario',
    tier: 'SQUALO',
    tierLabel: 'Squalo',
    status: 'pending',
    paymentMethod: 'paypal',
    createdAt: '2026-09-01T10:00:00.000Z',
    listPriceEur: 125,
    ...over,
  }) as SubscriptionRequest;

const pagina = (
  items: SubscriptionRequest[],
  over: Partial<Paginated<SubscriptionRequest>> = {},
): Paginated<SubscriptionRequest> => ({
  items,
  total: items.length,
  page: 1,
  limit: 25,
  totalPages: 1,
  ...over,
});

describe('AdminSubscriptionRequestsComponent', () => {
  let fixture: ComponentFixture<AdminSubscriptionRequestsComponent>;
  let http: HttpTestingController;

  const testo = () => fixture.nativeElement.textContent as string;

  const stabilizza = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const rispondi = async (p: Paginated<SubscriptionRequest>) => {
    http.expectOne((r) => r.url === ROTTA).flush(p);
    await stabilizza();
  };

  /** Il comando di riga si cerca per NOME ACCESSIBILE, mai per classe. */
  const comandoRiga = (i = 0): HTMLButtonElement =>
    [...fixture.nativeElement.querySelectorAll('button')].filter(
      (b: HTMLButtonElement) =>
        b.getAttribute('aria-label')?.startsWith('Apri la richiesta di'),
    )[i] as HTMLButtonElement;

  const bottone = (t: string): HTMLButtonElement | undefined =>
    [...fixture.nativeElement.querySelectorAll('button')].find(
      (b: HTMLButtonElement) => b.textContent?.trim() === t,
    ) as HTMLButtonElement | undefined;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminSubscriptionRequestsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminSubscriptionRequestsComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    document.documentElement.classList.remove('is-modale');
  });

  describe('la tabella', () => {
    it('⚠️ mostra «Da incassare» come COLONNA', async () => {
      // È il numero su cui si decide — quello che l'owner confronta col
      // bonifico ricevuto. Prima non compariva affatto nella riga: stava in
      // fondo a quattro paragrafi di meta, e per leggerlo bisognava scorrere.
      await rispondi(
        pagina([richiesta({ listPriceEur: 125, discountedPriceEur: 99 })]),
      );
      const intestazioni = [
        ...fixture.nativeElement.querySelectorAll('thead th'),
      ].map((h: HTMLElement) => h.textContent?.trim());
      expect(intestazioni).toContain('Da incassare');
      expect(testo()).toContain('€99');
    });

    it('il filtro di stato è una scelta esclusiva, non quattro toggle', async () => {
      await rispondi(pagina([richiesta()]));
      const gruppo = fixture.nativeElement.querySelector('[role="radiogroup"]');
      expect(gruppo).toBeTruthy();
      const acceso = [...gruppo.querySelectorAll('[role="radio"]')].filter(
        (b: HTMLElement) => b.getAttribute('aria-checked') === 'true',
      );
      expect(acceso.length).toBe(1);
      expect(acceso[0].textContent?.trim()).toBe('In attesa');
    });

    it('lo stato vuoto è un messaggio, non una tabella con la sola intestazione', async () => {
      await rispondi(pagina([]));
      expect(testo()).toContain('Nessuna richiesta con questo filtro');
      expect(fixture.nativeElement.querySelector('table')).toBeFalsy();
    });
  });

  describe('la modale della decisione', () => {
    const apri = async () => {
      await rispondi(pagina([richiesta()]));
      comandoRiga().click();
      await stabilizza();
    };

    it('si apre come dialog modale sulla richiesta scelta', async () => {
      await apri();
      const d = fixture.nativeElement.querySelector(
        'dialog',
      ) as HTMLDialogElement;
      expect(d.matches(':modal')).toBe(true);
      expect(testo()).toContain('Richiesta di Mario');
    });

    it('approva e chiude', async () => {
      await apri();
      bottone('Approva')!.click();
      const req = http.expectOne((r) => r.url === `${ROTTA}/r1/approve`);
      expect(req.request.method).toBe('POST');
      req.flush(richiesta({ status: 'approved' }));
      await rispondi(pagina([richiesta({ status: 'approved' })]));
      expect(fixture.nativeElement.querySelector('dialog')).toBeFalsy();
      expect(testo()).toContain('attivato');
    });

    it('⚠️ il motivo del rifiuto è un CAMPO, non un window.prompt', async () => {
      // Il prompt di sistema non è stilizzabile e su alcune configurazioni il
      // browser lo sopprime del tutto: in quel caso la richiesta veniva
      // rifiutata senza motivo e nessuno lo notava.
      await apri();
      const campo = fixture.nativeElement.querySelector(
        '#rq-motivo',
      ) as HTMLInputElement;
      expect(campo).toBeTruthy();
      campo.value = 'pagamento non ricevuto';
      campo.dispatchEvent(new Event('input'));
      await stabilizza();

      bottone('Rifiuta')!.click();
      const req = http.expectOne((r) => r.url === `${ROTTA}/r1/reject`);
      expect(req.request.body).toEqual({ note: 'pagamento non ricevuto' });
      req.flush(richiesta({ status: 'rejected' }));
      await rispondi(pagina([]));
    });

    it('un motivo vuoto non manda una nota vuota', async () => {
      await apri();
      bottone('Rifiuta')!.click();
      const req = http.expectOne((r) => r.url === `${ROTTA}/r1/reject`);
      expect(req.request.body).toEqual({});
      req.flush(richiesta({ status: 'rejected' }));
      await rispondi(pagina([]));
    });

    it('⚠️ un errore si legge DENTRO la modale, che resta aperta', async () => {
      // Con un dialog aperto un toast dipinge dietro il fondale (top layer):
      // il messaggio esisterebbe e nessuno lo vedrebbe.
      await apri();
      bottone('Approva')!.click();
      http
        .expectOne((r) => r.url === `${ROTTA}/r1/approve`)
        .flush({ message: 'Fondi insufficienti' }, { status: 409, statusText: 'Conflict' });
      await stabilizza();
      const d = fixture.nativeElement.querySelector('dialog');
      expect(d).toBeTruthy();
      expect(d.textContent).toContain('Fondi insufficienti');
    });

    it('su una richiesta già decisa non offre i comandi della decisione', async () => {
      await rispondi(pagina([richiesta({ status: 'approved' })]));
      comandoRiga().click();
      await stabilizza();
      expect(bottone('Approva')).toBeFalsy();
      expect(fixture.nativeElement.querySelector('#rq-motivo')).toBeFalsy();
    });
  });
});
