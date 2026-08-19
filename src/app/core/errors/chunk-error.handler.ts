import { isPlatformBrowser } from '@angular/common';
import {
  ErrorHandler,
  Injectable,
  InjectionToken,
  PLATFORM_ID,
  inject,
} from '@angular/core';

/**
 * Firme dei fallimenti di caricamento di un chunk lazy. Cambiano col bundler e
 * col browser, quindi si riconoscono per messaggio e non per tipo:
 * - Vite/esbuild (il nostro build): "Failed to fetch dynamically imported module"
 *   (Chrome) e "error loading dynamically imported module" (Firefox/Safari);
 * - webpack e alcuni polyfill: `ChunkLoadError`.
 */
const ERRORE_CHUNK =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|ChunkLoadError/i;

/** Flag anti-loop: sessionStorage, quindi per-scheda e non persistente. */
export const CHUNK_RELOAD_FLAG = 'bff-chunk-reload';

/**
 * Il ricaricamento della pagina, iniettabile: nei test un `location.reload()`
 * vero ricaricherebbe il runner di Karma (e la spec del non-loop sarebbe
 * impossibile da scrivere).
 */
export const RELOAD_PAGE = new InjectionToken<() => void>('RELOAD_PAGE', {
  providedIn: 'root',
  factory: () => () => location.reload(),
});

/**
 * ErrorHandler globale: registra l'errore come farebbe Angular e, quando è un
 * fallimento di chunk, ricarica la pagina UNA SOLA VOLTA.
 *
 * Perché: ogni deploy ruota i nomi (con hash) dei chunk. Una scheda rimasta
 * aperta sulla shell vecchia chiede un file che su Cloudflare non esiste più →
 * l'import dinamico della rotta lazy fallisce e il click resta muto, senza
 * alcun messaggio. Ricaricare prende la shell nuova e la navigazione riparte.
 *
 * ⚠️ Il flag in sessionStorage NON è prudenza teorica: se il chunk manca anche
 * dopo il reload (deploy a metà, cache dell'edge incoerente) senza il flag la
 * pagina si ricaricherebbe all'infinito. Se sessionStorage non è disponibile
 * (Safari privato, storage disabilitato) NON si ricarica: senza il flag non si
 * può garantire "una sola volta", e un loop è peggio di un click muto.
 * Il flag resta per tutta la vita della scheda: un secondo deploy nella stessa
 * sessione non ottiene un secondo reload — comportamento identico a quello di
 * oggi (nessun recupero), mai un loop.
 */
@Injectable()
export class ChunkErrorHandler implements ErrorHandler {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly reload = inject(RELOAD_PAGE);

  handleError(error: unknown): void {
    // Come l'ErrorHandler di default: l'errore finisce comunque in console
    // (e quindi negli strumenti di diagnosi), reload o no.
    console.error(error);
    if (!this.isBrowser || !isChunkError(error)) return;
    if (!claimReload()) return;
    this.reload();
  }
}

/**
 * L'errore arriva in forme diverse a seconda di chi lo consegna: il router lo
 * passa nudo, `provideBrowserGlobalErrorListeners` passa `e.reason` di una
 * promise rifiutata oppure un `Error` con l'ErrorEvent originale in `cause`.
 * Si guardano quindi anche i livelli annidati, con un tetto di profondità.
 */
export function isChunkError(error: unknown): boolean {
  return ERRORE_CHUNK.test(testoErrore(error));
}

function testoErrore(error: unknown, profondita = 0): string {
  if (error == null) return '';
  if (typeof error === 'string') return error;
  if (profondita > 3) return '';
  const e = error as Record<string, unknown>;
  const annidati = ['error', 'rejection', 'reason', 'cause'] as const;
  return [
    typeof e['name'] === 'string' ? e['name'] : '',
    typeof e['message'] === 'string' ? e['message'] : '',
    ...annidati.map((k) => testoErrore(e[k], profondita + 1)),
  ]
    .filter(Boolean)
    .join(' ');
}

/** Prenota l'unico reload consentito nella scheda. `false` = già speso. */
function claimReload(): boolean {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_FLAG)) return false;
    sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
    return true;
  } catch {
    return false;
  }
}
