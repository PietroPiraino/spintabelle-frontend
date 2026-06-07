import { InjectionToken } from '@angular/core';

/** Capacità del dispositivo rilevanti per i diorami (iniettabili nei test). */
export interface DioramaCapabilities {
  hasWebGL(): boolean;
  prefersReducedMotion(): boolean;
  /** Puntatore di precisione (mouse): abilita la parallasse. */
  hasFinePointer(): boolean;
}

/** Stesso probe dell'hero della landing: webgl2 con ripiego su webgl. */
export function hasWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    return !!(probe.getContext('webgl2') ?? probe.getContext('webgl'));
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function hasFinePointer(): boolean {
  return matchMedia('(pointer: fine)').matches;
}

export const DIORAMA_CAPABILITIES = new InjectionToken<DioramaCapabilities>(
  'DIORAMA_CAPABILITIES',
  {
    providedIn: 'root',
    factory: () => ({ hasWebGL, prefersReducedMotion, hasFinePointer }),
  },
);
