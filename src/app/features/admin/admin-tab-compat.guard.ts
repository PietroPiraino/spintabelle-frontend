import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';

/** Id storici dei tab: erano i valori di `?tab=` prima delle rotte figlie. */
const LEGACY_TABS = [
  'lezioni',
  'live',
  'news',
  'documenti',
  'negozio',
  'iscritti',
  'richieste',
  'sconti',
  'affiliazioni',
  'partecipazione',
  'statistiche',
  'log',
];

/**
 * Shim PERMANENTE per i deep-link `?tab=` dell'era pre-dashboard: le email
 * transazionali già inviate (backend `mail.service.ts`) puntano a
 * `/admin?tab=richieste|negozio|affiliazioni` e vivono nelle caselle per mesi.
 *
 * Montata SOLO sul figlio a path vuoto: un `?tab=` valido diventa la rotta
 * figlia corrispondente (il query param si scarta — URL pulito); tutto il
 * resto passa e rende la Panoramica.
 */
export const adminTabCompatGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
) => {
  const tab = route.queryParamMap.get('tab');
  if (tab && LEGACY_TABS.includes(tab)) {
    return inject(Router).createUrlTree(['/admin', tab]);
  }
  return true;
};
