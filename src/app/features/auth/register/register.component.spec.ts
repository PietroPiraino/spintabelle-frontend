import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { RegisterComponent } from './register.component';

describe('RegisterComponent — la destinazione dopo il primo accesso', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AuthService, useValue: { register: () => of({}) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RegisterComponent);
    el = fixture.nativeElement as HTMLElement;
  });

  async function registra(): Promise<void> {
    const scrivi = (id: string, v: string) => {
      const i = el.querySelector<HTMLInputElement>(`#${id}`)!;
      i.value = v;
      i.dispatchEvent(new Event('input'));
    };
    scrivi('nickname', 'NuovoSocio');
    scrivi('email', 'nuovo@bff.local');
    scrivi('password', 'password123');
    scrivi('confirm', 'password123');
    const privacy = el.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    privacy.checked = true;
    privacy.dispatchEvent(new Event('change'));
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** Il pulsante della schermata «Controlla la posta». */
  const vaiAllAccesso = () => el.querySelector<HTMLAnchorElement>('a.btn--primary');

  it('⚠️ arrivando dai premi, «Vai all’accesso» riporta ai premi e lo dice', async () => {
    fixture.componentRef.setInput('redirect', '/awards');
    fixture.detectChanges();
    expect(el.textContent).toContain('3 Max Hyper Awards');
    await registra();
    expect(el.textContent).toContain('ti riportiamo alla pagina dei premi');
    expect(vaiAllAccesso()?.getAttribute('href')).toBe('/login?redirect=%2Fawards');
  });

  it('senza destinazione il testo e i link restano quelli di sempre', async () => {
    fixture.detectChanges();
    expect(el.textContent).toContain('accedere alle lezioni della scuola');
    const accedi = el.querySelector<HTMLAnchorElement>(
      '.auth-card__footer a[href^="/login"]',
    );
    expect(accedi?.getAttribute('href')).toBe('/login');
    await registra();
    expect(vaiAllAccesso()?.getAttribute('href')).toBe('/login');
  });

  it('una destinazione ostile non arriva al link dell’accesso', async () => {
    fixture.componentRef.setInput('redirect', '//evil.it/x');
    fixture.detectChanges();
    await registra();
    expect(vaiAllAccesso()?.getAttribute('href')).toBe('/login');
  });
});
