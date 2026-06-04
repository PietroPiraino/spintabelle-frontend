import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/api.models';

/** Richiede una sessione attiva; altrimenti rimanda al login con redirect. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login'], {
    queryParams: { redirect: state.url },
  });
};

/** Richiede uno dei ruoli indicati (oltre alla sessione attiva). */
export function roleGuard(roles: Role[]): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login'], {
        queryParams: { redirect: state.url },
      });
    }
    const role = auth.user()?.role;
    return role && roles.includes(role) ? true : router.createUrlTree(['/']);
  };
}

/** Per login/registrazione: chi è già dentro torna alla home. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.createUrlTree(['/']) : true;
};
