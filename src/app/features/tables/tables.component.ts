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
  actionColorMap,
  actionLabel,
  anteOffset,
  composeFormat,
  depthDisplay,
  displayActions,
  formatBb,
  formatEv,
  formatFreq,
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
  // /tabelle?formato=spin&stack=25&azioni=R2-RAI → link condivisibili
  readonly formato = input<string>();
  readonly stack = input<string>();
  readonly azioni = input<string>();

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

  /** giochi base disponibili nella meta (pill della toolbar) */
  protected readonly bases = computed<PreflopBase[]>(() => {
    const available = new Set(this.formats().map((f) => f.format));
    return (['spin', 'husng'] as PreflopBase[]).filter((b) =>
      available.has(b),
    );
  });

  // un interruttore è attivabile solo se la variante esiste nei dati
  // (es. raise only non esiste su Heads-Up; ante solo dopo il nuovo import)
  protected readonly canToggleAnte = computed(() => {
    const p = this.parts();
    return this.hasFormat(composeFormat({ ...p, ante: !p.ante }));
  });
  protected readonly canToggleRaiseOnly = computed(() => {
    const p = this.parts();
    return this.hasFormat(composeFormat({ ...p, raiseOnly: !p.raiseOnly }));
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

  protected readonly canPrevDepth = computed(
    () => this.depthIndex() > 0,
  );
  protected readonly canNextDepth = computed(
    () => this.depthIndex() < this.depths().length - 1,
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
    // gli stack nei dati sono quelli iniziali: il residuo si ricava dai
    // versamenti di ciascuno — l'ante (dedotta dal piatto alla radice:
    // tutto ciò che eccede i blind), il blind, poi il betsize dell'ultima
    // azione (che nei dati è l'importo TOTALE portato nel piatto)
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

    // Ricarica il nodo a ogni cambio di formato / stack / percorso azioni
    effect(() => {
      const meta = this.meta();
      const user = this.auth.user();
      const format = this.resolvedFormat();
      const depth = this.resolvedDepth();
      const path = this.azioni() ?? '';
      if (!meta || !user || !depth) return;
      untracked(() => this.load(format, depth, path));
    });
  }

  private load(format: PreflopFormat, depth: string, path: string): void {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.error.set(false);
    // nodo corrente + tutti i prefissi del percorso (etichette del breadcrumb);
    // in navigazione normale sono già tutti in cache
    const prefixes = pathPrefixes(path);
    forkJoin(
      prefixes.map((p) => this.preflop.getNode(format, depth, p)),
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
          this.navigate(format, depth, '', true);
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
    replaceUrl = false,
  ): void {
    void this.router.navigate([], {
      queryParams: {
        formato: format,
        stack: depth,
        azioni: path || null,
      },
      replaceUrl,
    });
  }

  protected setBase(base: PreflopBase): void {
    const p = this.parts();
    if (base === p.base) return;
    // mantiene le varianti compatibili col nuovo gioco, scartando quelle
    // che lì non esistono (es. raise only passando a Heads-Up)
    const candidates: PreflopFormat[] = [
      composeFormat({ base, ante: p.ante, raiseOnly: p.raiseOnly }),
      composeFormat({ base, ante: p.ante, raiseOnly: false }),
      composeFormat({ base, ante: false, raiseOnly: false }),
    ];
    const target = candidates.find((f) => this.hasFormat(f));
    if (!target) return;
    // gioco diverso: percorso azzerato, stack equivalente mantenuto
    this.navigate(target, this.mappedDepth(target), '');
  }

  protected toggleAnte(): void {
    const p = this.parts();
    this.switchVariant(composeFormat({ ...p, ante: !p.ante }));
  }

  protected toggleRaiseOnly(): void {
    const p = this.parts();
    this.switchVariant(composeFormat({ ...p, raiseOnly: !p.raiseOnly }));
  }

  /** Cambio di variante: stack equivalente e percorso mantenuti (404 → radice). */
  private switchVariant(target: PreflopFormat): void {
    if (!this.hasFormat(target)) return;
    this.navigate(target, this.mappedDepth(target), this.azioni() ?? '');
  }

  private hasFormat(format: PreflopFormat): boolean {
    return this.formats().some((f) => f.format === format);
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

  /** Etichetta di profondità mostrata (senza offset ante: "10.17" → "10"). */
  protected depthLabel(depth: string): string {
    return depthDisplay(depth, this.resolvedFormat());
  }

  protected setDepth(depth: string): void {
    if (!depth || depth === this.resolvedDepth()) return;
    // il percorso si tenta di mantenere: se a questa profondità non esiste,
    // load() ripiega sulla radice
    this.navigate(this.resolvedFormat(), depth, this.azioni() ?? '');
  }

  protected onDepthChange(event: Event): void {
    this.setDepth((event.target as HTMLSelectElement).value);
  }

  protected stepDepth(dir: -1 | 1): void {
    const list = this.depths();
    const next = list[this.depthIndex() + dir];
    if (next) this.setDepth(next);
  }

  protected onAction(action: PreflopAction): void {
    const node = this.node();
    if (!node || action.is_terminal) return;
    const path = node.preflop_actions
      ? `${node.preflop_actions}-${action.code}`
      : action.code;
    this.navigate(node.format, node.depth_label, path);
  }

  /** Torna allo stato dopo le prime `count` azioni (0 = inizio mano). */
  protected crumbTo(count: number): void {
    const node = this.node();
    if (!node || count >= node.history.length) return;
    this.navigate(
      this.resolvedFormat(),
      this.resolvedDepth() ?? node.depth_label,
      node.history.slice(0, count).join('-'),
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
    if (depth) this.load(this.resolvedFormat(), depth, this.azioni() ?? '');
  }

  protected formatBbLabel(value: number | string): string {
    return formatBb(value);
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
