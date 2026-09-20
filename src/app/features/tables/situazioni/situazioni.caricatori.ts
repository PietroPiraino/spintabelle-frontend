// GENERATO da backend/scripts/export-situazioni.mjs — NON modificare a mano.
// Un import() letterale per situazione: il resolver di /tabelle/:slug carica
// SOLO il chunk della pagina richiesta (~3 KB gzip), mai tutti e 24.
import type { NodoCompatto } from './situazioni.types';

export const CARICATORI: Record<string, () => Promise<{ NODO: NodoCompatto }>> = {
  'spin-and-go-btn-8bb': () => import('./nodi/spin-and-go-btn-8bb'),
  'spin-and-go-btn-10bb': () => import('./nodi/spin-and-go-btn-10bb'),
  'spin-and-go-btn-12bb': () => import('./nodi/spin-and-go-btn-12bb'),
  'spin-and-go-btn-15bb': () => import('./nodi/spin-and-go-btn-15bb'),
  'spin-and-go-btn-20bb': () => import('./nodi/spin-and-go-btn-20bb'),
  'spin-and-go-btn-25bb': () => import('./nodi/spin-and-go-btn-25bb'),
  'spin-and-go-sb-8bb-dopo-fold': () => import('./nodi/spin-and-go-sb-8bb-dopo-fold'),
  'spin-and-go-sb-10bb-dopo-fold': () => import('./nodi/spin-and-go-sb-10bb-dopo-fold'),
  'spin-and-go-sb-12bb-dopo-fold': () => import('./nodi/spin-and-go-sb-12bb-dopo-fold'),
  'spin-and-go-sb-15bb-dopo-fold': () => import('./nodi/spin-and-go-sb-15bb-dopo-fold'),
  'spin-and-go-bb-8bb-vs-push-sb': () => import('./nodi/spin-and-go-bb-8bb-vs-push-sb'),
  'spin-and-go-bb-10bb-vs-push-sb': () => import('./nodi/spin-and-go-bb-10bb-vs-push-sb'),
  'spin-and-go-bb-12bb-vs-push-sb': () => import('./nodi/spin-and-go-bb-12bb-vs-push-sb'),
  'spin-and-go-bb-15bb-vs-push-sb': () => import('./nodi/spin-and-go-bb-15bb-vs-push-sb'),
  'spin-and-go-sb-8bb-vs-push-btn': () => import('./nodi/spin-and-go-sb-8bb-vs-push-btn'),
  'spin-and-go-sb-10bb-vs-push-btn': () => import('./nodi/spin-and-go-sb-10bb-vs-push-btn'),
  'spin-and-go-sb-12bb-vs-push-btn': () => import('./nodi/spin-and-go-sb-12bb-vs-push-btn'),
  'heads-up-sb-8bb': () => import('./nodi/heads-up-sb-8bb'),
  'heads-up-sb-10bb': () => import('./nodi/heads-up-sb-10bb'),
  'heads-up-sb-12bb': () => import('./nodi/heads-up-sb-12bb'),
  'heads-up-sb-15bb': () => import('./nodi/heads-up-sb-15bb'),
  'heads-up-sb-20bb': () => import('./nodi/heads-up-sb-20bb'),
  'heads-up-sb-25bb': () => import('./nodi/heads-up-sb-25bb'),
  'heads-up-bb-10bb-vs-push': () => import('./nodi/heads-up-bb-10bb-vs-push'),
};
