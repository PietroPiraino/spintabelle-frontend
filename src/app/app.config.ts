import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeIt from '@angular/common/locales/it';
import {
  ApplicationConfig,
  LOCALE_ID,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

registerLocaleData(localeIt);

// NB: il ripristino sessione NON blocca il bootstrap (il backend su Render
// può impiegare decine di secondi a svegliarsi dallo sleep): parte in
// background dal costruttore di AuthService, e i guard aspettano `ready`
// solo quando una rotta protetta lo richiede.
export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled',
      }),
      withViewTransitions(),
    ),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: LOCALE_ID, useValue: 'it' },
  ],
};
