import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  PreflopAction,
  PreflopFormat,
  PreflopMeta,
  PreflopNode,
} from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { PreflopService } from '../../core/services/preflop.service';
import {
  BASE_LABELS,
  PreflopBase,
  ShortSeat,
  actionColorMap,
  actionLabel,
  anteOffset,
  composeFormat,
  depthDisplay,
  displayActions,
  formatBb,
  formatEv,
  formatFreq,
  parseCombo,
  parseFormat,
} from './preflop-display';
import { RangeGridComponent } from './range-grid/range-grid.component';

/**
 * Una casella della timeline della mano: chi decideva, con che stack
 * (al netto di blind e puntate già versate), cosa ha scelto.
 * L'ultima casella è quella attiva: il giocatore che decide ora.
 */
interface TimelineStep {
  index: number;
  position: string;
  /** stack rimasto al momento di decidere, in bb */
  stack: number;
  /** azione scelta (null per la casella attiva, che deve ancora decidere) */
  label: string | null;
  colorVar: string | null;
  current: boolean;
}

/** blind forzati: contributi al piatto prima di qualsiasi decisione */
const BLINDS: Record<string, number> = { BTN: 0, SB: 0.5, BB: 1 };

interface DetailRow {
  label: string;
  colorVar: string;
  freq: string;
  ev: string;
  evSign: -1 | 0 | 1;
}

interface ShortValueOption {
  raw: string;
  value: number;
  label: string;
}

const DEFAULT_DEPTH = 25; // stack di partenza di uno Spin & Go

