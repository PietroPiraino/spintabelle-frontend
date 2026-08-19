import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';

import { SeoService } from './seo.service';

/**
 * Blocca la normalizzazione allo SLASH FINALE di canonical + og:url.
 * L'SSG serve la pagina reale (200) su `/abbonati/` e fa 308 dalla forma senza
 * slash: canonical/og:url/sitemap devono puntare alla forma con slash servita a
 * 200 (vedi SeoService.absUrl e gen-sitemap.mjs). Una regressione qui rifà
 * comparire in Search Console i bucket "reindirizzamento"/"canonical alternato".
 */
describe('SeoService — canonical con slash finale', () => {
  let seo: SeoService;
  let doc: Document;

  beforeEach(() => {
    seo = TestBed.inject(SeoService);
    doc = TestBed.inject(DOCUMENT);
  });

  const canonical = () =>
    doc.querySelector('link[rel="canonical"]')?.getAttribute('href');
  const ogUrl = () =>
    doc.querySelector('meta[property="og:url"]')?.getAttribute('content');

  it('aggiunge lo slash finale a una rotta di primo livello', () => {
    seo.setRouteMeta('T — Best Fish Forever', 'D', '/abbonati');
    expect(canonical()).toBe('https://bestfishforever.it/abbonati/');
    expect(ogUrl()).toBe('https://bestfishforever.it/abbonati/');
  });

  it('lascia la root come `/` (niente doppio slash)', () => {
    seo.setRouteMeta('T — Best Fish Forever', 'D', '/');
    expect(canonical()).toBe('https://bestfishforever.it/');
  });

  it('normalizza le rotte annidate (news/:id)', () => {
    seo.setSeo({ title: 'Articolo', description: 'D', path: '/news/abc123' });
    expect(canonical()).toBe('https://bestfishforever.it/news/abc123/');
  });

  it('è idempotente su un path che ha già lo slash', () => {
    seo.setRouteMeta('T — Best Fish Forever', 'D', '/tabelle/');
    expect(canonical()).toBe('https://bestfishforever.it/tabelle/');
  });

  it('scarta query/hash dal canonical (consolida le varianti del viewer)', () => {
    seo.setRouteMeta('T — Best Fish Forever', 'D', '/tabelle?formato=spin#x');
    expect(canonical()).toBe('https://bestfishforever.it/tabelle/');
  });

  it('senza path usa la root', () => {
    seo.setSeo({ title: 'Home', description: 'D' });
    expect(canonical()).toBe('https://bestfishforever.it/');
  });
});

/**
 * Blocca il `noindex` per-rotta, e soprattutto la sua RIMOZIONE.
 * In una SPA i meta sopravvivono alla navigazione: senza il ramo che toglie il
 * tag, bastava passare una volta da /affiliazioni (noindex per l'art. 9 del DL
 * 87/2018) perché ogni pagina visitata dopo, nella stessa sessione, restasse
 * `noindex`. Googlebot naviga anche così, e il danno sarebbe stato invisibile a
 * qualunque controllo sul singolo HTML prerenderizzato.
 */
describe('SeoService — noindex per rotta', () => {
  let seo: SeoService;
  let doc: Document;

  beforeEach(() => {
    seo = TestBed.inject(SeoService);
    doc = TestBed.inject(DOCUMENT);
  });

  const robots = () =>
    doc.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null;

  it('non emette alcun meta robots su una rotta indicizzabile', () => {
    seo.setRouteMeta('T — Best Fish Forever', 'D', '/tabelle');
    expect(robots()).toBeNull();
  });

  it('marca noindex,follow quando la rotta lo chiede', () => {
    seo.setRouteMeta('T — Best Fish Forever', 'D', '/affiliazioni', undefined, true);
    expect(robots()).toBe('noindex, follow');
  });

  it('RIMUOVE il noindex navigando verso una rotta indicizzabile', () => {
    seo.setRouteMeta('T — Best Fish Forever', 'D', '/affiliazioni', undefined, true);
    expect(robots()).toBe('noindex, follow');

    seo.setRouteMeta('T — Best Fish Forever', 'D', '/tabelle');
    expect(robots())
      .withContext('un noindex che sopravvive alla navigazione deindicizza il sito')
      .toBeNull();
  });
});

/**
 * Blocca l'escape del `<` dentro il blocco JSON-LD.
 * Il titolo di un articolo arriva da una fonte esterna e finisce nei dati
 * strutturati (news-detail.component): con `JSON.stringify` nudo un `</script>`
 * nel titolo CHIUDE il blocco nell'HTML serializzato da prerender/SSR — il
 * parser HTML non interpreta le entità dentro uno <script> — e tutto ciò che
 * segue diventa markup eseguito: XSS memorizzato, invisibile a qualunque
 * controllo che guardi solo il JSON.
 */
describe('SeoService — JSON-LD, escape del <', () => {
  let seo: SeoService;
  let doc: Document;

  beforeEach(() => {
    seo = TestBed.inject(SeoService);
    doc = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    doc.getElementById('ld-test')?.remove();
  });

  // Titolo ostile: chiude lo <script> e inietta markup subito dopo.
  const TITOLO_OSTILE =
    'Spin & Go </script><img src=x onerror="alert(1)"> resto del titolo';

  it("non lascia uscire un </script> dal blocco: nell'HTML serializzato c'è un solo tag di chiusura", () => {
    seo.setJsonLd('ld-test', {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: TITOLO_OSTILE,
    });

    const html = doc.getElementById('ld-test')!.outerHTML;
    expect((html.match(/<\/script/gi) ?? []).length)
      .withContext('un </script> nel titolo esce dal JSON-LD = XSS memorizzato')
      .toBe(1);
    // il markup iniettato non apre alcun tag: resta testo dentro il JSON
    expect(html).not.toContain('<img');
  });

  it('non lascia alcun `<` grezzo nel contenuto dello script', () => {
    seo.setJsonLd('ld-test', { headline: TITOLO_OSTILE });
    expect(doc.getElementById('ld-test')!.textContent).not.toContain('<');
  });

  it('non altera il dato: il JSON resta valido e il titolo torna identico', () => {
    seo.setJsonLd('ld-test', { headline: TITOLO_OSTILE });
    const parsed = JSON.parse(doc.getElementById('ld-test')!.textContent!) as {
      headline: string;
    };
    expect(parsed.headline).toBe(TITOLO_OSTILE);
  });

  it("aggiorna lo stesso nodo senza duplicarlo (l'escape vale anche in update)", () => {
    seo.setJsonLd('ld-test', { headline: 'innocuo' });
    seo.setJsonLd('ld-test', { headline: TITOLO_OSTILE });
    expect(doc.querySelectorAll('#ld-test').length).toBe(1);
    const html = doc.getElementById('ld-test')!.outerHTML;
    expect((html.match(/<\/script/gi) ?? []).length).toBe(1);
    expect(html).not.toContain('<img');
  });
});
