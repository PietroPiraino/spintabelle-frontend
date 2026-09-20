import type { ResolveFn } from '@angular/router';
import type { PreflopNode } from '../../../core/models/api.models';
import { espandiNodo } from './situazioni';
import { CARICATORI } from './situazioni.caricatori';

/** Cio' che il resolver consegna alla pagina: il nodo espanso e la data dell'export (dateModified). */
export interface SituazioneRisolta {
  nodo: PreflopNode;
  esportato: string;
}

/**
 * Carica il nodo GTO della situazione PRIMA che il componente renda.
 *
 * ⚠️ Un resolver e non un `import()` nel componente (ne' `PendingTasks`, che
 * il markdown usa per un altro motivo): l'import dinamico dentro un componente
 * e' sicuro in prerender ma NON all'idratazione — il client rifarebbe il
 * caricamento dopo il primo render, che uscirebbe senza griglia, e le 169
 * celle dell'HTML statico non combacerebbero con il DOM del client (NG0500).
 * Il router aspetta i resolver in entrambi i casi: i dati ci sono al primo
 * render, in prerender e nel browser. Con `withComponentInputBinding()` il
 * risultato arriva al componente come `input()` `dati`.
 *
 * Slug ignoto → `null`: il componente rende il ramo vuoto (in produzione
 * Cloudflare risponde 404 prima, `PrerenderFallback.None`).
 */
export const nodoSituazioneResolver: ResolveFn<SituazioneRisolta | null> =
  async (route) => {
    const carica = CARICATORI[route.paramMap.get('slug') ?? ''];
    if (!carica) return null;
    const { NODO } = await carica();
    return { nodo: espandiNodo(NODO), esportato: NODO.esportato };
  };
