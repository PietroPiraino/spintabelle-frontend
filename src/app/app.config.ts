import {
  ViewportScroller,
  isPlatformBrowser,
  registerLocaleData,
} from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeIt from '@angular/common/locales/it';
import {
  ApplicationConfig,
  LOCALE_ID,
  PLATFORM_ID,
  inject,
  provideEnvironmentInitializer,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import {
  NavigationEnd,
  NavigationStart,
  Router,
  Scroll,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';
import { SeoService } from './core/services/seo.service';

registerLocaleData(localeIt);

const DEFAULT_DESCRIPTION =
  'Best Fish Forever è la scuola italiana di poker dedicata a Spin & Go e Twister: lezioni video, tabelle GTO e una community di studio su Discord.';

// NB: il ripristino sessione NON blocca il bootstrap (il backend su Render
// può impiegare decine di secondi a svegliarsi dallo sleep): parte in
// background dal costruttore di AuthService, e i guard aspettano `ready`
// solo quando una rotta protetta lo richiede.
export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    // Idratazione dell'HTML prerenderizzato (SSG): il client riusa il DOM
    // statico invece di ricrearlo. withEventReplay riproduce i click avvenuti
    // prima che l'app fosse interattiva. Supportato con zoneless in Angular 22.
    provideClientHydration(withEventReplay()),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // niente scrollPositionRestoration automatico: gestito a mano sotto,
      // perché il 'top' del router scatta anche quando cambiano SOLO i query
      // param (es. navigare l'albero delle tabelle) e riporterebbe in cima
      withInMemoryScrolling({ anchorScrolling: 'enabled' }),
      withViewTransitions(),
    ),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: LOCALE_ID, useValue: 'it' },
    // Avvia il ripristino sessione in background (senza await: non blocca
    // il primo render; i guard aspettano ready$ solo sulle rotte protette).
    // SOLO browser: in prerender non c'è cookie di refresh e la chiamata HTTP
    // resterebbe un pending task che rallenta la stabilizzazione del build.
    provideEnvironmentInitializer(() => {
      if (isPlatformBrowser(inject(PLATFORM_ID))) {
        inject(AuthService).bootstrap().subscribe();
      }
    }),
    // SEO per-pagina: a ogni navigazione aggiorna canonical + description +
    // OG/Twitter dai `data` della rotta (il <title> lo fa già il router). Senza
    // questo ogni pagina eredita il canonical statico "/" della home (auto-
    // canonicalizzazione → Google tratta /tabelle, /abbonati… come duplicati).
    // news/:id ridefinisce poi i meta coi dati reali dell'articolo (vince perché
    // arriva dopo, alla risposta HTTP).
    provideEnvironmentInitializer(() => {
      const router = inject(Router);
      const seo = inject(SeoService);
      router.events.subscribe((e) => {
        if (!(e instanceof NavigationEnd)) return;
        let snapshot = router.routerState.snapshot.root;
        while (snapshot.firstChild) snapshot = snapshot.firstChild;
        const path = router.url.split('?')[0].split('#')[0];
        seo.setRouteMeta(
          (snapshot.title as string | undefined) ?? 'Best Fish Forever',
          (snapshot.data['description'] as string | undefined) ??
            DEFAULT_DESCRIPTION,
          path,
          snapshot.data['ogImage'] as string | undefined,
        );
      });
    }),
    // Scroll del router: in cima SOLO quando cambia la pagina (il path),
    // mai quando cambiano solo i query param; back/forward del browser
    // ripristina la posizione salvata. È l'algoritmo del RouterScroller di
    // Angular (store per navigationId) senza il suo scroll-to-top automatico,
    // che scatterebbe anche navigando l'albero delle tabelle.
    provideEnvironmentInitializer(() => {
      // Solo browser: lo scroll non ha senso in prerender e il callback legge
      // window.scrollY (global assente su Node → crash del prerender).
      if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
      const viewport = inject(ViewportScroller);
      viewport.setHistoryScrollRestoration('manual');
      const store: Record<number, [number, number]> = {};
      let lastId = 0;
      let restoredId = 0;
      let popstate = false;
      let lastPath = '';
      let yAtEnd = 0;
      inject(Router).events.subscribe((e) => {
        if (e instanceof NavigationStart) {
          // posizione della pagina che si sta lasciando
          store[lastId] = viewport.getScrollPosition();
          popstate = e.navigationTrigger === 'popstate';
          restoredId = e.restoredState?.navigationId ?? 0;
        } else if (e instanceof NavigationEnd) {
          lastId = e.id;
          yAtEnd = window.scrollY;
        } else if (e instanceof Scroll) {
          const url =
            'urlAfterRedirects' in e.routerEvent
              ? e.routerEvent.urlAfterRedirects
              : e.routerEvent.url;
          const path = url.split('?')[0];
          const position = popstate ? store[restoredId] : null;
          if (position) {
            // il contenuto (es. la matrice) può arrivare DOPO il NavigationEnd
            // quando la pagina è ancora corta: si riprova per ~1s
            const [x, y] = position;
            let tries = 60;
            const attempt = () => {
              viewport.scrollToPosition([x, y]);
              if (window.scrollY < y - 2 && --tries > 0) {
                requestAnimationFrame(attempt);
              }
            };
            attempt();
          } else if (
            !e.anchor &&
            path !== lastPath &&
            // l'evento arriva DOPO la view transition: se nel frattempo
            // l'utente ha già scrollato, non strappargli la pagina di mano
            Math.abs(window.scrollY - yAtEnd) < 4
          ) {
            viewport.scrollToPosition([0, 0]); // pagina nuova
          }
          // (le ancore le gestisce già anchorScrolling)
          lastPath = path;
        }
      });
    }),
  ],
};
