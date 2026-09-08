import { Component, signal } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SchedeComponent, VoceScheda } from './schede.component';

type Vista = 'prodotti' | 'ordini';

const VOCI: readonly VoceScheda<Vista>[] = [
  { valore: 'prodotti', etichetta: 'Prodotti' },
  { valore: 'ordini', etichetta: 'Ordini', conteggio: 3 },
];

@Component({
  imports: [SchedeComponent],
  template: `
    <app-schede
      #sch
      etichetta="Sotto-sezioni"
      [voci]="voci"
      [scelto]="vista()"
      (scegli)="vista.set($event)"
    />
    <div
      role="tabpanel"
      tabindex="0"
      [id]="sch.idPannello()"
      [attr.aria-labelledby]="sch.idSchedaAttiva()"
    >
      {{ vista() }}
    </div>
  `,
})
class Ospite {
  readonly voci = VOCI;
  readonly vista = signal<Vista>('prodotti');
}

describe('app-schede', () => {
  let fixture: ComponentFixture<Ospite>;
  let ospite: Ospite;

  const schede = (): HTMLButtonElement[] =>
    [...fixture.nativeElement.querySelectorAll('[role="tab"]')];

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

  it('⚠️ `aria-controls` punta a un pannello che ESISTE davvero', async () => {
    // È l'unica rete su un contratto spezzato fra due file: il primitivo
    // dichiara l'id, il pannello lo consuma nel template del chiamante. Un
    // `aria-controls` verso un id inesistente è peggio dell'omissione — uno
    // screen reader annuncia un pannello e poi non lo trova.
    const attiva = schede().find((b) => b.getAttribute('aria-selected') === 'true')!;
    const id = attiva.getAttribute('aria-controls')!;
    expect(id).toBeTruthy();
    const pannello = document.getElementById(id) ?? fixture.nativeElement.querySelector(`#${id}`);
    expect(pannello).toBeTruthy();
    expect(pannello!.getAttribute('role')).toBe('tabpanel');
  });

  it('⚠️ solo la scheda SELEZIONATA dichiara aria-controls', () => {
    // I pannelli vivono in un `@if` del chiamante: di id ne esiste uno per
    // volta, quindi metterlo su tutte punterebbe nel vuoto.
    const spente = schede().filter((b) => b.getAttribute('aria-selected') !== 'true');
    expect(spente.length).toBeGreaterThan(0);
    for (const b of spente) expect(b.getAttribute('aria-controls')).toBeNull();
  });

  it('usa aria-selected, non aria-pressed', () => {
    for (const b of schede()) {
      expect(b.getAttribute('aria-selected')).toBeTruthy();
      expect(b.getAttribute('aria-pressed')).toBeNull();
    }
  });

  it('il roving tabindex tiene UN solo bottone tabbabile', () => {
    const zeri = schede().filter((b) => b.getAttribute('tabindex') === '0');
    expect(zeri.length).toBe(1);
    expect(zeri[0].getAttribute('aria-selected')).toBe('true');
  });

  it('le frecce spostano la scelta, e Home/End vanno agli estremi', async () => {
    const lista = fixture.nativeElement.querySelector('[role="tablist"]') as HTMLElement;
    lista.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await stabilizza();
    expect(ospite.vista()).toBe('ordini');

    lista.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    await stabilizza();
    expect(ospite.vista()).toBe('prodotti');

    lista.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    await stabilizza();
    expect(ospite.vista()).toBe('ordini');
  });

  it('il conteggio si mostra solo dove c’è', () => {
    expect(schede()[0].querySelector('.schede__n')).toBeNull();
    expect(schede()[1].querySelector('.schede__n')?.textContent?.trim()).toBe('3');
  });
});
