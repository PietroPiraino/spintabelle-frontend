import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  PAROLE_NON_PUBBLICABILI,
  PROMESSE_VIETATE,
  SALE_AFFILIATE,
  terminiPresenti,
} from '../../../core/art9.constants';
import { SituazioneComponent } from './situazione.component';
import { espandiNodo } from './situazioni';
import { CARICATORI } from './situazioni.caricatori';
import { SITUAZIONI } from './situazioni.catalogo';
import type { SituazioneRisolta } from './situazioni.resolver';

const ID_LD = ['ld-situazione', 'ld-situazione-faq', 'ld-situazione-briciole'];

async function risolvi(slug: string): Promise<SituazioneRisolta> {
  const { NODO } = await CARICATORI[slug]();
  return { nodo: espandiNodo(NODO), esportato: NODO.esportato };
}

function parole(testo: string): number {
  return testo.split(/\s+/).filter((p) => p.length > 0).length;
}

describe('SituazioneComponent', () => {
  function monta(slug: string, dati: SituazioneRisolta | null): ComponentFixture<SituazioneComponent> {
    const f = TestBed.createComponent(SituazioneComponent);
    f.componentRef.setInput('slug', slug);
    f.componentRef.setInput('dati', dati);
    f.detectChanges();
    return f;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    });
  });

  afterEach(() => {
    for (const id of ID_LD) document.getElementById(id)?.remove();
  });

  it('rende un solo h1, la griglia STATICA con 169 celle e nessun bottone, la legenda e il testo', async () => {
    const s = SITUAZIONI[0];
    const f = monta(s.slug, await risolvi(s.slug));
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('h1')?.textContent?.trim()).toBe(s.h1);
    expect(el.querySelectorAll('.rg__cell--statica').length).toBe(169);
    expect(el.querySelectorAll('button.rg__cell').length).toBe(0);
    expect(el.querySelector('figure figcaption')).toBeTruthy();
    expect(el.querySelectorAll('.sit__legenda li').length).toBeGreaterThanOrEqual(2);
    expect(el.querySelectorAll('.faq__item').length).toBeGreaterThanOrEqual(3);
    for (const d of el.querySelectorAll('.faq__item')) {
      expect(d.querySelector('.faq__q')).toBeTruthy();
      expect(d.querySelector('.faq__a')).toBeTruthy();
    }
  });

  it('scrive meta e i tre JSON-LD (WebPage con dateModified, FAQPage, BreadcrumbList) e li toglie alla distruzione', async () => {
    const s = SITUAZIONI[1];
    const dati = await risolvi(s.slug);
    const f = monta(s.slug, dati);
    expect(document.title).toBe(`${s.titolo} — Best Fish Forever`);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `https://bestfishforever.it/tabelle/${s.slug}/`,
    );
    const pagina = JSON.parse(document.getElementById('ld-situazione')!.textContent ?? '{}');
    expect(pagina['@type']).toBe('WebPage');
    expect(pagina['dateModified']).toBe(dati.esportato);
    const faq = JSON.parse(document.getElementById('ld-situazione-faq')!.textContent ?? '{}');
    expect(faq['mainEntity'].length).toBe(f.nativeElement.querySelectorAll('.faq__item').length);
    const briciole = JSON.parse(document.getElementById('ld-situazione-briciole')!.textContent ?? '{}');
    expect(briciole['itemListElement'][1]['name']).toBe(s.h1);
    f.destroy();
    for (const id of ID_LD) expect(document.getElementById(id)).toBeNull();
  });

  it('con slug ignoto o dati nulli rende il ramo vuoto senza h1 e senza JSON-LD', async () => {
    let f = monta('situazione-inventata', null);
    expect((f.nativeElement as HTMLElement).querySelector('h1')).toBeNull();
    f = monta(SITUAZIONI[0].slug, null);
    expect((f.nativeElement as HTMLElement).querySelector('h1')).toBeNull();
    for (const id of ID_LD) expect(document.getElementById(id)).toBeNull();
  });

  // ⚠️ La prosa, NON le 169 etichette: `check-prerender-content.mjs` conta
  // anche i label della griglia come parole, quindi da solo non distingue una
  // pagina con testo da una griglia nuda. Qui si misura il solo `.sit__testo`
  // su TUTTE le situazioni, e si lintano i testi generati (art. 9).
  it('ogni situazione ha almeno 300 parole di prosa generata, senza sale, promesse o parole vietate', async () => {
    const liste: readonly (readonly string[])[] = [SALE_AFFILIATE, PAROLE_NON_PUBBLICABILI, PROMESSE_VIETATE];
    for (const s of SITUAZIONI) {
      const f = monta(s.slug, await risolvi(s.slug));
      const el: HTMLElement = f.nativeElement;
      const prosa = el.querySelector('.sit__testo')?.textContent ?? '';
      expect(parole(prosa)).withContext(s.slug).toBeGreaterThanOrEqual(300);
      const tutto = [prosa, ...[...el.querySelectorAll('.faq__q, .faq__a')].map((x) => x.textContent ?? '')];
      for (const t of tutto) {
        for (const lista of liste) {
          expect(terminiPresenti(t, lista)).withContext(`${s.slug}: «${t.slice(0, 80)}»`).toEqual([]);
        }
      }
      f.destroy();
      for (const id of ID_LD) document.getElementById(id)?.remove();
    }
  });

  it('il link al visualizzatore porta i query param del nodo (formato, stack, azioni)', async () => {
    const s = SITUAZIONI.find((x) => x.preflop_actions === 'F-RAI')!;
    const f = monta(s.slug, await risolvi(s.slug));
    const a = [...(f.nativeElement as HTMLElement).querySelectorAll('a')].find((x) =>
      /visualizzatore/.test(x.textContent ?? ''),
    )!;
    const href = a.getAttribute('href') ?? '';
    expect(href).toContain('/tabelle?');
    expect(href).toContain('formato=spin');
    expect(href).toContain(`stack=${s.depth_label}`);
    expect(href).toContain('azioni=F-RAI');
  });
});
