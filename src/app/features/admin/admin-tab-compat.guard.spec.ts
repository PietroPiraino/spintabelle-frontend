import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { routes } from '../../app.routes';
import { adminTabCompatGuard } from './admin-tab-compat.guard';

/**
 * Lo shim `?tab=` è il contratto con le email transazionali già inviate
 * (mail.service.ts del backend linka /admin?tab=richieste|negozio|affiliazioni):
 * quelle caselle non si aggiornano con un deploy.
 */
describe('adminTabCompatGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    });
  });

  const run = (queryParams: Record<string, string>) =>
    TestBed.runInInjectionContext(() =>
      adminTabCompatGuard(
        {
          queryParamMap: convertToParamMap(queryParams),
        } as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

  it('traduce un ?tab= storico nella rotta figlia, scartando il query param', () => {
    const result = run({ tab: 'richieste' });
    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
      '/admin/richieste',
    );
  });

  it('copre tutti e tre i tab linkati dalle email', () => {
    for (const tab of ['richieste', 'negozio', 'affiliazioni']) {
      const result = run({ tab });
      expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
        `/admin/${tab}`,
      );
    }
  });

  it('lascia passare un tab sconosciuto (Panoramica), senza redirect a vuoto', () => {
    expect(run({ tab: 'inventato' })).toBeTrue();
  });

  it('lascia passare /admin senza query param', () => {
    expect(run({})).toBeTrue();
  });

  // La guard che funziona ma non è montata è il fallimento silenzioso perfetto:
  // questi due test pinnano il cablaggio in app.routes.ts, non la funzione.
  it('è cablata sul figlio a path vuoto di /admin (dove atterrano le email)', () => {
    const admin = routes.find((r) => r.path === 'admin');
    const home = admin?.children?.find((c) => c.path === '');
    expect(home?.canActivate).toContain(adminTabCompatGuard);
  });

  it('ogni id storico di ?tab= esiste ancora come segmento figlio', () => {
    // il contratto dello shim: i vecchi valori di ?tab= SONO i path figli —
    // rinominare un segmento romperebbe i deep-link delle email già inviate
    const admin = routes.find((r) => r.path === 'admin');
    const segments = (admin?.children ?? []).map((c) => c.path);
    for (const tab of [
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
    ]) {
      expect(segments).toContain(tab);
    }
    // e le due nuove sezioni placeholder sono instradate
    expect(segments).toContain('stakings');
    expect(segments).toContain('conteggi-mensili');
  });
});
