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
  AdminSitoRicercaView,
  AdminSitoTrafficoView,
  AdminStatsView,
  AdminVideoStatsView,
  AndamentoConteggi,
  EsitoUrl,
  GiudizioVitale,
  RigaAndamento,
  RigaVideoLezione,
  StatoSitemap,
  StatsMeseAcquisizione,
  StatsMeseCoorte,
  StatsMeseIncasso,
  StatsMeseSenzaCassa,
  VitaleSito,
} from '../../../core/models/api.models';
import { AdminConteggiService } from '../../../core/services/admin-conteggi.service';
import { AdminStatsService } from '../../../core/services/admin-stats.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import {
  FiltroComponent,
  VoceFiltro,
} from '../../../shared/ui/filtro/filtro.component';
import {
  ColonnaGrafico,
  GraficoColonneComponent,
  SerieGrafico,
} from '../../../shared/ui/grafico/grafico-colonne.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import {
  SchedeComponent,
  VoceScheda,
} from '../../../shared/ui/schede/schede.component';
import {
  formattaBp,
  formattaCent,
  formattaCentBreve,
  formattaDelta,
  formattaEur,
  formattaEurBreve,
  formattaFrazione,
  formattaIntero,
} from '../denaro';
import { metodoLabelDaSlug } from '../metodo-pagamento';
import { roleLabel } from '../role-labels';

/**
 * Le cinque schede, tupla CHIUSA (idioma `ICON_NAMES` e `VISTE` dei
 * Conteggi): `Vista` si deriva da qui e `isVista()` è la guardia sul valore di
 * `?vista=`, che arriva dall'URL come stringa qualunque. Con una `type` a mano
 * e un `as Vista` sul parametro, `?vista=tutto` diventerebbe una scheda che
 * nessun `@case` rende: pannello vuoto, nessun errore.
 */
const VISTE = ['abbonati', 'incassi', 'andamento', 'video', 'sito'] as const;
type Vista = (typeof VISTE)[number];
const isVista = (v: string | undefined): v is Vista =>
  v !== undefined && (VISTE as readonly string[]).includes(v);

const SCHEDE: readonly VoceScheda<Vista>[] = [
  { valore: 'abbonati', etichetta: 'Abbonati' },
  { valore: 'incassi', etichetta: 'Incassi' },
  { valore: 'andamento', etichetta: 'Andamento' },
  { valore: 'video', etichetta: 'Video' },
  { valore: 'sito', etichetta: 'Sito' },
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
  sito: 'Sito: traffico e ricerca',
};

/** Profondità della serie mensile (il DTO backend accetta 1..24). */
const MESI_RANGES = [6, 12, 24] as const;
/** Finestra dell'andamento video (il DTO backend accetta 1..90). */
const GIORNI_RANGES = [7, 30, 90] as const;

/**
 * Lo scheletro di OGNI scheda: le tessere del suo PRIMO blocco e l'altezza del
 * suo primo grafico. ⚠️ Era uno solo, a sei tessere: non aveva la forma di
 * nessuna delle cinque schede, quindi riservava lo spazio sbagliato e il
 * dato atterrava spostando tutto — cioè il salto di layout che uno scheletro
 * esiste per evitare. Le tessere sono indici perché il `@for` vuole un
 * elenco; il grafico è in px, la stessa unità di `altezza` sul primitivo.
 *
 * ⚠️ `sito` vale per ENTRAMBE le metà della scheda (traffico e ricerca): i
 * loro primi blocchi hanno tutti e due quattro tessere e un grafico da 120,
 * quindi lo stesso `#scheletro` si rende due volte, uno per richiesta in volo.
 */
const tessere = (n: number): readonly number[] =>
  Array.from({ length: n }, (_, i) => i);
const SCHELETRI: Record<Vista, { tessere: readonly number[]; graficoH: number }> = {
  abbonati: { tessere: tessere(3), graficoH: 180 },
  incassi: { tessere: tessere(4), graficoH: 180 },
  andamento: { tessere: tessere(2), graficoH: 180 },
  video: { tessere: tessere(4), graficoH: 120 },
  sito: { tessere: tessere(4), graficoH: 120 },
};

// ── Le serie dei grafici ─────────────────────────────────────────────────────
// I toni sono alias dei token `--serie-*`: il tema li cambia da solo.

/**
 * ⚠️ Impilate `[verificate, registrati − verificate]`: l'altezza della pila è
 * il totale delle registrazioni, e la parte piena quelle confermate. È una
 * SOTTRAZIONE fra conteggi di persone, non denaro — l'unica aritmetica che il
 * client fa su una serie.
 */
