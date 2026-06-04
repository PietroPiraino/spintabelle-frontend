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
 * refresh e ripete la richiesta. Se anche il refresh fallisce → /login.
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

      return auth.refresh().pipe(
        switchMap((token) => next(withAuth(req, token))),
        catchError((refreshErr: unknown) => {
          auth.clearSession();
          void router.navigate(['/login']);
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
