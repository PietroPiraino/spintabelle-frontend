import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Observable } from 'rxjs';
import {
  HealthStatus,
  NEWS_PARSER_KEYS_BY_STRATEGY,
  NEWS_SOURCE_HEALTH_LABELS,
  NEWS_STRATEGY_LABELS,
  NewsParserKey,
  NewsSource,
  NewsSourceLanguage,
  NewsSourcePayload,
  NewsSourceSeed,
  NewsStrategy,
} from '../../../core/models/api.models';
import { HealthService } from '../../../core/services/health.service';
import { NewsSourcesService } from '../../../core/services/news-sources.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';

// ───────────────────────────────────────────────────────────────────────────
// Specchi dei vincoli del server. ⚠️ L'AUTORITÀ RESTA IL SERVER: qui i numeri
// servono a non far partire un viaggio che finirebbe in 400, mai a decidere.
// Se un giorno divergessero, chi rifiuta è il ValidationPipe, e il suo
// messaggio italiano nomina il limite vero.
// ───────────────────────────────────────────────────────────────────────────

/** Specchio di `CreateNewsSourceDto.name` (`@MinLength(2) @MaxLength(80)`). */
const NOME_MIN = 2;
const NOME_MAX = 80;

/** Specchio di `slug` (`@MinLength(2) @MaxLength(40) @Matches(/^[a-z0-9-]+$/)`). */
const SLUG_MIN = 2;
const SLUG_MAX = 40;
const SLUG_RE = /^[a-z0-9-]+$/;

/** Specchio di `endpointUrl` (`@MinLength(8) @MaxLength(500)`). */
const URL_MIN = 8;
const URL_MAX = 500;

/**
 * Specchio di `pollMinutes` (`@Min(5) @Max(10080)`).
 *
 * Il minimo non è arbitrario: 5 minuti è l'intervallo del tick, e un numero più
 * basso non comprerebbe una richiesta in più. Il massimo è una settimana —
 * oltre, la riga è spenta, non lenta.
 */
const POLL_MIN = 5;
const POLL_MAX = 10_080;

/** Specchio di `baselineItemsPerDay` (`@Min(0) @Max(1000)`, **decimali ammessi**). */
const BASELINE_MIN = 0;
const BASELINE_MAX = 1000;

/** Specchio di `note` (`@MaxLength(500)`) e di `excludeCategoryIds` (`@ArrayMaxSize(50)`). */
const NOTA_MAX = 500;
const CATEGORIE_MAX = 50;

// ── Specchi dei tre rilevatori di salute (`news-source-health.ts`) ──────────
// Servono a RICOSTRUIRE il perché di uno stato: il backend calcola i motivi in
// italiano ma **non li espone** (vivono dentro il service e finiscono nel
// digest email). Il pannello ha solo `healthState`, e uno stato senza ragione
// manda a cercare nei log di Render — che è esattamente il posto in cui il dato
// non c'è più.

const FALLIMENTI_DEGRADATA = 3;
const FALLIMENTI_MORTA = 12;
const STALLO_K = 6;
const STALLO_PAVIMENTO_MS = 24 * 60 * 60 * 1000;
const STALLO_MOLTIPLICATORE_MORTA = 3;
const VOLUME_SOTTO = 0.4;
const VOLUME_SOPRA = 2.5;
/** Giorni di osservazione sotto i quali l'EMA del volume può essere in riscaldamento. */
const RISCALDAMENTO_GIORNI = 7;

/** Backoff: 5 min × 2^(n−1), cap 6 ore (il tetto arriva al 7° fallimento). */
const BACKOFF_MAX_MINUTI = 360;

/** Ogni quanto gira il cron dell'ingest, in minuti (`EVERY_5_MINUTES`). */
const TICK_INGEST_MINUTI = 5;

/**
 * Passo del battito interno: invecchia le etichette **e rilegge i dati**.
 *
 * ⚠️ Le due cose vanno insieme, e questa è la riga che rende la schermata un
 * cruscotto invece di un'istantanea. «Ultimo articolo 3 ore fa» e «sospesa per
 * altri 12 min» invecchiano da soli, ma se accanto non si rileggesse l'elenco
 * il risultato sarebbe peggiore del nulla: una pagina che si muove e non sa
 * niente. Lo scenario è quello per cui esiste il pannello — si accende la prima
 * fonte, `lastItemAt` è assente, si torna dopo dieci minuti e la riga direbbe
 * ancora «Non ha ancora raccolto» su una fonte che nel frattempo ha ingerito
 * venti articoli, perché quelle frasi stanno nei rami «dato assente», dove
 * l'orologio non cambia niente.
 *
 * Un minuto: nessuna soglia di questa pagina è più fine, e il tick dell'ingest
 * gira ogni cinque — così una novità si vede al più tardi un minuto dopo che è
 * stata scritta.
 */
const TICK_MS = 60_000;

const GIORNO_ORA = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * ⚠️ **Ogni numero decimale di questa pagina passa da qui.** La pagina è in
 * italiano: un `{{ valore }}` crudo stampa «3.51» col punto a due centimetri
 * dal «3,51» che questo formattatore produce, sulla stessa grandezza e nella
 * stessa schermata.
 *
 * ⚠️ Due decimali, mentre `num()` lato server (`news-source-health.ts`) ne usa
 * uno. **È voluto e non va allineato**: quel formattatore serve le righe del
 * digest, questo serve anche a stampare il volume *configurato*, e un owner che
 * ha scritto `3,51` non deve leggere `3,5` nella sezione Configurazione. Le due
 * rese dicono la stessa cosa con un arrotondamento diverso — al contrario delle
 * durate, dove «90 min» e «2 ore» si leggono come due attese diverse: per
 * quelle `durata()` qui sotto ricalca `durataLabel()` riga per riga.
 */
const NUM = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

/** Lingue offerte dal form (specchio di `NEWS_SOURCE_LANGUAGES`). */
const LINGUE: readonly { valore: NewsSourceLanguage; label: string }[] = [
  { valore: 'it', label: 'Italiano' },
  { valore: 'en', label: 'Inglese' },
];

/**
 * Durata in italiano leggibile — stessa forma di `durataLabel()` lato server,
 * così il pannello e l'email del digest non raccontano la stessa attesa con due
 * unità diverse ("90 min" contro "2 ore" sullo stesso guasto).
 */
function durata(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 90) return `${min} min`;
  const ore = Math.round(min / 60);
  if (ore < 48) return `${ore} ore`;
  return `${Math.round(ore / 24)} giorni`;
}

/**
 * Istante di una data ISO, o `null` se manca / non è leggibile.
 *
 * ⚠️ Il ramo `NaN` non è pedanteria: un `new Date('...')` malformato dà `NaN`, e
 * ogni conto che ne discende diventa `NaN` — che stampato è la parola "NaN"
 * dentro un cruscotto, cioè un guasto della pagina travestito da guasto della
 * fonte.
 */
