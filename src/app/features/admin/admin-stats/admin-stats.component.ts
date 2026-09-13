import { DatePipe, NgTemplateOutlet } from '@angular/common';
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
import { RouterLink } from '@angular/router';
import {
  AdminStatsView,
  AdminVideoStatsView,
  AndamentoConteggi,
  RigaAndamento,
  RigaVideoLezione,
  StatsMeseAcquisizione,
  StatsMeseCoorte,
  StatsMeseIncasso,
  StatsMeseSenzaCassa,
} from '../../../core/models/api.models';
import { AdminConteggiService } from '../../../core/services/admin-conteggi.service';
import { AdminStatsService } from '../../../core/services/admin-stats.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import {
  FiltroComponent,
  VoceFiltro,
} from '../../../shared/ui/filtro/filtro.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import {
  SchedeComponent,
  VoceScheda,
} from '../../../shared/ui/schede/schede.component';
import {
  formattaCent,
  formattaDelta,
  formattaEur,
  formattaFrazione,
  formattaIntero,
} from '../denaro';
import { metodoLabelDaSlug } from '../metodo-pagamento';
import { roleLabel } from '../role-labels';

/**
 * Le quattro schede, tupla CHIUSA (idioma `ICON_NAMES` e `VISTE` dei
 * Conteggi): `Vista` si deriva da qui e `isVista()` è la guardia sul valore di
 * `?vista=`, che arriva dall'URL come stringa qualunque. Con una `type` a mano
 * e un `as Vista` sul parametro, `?vista=tutto` diventerebbe una scheda che
 * nessun `@case` rende: pannello vuoto, nessun errore.
 */
const VISTE = ['abbonati', 'incassi', 'andamento', 'video'] as const;
type Vista = (typeof VISTE)[number];
const isVista = (v: string | undefined): v is Vista =>
  v !== undefined && (VISTE as readonly string[]).includes(v);

const SCHEDE: readonly VoceScheda<Vista>[] = [
  { valore: 'abbonati', etichetta: 'Abbonati' },
  { valore: 'incassi', etichetta: 'Incassi' },
  { valore: 'andamento', etichetta: 'Andamento' },
  { valore: 'video', etichetta: 'Video' },
];

/**
 * Il titolo della barra dice in che SCHEDA si è, non come si chiama la
 * sezione: «Statistiche» la stampa già la topbar della shell.
 */
const TITOLI: Record<Vista, string> = {
  abbonati: 'Abbonati e rinnovi',
  incassi: 'Incassi degli abbonamenti',
  andamento: 'Andamento dei conteggi',
  video: 'Video',
};

/** Profondità della serie mensile (il DTO backend accetta 1..24). */
const MESI_RANGES = [6, 12, 24] as const;
/** Finestra dell'andamento video (il DTO backend accetta 1..90). */
const GIORNI_RANGES = [7, 30, 90] as const;

/** Sei tessere di scheletro: quante ne ha la griglia più larga della pagina. */
const SCHELETRI = [1, 2, 3, 4, 5, 6] as const;

/** `visibility` arriva come stringa libera dal backend: fallback sul grezzo. */
const VISIBILITY_LABELS: Record<string, string> = {
  USER: 'Gratis',
  PESCE_ROSSO: 'Pesce Rosso',
  SQUALO: 'Squalo',
};

/**
 * Le ore guardate, con al più un decimale: «200,5 h». Non è denaro, e non
 * passa da `denaro.ts` di proposito — è l'unico numero della pagina che non è
 * né un conteggio, né una frazione, né un importo.
 */
const ORE = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });

