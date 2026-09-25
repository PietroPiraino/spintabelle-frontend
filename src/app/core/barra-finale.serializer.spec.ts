import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterLink, UrlSerializer, provideRouter } from '@angular/router';
import { BarraFinaleUrlSerializer } from './barra-finale.serializer';

@Component({ template: 'pagina' })
class PaginaFinta {}

@Component({ template: 'non trovata' })
class NonTrovata {}

@Component({
  imports: [RouterLink],
  template: `
    <a id="voce" routerLink="/glossario/limp">limp</a>
    <a id="indice" [routerLink]="['/glossario']">glossario</a>
    <a id="tabelle" routerLink="/tabelle" [queryParams]="{ formato: 'spin' }">tabelle</a>
    <a id="news" [routerLink]="['/news', 'un-articolo']">articolo</a>
    <a id="login" routerLink="/login">accedi</a>
    <a id="admin" routerLink="/admin/news">admin</a>
    <a id="stanza" [routerLink]="['/live', 'x1', 'stanza']">stanza</a>
    <a id="home" routerLink="/">home</a>
  `,
})
class Collegamenti {}

describe('BarraFinaleUrlSerializer', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'glossario', component: PaginaFinta },
          { path: 'glossario/:slug', component: PaginaFinta },
          { path: 'tabelle', component: PaginaFinta },
          { path: 'news/:id', component: PaginaFinta },
          { path: 'login', component: PaginaFinta },
          { path: 'admin/news', component: PaginaFinta },
          { path: 'live/:id/stanza', component: PaginaFinta },
          { path: '**', component: NonTrovata },
        ]),
        { provide: UrlSerializer, useClass: BarraFinaleUrlSerializer },
      ],
    });
  });

  const href = (id: string) => {
    const f = TestBed.createComponent(Collegamenti);
    f.detectChanges();
    return (f.nativeElement as HTMLElement).querySelector(`#${id}`)!.getAttribute('href');
  };

  it("scrive la barra finale nell'href delle pagine pubbliche", () => {
    expect(href('voce')).toBe('/glossario/limp/');
    expect(href('indice')).toBe('/glossario/');
    expect(href('news')).toBe('/news/un-articolo/');
  });

  it('la mette PRIMA della query string', () => {
    expect(href('tabelle')).toBe('/tabelle/?formato=spin');
  });

  // ⚠️ Il verso grave: `/login/` non corrisponde alla regola `/login` di
  // public/_redirects, e chi ricarica la pagina riceverebbe la 404.
  it('NON la scrive sulle rotte client', () => {
    expect(href('login')).toBe('/login');
    expect(href('admin')).toBe('/admin/news');
    expect(href('stanza')).toBe('/live/x1/stanza');
  });

  it('la radice resta /', () => {
    expect(href('home')).toBe('/');
  });

  // Senza il `parse` che toglie la barra, `/glossario/limp/` sarebbe tre
  // segmenti (l'ultimo vuoto) e cadrebbe sul wildcard: `router.url` ora porta
  // la barra, e chi lo ripassa a navigateByUrl finirebbe sulla 404.
  it('una navigazione con la barra raggiunge la pagina, non la 404', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/glossario/limp/');
    const foglia = router.routerState.snapshot.root.firstChild!;
    expect(foglia.component).toBe(PaginaFinta);
    expect(foglia.params['slug']).toBe('limp');
    expect(router.url).toBe('/glossario/limp/');
  });

  it('router.url resta senza barra sulle rotte client', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/login?redirect=/abbonati');
    expect(router.url).toBe('/login?redirect=%2Fabbonati');
  });
});
