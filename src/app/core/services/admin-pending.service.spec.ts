import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AdminPendingService } from './admin-pending.service';

const API = environment.API_URL;

describe('AdminPendingService', () => {
  let service: AdminPendingService;
  let http: HttpTestingController;

  const isRichieste = (r: { url: string }) =>
    r.url === `${API}/admin/subscription-requests`;
  const isAffiliazioni = (r: { url: string }) =>
    r.url === `${API}/admin/affiliations/pending-count`;
  const isRedazione = (r: { url: string }) =>
    r.url === `${API}/admin/news/pending-count`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AdminPendingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('un refresh riempie i tre conteggi, ognuno dalla sua fonte', () => {
    service.refresh();

    http
      .expectOne(isRichieste)
      .flush({ items: [], total: 7, page: 1, limit: 1, totalPages: 7 });
    http.expectOne(isAffiliazioni).flush({ inVerifica: 2 });
    http.expectOne(isRedazione).flush({ inCoda: 3 });

    expect(service.richieste()).toBe(7);
    expect(service.affiliazioni()).toBe(2);
    expect(service.redazione()).toBe(3);
  });

  it('il min-interval assorbe i refresh ravvicinati; force li scavalca', () => {
    service.refresh();
    http
      .expectOne(isRichieste)
      .flush({ items: [], total: 1, page: 1, limit: 1, totalPages: 1 });
    http.expectOne(isAffiliazioni).flush({ inVerifica: 0 });
    http.expectOne(isRedazione).flush({ inCoda: 0 });

    // la shell chiama refresh() a ogni cambio sezione: senza il freno ogni
    // click farebbe tre chiamate — qui NON deve partire nulla
    service.refresh();
    http.expectNone(isRichieste);
    http.expectNone(isAffiliazioni);
    http.expectNone(isRedazione);

    // entrando in Panoramica il refresh è forzato
    service.refresh(true);
    http
      .expectOne(isRichieste)
      .flush({ items: [], total: 4, page: 1, limit: 1, totalPages: 4 });
    http.expectOne(isAffiliazioni).flush({ inVerifica: 1 });
    http.expectOne(isRedazione).flush({ inCoda: 5 });
    expect(service.richieste()).toBe(4);
    expect(service.redazione()).toBe(5);
  });

  it('ogni fonte degrada a null da sola, senza toccare le altre', () => {
    // ⚠️ Prima si riempiono davvero i tre conteggi: partendo dal `null`
    // iniziale questo test passerebbe anche cancellando i rami `error`, perché
    // "non è mai stato scritto" e "è tornato a null" si assomigliano. Il badge
    // deve **spegnersi**, non restare a contare un numero vecchio.
    service.refresh();
    http
      .expectOne(isRichieste)
      .flush({ items: [], total: 7, page: 1, limit: 1, totalPages: 7 });
    http.expectOne(isAffiliazioni).flush({ inVerifica: 9 });
    http.expectOne(isRedazione).flush({ inCoda: 5 });
    expect(service.richieste()).toBe(7);
    expect(service.redazione()).toBe(5);

    // `force`: qui si prova il degrado, non il freno del min-interval.
    service.refresh(true);
    http
      .expectOne(isRichieste)
      .flush(null, { status: 500, statusText: 'Server Error' });
    http.expectOne(isAffiliazioni).flush({ inVerifica: 9 });
    http
      .expectOne(isRedazione)
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(service.richieste()).toBeNull();
    // Il vicino sano non viene trascinato giù: i tre conteggi sono indipendenti.
    expect(service.affiliazioni()).toBe(9);
    expect(service.redazione()).toBeNull();
  });
});
