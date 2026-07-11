/// <reference lib="webworker" />
// Web Worker: esegue la simulazione fuori dal thread UI (la UI resta reattiva).

import { runSimulation } from './sim-engine';
import type { SimConfig } from './types';

interface RunMessage {
  readonly type: 'run';
  readonly config: SimConfig;
}

addEventListener('message', ({ data }: MessageEvent<RunMessage>) => {
  if (!data || data.type !== 'run') return;
  try {
    const result = runSimulation(data.config, (frac) => {
      postMessage({ type: 'progress', frac });
    });
    postMessage({ type: 'result', result });
  } catch (e) {
    postMessage({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
});
