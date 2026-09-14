import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

const API = environment.API_URL;

/**
 * ⚠️ Fino al 14/09/2026 questo interceptor NON aveva una spec, e il difetto
 * che nascondeva era di ordine: il `catchError` del refresh stava DOPO lo
 * `switchMap` della richiesta ripetuta, quindi catturava anche il 401 del
 * retry — e «password attuale errata» (401 dal backend) diventava un logout
 * forzato. Le due prove qui sotto pinnano ENTRAMBI i versi.
 */
describe('authInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let auth: {
    getToken: jasmine.Spy;
    refresh: jasmine.Spy;
    clearSession: jasmine.Spy;
  };
  let router: { navigate: jasmine.Spy };

  beforeEach(() => {
    auth = {
      getToken: jasmine.createSpy('getToken').and.returnValue('vecchio'),
      refresh: jasmine.createSpy('refresh'),
      clearSession: jasmine.createSpy('clearSession'),
    };
    router = { navigate: jasmine.createSpy('navigate') };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('401 → refresh ok → il retry risponde di nuovo 401: l’errore va al chiamante, NESSUN logout', async () => {
    auth.refresh.and.returnValue(of('nuovo'));
    const esito = new Promise<HttpErrorResponse>((resolve) => {
      http.patch(`${API}/account/password`, {}).subscribe({
        next: () => fail('non doveva riuscire'),
        error: (e: HttpErrorResponse) => resolve(e),
      });
    });
    ctrl
      .expectOne(`${API}/account/password`)
      .flush({ message: 'Password attuale errata' }, { status: 401, statusText: 'Unauthorized' });
    // La richiesta ripetuta porta il token NUOVO…
    const retry = ctrl.expectOne(`${API}/account/password`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer nuovo');
    // …e risponde ancora 401: è la risposta a QUELLA chiamata, non la sessione.
    retry.flush({ message: 'Password attuale errata' }, { status: 401, statusText: 'Unauthorized' });
    const err = await esito;
    expect(err.status).toBe(401);
    expect(auth.clearSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('401 → refresh KO: sessione azzerata e /login', async () => {
    auth.refresh.and.returnValue(throwError(() => new Error('refresh morto')));
    const esito = new Promise<unknown>((resolve) => {
      http.get(`${API}/points/me`).subscribe({
        next: () => fail('non doveva riuscire'),
        error: (e: unknown) => resolve(e),
      });
    });
    ctrl
      .expectOne(`${API}/points/me`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await esito;
    expect(auth.clearSession).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    // Nessun retry: il refresh non ha dato un token.
    ctrl.expectNone(`${API}/points/me`);
  });

  it('un 403 non tenta alcun refresh', async () => {
    const esito = new Promise<HttpErrorResponse>((resolve) => {
      http.patch(`${API}/account/password`, {}).subscribe({
        error: (e: HttpErrorResponse) => resolve(e),
      });
    });
    ctrl
      .expectOne(`${API}/account/password`)
      .flush({ message: 'Password attuale errata' }, { status: 403, statusText: 'Forbidden' });
    const err = await esito;
    expect(err.status).toBe(403);
    expect(auth.refresh).not.toHaveBeenCalled();
  });
});
