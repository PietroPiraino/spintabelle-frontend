import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AdminComponent } from './admin.component';

const API = environment.API_URL;

@Component({ template: '' })
class DummyComponent {}

describe('AdminComponent (shell dashboard)', () => {
  let fixture: ComponentFixture<AdminComponent>;
  let http: HttpTestingController;

  const isRichieste = (r: { url: string }) =>
    r.url === `${API}/admin/subscription-requests`;
  const isAffiliazioni = (r: { url: string }) =>
    r.url === `${API}/admin/affiliations/pending-count`;
  const isRedazione = (r: { url: string }) =>
    r.url === `${API}/admin/news/pending-count`;

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  /** Risponde ai tre conteggi del costruttore (`AdminPendingService`). */
  const flushPending = async (
    richieste: number | null,
    inVerifica: number | null,
    inCoda: number | null = 0,
  ) => {
    const reqRichieste = http.expectOne(isRichieste);
    if (richieste === null) {
      reqRichieste.flush(null, { status: 500, statusText: 'Server Error' });
    } else {
      reqRichieste.flush({
        items: [],
        total: richieste,
        page: 1,
        limit: 1,
        totalPages: richieste,
      });
    }
    const reqAff = http.expectOne(isAffiliazioni);
    if (inVerifica === null) {
      reqAff.flush(null, { status: 500, statusText: 'Server Error' });
    } else {
      reqAff.flush({ inVerifica });
    }
    const reqRedazione = http.expectOne(isRedazione);
    if (inCoda === null) {
      reqRedazione.flush(null, { status: 500, statusText: 'Server Error' });
    } else {
      reqRedazione.flush({ inCoda });
    }
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        // rotte fittizie: bastano a far risolvere routerLink e le navigazioni
        provideRouter([{ path: '**', component: DummyComponent }]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  /** Il badge dentro la voce il cui testo contiene `label` (null = assente). */
  const badgeOf = (label: string): string | null => {
    const link = Array.from(el().querySelectorAll('.admin-shell__link')).find(
      (a) => a.textContent?.includes(label),
    );
    return link?.querySelector('.admin-shell__badge')?.textContent?.trim() ?? null;
  };

  it('rende le 16 voci raggruppate, con i chip "Presto" sui placeholder', async () => {
    await flushPending(0, 0);

    expect(el().querySelectorAll('.admin-shell__link').length).toBe(16);
    for (const label of ['Contenuti', 'Vendite', 'Utenti', 'Finanze', 'Analisi']) {
      expect(text()).toContain(label);
    }
    // i chip stanno SULLE due voci placeholder, non altrove
    const soon = Array.from(el().querySelectorAll('.admin-shell__soon')).map(
      (chip) => chip.closest('.admin-shell__link')?.textContent ?? '',
    );
    expect(soon.length).toBe(2);
    expect(soon.some((t) => t.includes('Stakings'))).toBeTrue();
    expect(soon.some((t) => t.includes('Conteggi mensili'))).toBeTrue();
  });

  it('mostra i badge coi conteggi, ognuno sulla SUA voce', async () => {
    await flushPending(5, 3, 4);

    expect(badgeOf('Richieste')).toBe('5');
    expect(badgeOf('Affiliazioni')).toBe('3');
    // ⚠️ la terza fonte: con un ternario a due rami la Redazione mostrerebbe
    // in silenzio il conteggio delle affiliazioni
    expect(badgeOf('Redazione')).toBe('4');
  });

  it('NASCONDE il badge su errore o zero: mai un errore, mai uno "0"', async () => {
    // convenzione del badge affiliazioni: il conteggio è un accessorio,
    // degrada in silenzio senza rubare la banda errore delle liste
    await flushPending(0, null);

    expect(el().querySelectorAll('.admin-shell__badge').length).toBe(0);
    expect(text()).not.toContain('Server Error');
  });

  it('uno zero su una fonte non nasconde il badge dell\'altra', async () => {
    await flushPending(0, 3, null);

    expect(badgeOf('Richieste')).toBeNull();
    expect(badgeOf('Affiliazioni')).toBe('3');
    expect(badgeOf('Redazione')).toBeNull();
  });

  it('drawer mobile: si apre col toggle, si chiude con Escape e navigando', async () => {
    await flushPending(0, 0);
    const aside = () => el().querySelector('.admin-shell__sidebar')!;
    const toggle = el().querySelector<HTMLButtonElement>('.admin-shell__toggle')!;

    // il click sul toggle NON deve essere richiuso dal listener document:click
    toggle.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(aside().classList.contains('is-open')).toBeTrue();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(aside().classList.contains('is-open')).toBeFalse();

    // click fuori da sidebar e toggle → chiude
    toggle.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(aside().classList.contains('is-open')).toBeTrue();
    document.body.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(aside().classList.contains('is-open')).toBeFalse();

    toggle.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(aside().classList.contains('is-open')).toBeTrue();

    // la navigazione chiude il pannello e aggiorna il titolo della topbar;
    // il refresh dei conteggi NON riparte (min-interval del service): nessuna
    // nuova richiesta da rispondere qui, altrimenti http.verify() fallirebbe
    await TestBed.inject(Router).navigateByUrl('/admin/lezioni');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(aside().classList.contains('is-open')).toBeFalse();
    expect(el().querySelector('.admin-shell__title')?.textContent).toContain(
      'Lezioni',
    );
  });

  it('il titolo della topbar parte da "Panoramica" e segue la sezione', async () => {
    await flushPending(0, 0);
    expect(el().querySelector('.admin-shell__title')?.textContent).toContain(
      'Panoramica',
    );

    await TestBed.inject(Router).navigateByUrl('/admin/conteggi-mensili');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el().querySelector('.admin-shell__title')?.textContent).toContain(
      'Conteggi mensili',
    );
  });
});
