import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  convertToParamMap,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { firstValueFrom, isObservable, Observable, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { guestGuard } from './auth.guard';

describe('guestGuard', () => {
  async function esegui(
    autenticato: boolean,
    redirect?: string,
  ): Promise<boolean | UrlTree> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { ready$: of(true), isAuthenticated: () => autenticato },
        },
      ],
    });
    const route = {
      queryParamMap: convertToParamMap(redirect ? { redirect } : {}),
    } as ActivatedRouteSnapshot;
    const out = TestBed.runInInjectionContext(() =>
      guestGuard(route, {} as RouterStateSnapshot),
    );
    return firstValueFrom(
      isObservable(out)
        ? (out as Observable<boolean | UrlTree>)
        : of(out as boolean | UrlTree),
    );
  }

  const url = (r: boolean | UrlTree) =>
    TestBed.inject(Router).serializeUrl(r as UrlTree);

  it('chi non ha fatto l’accesso passa', async () => {
    expect(await esegui(false, '/awards')).toBeTrue();
  });

  it('⚠️ chi ha già fatto l’accesso va alla destinazione del link, non in home', async () => {
    const r = await esegui(true, '/awards');
    expect(r instanceof UrlTree).toBeTrue();
    expect(url(r)).toBe('/awards');
  });

  it('senza destinazione, in home', async () => {
    expect(url(await esegui(true))).toBe('/');
  });

  it('una destinazione ostile finisce in home (niente open redirect)', async () => {
    for (const ostile of ['//evil.it', '/\\evil.it', 'https://evil.it']) {
      expect(url(await esegui(true, ostile))).withContext(ostile).toBe('/');
    }
  });
});
