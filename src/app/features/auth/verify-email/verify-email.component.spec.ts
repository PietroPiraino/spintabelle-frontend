import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { DATE_AWARDS_2026 } from '../../awards/awards.data';
import { VerifyEmailComponent } from './verify-email.component';

const EDIZIONE = `${environment.API_URL}/awards/edizione`;

describe('VerifyEmailComponent — dopo la conferma, la strada per i premi', () => {
  let fixture: ComponentFixture<VerifyEmailComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [VerifyEmailComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(VerifyEmailComponent);
    http = TestBed.inject(HttpTestingController);
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  async function rendi(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function edizione(fase: string, raccoltaAttiva = true) {
    return {
      disponibile: true,
      anno: 2026,
      fase,
      raccoltaAttiva,
      date: DATE_AWARDS_2026,
      categorie: [],
    };
  }

  const primario = () => el.querySelector<HTMLAnchorElement>('a.btn--primary');

  it('⚠️ con le proposte aperte il pulsante principale porta ai premi', async () => {
    fixture.componentRef.setInput('esito', 'ok');
    await rendi();
    http.expectOne(EDIZIONE).flush(edizione('PROPOSTE'));
    await rendi();
    expect(primario()?.textContent?.trim()).toBe('Accedi e proponi');
    expect(primario()?.getAttribute('href')).toBe('/login?redirect=%2Fawards');
    // Chi non vuole i premi ha comunque l'accesso semplice.
    expect(el.querySelector('.auth-card__footer a')?.getAttribute('href')).toBe('/login');
  });

  it('fuori dalle proposte resta «Accedi ora»', async () => {
    fixture.componentRef.setInput('esito', 'ok');
    await rendi();
    http.expectOne(EDIZIONE).flush(edizione('CONTATTI'));
    await rendi();
    expect(primario()?.textContent?.trim()).toBe('Accedi ora');
    expect(primario()?.getAttribute('href')).toBe('/login');
  });

  it('a raccolta spenta resta «Accedi ora»', async () => {
    fixture.componentRef.setInput('esito', 'ok');
    await rendi();
    http.expectOne(EDIZIONE).flush(edizione('PROPOSTE', false));
    await rendi();
    expect(primario()?.textContent?.trim()).toBe('Accedi ora');
  });

  it('un errore dell’API non blocca niente: resta «Accedi ora»', async () => {
    fixture.componentRef.setInput('esito', 'ok');
    await rendi();
    http.expectOne(EDIZIONE).flush('giù', { status: 503, statusText: 'x' });
    await rendi();
    expect(primario()?.textContent?.trim()).toBe('Accedi ora');
  });

  it('a verifica fallita non chiama l’API dei premi', async () => {
    fixture.componentRef.setInput('esito', 'errore');
    await rendi();
    http.expectNone(EDIZIONE);
    expect(el.textContent).toContain('Verifica non riuscita');
  });
});