const SERIE_CRESCITA: readonly SerieGrafico[] = [
  { nome: 'Verificate', tono: 'uno' },
  { nome: 'Non verificate', tono: 'neutra' },
];
const SERIE_ACQUISIZIONE: readonly SerieGrafico[] = [
  { nome: 'Nuovi', tono: 'uno' },
  { nome: 'Rinnovi', tono: 'due' },
  { nome: 'Ritorni', tono: 'tre' },
];
/**
 * ⚠️ AFFIANCATE e non impilate: l'altezza di una pila «incasso + coperti dai
 * punti» sarebbe una somma che il backend vieta due volte — quegli euro non
 * sono mai arrivati sul conto.
 */
const SERIE_INCASSO: readonly SerieGrafico[] = [
  { nome: 'Incasso', tono: 'uno' },
  { nome: 'Coperti dai punti', tono: 'due' },
];
const SERIE_ANDAMENTO: readonly SerieGrafico[] = [
  { nome: 'Entrate', tono: 'uno' },
  { nome: 'Uscite', tono: 'neutra' },
];
const SERIE_VIDEO: readonly SerieGrafico[] = [
  { nome: 'Riproduzioni', tono: 'uno' },
];
/**
 * ⚠️ AFFIANCATE: una pagina vista appartiene a una visita, quindi «pagine
 * viste» CONTIENE le visite e una pila sarebbe una somma senza senso. Il
 * rapporto fra le due (~2-3×) si legge lo stesso, e sta anche nella tessera
 * «Pagine per visita».
 */
const SERIE_TRAFFICO: readonly SerieGrafico[] = [
  { nome: 'Visite', tono: 'uno' },
  { nome: 'Pagine viste', tono: 'due' },
];
/**
 * ⚠️ UNA serie sola: le impressioni sono ~×30 dei clic, e sullo stesso asse i
 * clic sparirebbero. Impressioni, CTR e posizione stanno nel `dettaglio` del
 * tooltip e nella tabella giorno per giorno.
 */
const SERIE_RICERCA: readonly SerieGrafico[] = [{ nome: 'Clic', tono: 'uno' }];

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

// ── I formattatori della scheda Sito, LOCALI come `ORE` ──────────────────────
// Nessuno di questi è denaro, un conteggio o una frazione: pagine per visita,
// secondi di LCP, posizione media su Google. Restano qui e non in `denaro.ts`,
// per la ragione scritta su `ORE`.

/** Un decimale al più: «2,8», «12,4». */
const UN_DECIMALE = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
/** Due decimali sempre: il CLS è adimensionale e «0,1» e «0,10» sono la stessa soglia. */
const DUE_DECIMALI = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
/** Codice ISO-2 → nome del Paese in italiano («IT» → «Italia»). */
const NOME_PAESE = new Intl.DisplayNames(['it'], { type: 'region' });
/** `deviceType` di Cloudflare: fallback sul grezzo per un valore ignoto. */
const DISPOSITIVO_LABELS: Record<string, string> = {
  desktop: 'Computer',
  mobile: 'Telefono',
  tablet: 'Tablet',
};

/**
 * Le tre mappe stato → {testo, tono} della scheda Sito, esaustive sulle union
 * del modello: uno stato nuovo dal backend NON compila finché non ha una
 * resa — è il precedente della pastiglia `.admin-stato`, nata perché una
 * classe interpolata dallo stato produceva pastiglie senza colore.
 * ⚠️ I toni sono quelli del PERCORSO (`admin-stato.ts`), non della salute
 * di /admin/fonti: `allarme` qui è «scarso»/«non indicizzata», rosso.
 */
interface Pastiglia {
  testo: string;
  tono: 'spento' | 'neutro' | 'attesa' | 'ok' | 'concluso' | 'allarme' | 'ignoto';
}
const GIUDIZIO: Record<GiudizioVitale, Pastiglia> = {
  buono: { testo: 'Buono', tono: 'ok' },
  daMigliorare: { testo: 'Da migliorare', tono: 'attesa' },
  scarso: { testo: 'Scarso', tono: 'allarme' },
};
const ESITO_URL: Record<EsitoUrl, Pastiglia> = {
  indicizzata: { testo: 'Indicizzata', tono: 'ok' },
  parziale: { testo: 'Parziale', tono: 'attesa' },
  nonIndicizzata: { testo: 'Non indicizzata', tono: 'allarme' },
  // `attesa` e non `neutro`: il verdetto NEUTRAL di Google («rilevata,
  // attualmente non indicizzata») su una delle pagine chiave — tutte
  // prerenderizzate, in sitemap e senza noindex — è una notizia da leggere,
  // e un tono muto la faceva passare per uno stato qualunque.
  esclusa: { testo: 'Esclusa', tono: 'attesa' },
  // «Non verificata» e non «Sconosciuto»: l'ispezione non è riuscita (di
  // solito un 403 finché l'account di servizio non ha i permessi), e la
  // riga porta il motivo nel sotto-testo.
  ignoto: { testo: 'Non verificata', tono: 'ignoto' },
};
const STATO_SITEMAP: Record<StatoSitemap, Pastiglia> = {
  letta: { testo: 'Letta', tono: 'ok' },
  attesa: { testo: 'In attesa', tono: 'attesa' },
  avvisi: { testo: 'Con avvisi', tono: 'attesa' },
  errori: { testo: 'Con errori', tono: 'allarme' },
};

