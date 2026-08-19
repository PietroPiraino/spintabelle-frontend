import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import localeIt from '@angular/common/locales/it';
import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AI_DISCLOSURE } from '../../../core/news.constants';
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
 *
 * ---
 *
 * ⚠️ DA QUI IN GIÙ (19/08/2026) SI VERIFICA L'IDENTITÀ EDITORIALE — byline, data
 * di pubblicazione, note di rettifica, etichetta IA. La gemella di questi casi
 * sta in `scripts/lib/news-render.test.mjs`, che misura la stessa pagina come la
 * scrive l'edge: le due stesure devono dire le stesse cose, e l'unica che il
 * crawler legge è quella. **L'unica asimmetria voluta è l'etichetta IA**, che
 * vive solo qui perché è volontaria (le ragioni in `core/news.constants.ts`).
 */
describe('NewsDetailComponent', () => {
  let http: HttpTestingController;

  /**
   * ⚠️ `publishedAt` e `createdAt` sono DIVERSI di proposito: con due date
   * uguali un controllo sulla data passerebbe anche leggendo il campo
   * sbagliato — che è lo stato in cui questa pagina è rimasta fino al
   * 19/08/2026. Le ore sono a mezzogiorno UTC perché il `DatePipe` formatta nel
   * fuso della macchina che esegue Karma.
   */
  const ARTICOLO = {
    _id: 'articolo-vero',
    title: 'Titolo di prova',
    body: 'Corpo di prova.',
    autore: 'Pietro Piraino',
    publishedAt: '2026-08-19T12:00:00.000Z',
    createdAt: '2026-08-17T12:00:00.000Z',
    updatedAt: '2026-08-21T12:00:00.000Z',
  };

  function monta(
    extra: Record<string, unknown> = {},
  ): ComponentFixture<NewsDetailComponent> {
    const f = TestBed.createComponent(NewsDetailComponent);
    f.componentRef.setInput('id', 'articolo-vero');
    f.detectChanges();
    http.expectOne(`${API}/news/articolo-vero`).flush({ ...ARTICOLO, ...extra });
    f.detectChanges();
    return f;
  }

  /** I dati strutturati scritti nel <head> da `SeoService`. */
  function jsonLd(): Record<string, any> {
    const el = document.getElementById('ld-news-article');
    expect(el).withContext('manca il blocco JSON-LD dell\'articolo').toBeTruthy();
    return JSON.parse(el!.textContent ?? '{}');
  }

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

  afterEach(() => {
    http.verify();
    // I dati strutturati vivono nel <head> del documento, che è condiviso fra i
    // test: il componente li toglie alla distruzione, qui si fa pulizia anche
    // per i casi che non distruggono la fixture.
    document.getElementById('ld-news-article')?.remove();
  });

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
    const f = monta();
    const testo = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(testo).toContain('Titolo di prova');
    expect(testo).not.toContain('News non trovata');
  });

  // ---- Byline e data (§4.2) ---------------------------------------------

  it('firma l\'articolo con un collegamento a /redazione', () => {
    // ⚠️ È un collegamento e non testo semplice: `/redazione` è la pagina dove
    // il lettore trova chi risponde degli articoli, ed è la seconda gamba
    // dell'esonero dell'art. 50(4) AI Act. Senza quella pagina raggiungibile la
    // firma è un ornamento.
    const el = (monta().nativeElement as HTMLElement).querySelector(
      '.news-detail__byline a',
    ) as HTMLAnchorElement | null;
    expect(el?.textContent?.trim()).toBe('Pietro Piraino');
    expect(el?.getAttribute('href')).toBe('/redazione');
  });

  it('senza autore non stampa una firma vuota', () => {
    const f = monta({ autore: undefined });
    expect(
      (f.nativeElement as HTMLElement).querySelector('.news-detail__byline'),
    ).toBeNull();
  });

  it('la data in pagina è publishedAt, non createdAt', () => {
    // ⚠️ L'asserzione sta sull'attributo `datetime` e non sul testo reso: è la
    // stringa che leggono le macchine, ed è indipendente dal fuso della
    // macchina che esegue i test.
    const el = (monta().nativeElement as HTMLElement).querySelector(
      'time.news-detail__date',
    );
    expect(el?.getAttribute('datetime')).toBe(ARTICOLO.publishedAt);
    expect(el?.textContent).toContain('2026');
  });

  it('senza publishedAt ripiega su createdAt invece di lasciare il vuoto', () => {
    const f = monta({ publishedAt: undefined });
    expect(
      (f.nativeElement as HTMLElement)
        .querySelector('time.news-detail__date')
        ?.getAttribute('datetime'),
    ).toBe(ARTICOLO.createdAt);
  });

  // ---- Note di rettifica (§4.4) -----------------------------------------

  it('stampa le note di rettifica fra l\'intestazione e il corpo', () => {
    const f = monta({
      rettifiche: [{ at: '2026-08-20T12:00:00.000Z', nota: 'Il montepremi era 5.000.' }],
      ultimaRettificaAt: '2026-08-20T12:00:00.000Z',
    });
    const root = f.nativeElement as HTMLElement;
    const nota = root.querySelector('.news-detail__rettifica');
    expect(nota?.textContent).toContain('Nota di rettifica');
    expect(nota?.textContent).toContain('Il montepremi era 5.000.');
    // La posizione fa parte del contenuto: una correzione che si legge dopo
    // l'articolo sbagliato non è una correzione.
    const corpo = root.querySelector('app-markdown');
    expect(nota!.compareDocumentPosition(corpo!) & Node.DOCUMENT_POSITION_FOLLOWING)
      .withContext('la nota di rettifica deve precedere il corpo')
      .toBeTruthy();
  });

  it('senza rettifiche non stampa alcun riquadro', () => {
    const f = monta();
    expect(
      (f.nativeElement as HTMLElement).querySelector('.news-detail__rettifiche'),
    ).toBeNull();
  });

  // ---- Etichetta IA (§4.3) ----------------------------------------------

  it('rende l\'etichetta IA con il nome del REVISORE e il rimando alla policy', () => {
    const f = monta({
      aiGeneratedAt: '2026-08-19T10:00:00.000Z',
      revisionatoDaNome: 'Pietro Piraino',
    });
    const el = (f.nativeElement as HTMLElement).querySelector('.news-detail__ia');
    // Il testo reso deve essere la costante versionata, carattere per carattere.
    expect(el?.textContent?.trim()).toBe(AI_DISCLOSURE.testo('Pietro Piraino'));
    expect(el?.querySelector('a')?.getAttribute('href')).toBe('/policy-editoriale');
  });

  it('non rende l\'etichetta su un pezzo scritto a mano', () => {
    const f = monta({ revisionatoDaNome: 'Pietro Piraino' });
    expect((f.nativeElement as HTMLElement).querySelector('.news-detail__ia')).toBeNull();
  });

  it('senza il nome del revisore NON ripiega sulla byline: non rende niente', () => {
    // ⚠️ È il caso che decide la forma di questa etichetta. La frase *afferma*
    // che una persona ha verificato l'articolo, e la policy editoriale
    // pubblicata promette di dire CHI. Le uscite possibili senza quel nome
    // sarebbero «da undefined» o il nome dell'autore — che il giorno in cui
    // autore e revisore non coincidono più è semplicemente falso (D62: oggi
    // coincidono, ma è un fatto di oggi). Non renderla è l'unica terza via, e
    // costa poco perché questa etichetta è volontaria.
    const f = monta({
      aiGeneratedAt: '2026-08-19T10:00:00.000Z',
      autore: 'Pietro Piraino',
    });
    const root = f.nativeElement as HTMLElement;
    expect(root.querySelector('.news-detail__ia')).toBeNull();
    expect(root.textContent).not.toContain('verificato e approvato');
  });

  // ---- Dati strutturati (§4.4 · D45) ------------------------------------

  it('datePublished è publishedAt e dateModified NON è updatedAt', () => {
    // ⚠️ Con `updatedAt` qualunque salvataggio dell'admin — un refuso, un tag —
    // alzava la data e la pagina si dichiarava aggiornata senza esserlo.
    monta();
    const dati = jsonLd();
    expect(dati['datePublished']).toBe(ARTICOLO.publishedAt);
    expect(dati['dateModified']).toBe(ARTICOLO.publishedAt);
    expect(dati['dateModified']).not.toBe(ARTICOLO.updatedAt);
  });

  it('dateModified si muove solo con una rettifica pubblicata', () => {
    monta({ ultimaRettificaAt: '2026-08-20T12:00:00.000Z' });
    expect(jsonLd()['dateModified']).toBe('2026-08-20T12:00:00.000Z');
  });

  it('l\'autore dei dati strutturati è una Person che punta a /redazione', () => {
    // ⚠️ `Person` e non `Organization` (D40): i dati strutturati devono dire
    // quello che dice la pagina. Il publisher resta l'organizzazione.
    monta();
    const dati = jsonLd();
    expect(dati['author']['@type']).toBe('Person');
    expect(dati['author']['name']).toBe('Pietro Piraino');
    expect(dati['author']['url']).toBe('https://bestfishforever.it/redazione/');
    expect(dati['publisher']['@type']).toBe('Organization');
  });

  it('senza autore non dichiara un author vuoto', () => {
    monta({ autore: undefined });
    expect(jsonLd()['author']).toBeUndefined();
  });
});
