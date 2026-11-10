import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/api.models';
import { safeRedirect } from '../utils/safe-redirect';

/**
 * Aspetta che il ripristino sessione in background sia concluso, poi valuta.
 * Così il primo render non è bloccato ma i guard decidono a stato certo.
 */
function whenReady(
  auth: AuthService,
  decide: () => boolean | UrlTree,
): Observable<boolean | UrlTree> {
  return auth.ready$.pipe(take(1), map(decide));
}

/** Richiede una sessione attiva; altrimenti rimanda al login con redirect. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return whenReady(auth, () =>
    auth.isAuthenticated()
      ? true
      : router.createUrlTree(['/login'], {
          queryParams: { redirect: state.url },
        }),
  );
};

/** Richiede uno dei ruoli indicati (oltre alla sessione attiva). */
export function roleGuard(roles: Role[]): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return whenReady(auth, () => {
      if (!auth.isAuthenticated()) {
        return router.createUrlTree(['/login'], {
          queryParams: { redirect: state.url },
        });
      }
      const role = auth.user()?.role;
      return role && roles.includes(role) ? true : router.createUrlTree(['/']);
    });
  };
}

/**
 * Per login/registrazione: chi è già dentro va dove il link voleva portarlo
 * (`?redirect=`), altrimenti in home.
 *
 * ⚠️ Ignorare `redirect` mandava in home chi apriva da loggato un link come
 * `/login?redirect=/awards` — quello del pulsante dell'email dei premi: il
 * socio finiva sulla pagina che dei premi non parla. Passa da `safeRedirect`
 * come nel login: è lo stesso valore, e lo stesso open redirect.
 */
export const guestGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return whenReady(auth, () =>
    auth.isAuthenticated()
      ? router.parseUrl(safeRedirect(route.queryParamMap.get('redirect')))
      : true,
  );
};