/** Una tessera dei Core Web Vitals: il valore già formattato, o null se il campo manca. */
interface TesseraVitale {
  chiave: 'lcp' | 'inp' | 'cls';
  etichetta: string;
  spiega: string;
  valore: string | null;
  v: VitaleSito;
}

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
const MESE_BREVE_FMT = new Intl.DateTimeFormat('it-IT', {
  month: 'short',
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

/**
 * 'YYYY-MM' → "set", per l'asse X del grafico: a dodici colonne in 390px lo
 * slot è largo 30px e «set 2026» non ci sta. Gennaio porta l'anno («gen 2026»)
 * così su ventiquattro colonne si capisce dove cambia.
 */
function meseBreve(chiave: string): string {
  const [anno, mese] = chiave.split('-').map(Number);
  if (!anno || !mese) return chiave;
  return mese === 1
    ? meseLabel(chiave)
    : MESE_BREVE_FMT.format(new Date(Date.UTC(anno, mese - 1, 1)));
}

/** 'YYYY-MM-DD' → "12 lug". */
function giornoLabel(chiave: string): string {
  const [anno, mese, giorno] = chiave.split('-').map(Number);
  if (!anno || !mese || !giorno) return chiave;
  return GIORNO_LABEL_FMT.format(new Date(Date.UTC(anno, mese - 1, giorno)));
}

/** 'YYYY-MM-DD' → "12", e "1 lug" sul primo del mese: l'asse X dei giorni. */
function giornoBreve(chiave: string): string {
  const giorno = Number(chiave.split('-')[2]);
  if (!giorno) return chiave;
  return giorno === 1 ? giornoLabel(chiave) : String(giorno);
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
 * La sezione «Statistiche»: cinque schede — Abbonati · Incassi · Andamento ·
 * Video · Sito — su cinque letture indipendenti, ognuna col proprio errore e
 * il proprio «Riprova».
 *
 * ⚠️ CINQUE fonti e non una: `/admin/stats` (aggregazioni Mongo, cache 5 min)
 * per Abbonati e Incassi, `/admin/conteggi/andamento` (senza cache: i mesi
 * aperti si ricalcolano a ogni lettura) per Andamento, `/admin/stats/video`
 * (una chiamata di rete a Bunny) per Video, `/admin/stats/sito/traffico`
 * (Cloudflare) e `/admin/stats/sito/ricerca` (Google) per Sito — DUE metà con
 * bande d'errore proprie, perché un 403 di Google non deve coprire il traffico
 * di Cloudflare. Un guasto di Bunny non deve spegnere i numeri di business, e
 * i conteggi non passano da nessuna delle altre.
 *
 * ⚠️ Andamento, Video e Sito si caricano PIGRAMENTE, al primo ingresso nella
 * scheda (precedente `caricaSoci` nei Conteggi): erano tre chiamate nel
 * costruttore, di cui una a Bunny, per chi apriva la pagina a leggere gli
 * abbonati. Una volta sola per scheda — un errore lascia la banda col suo
 * «Riprova», non un secondo tentativo automatico a ogni cambio di scheda.
 *
 * ⚠️ DUE unità di denaro convivono in questa pagina e non si incrociano MAI:
 * `/admin/stats` manda EURO float (`formattaEur`), i conteggi mandano
 * CENTESIMI interi (`formattaCent`). La scelta sbagliata è un fattore 100.
 * E il client non SOMMA denaro: ogni totale arriva dal server.
 *
 * ⚠️ I grafici sono `app-grafico-colonne`, l'unico tipo di grafico del
 * pannello, e ricevono NUMERI per la geometria e STRINGHE già formattate per
 * tooltip e readout: l'unità non li attraversa mai. Ogni grafico è
 * accompagnato dai numeri esatti in una tabella o in una modale — il disegno
 * riassume, non sostituisce. Le tre modali sono di sola lettura: nessun
 * toast, nessuna scrittura.
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
    ModalComponent,
    GraficoColonneComponent,
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
  protected readonly vista = signal<Vista>('abbonati');
  protected readonly titoloScheda = computed(() => TITOLI[this.vista()]);
  /** La sagoma della scheda che si sta guardando, finché il dato non arriva. */
  protected readonly scheletroScheda = computed(() => SCHELETRI[this.vista()]);

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
  protected readonly giorniSitoScelto = computed(() =>
    String(this.giorniSito()),
  );

  protected readonly meseLabel = meseLabel;
  protected readonly meseLungo = meseLungo;
  protected readonly giornoLabel = giornoLabel;
  protected readonly formattaCent = formattaCent;
  protected readonly formattaEur = formattaEur;
  protected readonly formattaFrazione = formattaFrazione;
  protected readonly formattaDelta = formattaDelta;
  protected readonly formattaIntero = formattaIntero;
  protected readonly formattaBp = formattaBp;
  /**
   * I tick degli assi: il grafico non conosce l'unità, gliela presta il
   * chiamante. ⚠️ `formattaCentBreve` per i centesimi dei Conteggi,
   * `formattaEurBreve` per gli euro float di `/admin/stats`, `formattaIntero`
   * per i conteggi di persone e riproduzioni.
   */
  protected readonly formattaCentBreve = formattaCentBreve;
  protected readonly formattaEurBreve = formattaEurBreve;
  protected readonly SERIE_CRESCITA = SERIE_CRESCITA;
  protected readonly SERIE_ACQUISIZIONE = SERIE_ACQUISIZIONE;
  protected readonly SERIE_INCASSO = SERIE_INCASSO;
  protected readonly SERIE_ANDAMENTO = SERIE_ANDAMENTO;
  protected readonly SERIE_VIDEO = SERIE_VIDEO;
  protected readonly SERIE_TRAFFICO = SERIE_TRAFFICO;
  protected readonly SERIE_RICERCA = SERIE_RICERCA;
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

  // ── Le cinque fonti ───────────────────────────────────────────────────────

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

  /**
   * Le due metà della scheda Sito: Cloudflare (traffico) e Google (ricerca).
   * Due signal di dato, due di caricamento, due di errore: nessuno dei sei
   * guarda l'altro lato. Una finestra SOLA per entrambe (`giorniSito`): la
   * barra ammette un filtro per scheda, e il ritardo di Google si dichiara in
   * risposta invece di spostare la finestra.
   */
  protected readonly traffico = signal<AdminSitoTrafficoView | null>(null);
  protected readonly trafficoLoading = signal(false);
  protected readonly trafficoError = signal<string | null>(null);
  protected readonly ricerca = signal<AdminSitoRicercaView | null>(null);
  protected readonly ricercaLoading = signal(false);
  protected readonly ricercaError = signal<string | null>(null);
  protected readonly giorniSito = signal<number>(30);

  // Guardie anti-sorpasso: cambiare finestra due volte in fretta può far
  // arrivare per ultima la risposta vecchia (stesso schema di /lezioni).
  // ⚠️ Sono anche la memoria del «già chiesto una volta» dei caricamenti pigri:
  // a zero, la scheda non ha mai chiesto niente.
  private statsSeq = 0;
  private andamentoSeq = 0;
  private videoSeq = 0;
  private trafficoSeq = 0;
  private ricercaSeq = 0;

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
        // Le due metà di Sito hanno ciascuna la propria guardia: un 500 di
        // Google non deve far ripartire Cloudflare, né viceversa.
        if (v === 'sito') {
          if (this.trafficoSeq === 0) this.loadTraffico();
          if (this.ricercaSeq === 0) this.loadRicerca();
        }
      });
    });

    /**
     * Le due modali tengono una CHIAVE (vedi `meseIncassoAperto`): se una
     * ricarica sposta la finestra e il mese non c'è più, la modale si chiude
     * da sé (l'`@if` sul `computed`) — ma `(chiusa)` non scatta, e la chiave
     * resterebbe. Alla ricarica successiva che riporta quel mese la modale si
     * RIAPRIREBBE da sola, senza che nessuno l'abbia chiesto: la chiave si
     * dimentica nell'istante in cui non risolve più niente.
     */
    effect(() => {
      if (this.meseIncassoAperto() !== null && this.incassoAperto() === null) {
        untracked(() => this.meseIncassoAperto.set(null));
      }
      if (this.meseAndamentoAperto() !== null && this.andamentoAperto() === null) {
        untracked(() => this.meseAndamentoAperto.set(null));
      }
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

  protected loadTraffico(): void {
    const seq = ++this.trafficoSeq;
    this.trafficoLoading.set(true);
    this.trafficoError.set(null);
    this.api.sitoTraffico(this.giorniSito()).subscribe({
      next: (data) => {
        if (seq !== this.trafficoSeq) return;
        this.traffico.set(data);
        this.trafficoLoading.set(false);
      },
      error: (err: unknown) => {
        if (seq !== this.trafficoSeq) return;
        this.trafficoLoading.set(false);
        this.trafficoError.set(
          apiErrorMessage(err, 'Caricamento del traffico non riuscito.'),
        );
      },
    });
  }

  protected loadRicerca(): void {
    const seq = ++this.ricercaSeq;
    this.ricercaLoading.set(true);
    this.ricercaError.set(null);
    this.api.sitoRicerca(this.giorniSito()).subscribe({
      next: (data) => {
        if (seq !== this.ricercaSeq) return;
        this.ricerca.set(data);
        this.ricercaLoading.set(false);
      },
      error: (err: unknown) => {
        if (seq !== this.ricercaSeq) return;
        this.ricercaLoading.set(false);
        this.ricercaError.set(
          apiErrorMessage(err, 'Caricamento dei dati di ricerca non riuscito.'),
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
      case 'sito':
        return this.trafficoLoading() || this.ricercaLoading();
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
      case 'sito':
        // Le due metà hanno bande PROPRIE dentro il pannello: un errore di
        // Google non deve coprire Cloudflare, e la banda unica ne mostrerebbe
        // uno solo. Qui, di proposito, niente.
        return null;
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
      case 'sito':
        // «Ricarica» della barra rifà entrambe le metà; i due «Riprova» nelle
        // bande proprie rifanno SOLO la loro.
        this.loadTraffico();
        this.loadRicerca();
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

  protected setGiorniSitoDaFiltro(v: string): void {
    this.setGiorniSito(Number(v));
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

  /** Una finestra sola per le due metà di Sito: cambiarla le rifà entrambe. */
  protected setGiorniSito(n: number): void {
    if (n === this.giorniSito()) return;
    this.giorniSito.set(n);
    this.loadTraffico();
    this.loadRicerca();
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
    // ⚠️ L'unione di TUTTE le serie che entrano nella riga, non solo delle
    // registrazioni: l'invariante di `chiaviMesi` («una riga vera non sparisce
    // mai») vale per ogni colonna della tabella. Con le sole registrazioni,
    // una fotografia a fine mese di un mese senza iscritti — fuori dalla
    // finestra calcolata qui — spariva in silenzio.
    const chiavi = chiaviMesi(finestraMesi(this.meseCorrente(), s.finestraMesi), [
      ...reg.keys(),
      ...fine.keys(),
      ...primi.keys(),
    ]);
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

  /**
   * Il grafico della crescita: pila `[verificate, non verificate]` con la
   * linea «Abbonati a fine mese». ⚠️ Il mese corrente è SENZA `linea` (né zero
   * né altro): il valore non esiste ancora, e la polyline si ferma al mese
   * chiuso prima — uno zero disegnato lì sarebbe un crollo inventato.
   */
  protected readonly colonneCrescita = computed<ColonnaGrafico[]>(() =>
    this.crescitaAsc().map((r) => {
      const nonVerificate = Math.max(0, r.registrati - r.verificati);
      const colonna: ColonnaGrafico = {
        chiave: r.mese,
        etichetta: meseBreve(r.mese),
        etichettaLunga: meseLungo(r.mese),
        valori: [r.verificati, nonVerificate],
        testi: [formattaIntero(r.verificati), formattaIntero(nonVerificate)],
        dettaglio: `${formattaIntero(r.registrati)} ${
          r.registrati === 1 ? 'registrazione' : 'registrazioni'
        }`,
      };
      return r.abbonatiFine === null
        ? colonna
        : {
            ...colonna,
            linea: r.abbonatiFine,
            testoLinea: formattaIntero(r.abbonatiFine),
          };
    }),
  );

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

  /**
   * Il grafico dell'incasso: euro float, AFFIANCATI (vedi `SERIE_INCASSO`).
   * I `testi` passano da `formattaEur`, l'asse da `formattaEurBreve`.
   */
  protected readonly colonneIncasso = computed<ColonnaGrafico[]>(() =>
    this.incassoAsc().map((r) => ({
      chiave: r.mese,
      etichetta: meseBreve(r.mese),
      etichettaLunga: meseLungo(r.mese),
      valori: [r.incassoEur, r.puntiEur],
      testi: [formattaEur(r.incassoEur), formattaEur(r.puntiEur)],
      dettaglio: `${formattaIntero(r.ordini)} ${
        r.ordini === 1 ? 'abbonamento' : 'abbonamenti'
      }`,
    })),
  );

  /**
   * La CHIAVE ('YYYY-MM') del mese di cui è aperta la modale «Incasso di …»,
   * o nessuna. ⚠️ La chiave e non l'oggetto della riga: una ricarica (il
   * pulsante, o un cambio di finestra) sostituisce `stats()` per intero, e una
   * modale che tenesse la riga vecchia continuerebbe a dire 500 € sopra una
   * tabella che dice 750. La riga si risolve a ogni lettura, qui sotto.
   */
  protected readonly meseIncassoAperto = signal<string | null>(null);

  /** La riga del mese aperto, letta dai dati di ADESSO; `null` se non c'è più. */
  protected readonly incassoAperto = computed<StatsMeseIncasso | null>(() => {
    const mese = this.meseIncassoAperto();
    return mese === null
      ? null
      : (this.incassoAsc().find((r) => r.mese === mese) ?? null);
  });

  /** Dal grafico: l'indice è quello di `incassoAsc`, ascendente come le colonne. */
  protected apriIncassoDaGrafico(i: number): void {
    const r = this.incassoAsc()[i];
    if (r) this.meseIncassoAperto.set(r.mese);
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

  /**
   * Il grafico dei clienti paganti, impilati per come sono entrati. I non
   * paganti NON sono nel disegno: sono nella tabella del dettaglio, e le due
   * metà non vanno mai sommate.
   */
  protected readonly colonneAcquisizione = computed<ColonnaGrafico[]>(() =>
    this.acquisizioneAsc().map((r) => ({
      chiave: r.mese,
      etichetta: meseBreve(r.mese),
      etichettaLunga: meseLungo(r.mese),
      valori: [r.paganti.nuovi, r.paganti.rinnovi, r.paganti.ritorni],
      testi: [
        formattaIntero(r.paganti.nuovi),
        formattaIntero(r.paganti.rinnovi),
        formattaIntero(r.paganti.ritorni),
      ],
    })),
  );

  /** La modale «Nuovi, rinnovi e ritorni per mese»: la tabella vive lì. */
  protected readonly dettaglioAcquisizioneAperto = signal(false);

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

  /**
   * Il grafico dell'andamento: CENTESIMI, entrate e uscite affiancate, la
   * linea del margine, i mesi aperti tratteggiati.
   * ⚠️ Il conguaglio coi giocatori va detto nel `dettaglio` quando c'è: senza,
   * la linea del margine non è la differenza delle due colonne e il disegno
   * sembra sbagliato di quel termine.
   */
  protected readonly colonneAndamento = computed<ColonnaGrafico[]>(() =>
    (this.andamento()?.mesi ?? []).map((r) => {
      const c = r.conguaglioGiocatoriCent;
      const colonna: ColonnaGrafico = {
        chiave: r.chiave,
        etichetta: meseBreve(r.chiave),
        etichettaLunga: r.etichetta,
        valori: [r.entrate.totaleCent, r.uscite.totaleCent],
        testi: [formattaCent(r.entrate.totaleCent), formattaCent(r.uscite.totaleCent)],
        linea: r.margineNettoCent,
        testoLinea: formattaCent(r.margineNettoCent),
        provvisorio: r.provvisorio,
      };
      return c === 0
        ? colonna
        : { ...colonna, dettaglio: `Conguaglio coi giocatori ${this.conSegno(c)}` };
    }),
  );

  /** Centesimi col segno stampato: «+348,29 €», «-12,00 €». */
  protected conSegno(cent: number): string {
    return cent > 0 ? `+${formattaCent(cent)}` : formattaCent(cent);
  }

  /**
   * L'`id` del mese di cui è aperta la modale «Conto economico di …», o
   * nessuno. La chiave e non la riga, per la ragione scritta su
   * `meseIncassoAperto`: qui pesa di più, perché `/andamento` non ha cache e
   * un mese aperto cambia a ogni lettura.
   */
  protected readonly meseAndamentoAperto = signal<string | null>(null);

  /** La riga del mese aperto, letta dai dati di ADESSO; `null` se non c'è più. */
  protected readonly andamentoAperto = computed<RigaAndamento | null>(() => {
    const id = this.meseAndamentoAperto();
    return id === null
      ? null
      : (this.andamento()?.mesi.find((r) => r.id === id) ?? null);
  });

  /** Dal grafico: l'indice è quello di `andamento().mesi`, ascendente come le colonne. */
  protected apriAndamentoDaGrafico(i: number): void {
    const r = this.andamento()?.mesi[i];
    if (r) this.meseAndamentoAperto.set(r.id);
  }

  /**
   * Il sottotitolo della modale del conto economico. ⚠️ Chiavato su
   * `provvisorio`, mai su `stato` (vedi `meseProvvisorio`).
   */
  protected sottotitoloMese(r: RigaAndamento): string {
    if (r.provvisorio) return 'Provvisorio: cambia a ogni cifra scritta nei Conteggi';
    const quando = r.chiusoAt ? this.date.transform(r.chiusoAt, 'dd/MM/yyyy') : null;
    return quando ? `Congelato il ${quando}` : 'Congelato alla chiusura del mese';
  }

  // ── Video ────────────────────────────────────────────────────────────────

  protected readonly videoQualitaPulita = computed(() => {
    const q = this.video()?.qualitaDati;
    return !!q && q.guidDuplicati === 0 && !q.paginaTroncata;
  });

  /** Le riproduzioni giorno per giorno: fino a 90 colonne, una serie sola. */
  protected readonly colonneVideo = computed<ColonnaGrafico[]>(() =>
    (this.video()?.andamento?.serie ?? []).map((p) => ({
      chiave: p.giorno,
      etichetta: giornoBreve(p.giorno),
      etichettaLunga: giornoLabel(p.giorno),
      valori: [p.visualizzazioni],
      testi: [formattaIntero(p.visualizzazioni)],
    })),
  );

  /**
   * Gli stessi giorni in tabella, il più recente in cima (come ogni tabella
   * della pagina): il grafico riassume, i numeri esatti stanno qui. Era
   * l'unico grafico della pagina senza i suoi numeri accanto.
   */
  protected readonly videoGiorniRows = computed(() =>
    [...(this.video()?.andamento?.serie ?? [])].reverse(),
  );

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

  // ── Sito · Traffico (Cloudflare Web Analytics) ───────────────────────────

  /**
   * Visite e pagine viste giorno per giorno, affiancate (vedi
   * `SERIE_TRAFFICO`). Il `dettaglio` dice se il giorno è esatto o una stima:
   * oltre i sette giorni Cloudflare campiona e moltiplica.
   *
   * ⚠️ NIENTE `provvisorio`: il primitivo stamperebbe la parola «provvisorio»
   * nel tooltip e nel readout, e una stima non è provvisoria — non cambierà,
   * è solo meno precisa. Lo stato esatti/stima è nel `dettaglio` qui e nella
   * colonna «Dati» della tabella.
   */
  protected readonly colonneTraffico = computed<ColonnaGrafico[]>(() =>
    (this.traffico()?.andamento?.serie ?? []).map((p) => ({
      chiave: p.giorno,
      etichetta: giornoBreve(p.giorno),
      etichettaLunga: giornoLabel(p.giorno),
      valori: [p.visite, p.pagineViste],
      testi: [formattaIntero(p.visite), formattaIntero(p.pagineViste)],
      dettaglio:
        p.campione > 1
          ? `Stima: Cloudflare ha tenuto circa una pagina su ${this.unDecimale(p.campione)}`
          : 'Dati esatti',
    })),
  );

  /** Gli stessi giorni in tabella, il più recente in cima. */
  protected readonly trafficoGiorniRows = computed(() =>
    [...(this.traffico()?.andamento?.serie ?? [])].reverse(),
  );

  /**
   * Le tre tessere dei Core Web Vitals, col valore già formattato nell'unità
   * giusta: millisecondi per LCP e INP, adimensionale a due decimali per CLS.
   * `valore` null = campo assente dal dataset, e la tessera dice «Nessun dato»
   * — mai uno zero, che per un CWV sarebbe un voto perfetto inventato.
   */
  protected readonly vitaliTessere = computed<TesseraVitale[]>(() => {
    const v = this.traffico()?.vitali;
    if (!v) return [];
    return [
      {
        chiave: 'lcp',
        etichetta: 'LCP',
        spiega: 'Comparsa del contenuto principale',
        valore: v.lcp.p75 === null ? null : this.millisecondi(v.lcp.p75),
        v: v.lcp,
      },
      {
        chiave: 'inp',
        etichetta: 'INP',
        spiega: 'Reattività al tocco e al clic',
        valore: v.inp.p75 === null ? null : this.millisecondi(v.inp.p75),
        v: v.inp,
      },
      {
        chiave: 'cls',
        etichetta: 'CLS',
        spiega: 'Salti di layout',
        valore: v.cls.p75 === null ? null : this.dueDecimali(v.cls.p75),
        v: v.cls,
      },
    ];
  });

  /** Nessuna stima, nessun elenco troncato, nessuna tranche fallita: va detto. */
  protected readonly trafficoQualitaPulita = computed(() => {
    const q = this.traffico()?.qualitaDati;
    return (
      !!q && q.giorniStimati === 0 && !q.elencoTroncato && q.finestreFallite === 0
    );
  });

  // ── Sito · Ricerca (Google Search Console) ───────────────────────────────

  /**
   * I clic giorno per giorno, UNA serie (vedi `SERIE_RICERCA`): impressioni,
   * CTR e posizione stanno nel `dettaglio`, da leggere nel tooltip e nel
   * readout. La serie è densa solo fino all'ultimo giorno che Google ha
   * pubblicato: i giorni del suo ritardo non sono colonne a zero.
   */
  protected readonly colonneRicerca = computed<ColonnaGrafico[]>(() =>
    (this.ricerca()?.andamento?.serie ?? []).map((p) => ({
      chiave: p.giorno,
      etichetta: giornoBreve(p.giorno),
      etichettaLunga: giornoLabel(p.giorno),
      valori: [p.clic],
      testi: [formattaIntero(p.clic)],
      dettaglio: `${formattaIntero(p.impressioni)} impressioni · CTR ${
        p.ctr === null ? '—' : formattaFrazione(p.ctr)
      } · posizione ${
        p.posizioneMedia === null ? '—' : this.unDecimale(p.posizioneMedia)
      }`,
    })),
  );

  /** Gli stessi giorni in tabella, il più recente in cima. */
  protected readonly ricercaGiorniRows = computed(() =>
    [...(this.ricerca()?.andamento?.serie ?? [])].reverse(),
  );

  /**
   * Le pagine chiave che Google dichiara fuori dall'indice: «esclusa»
   * (verdetto NEUTRAL) e «non indicizzata» (FAIL). Le «Non verificata» NON
   * contano — un'ispezione fallita non dice niente sull'indice, e le conta
   * già `ispezioniFallite`.
   */
  protected readonly pagineChiaveFuoriIndice = computed(
    () =>
      (this.ricerca()?.copertura?.urlChiave ?? []).filter(
        (u) => u.esito === 'esclusa' || u.esito === 'nonIndicizzata',
      ).length,
  );

  /**
   * L'intervallo delle ispezioni delle pagine chiave (min e max di
   * `ispezionatoIl`), o null senza righe. Le righe hanno orologi diversi —
   * una riuscita vale 24 ore in cache, una fallita si riprova dopo una — quindi
   * l'ora della prima riga non descrive le altre. Due estremi uguali = tutte
   * ispezionate insieme (il backend timbra un lotto con lo stesso istante).
   */
  protected readonly ispezioniIntervallo = computed<{ dal: string; al: string } | null>(
    () => {
      const tempi = (this.ricerca()?.copertura?.urlChiave ?? [])
        .map((u) => ({ iso: u.ispezionatoIl, ms: new Date(u.ispezionatoIl).getTime() }))
        .filter((t) => !isNaN(t.ms))
        .sort((a, b) => a.ms - b.ms);
      if (tempi.length === 0) return null;
      return { dal: tempi[0].iso, al: tempi[tempi.length - 1].iso };
    },
  );

  /**
   * Ogni clic attribuito a una parola, elenchi completi, ispezioni riuscite,
   * sitemap lette e nessuna pagina chiave fuori dall'indice. Le ultime due
   * arrivano dalla copertura e non da `qualitaDati`: senza, il blocco diceva
   * «tutto a posto» sopra una tabella con le sitemap mai lette.
   */
  protected readonly ricercaQualitaPulita = computed(() => {
    const r = this.ricerca();
    const q = r?.qualitaDati;
    return (
      !!q &&
      q.clicSenzaQuery === 0 &&
      !q.righeTroncate &&
      q.ispezioniFallite === 0 &&
      !r?.copertura?.sitemapMotivo &&
      this.pagineChiaveFuoriIndice() === 0
    );
  });

  // ── Formattatori della scheda Sito ───────────────────────────────────────

  /** «2,8», «12,4»: al più un decimale. */
  protected unDecimale(v: number): string {
    return UN_DECIMALE.format(v);
  }

  /** «0,10»: due decimali sempre, per il CLS. */
  protected dueDecimali(v: number): string {
    return DUE_DECIMALI.format(v);
  }

  /** Millisecondi → «2,1 s» da un secondo in su, «250 ms» sotto. */
  protected millisecondi(ms: number): string {
    return ms >= 1000
      ? `${this.unDecimale(ms / 1000)} s`
      : `${formattaIntero(ms)} ms`;
  }

  /**
   * Il nome del Paese da un codice ISO-2 («IT» → «Italia»). Cloudflare
   * dovrebbe dare il codice; se arriva un nome esteso o altro, si stampa il
   * grezzo: davanti a un valore ignoto la stringa com'è è una domanda, un
   * Paese plausibile sarebbe un'affermazione falsa.
   */
  protected nomePaese(codice: string): string {
    if (!/^[A-Za-z]{2}$/.test(codice)) return codice;
    try {
      return NOME_PAESE.of(codice.toUpperCase()) ?? codice;
    } catch {
      return codice;
    }
  }

  protected dispositivoLabel(tipo: string): string {
    return DISPOSITIVO_LABELS[tipo] ?? tipo;
  }

  /** La provenienza vuota è il traffico diretto o senza referrer, non un buco. */
  protected provenienzaLabel(chiave: string): string {
    return chiave || 'Diretto o sconosciuto';
  }

  /** Il solo percorso di un URL completo, per le tabelle di Google: il `title` porta l'URL intero. */
  protected percorsoDi(url: string): string {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }

  protected giudizio(g: GiudizioVitale): Pastiglia {
    return GIUDIZIO[g];
  }

  protected esitoUrl(e: EsitoUrl): Pastiglia {
    return ESITO_URL[e];
  }

  protected statoSitemap(s: StatoSitemap): Pastiglia {
    return STATO_SITEMAP[s];
  }

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