function istante(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Soglia di stallo in ms: `k × mediana`, mai sotto il pavimento di 24 ore. */
function sogliaStalloMs(medianGapMinutes?: number): number {
  if (!medianGapMinutes || medianGapMinutes <= 0) return STALLO_PAVIMENTO_MS;
  return Math.max(STALLO_PAVIMENTO_MS, STALLO_K * medianGapMinutes * 60_000);
}

function num(n: number): string {
  return NUM.format(n);
}

// ── Validatori del form, puri ───────────────────────────────────────────────

function validaNome(v: string): string | null {
  const t = v.trim();
  if (t.length < NOME_MIN || t.length > NOME_MAX) {
    return `Il nome deve avere fra ${NOME_MIN} e ${NOME_MAX} caratteri.`;
  }
  return null;
}

function validaSlug(v: string): string | null {
  const t = v.trim();
  if (t.length < SLUG_MIN || t.length > SLUG_MAX) {
    return `Lo slug deve avere fra ${SLUG_MIN} e ${SLUG_MAX} caratteri.`;
  }
  // Stesso messaggio del DTO, parola per parola: chi lo legge due volte non
  // deve chiedersi se sono due regole diverse.
  if (!SLUG_RE.test(t)) {
    return 'Lo slug ammette solo minuscole, cifre e trattini.';
  }
  return null;
}

function validaEndpoint(v: string): string | null {
  const t = v.trim();
  if (t.length < URL_MIN || t.length > URL_MAX) {
    return `L'indirizzo deve avere fra ${URL_MIN} e ${URL_MAX} caratteri.`;
  }
  if (!/^https?:\/\//i.test(t)) {
    return 'Sono ammessi solo indirizzi http:// o https://.';
  }
  return null;
}

function validaPoll(v: string): string | null {
  const n = Number(v.trim());
  if (!v.trim() || !Number.isInteger(n) || n < POLL_MIN || n > POLL_MAX) {
    return `La cadenza è un numero intero di minuti fra ${POLL_MIN} e ${POLL_MAX}.`;
  }
  return null;
}

/** ⚠️ Vuoto è legittimo: il campo è opzionale (e il rilevatore resta inerte). */
function validaBaseline(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replace(',', '.'));
  if (!Number.isFinite(n) || n < BASELINE_MIN || n > BASELINE_MAX) {
    return `Il volume atteso è un numero fra ${BASELINE_MIN} e ${BASELINE_MAX} (i decimali sono ammessi).`;
  }
  return null;
}

function validaNota(v: string): string | null {
  return v.length > NOTA_MAX
    ? `La nota non può superare ${NOTA_MAX} caratteri.`
    : null;
}

/** Gli id numerici di WordPress, scritti separati da virgole o spazi. */
function parseCategorie(v: string): number[] {
  return v
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n >= 1);
}

function validaCategorie(v: string): string | null {
  const pezzi = v.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  if (pezzi.length === 0) return null;
  if (pezzi.some((p) => !/^\d+$/.test(p) || Number(p) < 1)) {
    return 'Le categorie sono id numerici di WordPress, interi e maggiori di zero.';
  }
  if (pezzi.length > CATEGORIE_MAX) {
    return `Al massimo ${CATEGORIE_MAX} categorie.`;
  }
  return null;
}

/** Tono della pastiglia di stato: guida il colore, e nient'altro. */
type Tono = 'spenta' | 'attesa' | 'ok' | 'allarme' | 'grave';

/** Quale mutazione è in volo: mai un booleano unico (vedi `azione`). */
type Quale = 'accendi' | 'spegni' | 'salva' | 'elimina';

interface VoceRiepilogo {
  key: string;
  count: number;
  label: string;
}

/** Una data resa due volte: come la si legge, e l'istante esatto per l'attributo. */
interface Quando {
  testo: string;
  esatto: string | null;
}

/** La riga come la legge il cruscotto: la fonte più tutto ciò che se ne deduce. */
interface Riga {
  f: NewsSource;
  stato: { etichetta: string; tono: Tono; nota: string | null };
  /** Attesa di backoff ancora in corso, in chiaro. */
  backoff: string | null;
  ultimoArticolo: Quando;
  ultimoSuccesso: Quando;
  /**
   * Un errore registrato che **i contatori non mostrano**: vedi `spiaErrore()`.
   * Sta sulla riga CHIUSA di proposito.
   */
  spiaErrore: string | null;
  /** Le ragioni dello stato, **ricostruite** dai contatori. */
  perche: string[];
  /** Ciò che il pannello **non sa ancora**: mai un allarme, mai un colore. */
  avvisi: string[];
  errore: { quando: string; testo: string } | null;
  /** Volume misurato contro atteso, quando entrambi ci sono. */
  volume: string | null;
  /** Il solo volume atteso, in italiano, quando la misura non c'è ancora. */
  volumeAtteso: string | null;
  /** Cadenza misurata dal server, in italiano, o `null` se non c'è. */
  cadenzaMisurata: string | null;
  cadenza: string;
}

/**
 * Cruscotto delle **Fonti della redazione** (`/admin/fonti`).
 *
 * ⚠️ **Non è un CRUD, ed è la ragione per cui la forma è questa.** Da qui
 * l'owner accende la **prima** fonte e poi la guarda lavorare: la schermata deve
 * rispondere a «sta funzionando?» in un colpo d'occhio e a «cosa è andato
 * storto?» senza aprire i log di Render — che, su Atlas Flex e sul tier corrente
 * di Render, dopo poco non ci sono più. Se dopo il primo tick non si capisce se
 * la fonte ha preso qualcosa, la schermata ha fallito anche con tutti i pulsanti
 * funzionanti.
 *
 * ⚠️ **La coppia che conta è «risponde» contro «porta»**: `lastSuccessAt` lo
 * tocca anche un 304, `lastItemAt` no. Il modo più comune in cui una fonte muore
 * è rispondere 200 senza item nuovi (la news-sitemap di PokerItaliaWeb è ferma
 * al 22 luglio e risponde 200), e a quel guasto Sentry è cieco per costruzione:
 * nessuna eccezione, nessuno status ≥ 500. Le due date stanno una accanto
 * all'altra in ogni riga per questo.
 *
 * ⚠️ **Si accende una fonte per volta.** Sono redazioni vere: accenderne cinque
 * insieme significa non sapere quale si comporta male. Il pannello lo **dice**
 * nella conferma di accensione — non lo vieta.
 *
 * ⚠️ **Nessuno stato inventato.** Ogni rilevatore che non può misurare torna
 * `SANA` lato server, e qui vale lo stesso: l'assenza di un dato non si colora
 * di rosso e non diventa un "sospetta". «Non lo so ancora» e «va male» sono due
 * frasi diverse, e finiscono in due elenchi diversi (`avvisi` e `perche`).
 *
 * ⚠️ **Niente `confirm()` nativi e niente modali** (idioma `live-room`): due
 * conferme in linea, una sola aperta per pagina.
 */
