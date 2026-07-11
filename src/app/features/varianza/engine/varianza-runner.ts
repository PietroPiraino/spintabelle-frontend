import { Injectable, OnDestroy } from '@angular/core';
import { runSimulation } from './sim-engine';
import type { SimConfig, SimResult } from './types';

/**
 * Orchestratore della simulazione: gira in un Web Worker (thread UI reattivo) con
 * fallback sincrono sul main thread se i Worker non sono disponibili. Ogni run annulla
 * il precedente.
 */
@Injectable()
export class VarianzaRunner implements OnDestroy {
  private worker: Worker | null = null;
  private useWorker = typeof Worker !== 'undefined';

  run(config: SimConfig, onProgress?: (frac: number) => void): Promise<SimResult> {
    this.cancel();
    if (this.useWorker) {
      try {
        return this.runInWorker(config, onProgress);
      } catch {
        // Se la creazione del worker fallisce (build/ambiente), passa al fallback.
        this.useWorker = false;
      }
    }
    // Fallback sincrono: cede un tick così lo stato "in corso"/progress si disegna
    // prima del calcolo bloccante (il worker resta comunque la via normale).
    return new Promise<SimResult>((resolve) =>
      setTimeout(() => resolve(runSimulation(config, onProgress)), 0),
    );
  }

  /** Annulla la simulazione in corso (termina il worker). */
  cancel(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  ngOnDestroy(): void {
    this.cancel();
  }

  private runInWorker(
    config: SimConfig,
    onProgress?: (frac: number) => void,
  ): Promise<SimResult> {
    const worker = new Worker(new URL('./sim.worker', import.meta.url), { type: 'module' });
    this.worker = worker;
    return new Promise<SimResult>((resolve, reject) => {
      worker.onmessage = ({ data }) => {
        if (data.type === 'progress') {
          onProgress?.(data.frac);
        } else if (data.type === 'result') {
          if (this.worker === worker) this.cancel();
          resolve(data.result as SimResult);
        } else if (data.type === 'error') {
          if (this.worker === worker) this.cancel();
          reject(new Error(data.message));
        }
      };
      worker.onerror = (e) => {
        if (this.worker === worker) this.cancel();
        reject(new Error(e.message || 'Errore nel worker di simulazione'));
      };
      worker.postMessage({ type: 'run', config });
    });
  }
}
