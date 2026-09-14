import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  MyAffiliation,
  MyPoints,
  MySubscription,
  Percorso,
  SubscriptionRequest,
  UltimaRichiestaRifiutata,
} from '../../../core/models/api.models';
import { AffiliationsService } from '../../../core/services/affiliations.service';
import { AuthService } from '../../../core/services/auth.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import {
  formattaEur,
  formattaFrazione,
  formattaIntero,
} from '../../admin/denaro';
import { metodoPagamentoLabel } from '../../admin/metodo-pagamento';
import {
  CARICO,
  Carico,
  SCADENZA_VICINA_GIORNI,
  TonoPillola,
  VistaAccount,
  errore,
  giorniResidui,
  gruppoAffiliazione,
  ok,
  tonoAffiliazione,
} from '../account.types';

/** Il piano attivo, letto dal ruolo (la card è in pagina prima di ogni risposta). */
interface Piano {
  etichetta: string;
  scadenza: string | null;
  giorni: number | null;
  /** > 7 giorni · ≤ 7 · già passata (fra la scadenza e il cron delle 3:00). */
  stato: 'ok' | 'vicina' | 'scaduta';
}

/**
 * Panoramica: «Il tuo accesso» · Punti BFF · «Il mio percorso» · affiliazioni.
 *
 * ⚠️ REQUISITO LEGALE, pinnato da una spec: nessun `computed` combina le
 * affiliazioni con punti, ordini, prospetto o viste, e il nome di una sala
 * compare SOLO dentro il blocco delle affiliazioni. L'incrocio è la soglia
 * oltre la quale la DPIA diventa obbligatoria (`valutazione-affiliazioni.md`
 * criterio 6). Quattro blocchi, quattro sorgenti, nessun ponte.
 *
 * ⚠️ E nessuna frase sull'ORIGINE dei punti: la card la vede ogni registrato,
 * e su una pagina di tutti «gioca per guadagnarli» è la catena gioca→premio
 * dell'art. 9 DL 87/2018. Si dice dove SPENDERLI, non da dove vengono.
 */
