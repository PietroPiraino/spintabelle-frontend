import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import localeIt from '@angular/common/locales/it';
import {
  LOCALE_ID,
  Type,
  computed,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import {
  MyPoints,
  MySubscription,
  Percorso,
  ProspettoMese,
  Role,
  User,
} from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/ui/toast/toast.service';

// Il locale `it` è quello vero dell'app (app.config.ts lo registra): senza,
// «12,50 €» e «d MMM yyyy» uscirebbero in inglese e le prove di
// formattazione mentirebbero.
registerLocaleData(localeIt);

/** Un utente di prova; ogni spec cambia solo ciò che le serve. */
export function utente(over: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'rossana@example.it',
    nickname: 'MadRoxKO',
    role: 'USER' as Role,
    verified: true,
    points: 150_000,
    notifyNewLessons: true,
    createdAt: '2026-06-01T10:00:00.000Z',
    ...over,
  };
}

export const puntiVuoti: MyPoints = { balance: 0, history: [], page: 1, limit: 20, total: 0 };

export const subVuota: MySubscription = {
  role: 'USER' as Role,
  tier: null,
  subscriptionExpiresAt: null,
  pendingRequest: null,
  ultimaRifiutata: null,
};

export const percorsoVuoto: Percorso = {
  lezioni: { viste: 0, riprendi: [] },
  allenamento: { sessioni: 0, risposte: 0, precisione: null },
  preset: 0,
  mani: { usate: 0, tetto: 50 },
  live: { seguite: 0, ultime: [], consensi: [] },
};

/** La fixture di MadRoxKO (la stessa del vecchio spec del prospetto). */
export const prospettoMadRoxKO: ProspettoMese[] = [
  {
    meseId: 'm1',
    anno: 2026,
    mese: 9,
    etichetta: 'settembre 2026',
    provvisorio: true,
    rakeback: {
      username: 'MadRoxKO',
      backPlayerBp: 5000,
      scaglioneBaseBp: 4500,
      scaglionePassoCent: 2250,
      rakeGeneratoCent: 46_117,
      erogatoBonusCent: 20_250,
      spettanteAlPlayerCent: 2809,
      pagatoAlPlayerCent: 1000,
      residuoAlPlayerCent: 1809,
    },
  },
];

/**
 * Lo stub di `AuthService`: signal dove il componente li legge come signal,
 * spie dove chiama un metodo. Ogni spec può sovrascrivere i metodi.
 */
export function authStub(u: User | null = utente()) {
  const user = signal<User | null>(u);
  return {
    user,
    ready: signal(true),
    isAuthenticated: computed(() => user() !== null),
    isAdmin: computed(() => user()?.role === 'ADMIN'),
    points: computed(() => user()?.points ?? 0),
    loadMe: jasmine.createSpy('loadMe').and.returnValue(of(u)),
    updateProfile: jasmine
      .createSpy('updateProfile')
      .and.callFake((patch: Partial<User>) => {
        const next = { ...(user() as User), ...patch };
        user.set(next);
        return of(next);
      }),
    changePassword: jasmine.createSpy('changePassword').and.returnValue(of({ ok: true })),
    logout: jasmine.createSpy('logout').and.callFake(() => {
      user.set(null);
      return of(null);
    }),
    exportMyData: jasmine.createSpy('exportMyData').and.returnValue(of({ profile: {} })),
    deleteAccount: jasmine.createSpy('deleteAccount').and.callFake(() => {
      user.set(null);
      return of({ ok: true });
    }),
    clearSession: jasmine.createSpy('clearSession'),
  };
}

export type AuthStub = ReturnType<typeof authStub>;

export interface Ctx<T> {
  fixture: ComponentFixture<T>;
  http: HttpTestingController;
  auth: AuthStub;
  router: Router;
  toast: { success: jasmine.Spy; error: jasmine.Spy; show: jasmine.Spy };
  el: HTMLElement;
  stabilizza: () => Promise<void>;
  /** Il testo della pagina come lo legge il DOM (`textContent`, non `innerText`). */
  testo: () => string;
}

export async function monta<T>(
  comp: Type<T>,
  opts: { auth?: AuthStub; inputs?: Record<string, unknown> } = {},
): Promise<Ctx<T>> {
  // Due montaggi nello stesso `it` (es. carico → errore): il TestBed va azzerato.
  TestBed.resetTestingModule();
  const auth = opts.auth ?? authStub();
  const toast = {
    success: jasmine.createSpy('success'),
    error: jasmine.createSpy('error'),
    show: jasmine.createSpy('show'),
  };
  await TestBed.configureTestingModule({
    imports: [comp],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: LOCALE_ID, useValue: 'it' },
      { provide: AuthService, useValue: auth },
      { provide: ToastService, useValue: toast },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(comp);
  for (const [k, v] of Object.entries(opts.inputs ?? {})) {
    fixture.componentRef.setInput(k, v);
  }
  const http = TestBed.inject(HttpTestingController);
  const router = TestBed.inject(Router);
  const stabilizza = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return {
    fixture,
    http,
    auth,
    router,
    toast,
    el: fixture.nativeElement as HTMLElement,
    stabilizza,
    testo: () => (fixture.nativeElement as HTMLElement).textContent ?? '',
  };
}

/** Serve una richiesta il cui URL contiene `frammento`, con `body`. */
export function rispondi(http: HttpTestingController, frammento: string, body: object | null): void {
  http.expectOne((r) => r.url.includes(frammento)).flush(body);
}

/** Fa fallire con 500 la richiesta il cui URL contiene `frammento`. */
export function fallisci(http: HttpTestingController, frammento: string, status = 500): void {
  http
    .expectOne((r) => r.url.includes(frammento))
    .flush({ message: 'giù' }, { status, statusText: 'Errore' });
}

export function osservabile<T>(v: T): Observable<T> {
  return of(v);
}
