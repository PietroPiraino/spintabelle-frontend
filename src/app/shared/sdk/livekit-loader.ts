import { InjectionToken } from '@angular/core';

type LiveKitModule = typeof import('livekit-client');

let livekitPromise: Promise<LiveKitModule> | null = null;

/**
 * Import dinamico di livekit-client, memoizzato: il chunk pesante del client
 * WebRTC è caricato solo quando si entra in una stanza on-site.
 */
export function loadLiveKit(): Promise<LiveKitModule> {
  livekitPromise ??= import('livekit-client');
  return livekitPromise;
}

/**
 * Loader iniettabile: nei test si sostituisce con uno stub così il componente
 * stanza non apre mai una connessione WebRTC reale (ChromeHeadless senza media).
 */
export const LIVEKIT_LOADER = new InjectionToken<() => Promise<LiveKitModule>>(
  'LIVEKIT_LOADER',
  { providedIn: 'root', factory: () => loadLiveKit },
);
