/** Qualunque risorsa three con un metodo dispose (geometry, material, texture…). */
export interface Disposable {
  dispose(): void;
}

/**
 * Registro centralizzato delle risorse GPU di una scena.
 * Regola anti-leak (C1): ogni risorsa va tracciata SUBITO dopo la creazione,
 * prima di qualunque riga che possa lanciare — così un'init fallita a metà
 * viene comunque ripulita per intero.
 */
export class SceneResources {
  private readonly disposables: Disposable[] = [];

  /** Traccia una risorsa e la restituisce (uso fluido: res.track(new ...)). */
  track<T extends Disposable>(resource: T): T {
    this.disposables.push(resource);
    return resource;
  }

  get size(): number {
    return this.disposables.length;
  }

  /** Dispose di tutto in ordine inverso di creazione; idempotente. */
  disposeAll(): void {
    for (let i = this.disposables.length - 1; i >= 0; i--) {
      this.disposables[i].dispose();
    }
    this.disposables.length = 0;
  }
}