@Component({
  selector: 'app-tables',
  imports: [RouterLink, RangeGridComponent],
  templateUrl: './tables.component.html',
  styleUrl: './tables.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablesComponent {
  protected readonly auth = inject(AuthService);
  private readonly preflop = inject(PreflopService);
  private readonly router = inject(Router);

  // Query param legati dal router (withComponentInputBinding):
  // /tabelle?formato=spin&stack=25&azioni=R2-RAI&combo=25-25-12
  readonly formato = input<string>();
  readonly stack = input<string>();
  readonly azioni = input<string>();
  /** combinazione di stack BTN-SB-BB, solo per i formati asimmetrici */
  readonly combo = input<string>();

  protected readonly meta = signal<PreflopMeta | null>(null);
  protected readonly metaError = signal(false);
  protected readonly node = signal<PreflopNode | null>(null);
  protected readonly pathNodes = signal<PreflopNode[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  /** mano fissata con un click (resta selezionata navigando l'albero) */
  protected readonly selectedHand = signal<string | null>(null);
  protected readonly hoverHand = signal<string | null>(null);

  protected readonly baseLabels = BASE_LABELS;
  protected readonly formats = computed(() => this.meta()?.formats ?? []);

  protected readonly resolvedFormat = computed<PreflopFormat>(() => {
    const requested = this.formato();
    return (
      this.formats().find((f) => f.format === requested)?.format ?? 'spin'
    );
  });

  /** gioco base + varianti attive, derivati dal formato corrente */
  protected readonly parts = computed(() => parseFormat(this.resolvedFormat()));
  protected readonly isAsymmetric = computed(() => this.parts().asymmetric);

  /** giochi base disponibili nella meta (pill della toolbar) */
  protected readonly bases = computed<PreflopBase[]>(() => {
    const available = new Set(this.formats().map((f) => f.format));
    return (['spin', 'husng'] as PreflopBase[]).filter((b) =>
      available.has(b),
    );
  });

  // un interruttore è attivabile solo se la variante esiste nei dati
  protected readonly canToggleAnte = computed(() => {
    const p = this.parts();
    return (
      this.findFormat(p.base, p.asymmetric, !p.ante, p.raiseSize) !== null ||
      this.findFormat(p.base, p.asymmetric, !p.ante, null) !== null
    );
  });
  // gli stack asimmetrici non esistono in combinazione col raise-only:
  // attivando l'uno si spegne l'altro (gestito in toggle)
  protected readonly canToggleAsym = computed(() => {
    const p = this.parts();
    return (
      this.findFormat(p.base, !p.asymmetric, p.ante, null) !== null ||
      this.findFormat(p.base, !p.asymmetric, false, null) !== null
    );
  });
  protected readonly canToggleRaiseOnly = computed(() => {
    const p = this.parts();
    if (p.asymmetric) return false; // nessun asimmetrico raise-only nei dati
    return p.raiseSize
      ? this.hasFormat(composeFormat({ ...p, raiseSize: null }))
      : this.sizesFor(p.base, false, p.ante).length > 0;
  });

  /** taglie raise-only disponibili per il gioco/ante correnti (es. ["2x","2.5x"]) */
  protected readonly raiseSizes = computed(() => {
    const p = this.parts();
    return this.sizesFor(p.base, p.asymmetric, p.ante);
  });

  protected readonly depths = computed(() => {
    const list =
      this.formats().find((f) => f.format === this.resolvedFormat())?.depths ??
      [];
    // ordinamento numerico esplicito: lo stepper +/− assume la lista crescente
    return [...list].sort((a, b) => parseFloat(a) - parseFloat(b));
  });

  protected readonly resolvedDepth = computed<string | null>(() => {
    const list = this.depths();
    if (!list.length) return null;
    const requested = this.stack();
    if (requested && list.includes(requested)) return requested;
    return nearestDepth(list, requested ? parseFloat(requested) : DEFAULT_DEPTH);
  });

  protected readonly canPrevDepth = computed(() => this.depthIndex() > 0);
  protected readonly canNextDepth = computed(
    () => this.depthIndex() < this.depths().length - 1,
  );

  // ---- stato degli stack asimmetrici ----

  /** combinazione "BTN-SB-BB" risolta (undefined per i formati simmetrici) */
  protected readonly resolvedCombo = computed<string | undefined>(() => {
    const format = this.resolvedFormat();
    const depth = this.resolvedDepth();
    if (!parseFormat(format).asymmetric || !depth) return undefined;
    const list = this.combosAt(format, depth);
    if (!list.length) return undefined;
    const requested = this.combo();
    if (requested && list.includes(requested)) return requested;
    if (requested) {
      const pc = parseCombo(requested, format);
      return pickCombo(list, format, pc.short, pc.shortValue);
    }
    return pickCombo(list, format);
  });

  /** giocatore corto della combinazione corrente */
  protected readonly currentShort = computed<ShortSeat | null>(() => {
    const combo = this.resolvedCombo();
    return combo ? parseCombo(combo, this.resolvedFormat()).short : null;
  });

  /**
   * Asimmetria del nodo EFFETTIVAMENTE caricato (non del formato richiesto):
   * il badge la usa per non annunciare "BB corto 12" mentre a schermo c'è
   * ancora il vecchio nodo simmetrico, nella breve finestra di caricamento.
   */
  protected readonly loadedAsym = computed(() => {
    const n = this.node();
    return n && parseFormat(n.format).asymmetric
      ? parseCombo(n.stacks, n.format)
      : null;
  });

  /** posizioni che possono essere corte a questa profondità (pill SB/BB) */
  protected readonly shortSeats = computed<ShortSeat[]>(() => {
    const format = this.resolvedFormat();
    const depth = this.resolvedDepth();
    if (!depth) return [];
    const seats = new Set<ShortSeat>();
    for (const raw of this.combosAt(format, depth)) {
      seats.add(parseCombo(raw, format).short);
    }
    return (['SB', 'BB'] as ShortSeat[]).filter((s) => seats.has(s));
  });

  /** valori del corto disponibili per la posizione corrente (per il select) */
  protected readonly shortValues = computed<ShortValueOption[]>(() => {
    const format = this.resolvedFormat();
    const depth = this.resolvedDepth();
    const seat = this.currentShort();
    if (!depth || !seat) return [];
    return this.combosAt(format, depth)
      .map((raw) => parseCombo(raw, format))
      .filter((c) => c.short === seat)
      .sort((a, b) => a.shortValue - b.shortValue)
      .map((c) => ({
        raw: c.raw,
        value: c.shortValue,
        label: formatBb(c.shortValue),
      }));
  });

  private shortIndex(): number {
    const combo = this.resolvedCombo();
    return combo ? this.shortValues().findIndex((o) => o.raw === combo) : -1;
  }
  protected readonly canPrevShort = computed(() => this.shortIndex() > 0);
  protected readonly canNextShort = computed(
    () => this.shortIndex() < this.shortValues().length - 1,
  );

  protected readonly colorMap = computed(() =>
    actionColorMap(this.node()?.actions ?? []),
  );

  /** Azioni del nodo in ordine di visualizzazione (all-in → fold). */
  protected readonly nodeActions = computed(() =>
    displayActions(this.node()?.actions ?? []),
  );

  protected readonly timeline = computed<TimelineStep[]>(() => {
    const current = this.node();
    const nodes = this.pathNodes();
    if (!current) return [];
    // gli stack nei dati sono quelli iniziali (per posizione: negli
    // asimmetrici differiscono); il residuo si ricava dai versamenti di
    // ciascuno — l'ante (dedotta dal piatto alla radice), il blind, poi il
    // betsize dell'ultima azione (importo TOTALE portato nel piatto)
    const root = nodes[0];
    const ante = root
      ? Math.max(0, (root.pot - 1.5) / root.players.length)
      : 0;
    const bets: Record<string, number> = { ...BLINDS };
    const initialStack = (pos: string) =>
      current.players.find((p) => p.position === pos)?.stack ?? current.depth;
    const remaining = (pos: string) =>
      initialStack(pos) - ante - (bets[pos] ?? 0);

    const steps: TimelineStep[] = current.history.map((code, i) => {
      const at = nodes[i];
      const pos = at?.active_position ?? '';
      const stack = remaining(pos);
      const action = at?.actions.find((a) => a.code === code);
      if (action && pos) {
        bets[pos] = Math.max(bets[pos] ?? 0, action.betsize);
      }
      return {
        index: i,
        position: pos,
        stack,
        label: action ? actionLabel(action) : code,
        colorVar: at && action ? actionColorMap(at.actions)[code] : null,
        current: false,
      };
    });

    // la casella attiva: chi decide nel nodo corrente
    const pos = current.active_position;
    steps.push({
      index: current.history.length,
      position: pos,
      stack: remaining(pos),
      label: null,
      colorVar: null,
      current: true,
    });
    return steps;
  });

  /** Mano mostrata nel pannello di dettaglio: hover momentaneo o selezione fissata. */
  protected readonly detailHand = computed(
    () => this.hoverHand() ?? this.selectedHand(),
  );

  protected readonly detail = computed(() => {
    const node = this.node();
    const hand = this.detailHand();
    const data = node && hand ? node.hands[hand] : null;
    if (!node || !hand || !data) return null;
    const colors = this.colorMap();
    const rows: DetailRow[] = displayActions(node.actions).map((a) => {
      const ev = data.ev[a.code] ?? 0;
      return {
        label: actionLabel(a),
        colorVar: colors[a.code],
        freq: formatFreq(data.freq[a.code] ?? 0),
        ev: formatEv(ev),
        evSign: ev > 0.005 ? 1 : ev < -0.005 ? -1 : 0,
      };
    });
    const reached = Object.values(data.freq).some((f) => f > 0.0005);
    return {
      hand,
      rows,
      reached,
      handEv: formatEv(data.hand_ev),
      handEvSign: data.hand_ev > 0.005 ? 1 : data.hand_ev < -0.005 ? -1 : 0,
    };
  });

  /** Pulsanti azione (e legenda): colore, etichetta e frequenza di range. */
  protected readonly actionButtons = computed(() => {
    const colors = this.colorMap();
    return this.nodeActions().map((a) => ({
      action: a,
      label: actionLabel(a),
      colorVar: colors[a.code],
      freq: formatFreq(a.total_freq),
    }));
  });

  /** celle segnaposto per lo scheletro di caricamento */
  protected readonly skeletonCells = Array.from({ length: 169 }, (_, i) => i);

  private loadSeq = 0;

  constructor() {
    // La meta serve a popolare i selettori: parte appena l'utente è loggato
    effect(() => {
      if (!this.auth.user() || this.meta() || this.metaError()) return;
      untracked(() =>
        this.preflop.getMeta().subscribe({
          next: (m) => this.meta.set(m),
          error: () => this.metaError.set(true),
        }),
      );
    });

    // Ricarica il nodo a ogni cambio di formato / stack / combo / azioni
    effect(() => {
      const meta = this.meta();
      const user = this.auth.user();
      const format = this.resolvedFormat();
      const depth = this.resolvedDepth();
      const combo = this.resolvedCombo();
      const path = this.azioni() ?? '';
      if (!meta || !user || !depth) return;
      if (parseFormat(format).asymmetric) {
        if (!combo) return; // attende che resolvedCombo sia disponibile
        // URL con combo assente o non valida: la si allinea senza ricaricare due volte
        if (this.combo() !== combo) {
          untracked(() => this.navigate(format, depth, path, combo, true));
          return;
        }
      }
      untracked(() => this.load(format, depth, path, combo));
    });
  }

  private load(
    format: PreflopFormat,
    depth: string,
    path: string,
    combo?: string,
  ): void {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.error.set(false);
    // nodo corrente + tutti i prefissi del percorso (etichette del breadcrumb);
    // in navigazione normale sono già tutti in cache
    const prefixes = pathPrefixes(path);
    forkJoin(
      prefixes.map((p) => this.preflop.getNode(format, depth, p, combo)),
    ).subscribe({
      next: (nodes) => {
        if (seq !== this.loadSeq) return;
        const current = nodes[nodes.length - 1];
        this.pathNodes.set(nodes);
        this.node.set(current);
        this.loading.set(false);
        this.preflop.prefetchChildren(current);
      },
      error: (err: unknown) => {
        if (seq !== this.loadSeq) return;
        const status = (err as { status?: number })?.status;
        if (status === 404 && path) {
          // percorso inesistente a questa profondità (le size cambiano):
          // si riparte dalla radice della stessa tabella
          this.navigate(format, depth, '', combo, true);
          return;
        }
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  private navigate(
    format: PreflopFormat,
    depth: string,
    path: string,
    combo?: string,
    replaceUrl = false,
  ): void {
    void this.router.navigate([], {
      queryParams: {
        formato: format,
        stack: depth,
        azioni: path || null,
        combo: combo ?? null,
      },
      replaceUrl,
    });
  }

  // ---- toolbar ----

  protected setBase(base: PreflopBase): void {
    const p = this.parts();
    if (base === p.base) return;
    // mantiene le varianti compatibili col nuovo gioco, scartando quelle
    // che lì non esistono (es. raise only / asimmetrico passando a Heads-Up)
    const target =
      this.findFormat(base, p.asymmetric, p.ante, p.raiseSize) ??
      this.findFormat(base, false, p.ante, p.raiseSize) ??
      this.findFormat(base, false, false, null);
    if (!target) return;
    // gioco diverso: percorso azzerato, stack equivalente mantenuto
    const depth = this.mappedDepth(target);
    this.navigate(target, depth, '', this.comboFor(target, depth));
  }

  protected toggleAnte(): void {
    const p = this.parts();
    const target =
      this.findFormat(p.base, p.asymmetric, !p.ante, p.raiseSize) ??
      this.findFormat(p.base, p.asymmetric, !p.ante, null);
    if (target) this.switchVariant(target);
  }

  protected toggleAsymmetric(): void {
    const p = this.parts();
    // gli asimmetrici non hanno raise-only: attivandoli la taglia si azzera
    const target =
      this.findFormat(p.base, !p.asymmetric, p.ante, null) ??
      this.findFormat(p.base, !p.asymmetric, false, null);
    if (!target) return;
    // l'albero cambia (stack diversi): il percorso si azzera
    const depth = this.mappedDepth(target);
    this.navigate(target, depth, '', this.comboFor(target, depth));
  }

  protected toggleRaiseOnly(): void {
    const p = this.parts();
    if (p.raiseSize) {
      this.switchVariant(composeFormat({ ...p, raiseSize: null }));
      return;
    }
    const sizes = this.sizesFor(p.base, p.asymmetric, p.ante);
    const size = sizes.includes('2x') ? '2x' : sizes[0];
    if (size) this.switchVariant(composeFormat({ ...p, raiseSize: size }));
  }

  protected setRaiseSize(size: string): void {
    const p = this.parts();
    if (size === p.raiseSize) return;
    this.switchVariant(composeFormat({ ...p, raiseSize: size }));
  }

  /** Cambio di variante (stessa famiglia): stack/combo equivalenti e percorso mantenuti. */
  private switchVariant(target: PreflopFormat): void {
    if (!this.hasFormat(target)) return;
    const depth = this.mappedDepth(target);
    const combo = this.comboFor(
      target,
      depth,
      this.currentShort() ?? undefined,
      this.currentShortValue(),
    );
    this.navigate(target, depth, this.azioni() ?? '', combo);
  }

  // ---- selettore degli stack asimmetrici ----

  protected setShortSeat(seat: ShortSeat): void {
    if (seat === this.currentShort()) return;
    const format = this.resolvedFormat();
    const depth = this.resolvedDepth();
    if (!depth) return;
    const combo = this.comboFor(format, depth, seat, this.currentShortValue());
    // cambia la situazione: il percorso si azzera
    this.navigate(format, depth, '', combo);
  }

  protected onShortChange(event: Event): void {
    this.setShortCombo((event.target as HTMLSelectElement).value);
  }

  protected stepShort(dir: -1 | 1): void {
    const next = this.shortValues()[this.shortIndex() + dir];
    if (next) this.setShortCombo(next.raw);
  }

  private setShortCombo(raw: string): void {
    if (raw === this.resolvedCombo()) return;
    // diverso stack del corto = diversa soluzione: percorso azzerato
    this.navigate(this.resolvedFormat(), this.resolvedDepth()!, '', raw);
  }

  protected currentShortValue(): number {
    const combo = this.resolvedCombo();
    return combo ? parseCombo(combo, this.resolvedFormat()).shortValue : 0;
  }

  // ---- profondità ----

  protected depthLabel(depth: string): string {
    return depthDisplay(depth, this.resolvedFormat());
  }

  protected setDepth(depth: string): void {
    if (!depth || depth === this.resolvedDepth()) return;
    const format = this.resolvedFormat();
    const combo = this.comboFor(
      format,
      depth,
      this.currentShort() ?? undefined,
      this.currentShortValue(),
    );
    // il percorso si tenta di mantenere: se a questa profondità non esiste,
    // load() ripiega sulla radice
    this.navigate(format, depth, this.azioni() ?? '', combo);
  }

  protected onDepthChange(event: Event): void {
    this.setDepth((event.target as HTMLSelectElement).value);
  }

  protected stepDepth(dir: -1 | 1): void {
    const next = this.depths()[this.depthIndex() + dir];
    if (next) this.setDepth(next);
  }

  // ---- navigazione dell'albero ----

  protected onAction(action: PreflopAction): void {
    const node = this.node();
    if (!node || action.is_terminal) return;
    const path = node.preflop_actions
      ? `${node.preflop_actions}-${action.code}`
      : action.code;
    this.navigate(
      node.format,
      node.depth_label,
      path,
      this.resolvedCombo(),
    );
  }

  /** Torna allo stato dopo le prime `count` azioni (0 = inizio mano). */
  protected crumbTo(count: number): void {
    const node = this.node();
    if (!node || count >= node.history.length) return;
    this.navigate(
      this.resolvedFormat(),
      this.resolvedDepth() ?? node.depth_label,
      node.history.slice(0, count).join('-'),
      this.resolvedCombo(),
    );
  }

  protected onHandPick(hand: string): void {
    // click sulla mano già selezionata = deseleziona
    this.selectedHand.update((curr) => (curr === hand ? null : hand));
  }

  protected retry(): void {
    const depth = this.resolvedDepth();
    if (this.metaError()) {
      this.metaError.set(false); // l'effect della meta riparte
      return;
    }
    if (depth) {
      this.load(
        this.resolvedFormat(),
        depth,
        this.azioni() ?? '',
        this.resolvedCombo(),
      );
    }
  }

  protected formatBbLabel(value: number | string): string {
    return formatBb(value);
  }

  // ---- helper privati ----

  private hasFormat(format: PreflopFormat): boolean {
    return this.formats().some((f) => f.format === format);
  }

  /** combinazioni "BTN-SB-BB" disponibili per (formato, profondità) */
  private combosAt(format: PreflopFormat, depth: string): string[] {
    return (
      this.formats().find((f) => f.format === format)?.stacksByDepth?.[depth] ??
      []
    );
  }

  /**
   * La combinazione di stack da usare per (formato, profondità): preserva
   * posizione e valore del corto quando possibile. undefined per i simmetrici.
   */
  private comboFor(
    format: PreflopFormat,
    depth: string,
    preferShort?: ShortSeat,
    preferValue?: number,
  ): string | undefined {
    if (!parseFormat(format).asymmetric) return undefined;
    const list = this.combosAt(format, depth);
    if (!list.length) return undefined;
    return pickCombo(list, format, preferShort, preferValue);
  }

  /** taglie raise-only esistenti nella meta per (gioco, asimmetrico, ante) */
  private sizesFor(
    base: PreflopBase,
    asymmetric: boolean,
    ante: boolean,
  ): string[] {
    const sizes = new Set<string>();
    for (const f of this.formats()) {
      const p = parseFormat(f.format);
      if (
        p.base === base &&
        p.asymmetric === asymmetric &&
        p.ante === ante &&
        p.raiseSize
      ) {
        sizes.add(p.raiseSize);
      }
    }
    return [...sizes].sort((a, b) => parseFloat(a) - parseFloat(b));
  }

  /**
   * Il miglior formato esistente con le varianti richieste: stessa taglia di
   * raise-only se c'è, altrimenti un'altra taglia, altrimenti albero completo.
   */
  private findFormat(
    base: PreflopBase,
    asymmetric: boolean,
    ante: boolean,
    preferredSize: string | null,
  ): PreflopFormat | null {
    const sizes = preferredSize
      ? [
          preferredSize,
          ...this.sizesFor(base, asymmetric, ante).filter(
            (s) => s !== preferredSize,
          ),
        ]
      : [];
    const candidates = [
      ...sizes.map((s) => composeFormat({ base, asymmetric, ante, raiseSize: s })),
      composeFormat({ base, asymmetric, ante, raiseSize: null }),
    ];
    return candidates.find((f) => this.hasFormat(f)) ?? null;
  }

  /**
   * La profondità del formato di destinazione equivalente a quella corrente,
   * al netto degli offset ante (es. spin 10 → spin_ante "10.17").
   */
  private mappedDepth(target: PreflopFormat): string {
    const list = this.formats().find((f) => f.format === target)?.depths ?? [];
    const current = this.resolvedDepth();
    if (!list.length) return current ?? String(DEFAULT_DEPTH);
    const baseValue = current
      ? parseFloat(current) - anteOffset(this.resolvedFormat())
      : DEFAULT_DEPTH;
    return nearestDepth(list, baseValue + anteOffset(target));
  }

  private depthIndex(): number {
    const depth = this.resolvedDepth();
    return depth ? this.depths().indexOf(depth) : -1;
  }
}

/** ['', 'R2', 'R2-RAI'] per "R2-RAI": tutti i nodi dalla radice inclusa. */
function pathPrefixes(path: string): string[] {
  if (!path) return [''];
  const codes = path.split('-');
  return ['', ...codes.map((_, i) => codes.slice(0, i + 1).join('-'))];
}

/** La profondità della lista più vicina al valore richiesto. */
function nearestDepth(list: string[], target: number): string {
  let best = list[0];
  let bestDist = Math.abs(parseFloat(best) - target);
  for (const d of list) {
    const dist = Math.abs(parseFloat(d) - target);
    if (dist < bestDist) {
      best = d;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Sceglie una combinazione di stack dalla lista, preservando posizione e
 * valore del corto quando indicati. Default: BB corto, valore più alto
 * (combinazione più vicina al simmetrico, ingresso più morbido).
 */
function pickCombo(
  list: string[],
  format: PreflopFormat,
  preferShort?: ShortSeat,
  preferValue?: number,
): string {
  const parsed = list.map((raw) => parseCombo(raw, format));
  const choose = (pool: typeof parsed): string => {
    if (preferValue != null) {
      return pool.reduce((best, c) =>
        Math.abs(c.shortValue - preferValue) <
        Math.abs(best.shortValue - preferValue)
          ? c
          : best,
      ).raw;
    }
    // default: valore mediano del corto — uno spot rappresentativo,
    // né quasi-simmetrico (corto vicino al deep) né l'estremo cortissimo
    const sorted = [...pool].sort((a, b) => a.shortValue - b.shortValue);
    return sorted[Math.floor((sorted.length - 1) / 2)].raw;
  };
  if (preferShort) {
    const pool = parsed.filter((c) => c.short === preferShort);
    if (pool.length) return choose(pool);
  }
  const bb = parsed.filter((c) => c.short === 'BB');
  return choose(bb.length ? bb : parsed);
}
