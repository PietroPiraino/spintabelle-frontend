import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AdminStatsView,
  AdminVideoStatsView,
  Role,
  StatsMeseAcquisizione,
  StatsMeseCoorte,
  StatsMeseIncasso,
  StatsMeseSenzaCassa,
} from '../../../core/models/api.models';
import { AdminStatsService } from '../../../core/services/admin-stats.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

/** Profondità della serie mensile (il DTO backend accetta 1..24). */
const MESI_RANGES = [6, 12, 24] as const;
/** Finestra dell'andamento video (il DTO backend accetta 1..90). */
const GIORNI_RANGES = [7, 30, 90] as const;

const ROLE_LABELS: Record<Role, string> = {
  USER: 'Iscritto',
  PESCE_ROSSO: 'Pesce Rosso',
  SQUALO: 'Squalo',
  ADMIN: 'Admin',
};

/** `visibility` arriva come stringa libera dal backend: fallback sul grezzo. */
const VISIBILITY_LABELS: Record<string, string> = {
  USER: 'Gratis',
  PESCE_ROSSO: 'Pesce Rosso',
  SQUALO: 'Squalo',
};

const METODO_LABELS: Record<string, string> = {
  paypal: 'PayPal',
  skrill: 'Skrill',
};

const NF = new Intl.NumberFormat('it-IT');
const NF_DEC = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
const EUR = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const PCT = new Intl.NumberFormat('it-IT', {
  style: 'percent',
  maximumFractionDigits: 1,
});
/** Il segno È il senso della variazione: "+12,5%" dice più di "12,5%". */
const DELTA = new Intl.NumberFormat('it-IT', {
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

const MESE_LABEL_FMT = new Intl.DateTimeFormat('it-IT', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const GIORNO_LABEL_FMT = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
/**
 * Il mese va calcolato a Roma, non nel fuso del browser: è lo stesso `TZ` con
 * cui il backend fa i bucket ($dateTrunc in Europe/Rome). Su un browser con un
 * altro fuso — o alle 00:30 del 1° del mese — l'ultimo mese della finestra
 * sarebbe un altro, e la tabella mostrerebbe un mese che il backend non ha
 * calcolato.
 */
const MESE_KEY_FMT = new Intl.DateTimeFormat('it-IT', {
  year: 'numeric',
  month: '2-digit',
  timeZone: 'Europe/Rome',
});

/** 'YYYY-MM' → "giu 2026". */
function meseLabel(chiave: string): string {
  const [anno, mese] = chiave.split('-').map(Number);
  if (!anno || !mese) return chiave;
  return MESE_LABEL_FMT.format(new Date(Date.UTC(anno, mese - 1, 1)));
}

/** 'YYYY-MM-DD' → "12 lug". */
function giornoLabel(chiave: string): string {
  const [anno, mese, giorno] = chiave.split('-').map(Number);
  if (!anno || !mese || !giorno) return chiave;
  return GIORNO_LABEL_FMT.format(new Date(Date.UTC(anno, mese - 1, giorno)));
}

/** 'YYYY-MM' del mese in cui cade `iso`, a Roma. */
function meseKeyRoma(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const parts = MESE_KEY_FMT.formatToParts(d);
  const anno = parts.find((p) => p.type === 'year')?.value ?? '';
  const mese = parts.find((p) => p.type === 'month')?.value ?? '';
  return anno && mese ? `${anno}-${mese}` : '';
}

/** Le `count` chiavi mese consecutive che finiscono con `ultimo` (inclusa). */
function finestraMesi(ultimo: string, count: number): string[] {
  const [anno0, mese0] = ultimo.split('-').map(Number);
  if (!anno0 || !mese0 || count < 1) return [];
  const chiavi: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    let mese = mese0 - i;
    let anno = anno0;
    while (mese <= 0) {
      mese += 12;
      anno -= 1;
    }
    chiavi.push(`${anno}-${String(mese).padStart(2, '0')}`);
  }
  return chiavi;
}

/**
 * Unione fra la finestra attesa e i mesi davvero presenti nella risposta,
 * in ordine cronologico (le chiavi 'YYYY-MM' si ordinano come stringhe).
 *
 * La densificazione può solo AGGIUNGERE mesi a zero, mai togliere una riga
 * vera. Se la finestra calcolata qui e quella del backend divergessero —
 * `generatoIl` illeggibile, orologi sfasati, un off-by-one in questo file — un
 * mese CON dati sparirebbe dalla tabella in silenzio, ed è la cosa peggiore che
 * questa pagina possa fare: si leggerebbe "quel mese non è incassato nulla".
 * Nel dubbio la riga vera vince.
 */
function chiaviMesi(finestra: string[], presenti: string[]): string[] {
  return [...new Set([...finestra, ...presenti])].sort();
}

/** Mese precedente a `chiave` ('YYYY-MM'). */
function mesePrecedente(chiave: string): string {
  const [anno, mese] = chiave.split('-').map(Number);
  if (!anno || !mese) return chiave;
  return mese === 1
    ? `${anno - 1}-12`
    : `${anno}-${String(mese - 1).padStart(2, '0')}`;
}

/**
 * Punti di una sparkline in un viewBox 100×24.
 *
 * La base è SEMPRE lo zero, non il minimo della serie: una sparkline ancorata
 * al minimo trasforma un +5% in una scalata, cioè disegna una cosa che i numeri
 * accanto non dicono. Con meno di due punti non si disegna niente: una linea
 * fatta di un punto solo è una tendenza inventata.
 */
function sparkline(valori: number[]): string {
  if (valori.length < 2) return '';
  const max = Math.max(...valori, 0);
  const min = Math.min(...valori, 0);
  const span = max - min || 1;
  const w = 100;
  const h = 24;
  return valori
    .map((v, i) => {
      const x = (i / (valori.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

/**
 * Tab "Statistiche": sei numeri per decidere, non una plancia da esplorare.
 *
 * Due caricamenti indipendenti (`/admin/stats` su Mongo, `/admin/stats/video`
 * su Bunny) con errore e retry propri, come le due rotte lato backend: un
 * guasto di Bunny non deve spegnere i numeri di business, che con Bunny non
 * c'entrano nulla.
 */
@Component({
  selector: 'app-admin-stats',
  imports: [DatePipe, IconComponent],
  templateUrl: './admin-stats.component.html',
  styleUrls: ['../admin-shared.scss', './admin-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStatsComponent {
  private readonly api = inject(AdminStatsService);

  protected readonly mesiRanges = MESI_RANGES;
  protected readonly giorniRanges = GIORNI_RANGES;
  protected readonly meseLabel = meseLabel;
  protected readonly giornoLabel = giornoLabel;

  protected readonly stats = signal<AdminStatsView | null>(null);
  protected readonly statsLoading = signal(false);
  protected readonly statsError = signal<string | null>(null);
  protected readonly mesi = signal<number>(12);

  protected readonly video = signal<AdminVideoStatsView | null>(null);
  protected readonly videoLoading = signal(false);
  protected readonly videoError = signal<string | null>(null);
  protected readonly giorni = signal<number>(30);

  // Guardie anti-sorpasso: cambiare finestra due volte in fretta può far
  // arrivare per ultima la risposta vecchia (stesso schema di /lezioni).
  private statsSeq = 0;
  private videoSeq = 0;

  constructor() {
    this.loadStats();
    this.loadVideo();
  }

  // ── Caricamento ──────────────────────────────────────────────────────────

  protected loadStats(): void {
    const seq = ++this.statsSeq;
    this.statsLoading.set(true);
    this.statsError.set(null);
    this.api.overview(this.mesi()).subscribe({
      next: (data) => {
        if (seq !== this.statsSeq) return;
        this.stats.set(data);
        this.statsLoading.set(false);
      },
      error: (err: unknown) => {
        if (seq !== this.statsSeq) return;
        this.statsLoading.set(false);
        // Mai una pagina vuota travestita da "nessun dato": l'errore resta a
        // schermo con il suo retry, e i numeri già caricati restano quelli.
        this.statsError.set(
          apiErrorMessage(err, 'Caricamento statistiche non riuscito.'),
        );
      },
    });
  }

  protected loadVideo(): void {
    const seq = ++this.videoSeq;
    this.videoLoading.set(true);
    this.videoError.set(null);
    this.api.video(this.giorni()).subscribe({
      next: (data) => {
        if (seq !== this.videoSeq) return;
        this.video.set(data);
        this.videoLoading.set(false);
      },
      error: (err: unknown) => {
        if (seq !== this.videoSeq) return;
        this.videoLoading.set(false);
        this.videoError.set(
          apiErrorMessage(err, 'Caricamento statistiche video non riuscito.'),
        );
      },
    });
  }

  protected setMesi(n: number): void {
    if (n === this.mesi()) return;
    this.mesi.set(n);
    this.loadStats();
  }

  protected setGiorni(n: number): void {
    if (n === this.giorni()) return;
    this.giorni.set(n);
    this.loadVideo();
  }

  // ── 1) Abbonati ──────────────────────────────────────────────────────────

  /**
   * `hannoAccessoOra - conAbbonamentoValido`: quanti entrano SENZA un
   * abbonamento in regola. L'identità dichiarata dal backend dice che sono
   * tutti e soli `senzaScadenza + daDeclassare`, cioè accessi dati a mano.
   */
  protected readonly accessoSenzaAbbonamento = computed(() => {
    const a = this.stats()?.abbonati;
    return a ? a.hannoAccessoOra - a.conAbbonamentoValido : 0;
  });

  protected readonly senzaScadenzaTier = computed(() =>
    (this.stats()?.abbonati.perTier ?? []).reduce(
      (s, t) => s + t.senzaScadenza,
      0,
    ),
  );

  protected readonly daDeclassareTier = computed(() =>
    (this.stats()?.abbonati.perTier ?? []).reduce(
      (s, t) => s + t.daDeclassare,
      0,
    ),
  );

  // ── 2) Incasso abbonamenti ───────────────────────────────────────────────

  /**
   * L'ultimo mese della finestra: il mese IN CORSO, calcolato dal `generatoIl`
   * della risposta (l'ora del backend) e non dall'orologio del browser — che a
   * cavallo della mezzanotte del 1° darebbe un mese diverso da quello dei
   * bucket.
   */
  private readonly meseCorrente = computed(() => {
    const s = this.stats();
    return s ? meseKeyRoma(s.generatoIl) : '';
  });

  /**
   * Serie densa in ordine cronologico: i mesi senza righe rientrano come €0.
   *
   * Il backend restituisce solo i mesi CON dati. Un mese assente dalla tabella
   * si legge "non è successo niente" invece di "zero euro incassati", e nella
   * sparkline sposterebbe i punti come se quel mese non fosse mai esistito.
   */
  private readonly incassoAsc = computed<StatsMeseIncasso[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const per = new Map(
      s.incassoAbbonamenti.serieMensile.map((r) => [r.mese, r]),
    );
    const chiavi = chiaviMesi(
      finestraMesi(this.meseCorrente(), s.finestraMesi),
      [...per.keys()],
    );
    return chiavi.map(
      (mese) =>
        per.get(mese) ?? {
          mese,
          incassoEur: 0,
          ordini: 0,
          stimati: 0,
          perMetodo: [],
        },
    );
  });

  /** In tabella il mese più recente sta in cima: è quello che si legge per primo. */
  protected readonly incassoRows = computed(() =>
    [...this.incassoAsc()].reverse(),
  );

  protected readonly incassoSpark = computed(() =>
    sparkline(this.incassoAsc().map((r) => r.incassoEur)),
  );

  /** La colonna "stimati" compare solo se c'è davvero qualcosa di stimato. */
  protected readonly haStimati = computed(() =>
    this.incassoAsc().some((r) => r.stimati > 0),
  );

  private readonly senzaCassaAsc = computed<StatsMeseSenzaCassa[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const per = new Map(
      s.incassoAbbonamenti.senzaCassaMensile.map((r) => [r.mese, r]),
    );
    const chiavi = chiaviMesi(
      finestraMesi(this.meseCorrente(), s.finestraMesi),
      [...per.keys()],
    );
    return chiavi.map((mese) => per.get(mese) ?? { mese, punti: 0, manuale: 0 });
  });

  protected readonly senzaCassaRows = computed(() =>
    [...this.senzaCassaAsc()].reverse(),
  );

  /** Tabella di soli zeri = rumore: si mostra solo se c'è stata un'attivazione. */
  protected readonly haSenzaCassa = computed(() =>
    this.senzaCassaAsc().some((r) => r.punti > 0 || r.manuale > 0),
  );

  // ── 3) Rinnovi ───────────────────────────────────────────────────────────

  /**
   * Coorti dense: la finestra finisce col mese appena CHIUSO, mai con quello in
   * corso — il backend taglia le coorti a `inizioMeseCorrente` (un mese ancora
   * aperto non ha una coorte, ha solo metà dei suoi dati).
   */
  private readonly coortiAsc = computed<StatsMeseCoorte[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const ultimo = this.meseCorrente();
    const per = new Map(s.rinnovi.serieMensile.map((r) => [r.mese, r]));
    const chiavi = chiaviMesi(
      ultimo ? finestraMesi(mesePrecedente(ultimo), s.finestraMesi - 1) : [],
      [...per.keys()],
    );
    return chiavi.map(
      (mese) =>
        per.get(mese) ?? {
          mese,
          scaduti: 0,
          rinnovati: 0,
          // Zero scadenze non è "0% di rinnovi": non c'era niente da rinnovare.
          tassoRinnovo: null,
        },
    );
  });

  protected readonly coortiRows = computed(() => [...this.coortiAsc()].reverse());

  // ── 5) Acquisizione ──────────────────────────────────────────────────────

  private readonly acquisizioneAsc = computed<StatsMeseAcquisizione[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const per = new Map(s.acquisizione.serieMensile.map((r) => [r.mese, r]));
    const chiavi = chiaviMesi(
      finestraMesi(this.meseCorrente(), s.finestraMesi),
      [...per.keys()],
    );
    const vuoto = { nuovi: 0, rinnovi: 0, ritorni: 0 };
    return chiavi.map(
      (mese) =>
        per.get(mese) ?? {
          mese,
          paganti: { ...vuoto },
          nonPaganti: { ...vuoto },
        },
    );
  });

  protected readonly acquisizioneRows = computed(() =>
    [...this.acquisizioneAsc()].reverse(),
  );

  // ── Qualità dei dati ─────────────────────────────────────────────────────

  /** Nessuna anomalia: va detto, altrimenti la sezione sembra rotta. */
  protected readonly qualitaPulita = computed(() => {
    const q = this.stats()?.qualitaDati;
    return (
      !!q &&
      q.senzaScadenzaTotale === 0 &&
      q.daDeclassare === 0 &&
      q.stimati === 0 &&
      q.approvedSenzaDecidedAt === 0
    );
  });

  // ── Video ────────────────────────────────────────────────────────────────

  protected readonly videoSpark = computed(() =>
    sparkline(
      (this.video()?.andamento?.serie ?? []).map((p) => p.visualizzazioni),
    ),
  );

  protected readonly videoQualitaPulita = computed(() => {
    const q = this.video()?.qualitaDati;
    return !!q && q.guidDuplicati === 0 && !q.paginaTroncata;
  });

  /** I tre gruppi di lezioni saltate, appiattiti per il template. */
  protected readonly gruppiSaltate = computed(() => {
    const s = this.video()?.saltate;
    if (!s) return [];
    return [
      {
        chiave: 'senzaEmbedValido',
        titolo: 'URL non riconosciuto come embed Bunny',
        gruppo: s.senzaEmbedValido,
      },
      {
        chiave: 'libreriaDiversa',
        titolo: "Embed di un'altra libreria",
        gruppo: s.libreriaDiversa,
      },
      {
        chiave: 'senzaStatistiche',
        titolo: 'Video assente dalla libreria (cancellato o URL sbagliato)',
        gruppo: s.senzaStatistiche,
      },
    ].filter((g) => g.gruppo.totale > 0);
  });

  // ── Formattatori ─────────────────────────────────────────────────────────

  protected n(v: number): string {
    return NF.format(v);
  }

  protected dec(v: number): string {
    return NF_DEC.format(v);
  }

  protected eur(v: number): string {
    return EUR.format(v);
  }

  /** ⚠️ per le FRAZIONI 0..1 (tassoRinnovo, conversione, percentualeVisione). */
  protected pct(v: number): string {
    return PCT.format(v);
  }

  /** ⚠️ per `deltaPct`, che il backend manda GIÀ in punti percentuali. */
  protected delta(v: number): string {
    return `${DELTA.format(v)}%`;
  }

  protected roleLabel(r: Role): string {
    return ROLE_LABELS[r] ?? r;
  }

  protected visibilityLabel(v: string): string {
    return VISIBILITY_LABELS[v] ?? v;
  }

  protected metodoLabel(m: string): string {
    return METODO_LABELS[m] ?? m;
  }

  /** Secondi → "1h 23m" / "12m 30s" / "45s". */
  protected durata(secondi: number): string {
    const s = Math.max(0, Math.round(secondi));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    if (m > 0) return `${m}m ${String(r).padStart(2, '0')}s`;
    return `${r}s`;
  }

  /** Riepilogo compatto dei metodi di pagamento di un mese. */
  protected metodi(riga: StatsMeseIncasso): string {
    return riga.perMetodo
      .map((m) => `${this.metodoLabel(m.metodo)} ${this.eur(m.incassoEur)}`)
      .join(' · ');
  }
}
