import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { LoginComponent, safeRedirect } from './login.component';

describe('safeRedirect', () => {
  it('lascia passare un percorso interno, query string compresa', () => {
    expect(safeRedirect('/lezioni')).toBe('/lezioni');
    expect(safeRedirect('/affiliazioni?completa=admiralbet')).toBe(
      '/affiliazioni?completa=admiralbet',
    );
    expect(safeRedirect('/live/123/stanza')).toBe('/live/123/stanza');
  });

  it('torna in home quando il redirect manca o è vuoto', () => {
    expect(safeRedirect(undefined)).toBe('/');
    expect(safeRedirect(null)).toBe('/');
    expect(safeRedirect('')).toBe('/');
    expect(safeRedirect('   ')).toBe('/');
  });

  it('rifiuta tutto ciò che porta fuori dal sito', () => {
    const fuori = [
      '//evil.it', // protocol-relative
      '///evil.it',
      '/\\evil.it', // i browser lo normalizzano in //evil.it
      '\\\\evil.it',
      'https://evil.it',
      'http://evil.it',
      '//evil.it/login?redirect=/lezioni',
      'javascript:alert(1)',
      'lezioni', // relativo senza barra: non è una destinazione nostra
      '  //evil.it  ',
      '/\t/evil.it', // il tab sparisce dall'URL e resta //evil.it
      '/\n/evil.it',
    ];
    for (const raw of fuori) {
      expect(safeRedirect(raw)).withContext(raw).toBe('/');
    }
  });
});

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let router: Router;

  const compila = (): void => {
    const el = fixture.nativeElement as HTMLElement;
    const identifier = el.querySelector<HTMLInputElement>('#identifier')!;
    const password = el.querySelector<HTMLInputElement>('#password')!;
    identifier.value = 'test@spintabelle.it';
    identifier.dispatchEvent(new Event('input'));
    password.value = 'password123';
    password.dispatchEvent(new Event('input'));
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        // il componente usa solo `login()`: niente HTTP, niente sessione vera
        { provide: AuthService, useValue: { login: () => of({}) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
  });

  it('dopo l\'accesso va sul redirect quando è un percorso interno', async () => {
    fixture.componentRef.setInput('redirect', '/affiliazioni?completa=admiralbet');
    fixture.detectChanges();
    await fixture.whenStable();

    compila();

    expect(router.navigateByUrl).toHaveBeenCalledWith(
      '/affiliazioni?completa=admiralbet',
    );
  });

  it('ignora un redirect verso un altro dominio e torna in home', async () => {
    fixture.componentRef.setInput('redirect', '//evil.it/finta-pagina');
    fixture.detectChanges();
    await fixture.whenStable();

    compila();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });
});
