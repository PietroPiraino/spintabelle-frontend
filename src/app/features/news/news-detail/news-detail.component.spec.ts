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
import { ToastService } from '../../../shared/ui/toast/toast.service';
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
    // ⚠️ E NIENTE CONDIVISIONE SU UNA PAGINA CHE NON C'È. Oggi è vero per
    // costruzione — il `<footer class="news-share">` sta dentro il ramo `@else`
    // — ma nulla diventerebbe rosso se domani il blocco finisse fuori dalla
    // catena `@if/@else if/@else`: è la mossa naturale per dargli una fascia a
    // tutta larghezza, o per allinearlo al campo d'appoggio, che è GIÀ fuori dal
    // ramo e infatti si rende anche qui. L'esito sarebbe «News non trovata:
    // forse è stata rimossa» seguito da «Condividi l'articolo» con tre link a
    // un 404 — un invito a diffondere una pagina che non esiste.
    expect((f.nativeElement as HTMLElement).querySelector('.news-share'))
      .withContext('il blocco di condivisione è finito fuori dal ramo dell\'articolo')
      .toBeNull();
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

  // ---- Copertina social: due campi, due mestieri (A2) --------------------

  /**
   * ⚠️ DUE campi e non uno, ed è il cuore della deviazione dalla specifica
   * §4.8: `coverImageUrl` è l'immagine **visibile** nell'articolo (le foto
   * vere, scelte a mano — i tre articoli storici hanno quelle), `ogImageUrl` è
   * la targa 1200×675 generata dal backend, che esiste **solo** per le
   * anteprime social e in pagina non si vede mai.
   *
   * La catena è `ogImageUrl || coverImageUrl || og.png`, ed è scritta DUE volte
   * perché le due rese di questa pagina si **sostituiscono** invece di fondersi:
   * l'HTML iniziale lo compone `functions/lib/render-news.mjs` (lo legge lo
   * scraper), questo componente lo riscrive all'idratazione (lo legge il
   * browser). Aggiornarne una sola vorrebbe dire un'anteprima che cambia a
   * seconda di chi guarda. La gemella di questi casi sta in
   * `scripts/lib/news-render.test.mjs`.
   */
  const TARGA = 'https://cdn.bestfishforever.it/news/titolo-di-prova/cover.png';
  const FOTO = 'https://cdn.bestfishforever.it/news/foto-vera.jpg';

  /** Il contenuto di un meta del <head>, dove `SeoService` lo scrive davvero. */
  const meta = (property: string): string | null =>
    document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
      ?.content ?? null;

  it('og:image è la targa generata quando c\'è', () => {
    monta({ ogImageUrl: TARGA, coverImageUrl: FOTO });
    expect(meta('og:image')).toBe(TARGA);
  });

  it('senza targa l\'og:image ricade sulla copertina', () => {
    monta({ coverImageUrl: FOTO });
    expect(meta('og:image')).toBe(FOTO);
  });

  it('⚠️ una targa VUOTA non scavalca la foto: `||`, mai `??`', () => {
    // ⚠️ L'unico valore su cui i due operatori divergono, e la resa all'edge usa
    // `||` (`ogImage || copertina || OG_PREDEFINITA`). Con `??` qui la stringa
    // vuota vincerebbe, `SeoService.applyMeta` la trasformerebbe nell'`og.png`
    // predefinito, e lo stesso articolo mostrerebbe la FOTO allo scraper e
    // l'og.png a chi apre il link nel browser — l'anteprima che cambia a seconda
    // di chi guarda, cioè il difetto che questa coppia di rese deve escludere.
    // Il valore è raggiungibile: lo schema del backend ha `trim: true`, quindi
    // uno spazio salvato per sbaglio arriva qui come `''`.
    monta({ ogImageUrl: '', coverImageUrl: FOTO });
    expect(meta('og:image')).toBe(FOTO);
  });

  it('senza nessuna delle due resta l\'immagine predefinita del sito', () => {
    // È il punto di partenza che questo lotto sta correggendo: ogni articolo
    // condiviso mostrava la stessa identica figura.
    //
    // ⚠️ Il segnaposto non è decorativo. I meta vivono nel `<head>` del
    // documento, che TUTTE le spec condividono, e Jasmine gira in ordine
    // casuale: senza avvelenare il campo prima, un `og.png` lasciato lì da
    // un'altra pagina — che usa la stessa immagine predefinita — farebbe
    // passare questo caso anche con il componente che non scrive più niente.
    document
      .querySelector<HTMLMetaElement>('meta[property="og:image"]')
      ?.setAttribute('content', 'https://esempio.invalido/segnaposto.png');

    monta();
    expect(meta('og:image')).toBe('https://bestfishforever.it/og.png');
  });

  it('⚠️ la targa NON entra in pagina: l\'<img> resta la foto vera', () => {
    // Se il template rendesse `ogImageUrl`, l'articolo mostrerebbe in cima una
    // figura che ripete il titolo stampato due centimetri sotto — che è la
    // ragione per cui la copertina generata vive solo nell'`og:image`.
    const f = monta({ ogImageUrl: TARGA, coverImageUrl: FOTO });
    const img = (f.nativeElement as HTMLElement).querySelector<HTMLImageElement>(
      'img.news-detail__cover',
    );
    expect(img).withContext('la foto vera deve restare in pagina').toBeTruthy();
    expect(img!.getAttribute('src')).toBe(FOTO);
  });

  it('⚠️ con la SOLA targa la pagina non mostra alcuna immagine', () => {
    // È il caso di **ogni** pezzo scritto dalla redazione automatica: nessuna
    // foto scelta a mano, solo la targa. La pagina resta senza `<img>`, e
    // l'anteprima social ce l'ha lo stesso.
    const f = monta({ ogImageUrl: TARGA });
    expect((f.nativeElement as HTMLElement).querySelector('img')).toBeNull();
    expect(meta('og:image')).toBe(TARGA);
  });

  it('⚠️ i dati strutturati descrivono l\'articolo, non l\'insegna', () => {
    // `image` del NewsArticle resta `coverImageUrl`: i dati strutturati
    // descrivono il pezzo, e l'immagine del pezzo è quella che il lettore vede.
    monta({ ogImageUrl: TARGA, coverImageUrl: FOTO });
    expect(jsonLd()['image']).toEqual([FOTO]);
  });

  // ---- Condivisione (B) --------------------------------------------------

  /**
   * ⚠️ QUESTA È METÀ DEL BLOCCO, e la metà va detta. I tre collegamenti social
   * esistono anche nella resa all'edge (`functions/lib/render-news.mjs`): sono
   * `<a href>`, funzionano senza JavaScript, e quella è la stesura che leggono
   * lo scraper e il motore. Il **«Copia link» invece esiste solo qui**, perché
   * all'edge nessun gestore potrebbe ascoltarlo — sarebbe un bottone morto.
   *
   * L'asimmetria è pinnata **nei due versi**, e non tutti e due in questo file:
   * `scripts/lib/news-render.test.mjs` verifica che l'edge NON emetta il
   * controllo di copia *e* che questo template lo contenga. Senza il primo caso
   * qualcuno «allineerebbe» le rese aggiungendo il bottone morto; senza il
   * secondo lo toglierebbe per simmetria.
   */
  const SITO = 'https://bestfishforever.it';

  /** I tre collegamenti, letti dal DOM come li leggerebbe un browser. */
  function canali(f: ComponentFixture<NewsDetailComponent>) {
    const root = f.nativeElement as HTMLElement;
    const q = (host: string) =>
      root.querySelector<HTMLAnchorElement>(`.news-share__row a[href*="${host}"]`);
    return { whatsapp: q('wa.me'), telegram: q('t.me'), facebook: q('facebook.com') };
  }

  /** L'href del canonical, dove `SeoService` lo scrive davvero. */
  const canonical = (): string | null =>
    document
      .querySelector<HTMLLinkElement>('link[rel="canonical"]')
      ?.getAttribute('href') ?? null;

  it('offre i tre canali in fondo all\'articolo, ognuno con target e rel', () => {
    const c = canali(monta());
    expect(c.whatsapp).withContext('manca WhatsApp').not.toBeNull();
    expect(c.telegram).withContext('manca Telegram').not.toBeNull();
    expect(c.facebook).withContext('manca Facebook').not.toBeNull();
    // Convenzione della casa per ogni link che esce dal sito.
    for (const a of Object.values(c)) {
      expect(a!.getAttribute('target')).toBe('_blank');
      expect(a!.getAttribute('rel')).toBe('noopener');
    }
  });

  it('⚠️ il blocco è l\'ULTIMO figlio dell\'<article>, come nella resa all\'edge', () => {
    // Dentro l'articolo e in fondo: la colonna di lettura (max-width, gap) vive
    // su `.news-detail__article`, quindi un blocco fuori vorrebbe dire un
    // secondo contenitore con le stesse misure — una seconda fonte di verità
    // per la larghezza del testo.
    const article = (monta().nativeElement as HTMLElement).querySelector(
      'article.news-detail__article',
    )!;
    expect(article.lastElementChild?.classList).toContain('news-share');
  });

  it('⚠️ il «Copia link» c\'è: è la resa in cui può funzionare', () => {
    const copia = (monta().nativeElement as HTMLElement).querySelector(
      'button.news-share__copy',
    );
    expect(copia).not.toBeNull();
    // ⚠️ Il campo d'appoggio dev'essere RENDERIZZATO (fuori schermo, mai
    // `display: none`): un campo non renderizzato non si può selezionare.
    expect(
      (monta().nativeElement as HTMLElement).querySelector('input.news-share__fallback'),
    ).not.toBeNull();
  });

  it('⚠️ ogni `aria-label` contiene il testo visibile del suo controllo', () => {
    // WCAG 2.5.3 «Label in Name», livello A. L'`aria-label` **sostituisce** il
    // contenuto, quindi chi comanda a voce (Voice Control, Riconoscimento
    // vocale) legge l'etichetta scritta sul pulsante e dice «clicca Copia
    // link»: se il nome accessibile non la contiene, il comando non aggancia
    // niente. È il difetto per cui questo caso esiste — «Copia il link
    // dell'articolo» non contiene «Copia link», mentre «Condividi su WhatsApp»
    // contiene «WhatsApp».
    const controlli = (monta().nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
      '.news-share__btn',
    );
    expect(controlli.length).withContext('i quattro controlli').toBe(4);
    for (const el of Array.from(controlli)) {
      const nomeAccessibile = el.getAttribute('aria-label') ?? '';
      const visibile = (el.querySelector('span')?.textContent ?? '').trim();
      expect(visibile).withContext('un controllo senza testo visibile').not.toBe('');
      expect(nomeAccessibile)
        .withContext(`aria-label "${nomeAccessibile}" non contiene "${visibile}"`)
        .toContain(visibile);
    }
  });

  /**
   * Il colore che un token risolve **nel tema corrente del documento di prova**:
   * si legge da una sonda usa-e-getta invece di scrivere un `rgb(…)` a mano, così
   * il caso non si rompe se il valore del token cambia né se un'altra spec ha
   * lasciato un `data-theme` addosso a `<html>`.
   */
  function coloreToken(nome: string): string {
    const sonda = document.createElement('span');
    sonda.style.color = `var(${nome})`;
    document.body.appendChild(sonda);
    const c = getComputedStyle(sonda).color;
    sonda.remove();
    return c;
  }

  it('⚠️ gli stili del blocco sono in vigore: 44px di bersaglio, etichetta leggibile', () => {
    // ⚠️ QUESTO CASO GUARDA IL COLORE E L'ALTEZZA CALCOLATI, non il sorgente, ed
    // è metà di una coppia: dove quelle regole devono VIVERE (nei fogli globali,
    // perché la stesura composta all'edge non ha l'attributo
    // dell'incapsulamento) lo pinna `scripts/lib/news-render.test.mjs`.
    const root = monta().nativeElement as HTMLElement;

    // Bersaglio tattile: un `.btn--sm` nudo sta sui 38px, i 44 sono dichiarati.
    const btn = root.querySelector<HTMLElement>('.news-share__btn')!;
    expect(getComputedStyle(btn).minHeight).toBe('44px');
    expect(getComputedStyle(btn).minWidth).toBe('44px');

    // ⚠️ L'etichetta NON è color rame. Sui due temi chiari `--copper-400` sta a
    // 2,3:1 e 2,6:1 contro il fondo pagina — sotto il 4,5:1 che l'AA chiede a un
    // testo da 12px — e questa è l'unica istruzione del blocco, non un timbro da
    // scorrere come la data qui sopra (che quel colore ce l'ha, ed è coerente
    // che ce l'abbia).
    const label = root.querySelector<HTMLElement>('.news-share__label')!;
    expect(getComputedStyle(label).color).toBe(coloreToken('--text'));
    expect(getComputedStyle(label).color).not.toBe(coloreToken('--copper-400'));
  });

  it('il `u=` di Facebook decodificato è il canonical, quando la rotta È lo slug', () => {
    // Se l'indirizzo condiviso e quello che la pagina dichiara canonico
    // divergessero, si diffonderebbero link permanenti verso un URL che il sito
    // stesso dichiara non buono.
    //
    // ⚠️ MA IL NOME DI QUESTO CASO DICE «QUANDO LA ROTTA È LO SLUG», E LA
    // CONDIZIONE È PORTANTE — la prima stesura si chiamava «UN SOLO INDIRIZZO» e
    // prometteva una garanzia che questa resa non dà. Qui il canonical lo scrive
    // `applySeo` con `path: /news/${this.id()}`, cioè sul **parametro di rotta**,
    // mentre `urlCondivisione` lo costruisce sullo **slug**: è la deriva
    // preesistente che il piano dichiara fuori perimetro. Le due coincidono nel
    // caso normale in produzione (la Function fa 301 su `/news/<slug>/` prima
    // che l'app si monti, quindi la rotta È lo slug) e divergono per chi arriva
    // in-SPA da una card, che collega per `_id` (`shared/ui/news-card`).
    // Il verso che conta davvero — la condivisione segue lo slug e NON il
    // parametro di rotta — è il caso qui sotto, e all'edge (dove il canonical è
    // già sullo slug) l'uguaglianza è pinnata su tre chiavi diverse in
    // `news-render.test.mjs`. Il giorno in cui la deriva del canonical si
    // sistema, questo caso vale su qualunque chiave e la condizione nel nome può
    // cadere.
    const c = canali(monta({ slug: 'articolo-vero' }));
    const u = c.facebook!.getAttribute('href')!.split('u=')[1];
    expect(decodeURIComponent(u)).toBe(canonical()!);
    expect(canonical()).toBe(`${SITO}/news/articolo-vero/`);
  });

  it('⚠️ l\'indirizzo si costruisce sullo SLUG, non sul parametro di rotta', () => {
    // È il caso di chi arriva da un ObjectId o da uno slug storico: la Function
    // risponde 301 prima che l'app si monti, ma se questa resa ereditasse il
    // parametro di rotta il lettore condividerebbe l'indirizzo vecchio.
    const c = canali(monta({ slug: 'come-si-gioca-il-bottone' }));
    const atteso = `${SITO}/news/come-si-gioca-il-bottone/`;
    expect(decodeURIComponent(c.facebook!.getAttribute('href')!.split('u=')[1])).toBe(atteso);
    expect(c.telegram!.getAttribute('href')).toContain(encodeURIComponent(atteso));
    expect(c.whatsapp!.getAttribute('href')).toContain(encodeURIComponent(atteso));
    // E non l'indirizzo con cui la pagina è stata chiesta.
    expect(c.facebook!.getAttribute('href')).not.toContain('articolo-vero');
  });

  it('⚠️ un titolo con &, virgolette e apostrofo non spezza gli href', () => {
    // `encodeURIComponent` prima, escape dell'attributo dopo (qui lo fa Angular
    // con `[href]`). Invertendoli, Telegram riceverebbe UN PARAMETRO SOLO, con
    // il titolo appiccicato dentro l'indirizzo da condividere.
    const titolo = 'Bottone & "fold": l\'errore';
    const c = canali(monta({ title: titolo, slug: 'articolo-vero' }));
    const url = `${SITO}/news/articolo-vero/`;
    const p = new URLSearchParams(c.telegram!.getAttribute('href')!.split('?')[1]);
    expect(p.get('url')).toBe(url);
    expect(p.get('text')).toBe(titolo);
    expect(decodeURIComponent(c.whatsapp!.getAttribute('href')!.split('text=')[1])).toBe(
      `${titolo} ${url}`,
    );
  });

  it('⚠️ copia l\'URL canonica, MAI location.href', () => {
    // `location.href` sotto Karma è l'indirizzo del runner, e in produzione
    // porterebbe query string, frammento e — su un'anteprima di ramo — l'host
    // `*.pages.dev`: si diffonderebbero link permanenti verso una copia.
    const writeText = jasmine.createSpy('writeText').and.resolveTo();
    const own = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      get: () => ({ writeText }),
    });
    try {
      const f = monta({ slug: 'come-si-gioca-il-bottone' });
      (f.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('button.news-share__copy')!
        .click();
      expect(writeText).toHaveBeenCalledWith(`${SITO}/news/come-si-gioca-il-bottone/`);
      expect(writeText.calls.mostRecent().args[0]).not.toContain(location.host);
    } finally {
      if (own) Object.defineProperty(navigator, 'clipboard', own);
      else delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  it('senza `navigator.clipboard` parte il ripiego sul campo fuori schermo', async () => {
    // Fuori da un contesto sicuro l'API non esiste proprio: si ripiega su un
    // campo renderizzato (non `display: none`, o non si potrebbe selezionare) e
    // su `execCommand`. Mai un bottone morto.
    const own = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => undefined });
    const exec = spyOn(document, 'execCommand').and.returnValue(true);
    try {
      const f = monta({ slug: 'articolo-vero' });
      (f.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('button.news-share__copy')!
        .click();
      await f.whenStable();

      expect(exec).toHaveBeenCalledWith('copy');
      const campo = (f.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
        'input.news-share__fallback',
      )!;
      expect(campo.value).toBe(`${SITO}/news/articolo-vero/`);
      expect(
        TestBed.inject(ToastService)
          .toasts()
          .map((t) => t.text),
      ).toContain('Link copiato.');
    } finally {
      if (own) Object.defineProperty(navigator, 'clipboard', own);
      else delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  it('se fallisce anche il ripiego lo dice, invece di restare muto', async () => {
    const own = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => undefined });
    spyOn(document, 'execCommand').and.returnValue(false);
    try {
      const f = monta();
      (f.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('button.news-share__copy')!
        .click();
      await f.whenStable();

      const toasts = TestBed.inject(ToastService).toasts();
      expect(toasts.map((t) => t.kind)).toContain('error');
      const testo = toasts.map((t) => t.text).join(' ');
      expect(testo).toContain('Copia non riuscita');
      // ⚠️ E NON MANDA NELLA BARRA DEGLI INDIRIZZI. La prima stesura del
      // messaggio suggeriva «copia l'indirizzo dalla barra del browser», cioè
      // proprio `location.href`: le card di /news e della home collegano per
      // `_id`, quindi lì c'è spesso l'indirizzo che il sito dichiara NON
      // canonico — e il fallimento della copia sarebbe l'unico momento in cui
      // glielo consigliamo. Si rimanda ai tre collegamenti, che portano l'URL
      // buona e non hanno bisogno degli appunti.
      expect(testo).not.toMatch(/barra|indirizzi|url/i);
      expect(testo).toContain('condivisione');
    } finally {
      if (own) Object.defineProperty(navigator, 'clipboard', own);
      else delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });
});
