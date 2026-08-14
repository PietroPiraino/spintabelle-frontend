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

  it('un refresh riempie i due conteggi, ognuno dalla sua fonte', () => {
    service.refresh();

    http
      .expectOne(isRichieste)
      .flush({ items: [], total: 7, page: 1, limit: 1, totalPages: 7 });
    http.expectOne(isAffiliazioni).flush({ inVerifica: 2 });

    expect(service.richieste()).toBe(7);
    expect(service.affiliazioni()).toBe(2);
  });

  it('il min-interval assorbe i refresh ravvicinati; force li scavalca', () => {
    service.refresh();
    http
      .expectOne(isRichieste)
      .flush({ items: [], total: 1, page: 1, limit: 1, totalPages: 1 });
    http.expectOne(isAffiliazioni).flush({ inVerifica: 0 });

    // la shell chiama refresh() a ogni cambio sezione: senza il freno ogni
    // click farebbe due chiamate — qui NON deve partire nulla
    service.refresh();
    http.expectNone(isRichieste);
    http.expectNone(isAffiliazioni);

    // entrando in Panoramica il refresh è forzato
    service.refresh(true);
    http
      .expectOne(isRichieste)
      .flush({ items: [], total: 4, page: 1, limit: 1, totalPages: 4 });
    http.expectOne(isAffiliazioni).flush({ inVerifica: 1 });
    expect(service.richieste()).toBe(4);
  });

  it('ogni fonte degrada a null da sola, senza toccare l\'altra', () => {
    service.refresh();

    http
      .expectOne(isRichieste)
      .flush(null, { status: 500, statusText: 'Server Error' });
    http.expectOne(isAffiliazioni).flush({ inVerifica: 9 });

    expect(service.richieste()).toBeNull();
    expect(service.affiliazioni()).toBe(9);
  });
});
