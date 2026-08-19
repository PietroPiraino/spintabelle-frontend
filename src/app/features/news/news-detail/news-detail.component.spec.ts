import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import localeIt from '@angular/common/locales/it';
import {
  LOCALE_ID,
  RESPONSE_INIT,
  provideZonelessChangeDetection,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { NewsDetailComponent } from './news-detail.component';

const API = environment.API_URL;

registerLocaleData(localeIt);

/**
 * ⚠️ QUESTA SPEC ESISTE PER UNA COSA SOLA: fissare il 404.
 *
 * Da quando `news/:id` e' `RenderMode.Server` (19/08/2026) non c'e' piu' un
 * file per articolo: la pagina la rende l'app a ogni richiesta, e l'unico modo
 * che ha di dire "questo articolo non esiste" e' mutare lo stato della risposta
 * SSR attraverso il token `RESPONSE_INIT` di `@angular/core`. Senza quella
 * mutazione, QUALSIASI id inventato risponde 200 con la pagina "News non
 * trovata": un soft-404 su infinite URL, cioe' il difetto che `public/404.html`
 * ha chiuso il 16/08/2026, riaperto da un'altra porta.
 *
 * E' un contratto di MUTAZIONE su un oggetto iniettato — fragile per natura, e
 * invisibile in locale (in prerender e nel browser il token e' `null`). Se
 * questa spec un giorno fallisce dopo un aggiornamento di Angular, NON e' la
 * spec da aggiustare: e' il ripiego del piano da attivare (far riconoscere alla
 * Pages Function il marcatore di "non trovato" e riscrivere lo stato li').
 */
describe('NewsDetailComponent — stato 404 della risposta SSR', () => {
  let fixture: ComponentFixture<NewsDetailComponent>;
  let http: HttpTestingController;
  let responseInit: ResponseInit;

  const crea = (id: string) => {
    fixture = TestBed.createComponent(NewsDetailComponent);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
  };

  beforeEach(() => {
    // L'oggetto che l'engine di @angular/ssr passa come `useValue` e con cui poi
    // costruisce la Response: qui lo si simula com'e' davvero, un oggetto nudo.
    responseInit = { status: 200 };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOCALE_ID, useValue: 'it' },
        { provide: RESPONSE_INIT, useValue: responseInit },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('mette 404 sulla risposta quando l\'articolo non esiste', () => {
    crea('id-inventato');
    http
      .expectOne(`${API}/news/id-inventato`)
      .flush({ message: 'News non trovata' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(responseInit.status).toBe(404);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('News non trovata');
  });

  it('lascia 200 quando l\'articolo esiste', () => {
    crea('articolo-vero');
    http.expectOne(`${API}/news/articolo-vero`).flush({
      _id: 'articolo-vero',
      title: 'Titolo di prova',
      body: 'Corpo di prova.',
      createdAt: '2026-08-19T10:00:00.000Z',
      updatedAt: '2026-08-19T10:00:00.000Z',
    });
    fixture.detectChanges();

    expect(responseInit.status).toBe(200);
  });

});

describe('NewsDetailComponent — senza RESPONSE_INIT (browser e prerender)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOCALE_ID, useValue: 'it' },
        // ⚠️ Nessun RESPONSE_INIT: e' il caso NORMALE, non un caso limite — il
        // token esiste solo durante una resa lato server. Se l'iniezione nel
        // componente perdesse l'`{ optional: true }`, l'app non partirebbe
        // affatto nel browser, e lo si scoprirebbe in produzione.
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('mostra la pagina «non trovata» senza sollevare eccezioni', () => {
    const f = TestBed.createComponent(NewsDetailComponent);
    f.componentRef.setInput('id', 'id-inventato');
    f.detectChanges();
    http
      .expectOne(`${API}/news/id-inventato`)
      .flush({ message: 'News non trovata' }, { status: 404, statusText: 'Not Found' });
    f.detectChanges();

    expect((f.nativeElement as HTMLElement).textContent).toContain('News non trovata');
  });
});
