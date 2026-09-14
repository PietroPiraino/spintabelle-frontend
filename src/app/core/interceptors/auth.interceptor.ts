import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService, SKIP_REFRESH } from '../services/auth.service';

const API = environment.API_URL;

function withAuth(req: HttpRequest<unknown>, token: string | null) {
  let out = req;
  // I cookie servono solo alle rotte /auth (refresh token scoped lì)
  if (req.url.startsWith(`${API}/auth`)) {
    out = out.clone({ withCredentials: true });
  }
  if (token) {
    out = out.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return out;
}

/**
 * Allega il Bearer token alle chiamate verso l'API; su 401 tenta un singolo
 * refresh e ripete la richiesta. Se il REFRESH fallisce → /login; se fallisce
 * la richiesta ripetuta, l'errore torna al chiamante (non è un problema di
 * sessione: è la risposta a quella chiamata).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API)) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);

  return next(withAuth(req, auth.getToken())).pipe(
    catchError((err: unknown) => {
      const is401 =
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        !req.context.get(SKIP_REFRESH);
      if (!is401) return throwError(() => err);

      // ⚠️ `catchError` PRIMA dello `switchMap`, e l'ordine è tutto: fino al
      // 14/09/2026 stava dopo, quindi catturava anche un 401 della richiesta
      // RIPETUTA — e «password attuale errata» (che il backend rispondeva 401)
      // diventava un logout forzato. Il refresh fallito è l'unico caso che
      // significa «sessione morta»; l'errore del retry va al chiamante così
      // com'è, che lo mostri.
      return auth.refresh().pipe(
        catchError((refreshErr: unknown) => {
          auth.clearSession();
          void router.navigate(['/login']);
          return throwError(() => refreshErr);
        }),
        switchMap((token) => next(withAuth(req, token))),
      );
    }),
  );
};
