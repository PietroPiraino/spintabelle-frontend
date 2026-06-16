import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import {
  DrillActionLogEntry,
  DrillSeat,
} from '../../../core/models/api.models';
import { formatBb } from '../../tables/preflop-display';
import { actionSeqLabel } from '../drill-display';

interface Card {
  rank: string;
  suit: string;
  red: boolean;
}

interface Seat {
  position: string;
  stack: string;
  committed: number;
  isHero: boolean;
  folded: boolean;
  /** sequenza completa delle azioni del giocatore (es. "Limp › Raise 12 bb") */
  actionSeq: string | null;
  isButton: boolean;
  x: number;
  y: number;
}

interface Bet {
  position: string;
  label: string;
  x: number;
  y: number;
}

/**
 * Tavolo da gioco della situazione: posti disposti attorno al feltro (3 per
 * Spin & Go, 2 per Heads-Up), stack effettivi, fiche puntate, bottone del
 * dealer, piatto in cima, carte dell'eroe e azioni di ogni giocatore. Tutto
 * self-contained dal payload (players + actionLog), nessuna strategia.
 *
 * Dimensioni in `cqw` (relative alla larghezza del feltro, che è un container):
 * su mobile il tavolo rimpicciolisce mantenendo le stesse proporzioni del
 * desktop → niente sovrapposizioni.
 */
@Component({
  selector: 'app-poker-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './poker-table.component.html',
  styleUrl: './poker-table.component.scss',
})
export class PokerTableComponent {
  readonly players = input.required<DrillSeat[]>();
  readonly activePosition = input.required<string>();
  readonly pot = input.required<number>();
  readonly hand = input.required<string>();
  readonly actionLog = input.required<DrillActionLogEntry[]>();
  /** in feedback: cosa ha scelto l'eroe (sostituisce "tocca a te") */
  readonly heroChoice = input<string | null>(null);

  private static readonly RANK: Record<string, number> = {
    BTN: 0,
    SB: 1,
    BB: 2,
  };

  protected readonly potLabel = computed(() => `${formatBb(this.pot())} bb`);

  /** carte dell'eroe (suited = stesso seme, offsuit = due semi, coppia = due semi) */
  protected readonly heroCards = computed<Card[]>(() => {
    const h = this.hand();
    const r1 = h[0];
    const r2 = h[1];
    const spade: Card = { rank: r1, suit: '♠', red: false };
    if (r1 === r2) return [spade, { rank: r2, suit: '♥', red: true }];
    if (h.endsWith('s')) return [spade, { rank: r2, suit: '♠', red: false }];
    return [spade, { rank: r2, suit: '♥', red: true }];
  });

  /** sequenza di azioni già fatte dall'eroe (prima della decisione corrente) */
  protected readonly heroSeq = computed(
    () => this.seats().find((s) => s.isHero)?.actionSeq ?? null,
  );

  protected readonly seats = computed<Seat[]>(() => {
    const players = this.players();
    const hero = this.activePosition();
    const log = this.actionLog();

    const ordered = [...players].sort(
      (a, b) =>
        (PokerTableComponent.RANK[a.position] ?? 9) -
        (PokerTableComponent.RANK[b.position] ?? 9),
    );
    const positions = ordered.map((p) => p.position);
    const buttonPos = positions.includes('BTN') ? 'BTN' : 'SB';

    // ruota così che l'eroe occupi lo slot in basso
    const heroIdx = positions.indexOf(hero);
    const rot =
      heroIdx >= 0
        ? [...ordered.slice(heroIdx), ...ordered.slice(0, heroIdx)]
        : ordered;
    const slots = this.slotsFor(rot.length);

    return rot.map((pl, i) => {
      const entries = log.filter((e) => e.position === pl.position);
      const folded =
        entries.length > 0 && entries[entries.length - 1].type === 'FOLD';
      return {
        position: pl.position,
        stack: formatBb(pl.stack),
        committed: pl.committed,
        isHero: pl.position === hero,
        folded,
        actionSeq: entries.length ? actionSeqLabel(entries) : null,
        isButton: pl.position === buttonPos,
        x: slots[i].x,
        y: slots[i].y,
      };
    });
  });

  /**
   * Fiche davanti a ogni giocatore ancora in mano.
   * - HU: i due posti sono nella colonna centrale (eroe in basso, avversario in
   *   alto). Le fiche vanno nella FASCIA LATERALE libera (a destra) per non
   *   coprire la pillola action né il plate, sfruttando lo spazio ai lati.
   * - 3-max: la fiche scivola dal posto "verso il centro".
   */
  protected readonly bets = computed<Bet[]>(() => {
    const all = this.seats();
    const hu = all.length <= 2;
    return all
      .filter((s) => !s.folded && s.committed > 0.001)
      .map((s) => {
        let pos: { x: number; y: number };
        if (hu) pos = s.isHero ? { x: 72, y: 62 } : { x: 72, y: 43 };
        else if (s.isHero) pos = { x: 50, y: 56 };
        else pos = { x: s.x + (50 - s.x) * 0.46, y: s.y + (50 - s.y) * 0.46 };
        return { position: s.position, label: formatBb(s.committed), ...pos };
      });
  });

  private slotsFor(n: number): { x: number; y: number }[] {
    if (n <= 2) {
      // HU: eroe in basso, avversario in alto sotto il piatto
      return [
        { x: 50, y: 82 },
        { x: 50, y: 31 },
      ];
    }
    // 3-max: eroe in basso; in senso orario il successivo va a SINISTRA, poi a
    // destra → con [BTN, SB, BB] l'SB finisce a sinistra e il BB a destra
    return [
      { x: 50, y: 82 },
      { x: 14, y: 33 },
      { x: 86, y: 33 },
    ];
  }
}