@Component({
  selector: 'app-admin-fonti',
  imports: [IconComponent],
  templateUrl: './admin-fonti.component.html',
  styleUrls: ['../admin-shared.scss', './admin-fonti.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFontiComponent {
  private readonly api = inject(NewsSourcesService);
  private readonly healthApi = inject(HealthService);
  private readonly toast = inject(ToastService);

  // ── Costanti esposte al template ──

  protected readonly nomeMax = NOME_MAX;
  protected readonly slugMax = SLUG_MAX;
  protected readonly urlMax = URL_MAX;
  protected readonly notaMax = NOTA_MAX;
  protected readonly pollMin = POLL_MIN;
  protected readonly pollMax = POLL_MAX;
  protected readonly baselineMax = BASELINE_MAX;
  protected readonly tickIngestMinuti = TICK_INGEST_MINUTI;
  protected readonly backoffMaxOre = BACKOFF_MAX_MINUTI / 60;
  protected readonly lingue = LINGUE;
  /** Le cinque strategie, con il parser che le serve (vuoto = non disponibile). */
  protected readonly strategie = (
    Object.keys(NEWS_STRATEGY_LABELS) as NewsStrategy[]
  ).map((s) => ({
    valore: s,
    label: NEWS_STRATEGY_LABELS[s],
    disponibile: NEWS_PARSER_KEYS_BY_STRATEGY[s].length > 0,
  }));

  // ── Stato della lista ──

  /** `null` = non ancora caricata (≠ caricata e vuota: sono due schermate diverse). */
  protected readonly fonti = signal<NewsSource[] | null>(null);
  protected readonly caricamento = signal(false);
  /**
   * ⚠️ Banda persistente, e la lista già caricata **resta in pagina**: un guasto
   * di rete non deve somigliare a «nessuna fonte configurata», che qui vorrebbe
   * dire «la redazione non ha rubinetti» invece di «non ho potuto chiedere».
   */
  protected readonly erroreLista = signal<string | null>(null);

  /** Le cinque righe del censimento (accessorio: un guasto qui non è una banda). */
  protected readonly seeds = signal<NewsSourceSeed[]>([]);
  protected readonly seedNonDisponibile = signal(false);

  /** `/health`: l'unico posto da cui si sa se l'interruttore generale è acceso. */
  protected readonly salute = signal<HealthStatus | null>(null);
  /** ⚠️ «Non lo so» è una risposta legittima: non si finge un "on". */
  protected readonly saluteIgnota = signal(false);

  /**
   * Quando l'elenco è stato letto per l'ultima volta.
   *
   * ⚠️ Serve a una cosa sola, e non è cosmesi: rendere **visibile** l'età dei
   * dati. Con un battito che rilegge ogni minuto questa riga dice sempre
   * «adesso» — e il momento in cui smette di dirlo (rete giù, scheda sospesa dal
   * sistema, backend riavviato) è l'unico segnale che distingue un cruscotto
   * fermo da un cruscotto che non ha niente da dire.
   */
  protected readonly aggiornatoAt = signal<number | null>(null);

  /** Riga con il dettaglio aperto: una sola per volta. */
  protected readonly apertaId = signal<string | null>(null);

  /**
   * Conferma in linea aperta (`accendi:<id>` | `elimina:<id>`), o `null`.
   * Una sola per pagina: due conferme aperte insieme sono due modi di
   * confondersi su quale riga si sta decidendo.
   */
  protected readonly confirming = signal<string | null>(null);

  /**
   * QUALE mutazione è in volo, su quale riga — non un booleano unico.
   *
   * Con un booleano il pulsante avrebbe annunciato l'azione sbagliata mentre ne
   * girava un'altra (lezione della coda di revisione): su una schermata che
   * accende richieste verso un sito vero, «Accendo…» mostrato mentre si salva
   * un'altra riga è esattamente la piccola bugia che non ci si può permettere.
   */
  protected readonly azione = signal<{ id: string; quale: Quale } | null>(null);

  /** Una mutazione alla volta in tutta la pagina: blocca il doppio tocco. */
  protected readonly inVolo = computed(() => this.azione() !== null);

  // ── Stato del form ──

  protected readonly formAperto = signal(false);
  /** `null` = nuova fonte; altrimenti l'id della riga in modifica. */
  protected readonly modificaId = signal<string | null>(null);
  /** Errore dell'ultimo salvataggio: vive **dentro** il form, accanto ai campi. */
  protected readonly formErrore = signal<string | null>(null);
  /** Un salvataggio è stato tentato: da qui in poi gli errori si mostrano tutti. */
  protected readonly provato = signal(false);

  protected readonly fNome = signal('');
  protected readonly fSlug = signal('');
  protected readonly fStrategy = signal<NewsStrategy>('WP_REST');
  protected readonly fEndpoint = signal('');
  protected readonly fCategorie = signal('');
  /**
   * ⚠️ Il signal conserva il valore **anche quando il campo è nascosto**
   * (strategia non WP REST): il payload lo manda sempre, quindi azzerarlo alla
   * sparizione significherebbe spegnere in silenzio la spunta di chi passa a
   * RSS2 e torna indietro.
   */
  protected readonly fEscludiContenuto = signal(false);
  protected readonly fLingua = signal<NewsSourceLanguage>('it');
  protected readonly fPoll = signal('60');
  protected readonly fBaseline = signal('');
  protected readonly fNote = signal('');

  /** Orologio interno: le attese e le età invecchiano da sole. */
  private readonly adesso = signal(Date.now());

  constructor() {
    this.carica();
    this.caricaSeed();
    this.caricaSalute();
    const t = setInterval(() => this.battito(), TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  /**
   * Il battito: avanza l'orologio **e** rilegge dal server.
   *
   * ⚠️ **Salta mentre una mutazione è in volo.** `carica()` spegne `azione` alla
   * risposta: un ricaricamento di sfondo che atterra in mezzo riaccenderebbe i
   * comandi mentre la PATCH è ancora per aria — cioè riaprirebbe esattamente la
   * finestra di doppio tocco che `azione` esiste per chiudere.
   *
   * ⚠️ E salta se una lettura è già in corso: su una rete lenta, un battito al
   * minuto su una GET che ne impiega due accoderebbe richieste che si
   * sorpasserebbero fra loro.
   */
  private battito(): void {
    this.adesso.set(Date.now());
    if (this.inVolo() || this.caricamento()) return;
    this.carica();
    this.caricaSalute();
    // Il censimento si richiede solo se manca: è una lista statica.
    if (this.seedNonDisponibile()) this.caricaSeed();
  }

  // ── Derivati della lista ──

  protected readonly righe = computed<Riga[]>(() => {
    const ora = this.adesso();
    // ⚠️ Ordine del server (per slug) e basta: mettere in cima i guasti
    // farebbe saltare una riga da un capo all'altro dell'elenco proprio nel
    // momento in cui la si accende o spegne, cioè quando la si sta guardando.
    return (this.fonti() ?? []).map((f) => this.componiRiga(f, ora));
  });

  protected readonly accese = computed(
    () => (this.fonti() ?? []).filter((f) => f.enabled).length,
  );

  /**
   * Striscia di sintesi: la risposta a «sta funzionando?» prima di leggere le
   * righe. ⚠️ Solo le voci con conteggio > 0 — uno zero non è un'informazione,
   * è rumore che fa sembrare pieno un cruscotto vuoto.
   */
  protected readonly riepilogo = computed<VoceRiepilogo[]>(() => {
    const righe = this.righe();
    const conta = (t: Tono): number => righe.filter((r) => r.stato.tono === t).length;
    const voci: VoceRiepilogo[] = [
      { key: 'ok', count: conta('ok'), label: 'in salute' },
      { key: 'attesa', count: conta('attesa'), label: 'in attesa del primo articolo' },
      { key: 'allarme', count: conta('allarme'), label: 'degradate' },
      { key: 'grave', count: conta('grave'), label: 'morte' },
      { key: 'spenta', count: conta('spenta'), label: 'spente' },
    ];
    return voci.filter((v) => v.count > 0);
  });

  /** ⚠️ Interruttore generale spento: accendere una fonte non produce nulla. */
  protected readonly maestroSpento = computed(
    () => this.salute()?.newsIngest === 'off',
  );

  /** Modalità assenza della Redazione: ferma la **generazione**, non la raccolta. */
  protected readonly generazioneInPausa = computed(
    () => this.salute()?.newsPipeline === 'paused',
  );

  /**
   * Il caso che si legge peggio di tutti: fonti accese mentre il rubinetto
   * generale è chiuso. A schermo sembrano al lavoro e non stanno chiedendo
   * niente a nessuno.
   */
  protected readonly acceseMaFerme = computed(
    () => this.maestroSpento() && this.accese() > 0,
  );

  /**
   * Le righe del censimento non ancora configurate (per slug).
   *
   * ⚠️ **A elenco sconosciuto non propone niente.** `null` non è «non c'è
   * niente configurato», è «non ho potuto chiedere»: con la GET dell'elenco
   * fallita l'insieme dei presenti sarebbe vuoto e il pannello titolerebbe
   * «Comincia da qui» con tutte e cinque le fonti, **sotto la banda rossa**.
   * L'owner cliccherebbe su una fonte che esiste già e lo scoprirebbe con un
   * 409 sullo slug al salvataggio. È la stessa confusione che il blocco lista
   * evita di proposito, spostata di due sezioni.
   */
  protected readonly seedMancanti = computed(() => {
    const elenco = this.fonti();
    if (elenco === null) return [];
    const presenti = new Set(elenco.map((f) => f.slug));
    return this.seeds().filter((s) => !presenti.has(s.slug));
  });

  /** ⚠️ Caricato **e** vuoto — non «non ancora caricato». */
  protected readonly elencoVuoto = computed(() => this.fonti()?.length === 0);

  /**
   * Età dei dati in chiaro. Sotto il minuto e mezzo si dice «adesso»: con un
   * battito al minuto è la normalità, e vederla cambiare è il segnale.
   */
  protected readonly freschezza = computed<string | null>(() => {
    const t = this.aggiornatoAt();
    if (t === null) return null;
    const eta = this.adesso() - t;
    return eta < 90_000 ? 'Aggiornato adesso' : `Aggiornato ${durata(eta)} fa`;
  });

  // ── Composizione di una riga ──

  private componiRiga(f: NewsSource, ora: number): Riga {
    return {
      f,
      stato: this.stato(f, ora),
      backoff: this.backoff(f, ora),
      ultimoArticolo: this.quandoArticolo(f, ora),
      ultimoSuccesso: this.quandoSuccesso(f, ora),
      spiaErrore: this.spiaErrore(f, ora),
      perche: f.enabled ? this.perche(f, ora) : [],
      avvisi: f.enabled ? this.avvisi(f, ora) : [],
      errore: this.errore(f),
      volume: this.volume(f),
      // ⚠️ `0` è un valore che vuol dire «controllo spento», non «assente»:
      // resta falsy come nel resto del pannello (e il form lo dice).
      volumeAtteso:
        f.baselineItemsPerDay && typeof f.emaItemsPerDay !== 'number'
          ? num(f.baselineItemsPerDay)
          : null,
      cadenzaMisurata: f.medianGapMinutes ? num(f.medianGapMinutes) : null,
      cadenza: `ogni ${f.pollMinutes} min`,
    };
  }

  /**
   * La pastiglia di stato.
   *
   * ⚠️ **«Spenta» e «accesa e ferma» sono cose diversissime** e a colpo d'occhio
   * si confondono: una fonte spenta non è un allarme e non prende colore, una
   * accesa che non porta niente da un giorno sì. Per questo `enabled` viene
   * PRIMA di `healthState` — e per questo su una riga spenta lo stato di salute
   * si mostra come **ultima valutazione**, non come diagnosi di adesso: una
   * sorgente spenta non viene valutata affatto, quindi quel valore è congelato e
   * può restare «Morta» per sempre senza che nulla sia rotto.
   */
  private stato(
    f: NewsSource,
    ora: number,
  ): { etichetta: string; tono: Tono; nota: string | null } {
    if (!f.enabled) {
      const mai = !f.osservataDa;
      const vecchio = NEWS_SOURCE_HEALTH_LABELS[f.healthState];
      return {
        etichetta: 'Spenta',
        tono: 'spenta',
        nota: mai
          ? 'Mai accesa: non ha mai interrogato niente.'
          : f.healthState === 'SANA'
            ? 'Non viene interrogata.'
            : `Ultima valutazione da accesa: ${vecchio} — congelata.`,
      };
    }

    if (f.healthState === 'MORTA' || f.healthState === 'DEGRADATA') {
      const cambiato = istante(f.healthChangedAt);
      return {
        etichetta: NEWS_SOURCE_HEALTH_LABELS[f.healthState],
        tono: f.healthState === 'MORTA' ? 'grave' : 'allarme',
        // ⚠️ Da `healthChangedAt`, mai da `lastErrorAt`: «morta da 3 giorni»
        // è da quando lo stato è cambiato, non dall'ultimo errore — che su una
        // fonte che risponde 200 senza item non esiste nemmeno.
        nota:
          cambiato !== null && ora > cambiato
            ? `Da ${durata(ora - cambiato)}.`
            : null,
      };
    }

    if (!f.lastItemAt) {
      const da = this.daOsservata(f, ora);
      return {
        etichetta: 'In attesa del primo articolo',
        tono: 'attesa',
        // ⚠️ «Sotto osservazione da», non «accesa da»: `osservataDa` lo scrive
        // il server UNA volta sola (`updateOne` guardata su `$exists:false`) e
        // non lo azzera mai — né allo spegnimento, né alla riaccensione, né in
        // `update()`. Su una riga accesa a marzo, spenta ad aprile e riaccesa
        // adesso, «accesa da 5 mesi» è una storia che non è avvenuta: il conto
        // è fedele al rilevatore del server, sarebbe l'etichetta a mentire.
        nota:
          da !== null
            ? `Sotto osservazione da ${durata(da)}: non ha ancora portato niente.`
            : 'Appena accesa: il primo giro deve ancora arrivare.',
      };
    }

    return { etichetta: 'Sana', tono: 'ok', nota: null };
  }

  /** «Sospesa fino a…»: senza, l'owner vede "accesa" e non capisce il silenzio. */
  private backoff(f: NewsSource, ora: number): string | null {
    const fino = istante(f.backoffUntil);
    if (fino === null || fino <= ora) return null;
    return `Sospesa per altri ${durata(fino - ora)}`;
  }

  /**
   * ⚠️ **`lastItemAt` è il campo che risponde alla domanda del cruscotto.**
   * Assente non vuol dire «mai»: se la fonte non ha mai provato è un'altra cosa
   * — e scrivere «mai» dove il dato non c'è ANCORA manda a cercare un guasto
   * inesistente su una riga appena creata.
   */
  private quandoArticolo(f: NewsSource, ora: number): Quando {
    const t = istante(f.lastItemAt);
    if (t !== null) {
      return { testo: `${durata(Math.max(0, ora - t))} fa`, esatto: GIORNO_ORA.format(t) };
    }
    const da = this.daOsservata(f, ora);
    if (da === null) {
      return { testo: 'Non ha ancora raccolto', esatto: null };
    }
    return {
      testo: `Nessuno da quando è sotto osservazione (${durata(da)})`,
      esatto: null,
    };
  }

  /**
   * Da quanti ms la fonte è sotto osservazione, o `null` se non lo è ancora
   * (o se la data è illeggibile / nel futuro).
   */
  private daOsservata(f: NewsSource, ora: number): number | null {
    const da = istante(f.osservataDa);
    return da !== null && ora > da ? ora - da : null;
  }

  /**
   * ⚠️ **Il rilevatore di volume del server è INERTE durante il riscaldamento**
   * (`emaCampioni < EMA_CAMPIONI_MINIMI`, cioè 7 giorni di campioni), e
   * `emaCampioni` **non è esposto** da `NewsSourceView`: il pannello non può
   * replicare la guardia. La approssima con l'età dell'osservazione, e la
   * approssima **per difetto** — sotto i sette giorni il confronto non diventa
   * una ragione dello stato, perché un pannello che afferma «Volume sotto il
   * previsto» sotto una pastiglia «Sana» sta spiegando uno stato che non c'è.
   * È il primo allarme falso di una funzionalità nuova, cioè quello che decide
   * se il secondo verrà letto: la costante `EMA_CAMPIONI_MINIMI` esiste lato
   * server esattamente per impedirlo.
   */
  private volumeInRiscaldamento(f: NewsSource, ora: number): boolean {
    const eta = this.daOsservata(f, ora);
    return eta === null || eta < RISCALDAMENTO_GIORNI * 86_400_000;
  }

  /**
   * Un errore **registrato adesso** che i contatori della riga non mostrano.
   *
   * ⚠️ Il ramo `ILLEGGIBILE` del tick — formato dichiarato ≠ formato servito,
   * cioè l'errore di configurazione più probabile alla prima accensione — scrive
   * `lastSuccessAt`, `lastErrorAt` e `lastErrorMessage` ma di proposito **non**
   * incrementa `consecutiveFailures` e **non** mette backoff (la sorgente ha
   * risposto: non è un fallimento di trasporto). Senza questa spia quella riga
   * mostra solo segnali positivi — «in attesa del primo articolo», «ultimo
   * successo 2 min fa» — e il messaggio che dice cosa è andato storto resta
   * dietro «Dettagli», dove nessuno lo va a cercare: la diagnosi arriverebbe
   * solo dal rilevatore di stallo, cioè dopo 24 ore.
   *
   * ⚠️ Due esclusioni, e sono ciò che tiene la spia credibile: con almeno un
   * fallimento di fila l'errore è **già** annunciato dal contatore accanto, e un
   * errore più vecchio dell'ultima risposta riuscita è **già rientrato** — una
   * spia accesa su un guasto passato vale quanto una spia sempre accesa.
   */
  private spiaErrore(f: NewsSource, ora: number): string | null {
    if (!f.lastErrorMessage || f.consecutiveFailures > 0) return null;
    const err = istante(f.lastErrorAt);
    const ok = istante(f.lastSuccessAt);
    if (err !== null && ok !== null && ok > err) return null;
    const quando = err !== null && ora > err ? ` (${durata(ora - err)} fa)` : '';
    return `Errore all'ultimo giro${quando}`;
  }

  /**
   * ⚠️ **Un 304 tocca `lastSuccessAt` e nient'altro**: questa data dice che la
   * sorgente RISPONDE, non che abbia portato qualcosa. Non è la prova che
   * l'ingest funziona, ed è metà del guasto più comune quando è fresca e quella
   * dell'articolo è vecchia.
   */
  private quandoSuccesso(f: NewsSource, ora: number): Quando {
    const t = istante(f.lastSuccessAt);
    if (t !== null) {
      return { testo: `${durata(Math.max(0, ora - t))} fa`, esatto: GIORNO_ORA.format(t) };
    }
    if (!f.osservataDa) {
      return { testo: 'Non ha ancora provato', esatto: null };
    }
    return { testo: 'Nessuna risposta riuscita finora', esatto: null };
  }

  /**
   * Le ragioni dello stato, ricostruite dai contatori grezzi: i tre rilevatori
   * di §2.9 rifatti qui perché i loro `motivi` non escono dall'API.
   *
   * ⚠️ **Si accumulano tutti e tre**, non solo quello che ha deciso lo stato:
   * «12 fallimenti consecutivi» + «volume sotto la baseline» sulla stessa riga
   * dicono una cosa in più della somma.
   *
   * ⚠️ **Solo su una fonte accesa.** Su una spenta l'orologio dello stallo
   * continuerebbe a correre e ogni riga in archivio finirebbe per accusare uno
   * stallo che nessuno sta misurando: il tick non valuta le righe spente.
   */
  private perche(f: NewsSource, ora: number): string[] {
    const out: string[] = [];

    if (f.consecutiveFailures >= FALLIMENTI_MORTA) {
      out.push(
        `${f.consecutiveFailures} fallimenti consecutivi: la sorgente non risponde, o risponde con un errore.`,
      );
    } else if (f.consecutiveFailures >= FALLIMENTI_DEGRADATA) {
      out.push(`${f.consecutiveFailures} fallimenti consecutivi.`);
    }

    // ⚠️ L'orologio è `lastItemAt ?? osservataDa`, MAI `lastSuccessAt`: quello
    // lo tocca ogni 304, quindi su una fonte che risponde e non porta niente si
    // azzererebbe a ogni giro e lo stallo non scatterebbe mai.
    const orologio = istante(f.lastItemAt) ?? istante(f.osservataDa);
    if (orologio !== null && ora > orologio) {
      const eta = ora - orologio;
      const soglia = sogliaStalloMs(f.medianGapMinutes);
      if (eta > soglia) {
        const cosa = f.lastItemAt
          ? 'Nessun articolo nuovo'
          : 'Nessun articolo da quando è sotto osservazione';
        const grave = eta > soglia * STALLO_MOLTIPLICATORE_MORTA ? ' — ben oltre' : '';
        out.push(
          `${cosa} da ${durata(eta)}${grave} (soglia ${durata(soglia)}): risponde, ma non pubblica.`,
        );
      }
    }

    const baseline = f.baselineItemsPerDay ?? 0;
    const ema = f.emaItemsPerDay;
    // ⚠️ Il riscaldamento è una guardia del SERVER, non una raffinatezza del
    // pannello: durante quella finestra `rilevatoreVolume()` torna `SANA` e non
    // scrive alcun motivo. Affermare qui una ragione che il server rifiuta di
    // affermare vorrebbe dire spiegare uno stato che non esiste. Il numero non
    // si perde: passa negli avvisi, dichiarato per quello che è.
    if (
      baseline > 0 &&
      typeof ema === 'number' &&
      !this.volumeInRiscaldamento(f, ora)
    ) {
      const rapporto = ema / baseline;
      const confronto = `${num(ema)}/g contro ${num(baseline)}/g attesi`;
      if (rapporto < VOLUME_SOTTO) {
        out.push(`Volume sotto il previsto: ${confronto}.`);
      } else if (rapporto > VOLUME_SOPRA) {
        // Il sovra-volume non è simmetria per eleganza: un filtro di categoria
        // che smette di funzionare in silenzio inonda la pipeline proprio di
        // ciò che l'art. 9 DL 87/2018 rende più caro far entrare.
        out.push(
          `Volume sopra il previsto: ${confronto}. Se la fonte ha un filtro di categoria, controlla che stia ancora filtrando.`,
        );
      }
    }

    return out;
  }

  /**
   * Ciò che il pannello **non sa ancora** — l'altra metà, e non va confusa con
   * la prima: un allarme costruito su una baseline inventata è peggio di nessun
   * allarme, perché il primo avviso falso decide se il secondo verrà letto.
   */
  private avvisi(f: NewsSource, ora: number): string[] {
    const out: string[] = [];

    const baseline = f.baselineItemsPerDay;
    const ema = f.emaItemsPerDay;
    if (!baseline) {
      out.push(
        'Volume atteso non impostato: il controllo sul volume è inerte su questa fonte — non darà mai un allarme, né in meno né in più.',
      );
    } else if (typeof ema !== 'number') {
      out.push(
        'La media degli articoli al giorno non è ancora stata scritta: si aggiorna una volta al giorno.',
      );
    } else if (this.volumeInRiscaldamento(f, ora)) {
      // ⚠️ Il numero si mostra comunque — è un'osservazione, e serve — ma
      // dichiarato come tale e detto come STIMA: il contatore di riscaldamento
      // vero (`emaCampioni`) non è esposto dall'API, e il pannello non può
      // leggerlo. Quello che NON si fa è farne una ragione dello stato.
      out.push(
        `Il controllo sul volume è probabilmente ancora in riscaldamento (servono ${RISCALDAMENTO_GIORNI} giorni di misure): finora ${num(ema)}/g contro ${num(baseline)}/g attesi, ma il server non lo tratta come un allarme e nemmeno questa pagina. È una stima — il pannello non può saperlo con certezza.`,
      );
    }

    if (!f.medianGapMinutes) {
      out.push(
        "Cadenza abituale non ancora misurata (servono almeno tre intervalli fra un articolo e l'altro): finché manca, la soglia di stallo è il solo pavimento di 24 ore.",
      );
    }

    // ⚠️ L'orologio dell'osservazione è quello su cui poggiano «sotto
    // osservazione da …» e la soglia di stallo quando `lastItemAt` manca: se
    // questa riga era già stata accesa in passato, quella durata viene da
    // allora. Dirlo qui è l'unico modo perché «150 giorni» su una fonte
    // riaccesa stamattina non venga letto come un guasto di cinque mesi.
    if (!f.lastItemAt && f.osservataDa) {
      out.push(
        "L'orologio dell'osservazione parte dalla prima valutazione da accesa e non si azzera spegnendo e riaccendendo la fonte: se questa riga era già stata accesa in passato, la durata indicata viene da allora.",
      );
    }

    return out;
  }

  /**
   * ⚠️ Il testo dell'errore si **stampa**, non si nasconde dietro un tooltip: su
   * Atlas Flex i log del database non si scaricano e su Render la ritenzione è
   * corta — un pannello che dice «fallita alle 03:12» senza dire perché manda a
   * cercare dove il dato non c'è più.
   */
  private errore(f: NewsSource): { quando: string; testo: string } | null {
    if (!f.lastErrorMessage) return null;
    const t = istante(f.lastErrorAt);
    return {
      quando: t !== null ? GIORNO_ORA.format(t) : 'data non leggibile',
      testo: f.lastErrorMessage,
    };
  }

  private volume(f: NewsSource): string | null {
    const baseline = f.baselineItemsPerDay;
    const ema = f.emaItemsPerDay;
    if (typeof ema !== 'number') return null;
    return baseline
      ? `${num(ema)}/g misurati · ${num(baseline)}/g attesi`
      : `${num(ema)}/g misurati`;
  }

  protected strategiaLabel(s: NewsStrategy): string {
    return NEWS_STRATEGY_LABELS[s];
  }

  protected linguaLabel(l: NewsSourceLanguage): string {
    return l === 'it' ? 'Italiano' : 'Inglese';
  }

  /** ⚠️ Ogni decimale del template passa da qui: vedi il commento su `NUM`. */
  protected numero(n: number): string {
    return num(n);
  }

  // ── Caricamento ──

  private carica(): void {
    this.caricamento.set(true);
    this.erroreLista.set(null);
    this.api.list().subscribe({
      next: (righe) => {
        this.fonti.set(righe);
        this.caricamento.set(false);
        this.aggiornatoAt.set(Date.now());
        // ⚠️ I comandi si riaccendono QUI, non alla risposta della mutazione:
        // fra le due c'è una finestra in cui a schermo c'è ancora lo stato
        // vecchio, e il secondo tocco di un doppio tap accenderebbe una fonte
        // guardando la riga di prima.
        this.azione.set(null);
      },
      error: (err: unknown) => {
        this.caricamento.set(false);
        this.azione.set(null);
        this.erroreLista.set(
          apiErrorMessage(err, 'Caricamento delle fonti non riuscito.'),
        );
      },
    });
  }

  /**
   * Il censimento. Accessorio: se non arriva, il pannello dice solo che il
   * pulsante di precompilazione non c'è — **nessuna banda d'errore**, che è la
   * corsia della lista.
   */
  private caricaSeed(): void {
    this.api.seed().subscribe({
      next: (righe) => {
        this.seeds.set(righe);
        this.seedNonDisponibile.set(false);
      },
      error: () => {
        this.seeds.set([]);
        this.seedNonDisponibile.set(true);
      },
    });
  }

  private caricaSalute(): void {
    this.healthApi.stato().subscribe({
      next: (s) => {
        this.salute.set(s);
        this.saluteIgnota.set(false);
      },
      error: () => {
        this.salute.set(null);
        this.saluteIgnota.set(true);
      },
    });
  }

  /**
   * Rilettura a comando.
   *
   * ⚠️ Il template la offre **due volte, e non è un doppione**: dentro la banda
   * d'errore («Riprova») e nella testata («Aggiorna»). Il primo esiste solo
   * quando la GET è già fallita — cioè mai, sul percorso felice, che è
   * precisamente quello in cui l'owner sta guardando la prima fonte lavorare.
   */
  protected riprova(): void {
    if (this.inVolo() || this.caricamento()) return;
    this.carica();
    this.caricaSalute();
    if (this.seedNonDisponibile()) this.caricaSeed();
  }

  // ── Disclosure (una riga aperta per volta) ──

  protected isAperta(f: NewsSource): boolean {
    return this.apertaId() === f.id;
  }

  protected toggleDettaglio(f: NewsSource): void {
    if (this.isAperta(f)) {
      this.apertaId.set(null);
      this.confirming.set(null);
      // ⚠️ Il pannello esce dal DOM: senza rimettere il fuoco sul bottone che
      // l'ha aperto, chi usa la tastiera riparte dal <body>.
      this.focus(`dettaglio-toggle-${f.id}`);
      return;
    }
    this.apertaId.set(f.id);
    this.confirming.set(null);
  }

  // ── Conferme in linea ──

  protected isConfirming(key: string): boolean {
    return this.confirming() === key;
  }

  /**
   * ⚠️ **Il bottone che apre la conferma esce dal DOM** (i rami `@else if
   * (!isConfirming(…))` del template): senza spostare il fuoco, chi arriva da
   * tastiera lo perde sul `<body>` e deve ri-tabbare dall'inizio della pagina
   * per raggiungere «Sì, accendi». È lo stesso caso che `toggleDettaglio()`
   * gestisce già per la disclosure — qui sarebbe un'incoerenza interna, non una
   * svista di dominio. E spostare il fuoco **è** l'annuncio: il riquadro porta
   * un `role="group"` etichettato, quindi uno screen reader lo legge entrando.
   */
  protected askConfirm(key: string): void {
    this.confirming.set(key);
    this.focus(`conferma-si-${key}`);
  }

  /** Simmetrico: l'Annulla restituisce il fuoco al comando che riappare. */
  protected cancelConfirm(key?: string): void {
    this.confirming.set(null);
    if (key) this.focus(`cmd-${key}`);
  }

  /**
   * Che cosa comporta accendere **questa** fonte, adesso. Righe che l'owner
   * legge prima del secondo tocco: sono la parte della schermata che vale.
   */
  /**
   * Quando arriva il **primo** giro dopo l'accensione — che non è la cadenza.
   *
   * ⚠️ `sorgenteDovuta()` (lato server) comincia con `if (!s.lastSuccessAt)
   * return true`: una fonte che non ha **mai** risposto è dovuta subito, quindi
   * viene interrogata al tick successivo — entro cinque minuti — qualunque sia
   * il suo `pollMinutes`. Annunciare «entro 60 minuti» manda l'owner via
   * proprio nel momento in cui questa schermata serve, e gli fa leggere come
   * normale un ritardo che invece è un guasto.
   *
   * ⚠️ Il backoff vince su tutto: se la riga ha ancora una sospensione, il
   * primo giro è dopo quella, e nessuna delle due frasi sopra è vera.
   */
  private primoGiro(f: NewsSource, ora: number): string {
    const fino = istante(f.backoffUntil);
    if (fino !== null && fino > ora) {
      return `alla scadenza della sospensione, fra ${durata(fino - ora)}`;
    }
    return f.lastSuccessAt
      ? `entro ${f.pollMinutes} minuti circa`
      : `al primo controllo utile, entro ${TICK_INGEST_MINUTI} minuti`;
  }

  protected avvisiAccensione(f: NewsSource): string[] {
    const ora = this.adesso();
    const out: string[] = [
      `Il primo giro arriva ${this.primoGiro(f, ora)}; da lì in poi il sito verrà interrogato ogni ${f.pollMinutes} minuti circa (con uno scarto casuale del 20%, così le fonti non bussano tutte insieme).`,
    ];
    if (this.maestroSpento()) {
      out.push(
        "⚠️ L'interruttore generale della raccolta è spento: la fonte risulterà accesa qui, ma non partirà nessuna richiesta finché non viene riacceso su Render.",
      );
    }
    if (this.accese() > 0) {
      out.push(
        `Hai già ${this.accese()} ${this.accese() === 1 ? 'fonte accesa' : 'fonti accese'}: puoi accenderne un'altra, ma con due che partono insieme diventa difficile capire quale si comporta male. Il consiglio è aspettare il primo giro.`,
      );
    } else {
      out.push(
        'Sarà la prima fonte accesa: guarda «ultimo articolo» fra un giro e l\'altro prima di accenderne un\'altra.',
      );
    }
    const fino = istante(f.backoffUntil);
    if (fino !== null && fino > this.adesso()) {
      out.push(
        `Ha ancora un'attesa di sospensione (${durata(fino - this.adesso())}): non verrà interrogata prima che scada.`,
      );
    }
    return out;
  }

  // ── Accendere / spegnere ──

  /**
   * ⚠️ Accendere è l'inizio del trattamento: fa partire richieste verso una
   * redazione vera. Per questo passa da una conferma in linea e non da un
   * interruttore che scatta al primo sfioramento.
   */
  protected accendi(f: NewsSource): void {
    this.esegui(
      f.id,
      'accendi',
      () => this.api.update(f.id, { enabled: true }),
      [
        `Fonte «${f.name}» accesa.`,
        this.maestroSpento()
          ? "L'interruttore generale è spento: non partirà nulla finché resta così."
          : `Il primo giro arriva ${this.primoGiro(f, this.adesso())}.`,
      ].join(' '),
      `dettaglio-toggle-${f.id}`,
    );
  }

  /** Spegnere riduce l'attività: nessuna conferma, solo il blocco anti doppio tocco. */
  protected spegni(f: NewsSource): void {
    this.esegui(
      f.id,
      'spegni',
      () => this.api.update(f.id, { enabled: false }),
      `Fonte «${f.name}» spenta: non verrà più interrogata.`,
      `dettaglio-toggle-${f.id}`,
    );
  }

  protected elimina(f: NewsSource): void {
    this.esegui(
      f.id,
      'elimina',
      () => this.api.remove(f.id),
      `Fonte «${f.name}» eliminata. Gli articoli grezzi già raccolti restano fino alla loro scadenza.`,
      // La riga sparisce del tutto: il successore naturale del fuoco è il
      // comando che crea la prossima.
      'fnt-nuova',
    );
  }

  /**
   * Runner delle mutazioni: una alla volta, esito a toast, **ricarica completa**
   * della lista. Non una modifica in posto — la risposta di un PATCH è la riga
   * nuova, ma lo stato di salute lo riscrive il tick e il resto della pagina
   * (riepilogo compreso) deve restare coerente con quello che il server ha.
   */
  private esegui(
    id: string,
    quale: Quale,
    lavoro: () => Observable<unknown>,
    messaggio: string,
    /** Dove rimettere il fuoco: il comando premuto esce sempre dal DOM. */
    fuoco?: string,
  ): void {
    if (this.inVolo()) return;
    this.azione.set({ id, quale });
    lavoro().subscribe({
      next: () => {
        this.confirming.set(null);
        this.toast.success(messaggio);
        if (fuoco) this.focus(fuoco);
        // ⚠️ `azione` resta impostata: la spegne la ricarica. Riaccendere qui
        // offrirebbe i comandi per qualche decina di millisecondi sopra dati
        // che sono già cambiati.
        this.carica();
      },
      error: (err: unknown) => {
        this.azione.set(null);
        this.toast.error(apiErrorMessage(err, 'Operazione non riuscita.'));
      },
    });
  }

  protected inVoloSu(id: string, quale: Quale): boolean {
    const a = this.azione();
    return a?.id === id && a.quale === quale;
  }

  // ── Form ──

  protected readonly parserDerivato = computed<NewsParserKey | null>(() => {
    const ammessi = NEWS_PARSER_KEYS_BY_STRATEGY[this.fStrategy()];
    return ammessi.length > 0 ? ammessi[0] : null;
  });

  /** ⚠️ Le categorie sono id di WordPress: fuori da WP REST non filtrano niente. */
  protected readonly mostraCategorie = computed(
    () => this.fStrategy() === 'WP_REST',
  );

  /**
   * La modifica cambia la **domanda** che si fa alla sorgente.
   *
   * ⚠️ È l'effetto collaterale che il pannello deve dire prima del salvataggio:
   * cambiando strategia, indirizzo o categorie il server azzera i fallimenti
   * consecutivi e butta i validatori del GET condizionale — perché descrivono la
   * vecchia domanda, e un 304 su una domanda diversa farebbe credere che non ci
   * sia niente di nuovo.
   */
  protected readonly cambiaLaRichiesta = computed(() => {
    const id = this.modificaId();
    if (!id) return false;
    const prima = (this.fonti() ?? []).find((f) => f.id === id);
    if (!prima) return false;
    const categorie = this.mostraCategorie()
      ? parseCategorie(this.fCategorie())
      : [];
    const stesseCategorie =
      categorie.length === prima.excludeCategoryIds.length &&
      [...categorie].sort((a, b) => a - b).every(
        (n, i) => n === [...prima.excludeCategoryIds].sort((a, b) => a - b)[i],
      );
    return (
      prima.strategy !== this.fStrategy() ||
      prima.endpointUrl !== this.fEndpoint().trim() ||
      prima.parserKey !== this.parserDerivato() ||
      // ⚠️ La spunta sul corpo cambia `_fields`, cioè cambia la domanda: il
      // server azzera i validatori anche per lei, e l'avviso qui sopra deve
      // dirlo **prima** del salvataggio, non dopo.
      (prima.escludiContenuto ?? false) !== this.fEscludiContenuto() ||
      !stesseCategorie
    );
  });

  /** La riga in modifica, per stampare che cosa si azzera salvando. */
  protected readonly inModifica = computed<NewsSource | null>(() => {
    const id = this.modificaId();
    return id ? ((this.fonti() ?? []).find((f) => f.id === id) ?? null) : null;
  });

  private mostraErrore(valore: string): boolean {
    return this.provato() || valore.trim().length > 0;
  }

  protected readonly erroreNome = computed(() =>
    this.mostraErrore(this.fNome()) ? validaNome(this.fNome()) : null,
  );
  protected readonly erroreSlug = computed(() =>
    this.mostraErrore(this.fSlug()) ? validaSlug(this.fSlug()) : null,
  );
  protected readonly erroreEndpoint = computed(() =>
    this.mostraErrore(this.fEndpoint()) ? validaEndpoint(this.fEndpoint()) : null,
  );
  protected readonly errorePoll = computed(() =>
    this.mostraErrore(this.fPoll()) ? validaPoll(this.fPoll()) : null,
  );
  protected readonly erroreBaseline = computed(() =>
    validaBaseline(this.fBaseline()),
  );
  protected readonly erroreCategorie = computed(() =>
    this.mostraCategorie() ? validaCategorie(this.fCategorie()) : null,
  );
  protected readonly erroreNota = computed(() => validaNota(this.fNote()));

  protected readonly formValido = computed(
    () =>
      this.parserDerivato() !== null &&
      !validaNome(this.fNome()) &&
      !validaSlug(this.fSlug()) &&
      !validaEndpoint(this.fEndpoint()) &&
      !validaPoll(this.fPoll()) &&
      !validaBaseline(this.fBaseline()) &&
      !validaNota(this.fNote()) &&
      !(this.mostraCategorie() && validaCategorie(this.fCategorie())),
  );

  protected apriNuova(): void {
    this.azzeraForm();
    this.modificaId.set(null);
    this.formAperto.set(true);
    this.focus('fonte-nome');
  }

  protected modifica(f: NewsSource): void {
    this.formErrore.set(null);
    this.provato.set(false);
    this.modificaId.set(f.id);
    this.fNome.set(f.name);
    this.fSlug.set(f.slug);
    this.fStrategy.set(f.strategy);
    this.fEndpoint.set(f.endpointUrl);
    this.fCategorie.set(f.excludeCategoryIds.join(', '));
    this.fEscludiContenuto.set(f.escludiContenuto ?? false);
    this.fLingua.set(f.lingua);
    this.fPoll.set(String(f.pollMinutes));
    this.fBaseline.set(
      f.baselineItemsPerDay === undefined ? '' : String(f.baselineItemsPerDay),
    );
    this.fNote.set(f.note ?? '');
    this.formAperto.set(true);
    this.confirming.set(null);
    this.focus('fonte-nome');
  }

  /** Precompila il form dal censimento. ⚠️ **Non salva**: la conferma è umana. */
  protected precompila(s: NewsSourceSeed): void {
    this.azzeraForm();
    this.modificaId.set(null);
    this.fNome.set(s.name);
    this.fSlug.set(s.slug);
    this.fStrategy.set(s.strategy);
    this.fEndpoint.set(s.endpointUrl);
    this.fCategorie.set(s.excludeCategoryIds.join(', '));
    this.fEscludiContenuto.set(s.escludiContenuto ?? false);
    this.fLingua.set(s.lingua);
    this.fPoll.set(String(s.pollMinutes));
    this.fBaseline.set(String(s.baselineItemsPerDay));
    this.fNote.set(s.note);
    this.formAperto.set(true);
    this.focus('fonte-endpoint');
  }

  protected chiudiForm(): void {
    this.formAperto.set(false);
    this.modificaId.set(null);
    this.formErrore.set(null);
    this.provato.set(false);
    // Simmetrico ad `apriNuova()`: il pannello esce dal DOM insieme al bottone
    // che si è appena premuto, e il fuoco cadrebbe sul <body>.
    this.focus('fnt-nuova');
  }

  private azzeraForm(): void {
    this.fNome.set('');
    this.fSlug.set('');
    this.fStrategy.set('WP_REST');
    this.fEndpoint.set('');
    this.fCategorie.set('');
    this.fEscludiContenuto.set(false);
    this.fLingua.set('it');
    this.fPoll.set('60');
    this.fBaseline.set('');
    this.fNote.set('');
    this.formErrore.set(null);
    this.provato.set(false);
  }

  protected onNome(e: Event): void {
    this.fNome.set((e.target as HTMLInputElement).value);
  }
  protected onSlug(e: Event): void {
    // Lo slug si scrive minuscolo: il server lo abbassa comunque, e vederlo
    // cambiare dopo il salvataggio farebbe dubitare di che cosa sia stato
    // salvato davvero.
    this.fSlug.set((e.target as HTMLInputElement).value.toLowerCase());
  }
  protected onStrategy(e: Event): void {
    this.fStrategy.set((e.target as HTMLSelectElement).value as NewsStrategy);
  }
  protected onEndpoint(e: Event): void {
    this.fEndpoint.set((e.target as HTMLInputElement).value);
  }
  protected onCategorie(e: Event): void {
    this.fCategorie.set((e.target as HTMLInputElement).value);
  }
  protected onEscludiContenuto(e: Event): void {
    this.fEscludiContenuto.set((e.target as HTMLInputElement).checked);
  }
  protected onLingua(e: Event): void {
    this.fLingua.set(
      (e.target as HTMLSelectElement).value as NewsSourceLanguage,
    );
  }
  protected onPoll(e: Event): void {
    this.fPoll.set((e.target as HTMLInputElement).value);
  }
  protected onBaseline(e: Event): void {
    this.fBaseline.set((e.target as HTMLInputElement).value);
  }
  protected onNote(e: Event): void {
    this.fNote.set((e.target as HTMLTextAreaElement).value);
  }

  /**
   * Salvataggio.
   *
   * ⚠️ **`enabled` non viaggia mai da qui.** Una fonte nasce spenta (default
   * dello schema) e si accende dal cruscotto, una per volta, con una conferma:
   * un interruttore anche nel form sarebbe un secondo modo di accendere, senza
   * nessuno degli avvisi che rendono quel gesto una decisione.
   *
   * ⚠️ `excludeCategoryIds` viaggia **sempre**, anche vuoto: passando da WP REST
   * a un'altra strategia il server confronta con il valore già salvato
   * (`dto ?? prima`) e rifiuterebbe con un 400 le categorie rimaste sulla riga —
   * un errore incomprensibile su un campo che il form non mostra nemmeno più.
   */
  protected salva(): void {
    this.provato.set(true);
    if (!this.formValido() || this.inVolo()) return;
    const parser = this.parserDerivato();
    if (!parser) return;

    const categorie = this.mostraCategorie()
      ? parseCategorie(this.fCategorie())
      : [];
    const baseline = this.fBaseline().trim();
    const payload: NewsSourcePayload = {
      name: this.fNome().trim(),
      slug: this.fSlug().trim().toLowerCase(),
      strategy: this.fStrategy(),
      parserKey: parser,
      endpointUrl: this.fEndpoint().trim(),
      excludeCategoryIds: categorie,
      escludiContenuto: this.fEscludiContenuto(),
      lingua: this.fLingua(),
      pollMinutes: Number(this.fPoll().trim()),
      note: this.fNote().trim(),
    };
    // ⚠️ Solo se c'è: il campo è opzionale e l'API non accetta un vuoto. Chi
    // vuole rendere inerte il controllo sul volume scrive 0 (il form lo dice).
    if (baseline) payload.baselineItemsPerDay = Number(baseline.replace(',', '.'));

    const id = this.modificaId();
    this.formErrore.set(null);
    this.azione.set({ id: id ?? 'nuova', quale: 'salva' });

    const richiesta = id
      ? this.api.update(id, payload)
      : this.api.create(payload);

    richiesta.subscribe({
      next: (f) => {
        this.toast.success(
          id
            ? `Fonte «${f.name}» aggiornata.`
            : `Fonte «${f.name}» creata, e nasce spenta: accendila quando l'indirizzo è quello giusto.`,
        );
        this.chiudiForm();
        this.carica();
      },
      error: (err: unknown) => {
        this.azione.set(null);
        // ⚠️ L'errore resta **dentro** il form, accanto ai campi che l'hanno
        // causato: un toast che sparisce dopo quattro secondi non basta a
        // rileggere un 400 che nomina la deny-list o lo slug già in uso.
        this.formErrore.set(
          apiErrorMessage(err, 'Salvataggio non riuscito.'),
        );
      },
    });
  }

  /** Fuoco differito: l'elemento entra nel DOM col ciclo di rendering. */
  private focus(id: string): void {
    setTimeout(() => document.getElementById(id)?.focus(), 0);
  }
}