const MESE_LABEL_FMT = new Intl.DateTimeFormat('it-IT', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const MESE_LUNGO_FMT = new Intl.DateTimeFormat('it-IT', {
  month: 'long',
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

/** 'YYYY-MM' → "giugno 2026", per tooltip, readout e titoli di modale. */
function meseLungo(chiave: string): string {
  const [anno, mese] = chiave.split('-').map(Number);
  if (!anno || !mese) return chiave;
  return MESE_LUNGO_FMT.format(new Date(Date.UTC(anno, mese - 1, 1)));
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
 * Una riga della tabella «Crescita»: il funnel del mese, denso.
 * `abbonatiFine` è `null` dove il backend non ha una fotografia — il mese
 * corrente, che non è ancora chiuso — e la tabella stampa «—», mai uno zero.
 */
interface RigaCrescita {
  mese: string;
  registrati: number;
  verificati: number;
  /** `acquisizione.paganti.nuovi`: il terzo gradino del funnel, già calcolato. */
  primiAbbonamenti: number;
  abbonatiFine: number | null;
}

/**
 * La sezione «Statistiche»: quattro schede — Abbonati · Incassi · Andamento ·
 * Video — su tre letture indipendenti, ognuna col proprio errore e il proprio
 * «Riprova».
 *
 * ⚠️ TRE fonti e non una: `/admin/stats` (aggregazioni Mongo, cache 5 min) per
 * Abbonati e Incassi, `/admin/conteggi/andamento` (senza cache: i mesi aperti
 * si ricalcolano a ogni lettura) per Andamento, `/admin/stats/video` (una
 * chiamata di rete a Bunny) per Video. Un guasto di Bunny non deve spegnere i
 * numeri di business, e i conteggi non passano da nessuna delle altre due.
 *
 * ⚠️ Andamento e Video si caricano PIGRAMENTE, al primo ingresso nella scheda
 * (precedente `caricaSoci` nei Conteggi): erano tre chiamate nel costruttore,
 * di cui una a Bunny, per chi apriva la pagina a leggere gli abbonati. Una
 * volta sola per scheda — un errore lascia la banda col suo «Riprova», non un
 * secondo tentativo automatico a ogni cambio di scheda.
 *
 * ⚠️ DUE unità di denaro convivono in questa pagina e non si incrociano MAI:
 * `/admin/stats` manda EURO float (`formattaEur`), i conteggi mandano
 * CENTESIMI interi (`formattaCent`). La scelta sbagliata è un fattore 100.
 * E il client non SOMMA denaro: ogni totale arriva dal server.
 */
@Component({
  selector: 'app-admin-stats',
  imports: [
    DatePipe,
    NgTemplateOutlet,
    RouterLink,
    IconComponent,
    FiltroComponent,
    SchedeComponent,
  ],
  templateUrl: './admin-stats.component.html',
  styleUrls: [
    '../admin-shared.scss',
    '../admin-table.scss',
    '../admin-modale.scss',
    '../admin-cruscotto.scss',
    './admin-stats.component.scss',
  ],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStatsComponent {
  private readonly api = inject(AdminStatsService);
  private readonly conteggi = inject(AdminConteggiService);
  // ⚠️ Il `DatePipe` si INIETTA, non si riscrive: segue il `LOCALE_ID`
  // dell'applicazione, e una data composta a mano con `toLocaleDateString`
  // diverge dal template — è successo sul sotto-testo delle news.
  private readonly date = inject(DatePipe);

  protected readonly SCHEDE = SCHEDE;
  protected readonly SCHELETRI = SCHELETRI;
  protected readonly vista = signal<Vista>('abbonati');
  protected readonly titoloScheda = computed(() => TITOLI[this.vista()]);

  /**
   * Il `?vista=` di un deep-link (dalla Panoramica, o da un URL salvato).
   *
   * ⚠️ «Iniziale» nel nome perché è un valore di PARTENZA, non uno stato: la
   * scheda si cambia dal clic e nessuno riscrive l'URL — un `?vista=` che
   * seguisse ogni clic farebbe del tasto Indietro un giro fra le schede invece
   * di un ritorno alla Panoramica. Stesso nome di parametro dei Conteggi.
   */
  readonly vistaIniziale = input<string | undefined>(undefined, {
    alias: 'vista',
  });

  /**
   * Le finestre temporali, per `app-filtro`.
   *
   * ⚠️ I valori sono STRINGHE perché `VoceFiltro<T extends string>` lo impone,
   * e il vincolo non è un capriccio del primitivo: quel valore finisce in un
   * `data-*` e in un `aria-checked`, cioè attraversa il DOM, dove i numeri non
   * esistono. Il ritorno a numero sta in una riga sola, qui accanto.
   */
  protected readonly vociMesi: readonly VoceFiltro<string>[] = MESI_RANGES.map(
    (r) => ({ valore: String(r), etichetta: `${r} mesi` }),
  );
  protected readonly vociGiorni: readonly VoceFiltro<string>[] =
    GIORNI_RANGES.map((r) => ({ valore: String(r), etichetta: `${r} giorni` }));

  /**
   * Lo stesso valore in stringa, per `[scelto]`.
   *
   * ⚠️ E non `String(mesi())` nel template: nei template Angular sono
   * raggiungibili solo i membri del componente, quindi `String` non esiste e
   * l'espressione non compila.
   */
  protected readonly mesiScelto = computed(() => String(this.mesi()));
  protected readonly mesiAndamentoScelto = computed(() =>
    String(this.mesiAndamento()),
  );
  protected readonly giorniScelto = computed(() => String(this.giorni()));

  protected readonly meseLabel = meseLabel;
  protected readonly meseLungo = meseLungo;
  protected readonly giornoLabel = giornoLabel;
  protected readonly formattaCent = formattaCent;
  protected readonly formattaEur = formattaEur;
  protected readonly formattaFrazione = formattaFrazione;
  protected readonly formattaDelta = formattaDelta;
  protected readonly formattaIntero = formattaIntero;
  protected readonly roleLabel = roleLabel;
  /**
   * ⚠️ Era una mappa di DUE voci (paypal, skrill) con ripiego sullo slug: non
   * conosceva né `manuale`, né `punti`, né `contanti`. Passa dalla funzione
   * condivisa, che il ripiego sullo slug lo conserva — qui il metodo arriva
   * dentro un'aggregazione come `string`, e davanti a un valore ignoto la
   * stringa grezza è una domanda, mentre un metodo plausibile sarebbe
   * un'affermazione falsa.
   */
  protected readonly metodoLabel = metodoLabelDaSlug;

  // ── Le tre fonti ──────────────────────────────────────────────────────────

  protected readonly stats = signal<AdminStatsView | null>(null);
  protected readonly statsLoading = signal(false);
  protected readonly statsError = signal<string | null>(null);
  protected readonly mesi = signal<number>(12);

  protected readonly andamento = signal<AndamentoConteggi | null>(null);
  protected readonly andamentoLoading = signal(false);
  protected readonly andamentoError = signal<string | null>(null);
  protected readonly mesiAndamento = signal<number>(12);

  protected readonly video = signal<AdminVideoStatsView | null>(null);
  protected readonly videoLoading = signal(false);
  protected readonly videoError = signal<string | null>(null);
  protected readonly giorni = signal<number>(30);

  // Guardie anti-sorpasso: cambiare finestra due volte in fretta può far
  // arrivare per ultima la risposta vecchia (stesso schema di /lezioni).
  // ⚠️ Sono anche la memoria del «già chiesto una volta» dei caricamenti pigri:
  // a zero, la scheda non ha mai chiesto niente.
  private statsSeq = 0;
  private andamentoSeq = 0;
  private videoSeq = 0;

  constructor() {
    this.loadStats();

    /**
     * Il `?vista=` del deep-link apre la scheda, se ne nomina una vera.
     * ⚠️ `isVista` e non un cast: `?vista=tutto` è una stringa come le altre,
     * e senza la guardia sarebbe una scheda che nessun `@case` rende.
     */
    effect(() => {
      const v = this.vistaIniziale();
      if (isVista(v)) this.vista.set(v);
    });

    /**
     * I caricamenti PIGRI: un effect e non una chiamata nel click, perché la
     * scheda si sceglie anche da tastiera e dal deep-link, e l'unico posto che
     * vede ogni cambio è il signal.
     *
     * ⚠️ La guardia è «mai chiesto» (`seq === 0`) e NON «non ho il dato»: con
     * `!video()` un 500 lascerebbe il dato vuoto, l'effect rientrerebbe alla
     * fine del caricamento (legge i signal che cambiano) e chiederebbe di
     * nuovo, per sempre. Un errore resta nella banda col suo «Riprova».
     * ⚠️ `untracked` sulle scritture: l'effect dipende dalla sola scheda.
     */
    effect(() => {
      const v = this.vista();
      untracked(() => {
        if (v === 'andamento' && this.andamentoSeq === 0) this.loadAndamento();
        if (v === 'video' && this.videoSeq === 0) this.loadVideo();
      });
    });
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

  protected loadAndamento(): void {
    const seq = ++this.andamentoSeq;
    this.andamentoLoading.set(true);
    this.andamentoError.set(null);
    this.conteggi.andamento(this.mesiAndamento()).subscribe({
      next: (data) => {
        if (seq !== this.andamentoSeq) return;
        this.andamento.set(data);
        this.andamentoLoading.set(false);
      },
      error: (err: unknown) => {
        if (seq !== this.andamentoSeq) return;
        this.andamentoLoading.set(false);
        this.andamentoError.set(
          apiErrorMessage(err, 'Caricamento dei conteggi non riuscito.'),
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

  /** La richiesta in volo della scheda che si sta guardando. */
  protected readonly caricamentoScheda = computed(() => {
    switch (this.vista()) {
      case 'abbonati':
      case 'incassi':
        return this.statsLoading();
      case 'andamento':
        return this.andamentoLoading();
      case 'video':
        return this.videoLoading();
    }
  });

  /** L'errore della scheda che si sta guardando: la banda ne mostra uno solo. */
  protected readonly erroreScheda = computed(() => {
    switch (this.vista()) {
      case 'abbonati':
      case 'incassi':
        return this.statsError();
      case 'andamento':
        return this.andamentoError();
      case 'video':
        return this.videoError();
    }
  });

  /** «Ricarica» e «Riprova» rifanno SOLO la rotta della scheda. */
  protected ricaricaScheda(): void {
    switch (this.vista()) {
      case 'abbonati':
      case 'incassi':
        this.loadStats();
        return;
      case 'andamento':
        this.loadAndamento();
        return;
      case 'video':
        this.loadVideo();
        return;
    }
  }

  /** Il ponte fra il valore-stringa del filtro e il signal numerico. */
  protected setMesiDaFiltro(v: string): void {
    this.setMesi(Number(v));
  }

  protected setMesiAndamentoDaFiltro(v: string): void {
    this.setMesiAndamento(Number(v));
  }

  protected setGiorniDaFiltro(v: string): void {
    this.setGiorni(Number(v));
  }

  protected setMesi(n: number): void {
    if (n === this.mesi()) return;
    this.mesi.set(n);
    this.loadStats();
  }

  protected setMesiAndamento(n: number): void {
    if (n === this.mesiAndamento()) return;
    this.mesiAndamento.set(n);
    this.loadAndamento();
  }

  protected setGiorni(n: number): void {
    if (n === this.giorni()) return;
    this.giorni.set(n);
    this.loadVideo();
  }

  // ── Abbonati ─────────────────────────────────────────────────────────────

  /**
   * `hannoAccessoOra - conAbbonamentoValido`: quanti entrano SENZA un
   * abbonamento in regola. L'identità dichiarata dal backend dice che sono
   * tutti e soli `senzaScadenza + daDeclassare`, cioè accessi dati a mano.
   * ⚠️ È una differenza fra CONTEGGI di persone, non denaro.
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
   * Il funnel mensile, denso: registrazioni (sparse dal backend), le
   * verificate a oggi, i primi abbonamenti paganti (da `acquisizione`) e la
   * fotografia degli abbonati a fine mese — che il backend manda SOLO per i
   * mesi chiusi: il mese corrente resta `null`, e la tabella stampa «—».
   */
  private readonly crescitaAsc = computed<RigaCrescita[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const reg = new Map(s.crescita.registrazioniMensili.map((r) => [r.mese, r]));
    const fine = new Map(
      s.crescita.abbonatiFineMese.map((r) => [r.mese, r.attivi]),
    );
    const primi = new Map(
      s.acquisizione.serieMensile.map((r) => [r.mese, r.paganti.nuovi]),
    );
    const chiavi = chiaviMesi(
      finestraMesi(this.meseCorrente(), s.finestraMesi),
      [...reg.keys()],
    );
    return chiavi.map((mese) => ({
      mese,
      registrati: reg.get(mese)?.registrati ?? 0,
      verificati: reg.get(mese)?.verificati ?? 0,
      primiAbbonamenti: primi.get(mese) ?? 0,
      abbonatiFine: fine.get(mese) ?? null,
    }));
  });

  /** In tabella il mese più recente sta in cima: è quello che si legge per primo. */
  protected readonly crescitaRows = computed(() =>
    [...this.crescitaAsc()].reverse(),
  );

  /** Le registrazioni del mese in corso, per la tessera. */
  protected readonly registrazioniMese = computed<RigaCrescita | null>(() => {
    const corrente = this.meseCorrente();
    return this.crescitaAsc().find((r) => r.mese === corrente) ?? null;
  });

  // ── Incassi ──────────────────────────────────────────────────────────────

  /**
   * Serie densa in ordine cronologico: i mesi senza righe rientrano come €0.
   *
   * Il backend restituisce solo i mesi CON dati. Un mese assente dalla tabella
   * si legge "non è successo niente" invece di "zero euro incassati", e nel
   * grafico sposterebbe le colonne come se quel mese non fosse mai esistito.
   */
  protected readonly incassoAsc = computed<StatsMeseIncasso[]>(() => {
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
          puntiEur: 0,
          ordini: 0,
          stimati: 0,
          perMetodo: [],
        },
    );
  });

  protected readonly incassoRows = computed(() =>
    [...this.incassoAsc()].reverse(),
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
    return chiavi.map(
      (mese) => per.get(mese) ?? { mese, punti: 0, manuale: 0, omaggio: 0 },
    );
  });

  protected readonly senzaCassaRows = computed(() =>
    [...this.senzaCassaAsc()].reverse(),
  );

  /** Tabella di soli zeri = rumore: si mostra solo se c'è stata un'attivazione. */
  protected readonly haSenzaCassa = computed(() =>
    this.senzaCassaAsc().some(
      (r) => r.punti > 0 || r.manuale > 0 || r.omaggio > 0,
    ),
  );

  /** Le attivazioni senza cassa di UN mese, per la modale dell'incasso. */
  protected senzaCassaDel(mese: string): StatsMeseSenzaCassa | null {
    return this.senzaCassaAsc().find((r) => r.mese === mese) ?? null;
  }

  // ── Rinnovi ──────────────────────────────────────────────────────────────

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

  // ── Acquisizione ─────────────────────────────────────────────────────────

  protected readonly acquisizioneAsc = computed<StatsMeseAcquisizione[]>(() => {
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

  // ── Andamento (dai Conteggi, in CENTESIMI) ───────────────────────────────

  /** In tabella il mese più recente sta in cima. */
  protected readonly andamentoRows = computed<RigaAndamento[]>(() =>
    [...(this.andamento()?.mesi ?? [])].reverse(),
  );

  /**
   * Il mese aperto più recente e l'ultimo congelato, per le due tessere.
   * ⚠️ Chiavati su `provvisorio` e MAI su `stato`: un mese CHIUSO il cui
   * riepilogo non si è salvato alla chiusura si ricalcola a ogni lettura ed è
   * provvisorio a tutti gli effetti — e il server lo tiene fuori dai totali.
   */
  protected readonly meseProvvisorio = computed<RigaAndamento | null>(
    () => this.andamentoRows().find((r) => r.provvisorio) ?? null,
  );

  protected readonly meseCongelato = computed<RigaAndamento | null>(
    () => this.andamentoRows().find((r) => !r.provvisorio) ?? null,
  );

  /** «settembre 2026, ottobre 2026»: i mesi che il server non ha calcolato. */
  protected readonly nonCalcolatiEtichette = computed(() =>
    (this.andamento()?.nonCalcolati ?? []).map((m) => m.etichetta).join(', '),
  );

  // ── Video ────────────────────────────────────────────────────────────────

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

  // ── Formattatori propri della pagina ─────────────────────────────────────

  /** Le ore guardate: «200,5». */
  protected ore(v: number): string {
    return ORE.format(v);
  }

  protected visibilityLabel(v: string): string {
    return VISIBILITY_LABELS[v] ?? v;
  }

  /**
   * Il sotto-testo della lezione nella tabella video: «High · 12/07/2026 ·
   * guid», più il titolo Bunny se diverge. Una stringa sola perché va sia nel
   * testo sia nel `title` che rende leggibile ciò che l'ellissi taglia — e due
   * composizioni della stessa riga divergono (precedente delle news).
   */
  protected subLezione(r: RigaVideoLezione): string {
    const pezzi: string[] = [];
    if (r.stakes) pezzi.push(r.stakes === 'HIGH' ? 'High' : 'Low');
    if (r.videoDate) {
      const d = this.date.transform(r.videoDate, 'dd/MM/yyyy');
      if (d) pezzi.push(d);
    }
    pezzi.push(r.guid);
    let sub = pezzi.join(' · ');
    if (r.titoloVideo && r.titoloVideo !== r.titolo) {
      sub += ` · su Bunny: "${r.titoloVideo}"`;
    }
    return sub;
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
}
