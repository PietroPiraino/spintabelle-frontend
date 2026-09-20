import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  GlossarioListComponent,
  raggruppaPerLettera,
} from './glossario-list.component';
import { VOCI } from './glossario.data';

describe('GlossarioListComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    });
  });

  afterEach(() => {
    document.getElementById('ld-glossario-set')?.remove();
  });

  it('rende TUTTE le voci con termine, definizione in chiaro e link a /glossario/<slug>, sotto un solo h1', () => {
    const f = TestBed.createComponent(GlossarioListComponent);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelectorAll('h1').length).toBe(1);
    const voci = el.querySelectorAll('.glossario__voci li');
    expect(voci.length).toBe(VOCI.length);
    const href = [...el.querySelectorAll('.glossario__voci a')].map((a) =>
      a.getAttribute('href'),
    );
    for (const v of VOCI) {
      expect(href).toContain(`/glossario/${v.slug}`);
      expect(el.textContent).toContain(v.definizione);
    }
  });

  it('le lettere sono ancore verso i gruppi, e ogni gruppo ha un h2 con quell\'id', () => {
    const f = TestBed.createComponent(GlossarioListComponent);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    const lettere = [...el.querySelectorAll('.glossario__lettere a')];
    expect(lettere.length).toBeGreaterThan(0);
    for (const a of lettere) {
      const frammento = a.getAttribute('href')?.split('#')[1];
      expect(frammento).withContext(a.textContent ?? '').toBeTruthy();
      expect(el.querySelector(`h2#${frammento}`)).withContext(frammento!).toBeTruthy();
    }
  });

  it('scrive il DefinedTermSet con una DefinedTerm per voce', () => {
    const f = TestBed.createComponent(GlossarioListComponent);
    f.detectChanges();
    const el = document.getElementById('ld-glossario-set');
    expect(el).toBeTruthy();
    const ld = JSON.parse(el!.textContent ?? '{}');
    expect(ld['@type']).toBe('DefinedTermSet');
    expect(ld['hasDefinedTerm'].length).toBe(VOCI.length);
    expect(ld['hasDefinedTerm'][0]['@type']).toBe('DefinedTerm');
  });

  it('raggruppaPerLettera: ordine italiano, iniziale senza accento, cifre sotto «#»', () => {
    const gruppi = raggruppaPerLettera([
      { termine: 'Èquity' } as never,
      { termine: 'ante' } as never,
      { termine: '3-bet' } as never,
      { termine: 'Equity' } as never,
    ]);
    expect(gruppi.map((g) => g.lettera)).toEqual(['A', 'E', '#']);
    expect(gruppi[1].voci.length).toBe(2);
    expect(gruppi[2].id).toBe('lettera-altro');
  });
});
