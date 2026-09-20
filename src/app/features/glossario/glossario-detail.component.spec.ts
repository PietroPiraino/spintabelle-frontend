import { registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';
import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  PAROLE_NON_PUBBLICABILI,
  PROMESSE_VIETATE,
  SALE_AFFILIATE,
  terminiPresenti,
} from '../../core/art9.constants';
import { GlossarioDetailComponent } from './glossario-detail.component';
import { VOCI, testiDiVoce } from './glossario.data';

registerLocaleData(localeIt);

const ID_LD = ['ld-voce', 'ld-voce-pagina', 'ld-voce-briciole'];

describe('GlossarioDetailComponent', () => {
  function monta(slug: string): ComponentFixture<GlossarioDetailComponent> {
    const f = TestBed.createComponent(GlossarioDetailComponent);
    f.componentRef.setInput('slug', slug);
    f.detectChanges();
    return f;
  }

  function jsonLd(id: string): Record<string, any> {
    const el = document.getElementById(id);
    expect(el).withContext(`manca il blocco JSON-LD ${id}`).toBeTruthy();
    return JSON.parse(el!.textContent ?? '{}');
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'it' },
      ],
    });
  });

  afterEach(() => {
    for (const id of ID_LD) document.getElementById(id)?.remove();
  });

  it('rende la voce con un solo h1 (il termine), la definizione come lead e i paragrafi', () => {
    const v = VOCI[0];
    const f = monta(v.slug);
    const el: HTMLElement = f.nativeElement;
    const h1 = el.querySelectorAll('h1');
    expect(h1.length).toBe(1);
    expect(h1[0].textContent?.trim()).toBe(v.termine);
    expect(el.querySelector('.lead')?.textContent?.trim()).toBe(v.definizione);
    const paragrafi = [...el.querySelectorAll('article > p')].map((p) =>
      p.textContent?.trim(),
    );
    for (const p of v.spiegazione) expect(paragrafi).toContain(p);
  });

  it('scrive meta e i tre blocchi JSON-LD (DefinedTerm, WebPage, BreadcrumbList) e li toglie alla distruzione', () => {
    const v = VOCI[0];
    const f = monta(v.slug);
    const url = `https://bestfishforever.it/glossario/${v.slug}/`;
    expect(document.title).toBe(`${v.titolo} — Best Fish Forever`);
    expect(
      document
        .querySelector('link[rel="canonical"]')
        ?.getAttribute('href'),
    ).toBe(url);

    const termine = jsonLd('ld-voce');
    expect(termine['@type']).toBe('DefinedTerm');
    expect(termine['name']).toBe(v.termine);
    expect(termine['description']).toBe(v.definizione);
    expect(termine['inDefinedTermSet']['@id']).toBe(
      'https://bestfishforever.it/glossario/#set',
    );
    const pagina = jsonLd('ld-voce-pagina');
    expect(pagina['@type']).toBe('WebPage');
    expect(pagina['mainEntity']['@id']).toBe(`${url}#termine`);
    expect(pagina['dateModified']).toBe(v.aggiornata);
    const briciole = jsonLd('ld-voce-briciole');
    expect(briciole['itemListElement'].length).toBe(2);
    expect(briciole['itemListElement'][1]['name']).toBe(v.termine);

    f.destroy();
    for (const id of ID_LD) expect(document.getElementById(id)).toBeNull();
  });

  it('su uno slug ignoto rende il ramo vuoto, senza h1 di voce e senza JSON-LD', () => {
    const f = monta('voce-che-non-esiste');
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('.empty-state')).toBeTruthy();
    expect(el.querySelector('h1')).toBeNull();
    for (const id of ID_LD) expect(document.getElementById(id)).toBeNull();
  });

  it('i correlati sono link a /glossario/<slug> e i termini collegati esistono', () => {
    const v = VOCI.find((x) => x.correlati.some((c) => VOCI.some((y) => y.slug === c)))!;
    const f = monta(v.slug);
    const el: HTMLElement = f.nativeElement;
    const link = [...el.querySelectorAll('.voce__correlati a')].map((a) =>
      a.getAttribute('href'),
    );
    expect(link.length).toBeGreaterThan(0);
    for (const h of link) expect(h).toMatch(/^\/glossario\/[a-z0-9-]+$/);
  });

  // ⚠️ Il vincolo legale, sui DATI e non sul template: ogni testo pubblico di
  // ogni voce, contro le tre liste. Una sala, un bonus o una promessa in una
  // voce e' un contenuto indicizzabile fuori perimetro (art. 9 DL 87/2018).
  it('nessuna voce nomina una sala affiliata, una parola non pubblicabile o una promessa al lettore', () => {
    const liste: [string, readonly string[]][] = [
      ['sala', SALE_AFFILIATE],
      ['parola', PAROLE_NON_PUBBLICABILI],
      ['promessa', PROMESSE_VIETATE],
    ];
    for (const v of VOCI) {
      for (const testo of testiDiVoce(v)) {
        for (const [nome, lista] of liste) {
          expect(terminiPresenti(testo, lista))
            .withContext(`${v.slug} (${nome}): «${testo.slice(0, 60)}…»`)
            .toEqual([]);
        }
      }
    }
  });

  it('nessun link esterno nelle voci e titoli entro i 60 caratteri', () => {
    for (const v of VOCI) {
      expect(v.titolo.length).withContext(v.slug).toBeLessThanOrEqual(60);
      for (const l of [v.guida, v.strumento]) {
        if (l) expect(l.href).withContext(v.slug).toMatch(/^\//);
      }
    }
    const f = monta(VOCI[0].slug);
    const esterni = [...(f.nativeElement as HTMLElement).querySelectorAll('a')].filter(
      (a) => /^https?:\/\//.test(a.getAttribute('href') ?? ''),
    );
    expect(esterni.length).toBe(0);
  });
});