@Component({
  selector: 'app-account-panoramica',
  imports: [DatePipe, RouterLink, IconComponent],
  templateUrl: './account-panoramica.component.html',
  styleUrls: ['../account-shared.scss', './account-panoramica.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPanoramicaComponent {
  private readonly auth = inject(AuthService);
  private readonly affiliationsApi = inject(AffiliationsService);

  readonly sub = input.required<Carico<MySubscription>>();
  readonly punti = input.required<Carico<MyPoints>>();
  readonly percorso = input.required<Carico<Percorso>>();
  readonly haConteggi = input(false);

  readonly riprovaSub = output<void>();
  readonly riprovaPunti = output<void>();
  readonly riprovaPercorso = output<void>();
  readonly vaiA = output<VistaAccount>();

  protected readonly user = this.auth.user;
  protected readonly SCADENZA_VICINA_GIORNI = SCADENZA_VICINA_GIORNI;

  /** L'istante di apertura: basta per «scade fra N giorni». */
  private readonly ora = new Date();

  // ── Il tuo accesso ────────────────────────────────────────────────────────

  /**
   * Il ramo per ruolo, dal solo `auth.user()`: la card si disegna prima di
   * ogni risposta. ⚠️ STAKATO e COACH hanno accesso a tutto e il server
   * rifiuta loro l'acquisto (409): niente CTA, e per lo STAKATO la porta ai
   * conteggi — la frase «sei in staking» da sola non diceva dove guardare.
   */
  protected readonly ruoloAccesso = computed<
    'admin' | 'coach' | 'stakato' | 'tier' | 'nessuno'
  >(() => {
    const role = this.user()?.role;
    if (role === 'ADMIN') return 'admin';
    if (role === 'COACH') return 'coach';
    if (role === 'STAKATO') return 'stakato';
    if (role === 'SQUALO' || role === 'PESCE_ROSSO') return 'tier';
    return 'nessuno';
  });

  protected readonly piano = computed<Piano | null>(() => {
    const u = this.user();
    if (!u) return null;
    const etichetta =
      u.role === 'SQUALO' ? 'Squalo' : u.role === 'PESCE_ROSSO' ? 'Pesce Rosso' : null;
    if (!etichetta) return null;
    const giorni = giorniResidui(u.subscriptionExpiresAt, this.ora);
    const stato: Piano['stato'] =
      giorni === null || giorni > SCADENZA_VICINA_GIORNI
        ? 'ok'
        : giorni < 0
          ? 'scaduta'
          : 'vicina';
    return { etichetta, scadenza: u.subscriptionExpiresAt ?? null, giorni, stato };
  });

  /** La richiesta in attesa, quando `/subscriptions/me` ha risposto. */
  protected readonly pending = computed<SubscriptionRequest | null>(() => {
    const s = this.sub();
    return s.stato === 'ok' ? s.dati.pendingRequest : null;
  });

  protected readonly rifiutata = computed<UltimaRichiestaRifiutata | null>(() => {
    const s = this.sub();
    return s.stato === 'ok' ? (s.dati.ultimaRifiutata ?? null) : null;
  });

  /**
   * ⚠️ `metodoPagamentoLabel` (switch esaustivo) e MAI il ternario
   * `skrill ? 'Skrill' : 'PayPal'`: su una richiesta coperta interamente coi
   * punti il server scrive `paymentMethod: 'punti'`, e quel ternario stampa
   * «PayPal» — il difetto già pagato in produzione.
   */
  protected metodo(r: SubscriptionRequest): string {
    return metodoPagamentoLabel(r.paymentMethod);
  }

  /** Euro dovuti: SOLO se il campo c'è (assente sulle righe legacy). */
  protected dovuto(r: SubscriptionRequest): string | null {
    return r.discountedPriceEur != null ? formattaEur(r.discountedPriceEur) : null;
  }

  // ── Punti ─────────────────────────────────────────────────────────────────

  /** Il saldo: dalla risposta se c'è, altrimenti dal profilo (è lo stesso numero). */
  protected readonly saldo = computed(() => {
    const p = this.punti();
    const n = p.stato === 'ok' ? p.dati.balance : (this.user()?.points ?? 0);
    return formattaIntero(n);
  });

  // ── Il mio percorso ───────────────────────────────────────────────────────

  /** I dati del percorso, o `null` finché non ci sono (carico/errore). */
  protected readonly percorsoDati = computed<Percorso | null>(() => {
    const p = this.percorso();
    return p.stato === 'ok' ? p.dati : null;
  });

  protected readonly percorsoVuoto = computed(() => {
    const d = this.percorsoDati();
    if (!d) return false;
    return (
      !(d.lezioni && d.lezioni.viste > 0) &&
      !(d.allenamento && d.allenamento.sessioni > 0) &&
      !(d.preset && d.preset > 0) &&
      !(d.mani && d.mani.usate > 0) &&
      !(d.live && d.live.seguite > 0)
    );
  });

  protected intero(n: number): string {
    return formattaIntero(n);
  }

  protected frazione(f: number): string {
    return formattaFrazione(f);
  }

  /** «visto fino a circa il 60%»: il «circa» è il limite noto di A12 reso in pagina. */
  protected circa(percentuale: number): string {
    return `circa il ${Math.round(percentuale)}%`;
  }

  // ── Affiliazioni (caricate QUI, non dalla shell: servono solo alla Panoramica) ──

  protected readonly affiliazioni = signal<Carico<MyAffiliation[]>>(CARICO);

  private gruppo(g: ReturnType<typeof gruppoAffiliazione>) {
    return computed(() => {
      const a = this.affiliazioni();
      return a.stato === 'ok' ? a.dati.filter((x) => gruppoAffiliazione(x.status) === g) : [];
    });
  }

  protected readonly tracciate = this.gruppo('tracciate');
  protected readonly inCorso = this.gruppo('inCorso');
  protected readonly daRiprendere = this.gruppo('daRiprendere');

  /** La striscia: solo le voci > 0 (idioma di /affiliazioni). */
  protected readonly striscia = computed(() => {
    const voci: string[] = [];
    const t = this.tracciate().length;
    const c = this.inCorso().length;
    const r = this.daRiprendere().length;
    if (t) voci.push(t === 1 ? '1 tracciata' : `${t} tracciate`);
    if (c) voci.push(c === 1 ? '1 in corso' : `${c} in corso`);
    if (r) voci.push(r === 1 ? '1 da riprendere' : `${r} da riprendere`);
    return voci;
  });

  protected readonly affiliazioniErrore = computed(() => {
    const a = this.affiliazioni();
    return a.stato === 'errore' ? a.messaggio : null;
  });

  protected readonly nessunaAffiliazione = computed(() => {
    const a = this.affiliazioni();
    return a.stato === 'ok' && a.dati.length === 0;
  });

  protected tono(a: MyAffiliation): TonoPillola {
    return tonoAffiliazione(a.status);
  }

  constructor() {
    this.caricaAffiliazioni();
  }

  protected caricaAffiliazioni(): void {
    this.affiliazioni.set(CARICO);
    this.affiliationsApi.mine().subscribe({
      next: (rows) => this.affiliazioni.set(ok(rows)),
      // ⚠️ MOSTRATO, mai assorbito in una lista vuota: «non risulti tracciato»
      // con l'API giù è una bugia sul dato per cui l'utente è passato di qui.
      error: (err: unknown) =>
        this.affiliazioni.set(
          errore(apiErrorMessage(err, 'Caricamento delle affiliazioni non riuscito.')),
        ),
    });
  }
}
