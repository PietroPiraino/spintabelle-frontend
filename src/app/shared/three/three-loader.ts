import { InjectionToken } from '@angular/core';
import type { ThreeModule } from './diorama.types';

let threePromise: Promise<ThreeModule> | null = null;

/**
 * Import dinamico di three, memoizzato: tutte le scene (e l'hero della
 * landing) condividono lo stesso chunk lazy.
 */
export function loadThree(): Promise<ThreeModule> {
  threePromise ??= import('three');
  return threePromise;
}

/**
 * Loader iniettabile: nei test si sostituisce con uno stub così i componenti
 * host non creano mai un WebGLRenderer reale (ChromeHeadless non ha GPU).
 */
export const THREE_LOADER = new InjectionToken<() => Promise<ThreeModule>>('THREE_LOADER', {
  providedIn: 'root',
  factory: () => loadThree,
});
