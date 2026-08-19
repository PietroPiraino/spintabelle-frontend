import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import localeIt from '@angular/common/locales/it';
import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { NewsDetailComponent } from './news-detail.component';

const API = environment.API_URL;

registerLocaleData(localeIt);

/**
 * ⚠️ QUESTA SPEC NASCE DA UNA RIMOZIONE, e vale la pena dire quale.
 *
 * Fino al 19/08/2026 verificava che il componente mutasse `RESPONSE_INIT` per
 * far rispondere 404 all'SSR su un articolo inesistente. L'SSR non c'è più (il
 * bundle server pesa 11 MB e Cloudflare rifiuta una Function sopra i 3 MiB:
 * la storia è nel commento di angular.json), quindi quel token è `null` sempre
 * e la spec verificava una mutazione che in produzione non avveniva mai — cioè
 * dava per coperto proprio il caso che non lo era più.
 *
 * ⚠️ IL 404 VERO ORA È ALTROVE: lo produce `functions/news/[[path]].ts`, che
 * risponde 404 con il corpo di `public/404.html` quando l'API dice 404. Non è
 * verificabile da Karma (è una Pages Function, non c'è in `dist/`): lo verifica
 * dal vivo, dopo il deploy, `node scripts/check-news-live.mjs`.
 *
 * Quello che resta qui è l'altro caso, che è dello SPA e solo suo: chi sta già
 * navigando il sito e apre un articolo cancellato. Lì non c'è nessuna risposta
 * HTTP da marcare — c'è una pagina da mostrare, e deve mostrarla.
 */
describe('NewsDetailComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOCALE_ID, useValue: 'it' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('mostra «News non trovata» quando l\'articolo non esiste', () => {
    const f = TestBed.createComponent(NewsDetailComponent);
    f.componentRef.setInput('id', 'id-inventato');
    f.detectChanges();
    http
      .expectOne(`${API}/news/id-inventato`)
      .flush({ message: 'News non trovata' }, { status: 404, statusText: 'Not Found' });
    f.detectChanges();

    expect((f.nativeElement as HTMLElement).textContent).toContain('News non trovata');
  });

  it('mostra titolo e corpo quando l\'articolo esiste', () => {
    const f = TestBed.createComponent(NewsDetailComponent);
    f.componentRef.setInput('id', 'articolo-vero');
    f.detectChanges();
    http.expectOne(`${API}/news/articolo-vero`).flush({
      _id: 'articolo-vero',
      title: 'Titolo di prova',
      body: 'Corpo di prova.',
      createdAt: '2026-08-19T10:00:00.000Z',
      updatedAt: '2026-08-19T10:00:00.000Z',
    });
    f.detectChanges();

    const testo = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(testo).toContain('Titolo di prova');
    expect(testo).not.toContain('News non trovata');
  });
});
