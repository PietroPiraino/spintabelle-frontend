import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  CHUNK_RELOAD_FLAG,
  ChunkErrorHandler,
  RELOAD_PAGE,
} from './chunk-error.handler';

/**
 * Blocca le due proprietà del recupero dei chunk: ricarica sui fallimenti di
 * import dinamico (dopo un deploy i nomi con hash cambiano e una scheda vecchia
 * chiede file che non esistono più → click muto), e ricarica UNA VOLTA SOLA.
 * Un loop di reload è un danno peggiore del problema che risolve.
 */
describe('ChunkErrorHandler', () => {
  let reloads: number;
  let handler: ErrorHandler;

  beforeEach(() => {
    reloads = 0;
    sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
    TestBed.configureTestingModule({
      providers: [
        { provide: ErrorHandler, useClass: ChunkErrorHandler },
        { provide: RELOAD_PAGE, useValue: () => reloads++ },
      ],
    });
    handler = TestBed.inject(ErrorHandler);
    // l'handler logga sempre l'errore: silenziato per non sporcare il report
    spyOn(console, 'error');
  });

  afterEach(() => sessionStorage.removeItem(CHUNK_RELOAD_FLAG));

  it('ricarica su "Failed to fetch dynamically imported module" (Chrome)', () => {
    handler.handleError(
      new Error(
        'Failed to fetch dynamically imported module: https://bestfishforever.it/chunk-ABC123.js',
      ),
    );
    expect(reloads).toBe(1);
  });

  it('ricarica su "error loading dynamically imported module" (Firefox/Safari)', () => {
    handler.handleError(new Error('error loading dynamically imported module'));
    expect(reloads).toBe(1);
  });

  it('ricarica su ChunkLoadError riconoscendolo dal nome', () => {
    const err = new Error('Loading chunk 42 failed.');
    err.name = 'ChunkLoadError';
    handler.handleError(err);
    expect(reloads).toBe(1);
  });

  it('riconosce la promise rifiutata annidata in `reason` (listener globali)', () => {
    handler.handleError({
      reason: new Error('Failed to fetch dynamically imported module'),
    });
    expect(reloads).toBe(1);
  });

  it("riconosce l'ErrorEvent riportato in `cause`", () => {
    handler.handleError(
      new Error('An ErrorEvent with no error occurred.', {
        cause: { message: 'error loading dynamically imported module' },
      }),
    );
    expect(reloads).toBe(1);
  });

  it('NON ricarica su un errore applicativo qualunque', () => {
    handler.handleError(new Error('Cannot read properties of undefined'));
    expect(reloads).toBe(0);
  });

  it('NON ricarica su un errore HTTP 500 del backend', () => {
    handler.handleError({ status: 500, message: 'Http failure response' });
    expect(reloads).toBe(0);
  });

  it('ricarica UNA SOLA VOLTA anche se il chunk manca di nuovo (niente loop)', () => {
    const err = new Error('Failed to fetch dynamically imported module');
    handler.handleError(err);
    handler.handleError(err);
    handler.handleError(err);
    expect(reloads)
      .withContext('senza il flag in sessionStorage la pagina cicla a vuoto')
      .toBe(1);
  });

  it('non ricarica se il flag è già in sessionStorage (reload appena avvenuto)', () => {
    sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
    handler.handleError(new Error('Failed to fetch dynamically imported module'));
    expect(reloads).toBe(0);
  });

  it("logga sempre l'errore, anche quando ricarica", () => {
    const err = new Error('Failed to fetch dynamically imported module');
    handler.handleError(err);
    expect(console.error).toHaveBeenCalledWith(err);
  });

  it('non esplode su null/undefined/stringhe', () => {
    expect(() => handler.handleError(null)).not.toThrow();
    expect(() => handler.handleError(undefined)).not.toThrow();
    expect(() => handler.handleError('boom')).not.toThrow();
    expect(reloads).toBe(0);
  });
});
