import { HttpClient, HttpContext, HttpContextToken } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Observable,
  ReplaySubject,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, RegisterPayload, User } from '../models/api.models';

/** Marca le richieste che non devono innescare il refresh automatico sul 401. */
export const SKIP_REFRESH = new HttpContextToken<boolean>(() => false);

const API = environment.API_URL;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  // Access token SOLO in memoria: mai in localStorage (XSS-safe).
  private readonly token = signal<string | null>(null);
  readonly user = signal<User | null>(null);
  /** true quando il tentativo di ripristino sessione all'avvio è concluso */
  readonly ready = signal(false);
  // Variante observable per i guard (toObservable su signal non emette
  // in modo affidabile nei guard con zoneless change detection)
  private readonly readySubject = new ReplaySubject<void>(1);
  readonly ready$ = this.readySubject.asObservable();

  // NB: il bootstrap NON parte dal costruttore — la chiamata HTTP passerebbe
  // dall'authInterceptor che inietta AuthService ancora in costruzione
  // (dipendenza circolare). Viene avviato da provideEnvironmentInitializer
  // in app.config.ts, sempre in background.

  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isSubscriber = computed(() => {
    const role = this.user()?.role;
    return role === 'SUBSCRIBER' || role === 'ADMIN';
  });
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');
  /** Nome mostrato in interfaccia (fallback per account senza nickname) */
  readonly displayName = computed(
    () => this.user()?.nickname ?? this.user()?.email ?? '',
  );

  private refreshInFlight$: Observable<string> | null = null;

  getToken(): string | null {
    return this.token();
  }

  /**
   * Ripristino silenzioso della sessione all'avvio: se il cookie di refresh
   * è valido otteniamo un nuovo access token, altrimenti restiamo sloggati.
   * Se il backend è lento (cold start di Render), dopo 8s l'interfaccia
   * mostra comunque lo stato sloggato: il ripristino continua in background
   * e, se riesce, l'header si aggiorna da solo.
   */
  bootstrap(): Observable<void> {
    const readyCap = setTimeout(() => this.markReady(), 8000);
    return this.refresh().pipe(
      switchMap(() => this.loadMe()),
      map(() => undefined),
      catchError(() => of(undefined)),
      finalize(() => {
        clearTimeout(readyCap);
        this.markReady();
      }),
    );
  }

  private markReady(): void {
    if (this.ready()) return;
    this.ready.set(true);
    this.readySubject.next();
  }

  /** `identifier` può essere l'email oppure il nome utente (nickname). */
  login(identifier: string, password: string): Observable<User> {
    return this.http
      .post<AuthResponse>(
        `${API}/auth/login`,
        { identifier, password },
        { withCredentials: true, context: new HttpContext().set(SKIP_REFRESH, true) },
      )
      .pipe(
        tap((res) => this.token.set(res.accessToken)),
        switchMap(() => this.loadMe()),
      );
  }

  register(payload: RegisterPayload): Observable<unknown> {
    return this.http.post(`${API}/auth/register`, payload);
  }

  resendVerification(email: string): Observable<unknown> {
    return this.http.post(`${API}/auth/resend-verification`, { email });
  }

  forgotPassword(email: string): Observable<unknown> {
    return this.http.post(`${API}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<unknown> {
    return this.http.post(`${API}/auth/reset-password`, { token, password });
  }

  /** Refresh condiviso: N richiamanti concorrenti → una sola chiamata HTTP. */
  refresh(): Observable<string> {
    this.refreshInFlight$ ??= this.http
      .post<AuthResponse>(
        `${API}/auth/refresh`,
        {},
        { withCredentials: true, context: new HttpContext().set(SKIP_REFRESH, true) },
      )
      .pipe(
        map((res) => res.accessToken),
        tap((token) => this.token.set(token)),
        finalize(() => (this.refreshInFlight$ = null)),
        shareReplay(1),
      );
    return this.refreshInFlight$;
  }

  loadMe(): Observable<User> {
    return this.http
      .get<User>(`${API}/auth/me`)
      .pipe(tap((user) => this.user.set(user)));
  }

  logout(): Observable<unknown> {
    return this.http
      .post(`${API}/auth/logout`, {}, { withCredentials: true })
      .pipe(finalize(() => this.clearSession()));
  }

  // ----- Gestione account (diritti dell'interessato, GDPR) -----

  /** Export di tutti i propri dati (accesso/portabilità). */
  exportMyData(): Observable<unknown> {
    return this.http.get(`${API}/account/export`);
  }

  /** Rettifica email e/o nickname; aggiorna l'utente in memoria. */
  updateProfile(patch: {
    email?: string;
    nickname?: string;
  }): Observable<User> {
    return this.http
      .patch<User>(`${API}/account/profile`, patch)
      .pipe(tap((user) => this.user.set(user)));
  }

  changePassword(
    currentPassword: string,
    newPassword: string,
  ): Observable<unknown> {
    return this.http.patch(`${API}/account/password`, {
      currentPassword,
      newPassword,
    });
  }

  /** Cancellazione account e dati collegati (diritto all'oblio). */
  deleteAccount(): Observable<unknown> {
    return this.http
      .delete(`${API}/account`, { withCredentials: true })
      .pipe(finalize(() => this.clearSession()));
  }

  clearSession(): void {
    this.token.set(null);
    this.user.set(null);
  }
}
