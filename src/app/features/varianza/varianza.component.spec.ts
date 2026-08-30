import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { VarianzaComponent } from './varianza.component';

/**
 * Un solo test, e non e' pigrizia: e' IL caso che la riparazione del CLS ha
 * introdotto e poi chiuso, e l'unico che nessuna guardia di testo puo' vedere.
 *
 * Lo scheletro dei risultati (che riserva i ~1.400px che il worker fara'
 * comparire) NON e' legato a `running()` da solo, perche' `setMode()` non
 * annulla la simulazione in volo. La sequenza che rompeva tutto:
 *
 *   1. clic su «Simula» in modalita' soldi -> `running()` true, scheletro su;
 *   2. dopo un secondo l'utente passa a EV Chip -> `mode()` diventa 'chip',
 *      `result()` guarda `chipResult()` (null), lo scheletro resterebbe su;
 *   3. il worker finisce quattro secondi dopo e scrive `moneyResult`, che
 *      `result()` non guarda piu' -> `running.set(false)` fa CROLLARE lo
 *      scheletro di ~1.400px, a quattro secondi dall'ultimo clic, cioe' ben
 *      fuori dalla finestra di 500ms in cui uno spostamento e' scusato.
 *
 * Cioe' un CLS pieno causato dalla riparazione. La congiunzione con
 * `runningMode() === mode()` lo chiude: al cambio di modalita' i due smettono
 * di combaciare e lo scheletro sparisce SUBITO, dentro i 500ms di quel clic.
 *
 * ⚠️ `mostraScheletro` e `runningMode` sono `protected`: qui si leggono dal
 * componente con un cast, che e' il prezzo per provare l'unica cosa che conta.
 */
describe('VarianzaComponent — quando mostra lo scheletro', () => {
  let comp: VarianzaComponent;
  /** L'istanza con i membri protetti visibili, per non ripetere il cast. */
  let dentro: {
    mostraScheletro: () => boolean;
    runningMode: { set: (m: 'money' | 'chip' | null) => void };
    mode: { set: (m: 'money' | 'chip') => void };
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [VarianzaComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    comp = TestBed.createComponent(VarianzaComponent).componentInstance;
    dentro = comp as unknown as typeof dentro;
  });

  it('sta fermo se nessun run e in volo (chi arriva sulla pagina non vede 1.400px di finto contenuto)', () => {
    expect(dentro.mostraScheletro()).toBeFalse();
  });

  it('compare quando un run e in volo PER LA MODALITA corrente', () => {
    dentro.mode.set('money');
    dentro.runningMode.set('money');
    expect(dentro.mostraScheletro()).toBeTrue();
  });

  it('⚠️ SPARISCE se l utente cambia modalita mentre il worker gira', () => {
    dentro.mode.set('money');
    dentro.runningMode.set('money');
    expect(dentro.mostraScheletro()).toBeTrue();

    // L'utente passa a EV Chip: il run di «money» e' ancora in volo.
    dentro.mode.set('chip');
    expect(dentro.mostraScheletro())
      .withContext(
        'lo scheletro deve sparire QUI, dentro i 500ms del clic che ha cambiato ' +
          'modalita\' — non alla fine del worker, secondi dopo',
      )
      .toBeFalse();
  });
});
