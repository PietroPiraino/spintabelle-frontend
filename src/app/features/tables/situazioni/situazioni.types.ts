/**
 * Il nodo GTO di una situazione, nella forma COMPATTA scritta da
 * `backend/scripts/export-situazioni.mjs` in `nodi/<slug>.ts`.
 *
 * Perche' compatto: un nodo grezzo pesa ~22 KB (169 mani × {freq, ev} per
 * azione, con float a 17 cifre). Qui le 169 righe seguono l'ordine di
 * `MATRIX_HANDS` (`preflop-display.ts`), le colonne l'ordine di `codici`, e
 * i numeri sono arrotondati (frequenze a 3 decimali, EV a 2): ~8-12 KB di
 * sorgente, ~3 KB gzip, UN chunk per pagina caricato dal resolver.
 *
 * ⚠️ Solo `import type`: il file dev'essere importabile da Node 24 senza build
 * (lo leggono `scripts/lib/situazioni.test.mjs` e l'esportatore).
 */
import type { PreflopAction, PreflopPlayer } from '../../../core/models/api.models';

export interface NodoCompatto {
  format: string;
  depth: number;
  depth_label: string;
  stacks: string;
  preflop_actions: string;
  history: string[];
  active_position: string;
  pot: number;
  players: PreflopPlayer[];
  /** Le azioni complete del nodo (3-5), nell'ordine del database. */
  actions: PreflopAction[];
  /** Le colonne di `f` ed `e`: i `code` delle azioni. */
  codici: string[];
  /** 169 righe (ordine `MATRIX_HANDS`) × `codici.length` frequenze, 3 decimali. */
  f: number[][];
  /** 169 × `codici.length` EV in big blind, 2 decimali. */
  e: number[][];
  /** 169 `hand_ev`, 2 decimali. */
  h: number[];
  /** Data ISO dell'esportazione: e' il `dateModified` della pagina. */
  esportato: string;
}
