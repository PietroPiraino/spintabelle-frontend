import type { PreflopAction, PreflopNode } from '../../../core/models/api.models';
import {
  MATRIX_HANDS,
  actionColorMap,
  actionLabel,
  displayActions,
} from '../preflop-display';

/**
 * Le statistiche di un nodo GTO, calcolate a RUNTIME da un modulo puro: una
 * sola implementazione (non nell'esportatore), provata in Karma, la stessa
 * per il testo generato e per la pagina.
 */

/** Soglia sotto cui una mano non arriva al nodo (idioma `UNREACHED_FREQ` dei drill). */
const NON_RAGGIUNTA = 0.01;
/** Una mano e' «pura» per un'azione se la gioca cosi' (quasi) sempre. */
const PURA = 0.995;
/**
 * Una mano e' «al confine» fra giocare e passare se la sua azione migliore
 * diversa dal fold vale, in assoluto, meno di questo (in bb): il fold vale
 * zero, quindi e' la distanza dal punto di indifferenza.
 */
export const SOGLIA_CONFINE = 0.05;

const RANKS = 'AKQJT98765432';

/** Combinazioni di una mano: 6 per una coppia, 4 per una suited, 12 per una offsuit. */
export function combinazioni(mano: string): number {
  return mano.length === 2 ? 6 : mano.endsWith('s') ? 4 : 12;
}

export const COMBINAZIONI_TOTALI = MATRIX_HANDS.reduce(
  (s, m) => s + combinazioni(m),
  0,
); // 1326

export interface AzioneStat {
  code: string;
  label: string;
  tipo: PreflopAction['type'] | 'ALLIN';
  /** nome della custom property del colore (`--act-*`) */
  colore: string;
  /** quota delle 1.326 combinazioni giocate cosi' (0..1) */
  quotaCombo: number;
  /** mani in cui questa e' l'azione piu' frequente */
  maniDominanti: number;
  /** mani giocate cosi' (quasi) sempre, dalla piu' forte per EV */
  maniPure: string[];
  /** notazione compatta delle mani pure: «22+, A2s+, K9s+…» */
  notazione: string;
}

export interface ManoMista {
  mano: string;
  parti: { code: string; freq: number }[];
}

export interface ManoAlConfine {
  mano: string;
  /** l'azione migliore diversa dal fold */
  azione: string;
  /** il suo EV in bb: appena sopra zero se si gioca, appena sotto se si passa */
  ev: number;
}

/**
 * Il confine fra giocare e passare. ⚠️ Non «le due azioni migliori distano
 * poco»: in questo dataset l'EV di un'azione non giocata e' spesso IDENTICO a
 * quello dell'azione giocata (AKs a 10 bb: raise 2,10, all-in 2,10), quindi
 * quel criterio dava 127 mani «al margine» su 142 pure — vero e inutile. Il
 * confine che conta e' quello col fold, che vale zero per definizione.
 */
export interface Confine {
  /** le mani piu' deboli che si giocano ancora (EV appena sopra zero) */
  giocate: ManoAlConfine[];
  /** le mani piu' forti che si passano (l'alternativa migliore vale appena meno di zero) */
  passate: ManoAlConfine[];
  /** quante mani stanno entro SOGLIA_CONFINE dal confine, in entrambi i versi */
  quante: number;
}

export interface Statistiche {
  azioni: AzioneStat[];
  maniMiste: ManoMista[];
  /** `null` quando il nodo non ha un fold (il big blind che puo' checkare) */
  confine: Confine | null;
  /** mani che non arrivano mai a questo nodo (gia' scartate prima) */
  nonRaggiunte: number;
  /** EV medio del range al nodo, pesato per combinazioni, in bb */
  evMedio: number;
}

