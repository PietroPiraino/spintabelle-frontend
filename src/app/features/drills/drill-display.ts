// Helper di presentazione specifici dei drill, costruiti SOPRA quelli del
// viewer (preflop-display.ts) — niente duplicazione di logica di scoring/colori.
import {
  DrillActionLogEntry,
  DrillConfigPayload,
  DrillDifficulty,
  DrillQuestionAction,
  DrillSpotType,
  PreflopAction,
  PreflopFormat,
} from '../../core/models/api.models';
import {
  BASE_LABELS,
  actionColorMap,
  actionLabel,
  formatBb,
  parseFormat,
} from '../tables/preflop-display';

/** Le azioni della domanda sono un sottoinsieme strutturale di PreflopAction. */
function asActions(actions: DrillQuestionAction[]): PreflopAction[] {
  return actions as unknown as PreflopAction[];
}

/** Mappa codice→colore (token --act-*) per i pulsanti della domanda. */
export function drillColorMap(
  actions: DrillQuestionAction[],
): Record<string, string> {
  return actionColorMap(asActions(actions));
}

/** Etichetta leggibile di un'azione della domanda ("Raise 2bb", "All-in 25bb"). */
export function drillActionLabel(a: DrillQuestionAction): string {
  return actionLabel(a as unknown as PreflopAction);
}

/** Etichetta di una singola azione sul tavolo (da actionLog). Un call che
 *  pareggia solo il big blind è un LIMP. */
export function actionLogLabel(e: DrillActionLogEntry): string {
  if (e.type === 'FOLD') return 'Fold';
  if (e.type === 'CHECK') return 'Check';
  if (e.type === 'CALL') return e.betsize <= 1.0001 ? 'Limp' : 'Call';
  return e.display === 'ALLIN' ? 'All-in' : `Raise ${formatBb(e.betsize)} bb`;
}

/** Sequenza completa delle azioni di un giocatore, es. "Limp › Raise 12 bb". */
export function actionSeqLabel(entries: DrillActionLogEntry[]): string {
  return entries.map(actionLogLabel).join(' › ');
}

/** Etichetta di un passo della history (i codici non portano la size della call). */
export function historyStepLabel(code: string): string {
  if (code === 'F') return 'Fold';
  if (code === 'C') return 'Call';
  if (code === 'X') return 'Check';
  if (code === 'RAI') return 'All-in';
  const m = /^R(\d+(?:\.\d+)?)/.exec(code);
  if (m) return `Raise ${m[1].replace('.', ',')}`;
  return code;
}

/** "spin_asymmetric_ante" → "Spin & Go · Ante · Asimmetrico". */
export function formatLabel(format: PreflopFormat): string {
  const p = parseFormat(format);
  const parts: string[] = [BASE_LABELS[p.base]];
  if (p.ante) parts.push('Ante');
  if (p.asymmetric) parts.push('Asimmetrico');
  if (p.raiseSize) parts.push(`Raise ${p.raiseSize}`);
  return parts.join(' · ');
}

export const SPOT_TYPE_LABELS: Record<DrillSpotType, string> = {
  OPEN: 'Apertura (RFI)',
  VS_OPEN: 'Risposta all’apertura',
  VS_3BET: 'Risposta al 3-bet',
  VS_4BET_PLUS: '4-bet e oltre',
  LIMPED: 'Piatto limpato',
};

export const DIFFICULTY_LABELS: Record<DrillDifficulty, string> = {
  ALL: 'Tutte le mani',
  STANDARD: 'Standard',
  MIXED_ONLY: 'Solo mix',
  MARGINAL: 'Marginali',
};

/** Riassunto leggibile della config di una sessione (per lo storico). */
export function configSummary(c: DrillConfigPayload): string {
  const fmt = c.formats.length
    ? c.formats.map(formatLabel).join(', ')
    : 'Tutti i formati';
  const extra: string[] = [];
  if (c.positions.length) extra.push(c.positions.join('/'));
  if (c.spotTypes.length)
    extra.push(c.spotTypes.map((s) => SPOT_TYPE_LABELS[s]).join(', '));
  if (c.difficulty && c.difficulty !== 'STANDARD')
    extra.push(DIFFICULTY_LABELS[c.difficulty]);
  return [fmt, ...extra].join(' · ');
}

export const DIFFICULTY_HINTS: Record<DrillDifficulty, string> = {
  ALL: 'Ogni mano raggiunta, anche le pure banali.',
  STANDARD: 'Esclude i fold scontati e le mani che non arrivano mai qui.',
  MIXED_ONLY: 'Solo decisioni con strategia mista (le più istruttive).',
  MARGINAL: 'Solo i mix al fotofinish: gli spot più difficili.',
};
