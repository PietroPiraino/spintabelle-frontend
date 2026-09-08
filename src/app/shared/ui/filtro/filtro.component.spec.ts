import { Component, signal } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FiltroComponent, VoceFiltro } from './filtro.component';

type Stato = 'TUTTI' | 'ATTIVI' | 'SPENTI';

const VOCI: readonly VoceFiltro<Stato>[] = [
  { valore: 'TUTTI', etichetta: 'Tutti' },
  { valore: 'ATTIVI', etichetta: 'Attivi', conteggio: 0 },
  { valore: 'SPENTI', etichetta: 'Spenti', conteggio: 7 },
];

@Component({
  imports: [FiltroComponent],
  template: `<app-filtro
    etichetta="Filtra per stato"
    [voci]="voci"
    [scelto]="stato()"
    [inerte]="inerte()"
    (scegli)="stato.set($event)"
  />`,
})
class Ospite {
  readonly voci = VOCI;
  readonly stato = signal<Stato>('TUTTI');
  readonly inerte = signal(false);
}

describe('app-filtro', () => {
  let fixture: ComponentFixture<Ospite>;
  let ospite: Ospite;

  const pillole = (): HTMLButtonElement[] =>
    [...fixture.nativeElement.querySelectorAll('[role="radio"]')];

  const stabilizza = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ospite],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    fixture = TestBed.createComponent(Ospite);
    ospite = fixture.componentInstance;
    await stabilizza();
  });

  it('⚠️ è una scelta esclusiva: aria-checked, MAI aria-pressed', () => {
    // `aria-pressed` è la grammatica dei toggle indipendenti. Su tre pillole di
    // cui una sempre accesa annuncia «tre interruttori, uno premuto» invece di
    // «radio 1 di 3». Ed è il difetto che questo primitivo sostituisce, non
    // uno da riportarsi dentro.
    const gruppo = fixture.nativeElement.querySelector('[role="radiogroup"]');
    expect(gruppo).toBeTruthy();
    for (const b of pillole()) {
      expect(b.getAttribute('aria-checked')).toBeTruthy();
      expect(b.getAttribute('aria-pressed')).toBeNull();
    }
    expect(pillole().filter((b) => b.getAttribute('aria-checked') === 'true').length).toBe(1);
  });

  it('il roving tabindex tiene UN solo bottone tabbabile', () => {
    const zeri = pillole().filter((b) => b.getAttribute('tabindex') === '0');
    expect(zeri.length).toBe(1);
    expect(zeri[0].getAttribute('aria-checked')).toBe('true');
  });

  it('le frecce cambiano la scelta e girano in tondo', async () => {
    const gruppo = fixture.nativeElement.querySelector('[role="radiogroup"]') as HTMLElement;
    gruppo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await stabilizza();
    expect(ospite.stato()).toBe('ATTIVI');
    gruppo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await stabilizza();
    expect(ospite.stato()).toBe('TUTTI');
    gruppo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await stabilizza();
    expect(ospite.stato()).toBe('SPENTI');
  });

  describe('durante un caricamento', () => {
    it('⚠️ i bottoni restano FOCALIZZABILI: aria-disabled, non disabled', async () => {
      // Con `[disabled]` il bottone che porta il `tabindex="0"` diventa non
      // focalizzabile: il fuoco esce dal gruppo e non ci rientra più con Tab
      // finché il caricamento non finisce. È un difetto che si vede solo da
      // tastiera, cioè quasi mai — e mai da chi lo introduce.
      ospite.inerte.set(true);
      await stabilizza();
      for (const b of pillole()) {
        expect(b.disabled).toBe(false);
        expect(b.getAttribute('aria-disabled')).toBe('true');
      }
      expect(pillole().filter((b) => b.getAttribute('tabindex') === '0').length).toBe(1);
    });

    it('ma il clic e le frecce non cambiano niente', async () => {
      ospite.inerte.set(true);
      await stabilizza();
      pillole()[1].click();
      await stabilizza();
      expect(ospite.stato()).toBe('TUTTI');
    });
  });

  it('⚠️ un conteggio a ZERO si stampa, non sparisce', () => {
    // «Attivi 0» è un'informazione: dice che il filtro non troverebbe niente,
    // e la sua assenza si legge come «non lo so». Il test guarda `!= null`,
    // non la verità del numero.
    expect(pillole()[1].querySelector('.filtro__n')?.textContent?.trim()).toBe('0');
    expect(pillole()[0].querySelector('.filtro__n')).toBeNull();
  });
});
