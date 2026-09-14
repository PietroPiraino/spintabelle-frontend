import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  MyPoints,
  MyVoucher,
  PointsLedgerEntry,
  ShopOrder,
} from '../../../core/models/api.models';
import { PointsService } from '../../../core/services/points.service';
import { ShopService } from '../../../core/services/shop.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { formattaEur, formattaIntero } from '../../admin/denaro';
import {
  CARICO,
  Carico,
  TonoPillola,
  errore,
  etichettaBuono,
  ok,
  tonoBuono,
  tonoOrdine,
} from '../account.types';

/** Il tetto di `GET /shop/my-orders`: oltre, i più vecchi non arrivano. */
const ORDINI_TETTO = 50;

/**
 * Acquisti e punti: movimenti (paginati), buoni, ordini.
 *
 * ⚠️ Buoni e ordini si caricano QUI, al primo ingresso nella scheda, e con i
 * quattro stati di `Carico`: fino al 14/09/2026 nascevano `[]` e con l'API in
 * carico — o giù — la pagina diceva «Non hai ancora buoni sconto».
 *
 * ⚠️ Tutte le cifre passano da `denaro.ts`: «€12.50» a mano accanto a
 * «230,59 €» era il difetto più visibile della vecchia pagina.
 */
@Component({
  selector: 'app-account-acquisti',
  imports: [DatePipe, RouterLink, IconComponent],
  templateUrl: './account-acquisti.component.html',
  styleUrls: ['../account-shared.scss', './account-acquisti.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountAcquistiComponent {
  private readonly pointsApi = inject(PointsService);
  private readonly shop = inject(ShopService);

  /** La prima pagina, caricata dalla shell (la Panoramica ne mostra il saldo). */
  readonly punti = input.required<Carico<MyPoints>>();
  readonly riprovaPunti = output<void>();

  // ── Movimenti: la prima pagina dalla shell, le altre da qui ──────────────

  /** Le pagine oltre la prima, accodate. */
  private readonly altrePagine = signal<PointsLedgerEntry[]>([]);
  private readonly paginaCorrente = signal(1);
  protected readonly caricandoAltri = signal(false);
  protected readonly erroreAltri = signal<string | null>(null);

  protected readonly movimenti = computed<PointsLedgerEntry[]>(() => {
    const p = this.punti();
    if (p.stato !== 'ok') return [];
    return [...p.dati.history, ...this.altrePagine()];
  });

  protected readonly totaleMovimenti = computed<number | null>(() => {
    const p = this.punti();
    return p.stato === 'ok' ? (p.dati.total ?? null) : null;
  });

  /** «Carica altri» solo se il server ha detto quanti sono, e ne restano. */
  protected readonly ciSonoAltri = computed(() => {
    const t = this.totaleMovimenti();
    return t !== null && this.movimenti().length < t;
  });

  protected readonly saldo = computed(() => {
    const p = this.punti();
    return p.stato === 'ok' ? formattaIntero(p.dati.balance) : null;
  });

  constructor() {
    // Se la shell ricarica la prima pagina, le pagine accodate non valgono più.
    effect(() => {
      this.punti();
      untracked(() => {
        this.altrePagine.set([]);
        this.paginaCorrente.set(1);
      });
    });
    this.caricaBuoni();
    this.caricaOrdini();
  }

  protected caricaAltri(): void {
    if (this.caricandoAltri()) return;
    const p = this.punti();
    if (p.stato !== 'ok') return;
    const limit = p.dati.limit ?? p.dati.history.length;
    const pagina = this.paginaCorrente() + 1;
    this.caricandoAltri.set(true);
    this.erroreAltri.set(null);
    this.pointsApi.myPoints(pagina, limit).subscribe({
      next: (r) => {
        this.caricandoAltri.set(false);
        this.paginaCorrente.set(pagina);
        // Dedup per id: fra due pagine può entrare un movimento nuovo e
        // spostare tutto di uno (idioma dell'append di /lezioni).
        const visti = new Set(this.movimenti().map((e) => e.id));
        this.altrePagine.update((a) => [
          ...a,
          ...r.history.filter((e) => !visti.has(e.id)),
        ]);
      },
      error: (err: unknown) => {
        this.caricandoAltri.set(false);
        this.erroreAltri.set(apiErrorMessage(err, 'Caricamento non riuscito.'));
      },
    });
  }

  protected delta(e: PointsLedgerEntry): string {
    const n = formattaIntero(Math.abs(e.delta));
    return e.delta > 0 ? `+${n}` : e.delta < 0 ? `−${n}` : n;
  }

  protected intero(n: number): string {
    return formattaIntero(n);
  }

  // ── Buoni ─────────────────────────────────────────────────────────────────

  protected readonly buoni = signal<Carico<MyVoucher[]>>(CARICO);

  protected caricaBuoni(): void {
    this.buoni.set(CARICO);
    this.shop.myVouchers().subscribe({
      next: (v) => this.buoni.set(ok(v)),
      error: (err: unknown) =>
        this.buoni.set(errore(apiErrorMessage(err, 'Buoni non disponibili.'))),
    });
  }

  /** I buoni, o `null` finché non ci sono. */
  protected readonly buoniDati = computed<MyVoucher[] | null>(() => {
    const b = this.buoni();
    return b.stato === 'ok' ? b.dati : null;
  });

  protected tonoBuono(v: MyVoucher): TonoPillola {
    return tonoBuono(v.status);
  }

  protected statoBuono(v: MyVoucher): string {
    return etichettaBuono(v.status);
  }

  /** Valore leggibile di un buono: percentuale, o euro con `formattaEur`. */
  protected valoreBuono(v: MyVoucher): string {
    return v.kind === 'PERCENT' ? `${v.value}%` : formattaEur(v.value);
  }

  // ── Ordini ────────────────────────────────────────────────────────────────

  protected readonly ordini = signal<Carico<ShopOrder[]>>(CARICO);

  /** Il titolo dice «ultimi 50» solo quando la risposta ne porta 50. */
  protected readonly ordiniAlTetto = computed(() => {
    const o = this.ordini();
    return o.stato === 'ok' && o.dati.length >= ORDINI_TETTO;
  });

  protected caricaOrdini(): void {
    this.ordini.set(CARICO);
    this.shop.myOrders().subscribe({
      next: (o) => this.ordini.set(ok(o)),
      error: (err: unknown) =>
        this.ordini.set(errore(apiErrorMessage(err, 'Ordini non disponibili.'))),
    });
  }

  protected readonly ordiniDati = computed<ShopOrder[] | null>(() => {
    const o = this.ordini();
    return o.stato === 'ok' ? o.dati : null;
  });

  protected tonoOrdine(o: ShopOrder): TonoPillola {
    return tonoOrdine(o.status);
  }

  /** Euro per gli ordini off-site, altrimenti i punti spesi. */
  protected importoOrdine(o: ShopOrder): string {
    return o.amountEur != null
      ? formattaEur(o.amountEur)
      : `−${formattaIntero(o.pointsSpent)} pt`;
  }

  /** Il vuoto SOLO dopo la risposta: due liste vuote, una riga sola. */
  protected readonly senzaAcquisti = computed(() => {
    const b = this.buoni();
    const o = this.ordini();
    return b.stato === 'ok' && o.stato === 'ok' && b.dati.length === 0 && o.dati.length === 0;
  });
}