export function statistiche(node: PreflopNode): Statistiche {
  const azioni = displayActions(node.actions);
  const colori = actionColorMap(node.actions);
  const perAzione = new Map<string, { combo: number; dominanti: number; pure: { mano: string; ev: number }[] }>();
  for (const a of azioni) perAzione.set(a.code, { combo: 0, dominanti: 0, pure: [] });

  const miste: ManoMista[] = [];
  const fold = azioni.find((a) => a.type === 'FOLD');
  const giocate: ManoAlConfine[] = [];
  const passate: ManoAlConfine[] = [];
  let nonRaggiunte = 0;
  let evPesato = 0;
  let comboRaggiunte = 0;

  for (const mano of MATRIX_HANDS) {
    const d = node.hands[mano];
    const c = combinazioni(mano);
    const totale = azioni.reduce((s, a) => s + (d?.freq[a.code] ?? 0), 0);
    if (!d || totale < NON_RAGGIUNTA) {
      nonRaggiunte++;
      continue;
    }
    comboRaggiunte += c;
    evPesato += c * d.hand_ev;

    let dominante = azioni[0];
    let freqDominante = -1;
    const parti: { code: string; freq: number }[] = [];
    for (const a of azioni) {
      const f = (d.freq[a.code] ?? 0) / totale;
      const stat = perAzione.get(a.code)!;
      stat.combo += c * f;
      if (f > freqDominante) {
        freqDominante = f;
        dominante = a;
      }
      if (f >= PURA) stat.pure.push({ mano, ev: d.ev[a.code] ?? 0 });
      if (f >= 0.005) parti.push({ code: a.code, freq: f });
    }
    perAzione.get(dominante.code)!.dominanti++;
    if (freqDominante < PURA) miste.push({ mano, parti });

    // Il confine col fold: la migliore azione diversa dal fold e il suo EV.
    if (fold) {
      const alternative = azioni
        .filter((a) => a.type !== 'FOLD')
        .map((a) => ({ code: a.code, ev: d.ev[a.code] ?? -Infinity }))
        .filter((x) => Number.isFinite(x.ev))
        .sort((x, y) => y.ev - x.ev);
      if (alternative.length) {
        const m = { mano, azione: alternative[0].code, ev: alternative[0].ev };
        if (dominante.type === 'FOLD') passate.push(m);
        else giocate.push(m);
      }
    }
  }

  return {
    azioni: azioni.map((a) => {
      const stat = perAzione.get(a.code)!;
      const pure = [...stat.pure].sort((x, y) => y.ev - x.ev).map((x) => x.mano);
      return {
        code: a.code,
        label: actionLabel(a),
        tipo: a.display === 'ALLIN' ? 'ALLIN' : a.type,
        colore: colori[a.code],
        quotaCombo: stat.combo / COMBINAZIONI_TOTALI,
        maniDominanti: stat.dominanti,
        maniPure: pure,
        notazione: notazioneRange(pure),
      };
    }),
    maniMiste: miste,
    confine: fold
      ? {
          giocate: giocate.sort((x, y) => x.ev - y.ev).slice(0, 5),
          passate: passate.sort((x, y) => y.ev - x.ev).slice(0, 5),
          quante:
            giocate.filter((x) => Math.abs(x.ev) < SOGLIA_CONFINE).length +
            passate.filter((x) => Math.abs(x.ev) < SOGLIA_CONFINE).length,
        }
      : null,
    nonRaggiunte,
    evMedio: comboRaggiunte ? evPesato / comboRaggiunte : 0,
  };
}

/**
 * Notazione compatta di un insieme di mani: «77+, A2s+, KTs+, QJs, A9o+».
 * Per gruppo (coppie; suited e offsuit per carta alta) si prendono le mani
 * presenti in ordine decrescente e si compattano le sequenze contigue: una
 * sequenza che parte dalla cima del gruppo e' «X+», una nel mezzo «X-Y», una
 * mano sola resta com'e'.
 */
export function notazioneRange(mani: readonly string[]): string {
  const presenti = new Set(mani);
  const pezzi: string[] = [];

  const sequenze = (elenco: string[]): string[] => {
    const out: string[] = [];
    let i = 0;
    while (i < elenco.length) {
      if (!presenti.has(elenco[i])) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < elenco.length && presenti.has(elenco[j + 1])) j++;
      // «X+» solo per una sequenza di almeno due mani che parte dalla cima:
      // «T9s+» da solo si leggerebbe come i connettori suited verso l'alto.
      if (i === 0 && j > i) out.push(`${elenco[j]}+`);
      else if (j === i) out.push(elenco[i]);
      else out.push(`${elenco[i]}-${elenco[j]}`);
      i = j + 1;
    }
    return out;
  };

  pezzi.push(...sequenze([...RANKS].map((r) => r + r)));
  for (const suffisso of ['s', 'o'] as const) {
    for (let a = 0; a < RANKS.length - 1; a++) {
      const alta = RANKS[a];
      const gruppo: string[] = [];
      for (let b = a + 1; b < RANKS.length; b++) gruppo.push(`${alta}${RANKS[b]}${suffisso}`);
      pezzi.push(...sequenze(gruppo));
    }
  }
  return pezzi.join(', ');
}
