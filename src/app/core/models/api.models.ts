/**
 * Ruoli in scala: ADMIN ≥ SQUALO ≥ PESCE_ROSSO ≥ USER.
 * I due tier a pagamento (Pesce Rosso = low stakes, Squalo = tutto) gateano i
 * contenuti tramite il rango, come lato backend (roles.enum.ts).
 *
 * `STAKATO` (giocatore finanziato dalla scuola: come Squalo, ma senza scadenza)
 * e `COACH` (conduce le live; accesso pieno ai contenuti, mai alla dashboard
 * admin) condividono il rango di Squalo. La scala e le sue liste vivono in
 * `core/models/roles.ts` — qui c'è solo il tipo, perché è ciò che l'intera
 * cartella `models` consuma.
 */
export type Role =
  | 'USER'
  | 'PESCE_ROSSO'
  | 'SQUALO'
  | 'STAKATO'
  | 'COACH'
  | 'ADMIN';

export interface User {
  id: string;
  email: string;
  /** assente per gli account creati prima dell'introduzione del nickname */
  nickname?: string;
  role: Role;
  verified: boolean;
  /** scadenza abbonamento (ISO) se tier attivo; null/assente per USER e ADMIN */
  subscriptionExpiresAt?: string | null;
  /** saldo punti BFF */
  points?: number;
  /** preferenza opt-out: avvisi email sulle nuove lezioni (default true) */
  notifyNewLessons?: boolean;
}

// ----- Punti BFF -----

export interface PointsLedgerEntry {
  id: string;
  /** variazione: positiva = accredito, negativa = storno */
  delta: number;
  reason: string;
  balanceAfter: number;
  createdAt?: string;
}

export interface MyPoints {
  balance: number;
  history: PointsLedgerEntry[];
}

export interface AdjustPointsResult {
  balance: number;
  entry: PointsLedgerEntry;
}

export interface AuthResponse {
  accessToken: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  nickname: string;
}

/** Tier minimo per vedere il video: USER = anteprima gratis, poi i due tier. */
export type LessonVisibility = 'USER' | 'PESCE_ROSSO' | 'SQUALO';
/** Livello stakes: guida le due sezioni Low/High della libreria. */
export type LessonStakes = 'LOW' | 'HIGH';

/**
 * Le sette categorie delle lezioni, nell'ordine del programma di studio.
 *
 * ⚠️ È lo SPECCHIO di `backend/src/lessons/lessons.types.ts` e non c'è alcuna
 * guardia che confronti le due copie: una deriva (una categoria aggiunta di là
 * e non di qua) si manifesta come una pillola che non compare mai, senza
 * errori. È lo stesso debito già in essere per le otto categorie delle news.
 */
export const LESSON_CATEGORIES = [
  'fondamentali',
  '3-max',
  'heads-up',
  'review',
  'leak-finder',
  'mental-coaching',
  'sessioni-live',
] as const;
export type LessonCategory = (typeof LESSON_CATEGORIES)[number];

export const LESSON_CATEGORY_LABELS: Record<LessonCategory, string> = {
  fondamentali: 'Fondamentali',
  '3-max': '3-max',
  'heads-up': 'Heads-up',
  review: 'Hand Review',
  'leak-finder': 'Leak finder',
  'mental-coaching': 'Mental coaching',
  'sessioni-live': 'Sessioni dal vivo',
};

/**
 * Sentinella «non ancora classificate» del filtro admin.
 * ⚠️ Valore di QUERY, mai valore di campo: non entra in `LESSON_CATEGORIES`.
 */
export const LESSON_CATEGORIA_NESSUNA = 'NESSUNA';
export type LessonCategoriaFiltro =
  | LessonCategory
  | typeof LESSON_CATEGORIA_NESSUNA;

/** Quante lezioni per categoria, più la coda da classificare. */
export interface LessonsSommario {
  categorie: { categoria: LessonCategory; count: number }[];
  senzaCategoria: number;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  tags: string[];
  visibility: LessonVisibility;
  /** livello stakes (Low/High) della lezione */
  stakes?: LessonStakes;
  /** true se il ruolo corrente non sblocca il video (bunnyEmbedUrl assente) */
  locked: boolean;
  bunnyEmbedUrl?: string;
  /** copertina del video (thumbnail.jpg sul CDN Bunny), referer-gated */
  thumbnailUrl?: string;
  /** data del video (ISO); chiave di ordinamento della lista */
  videoDate?: string;
  createdAt?: string;
  /** asse primario del catalogo; assente = non ancora classificata */
  categoria?: LessonCategory;
}

export interface LessonPayload {
  title: string;
  description: string;
  bunnyEmbedUrl: string;
  tags: string[];
  /** livello stakes (obbligatorio): da cui il backend deriva la visibilità */
  stakes: LessonStakes;
  /** anteprima gratuita: se true la lezione è visibile a tutti i registrati */
  freePreview?: boolean;
  /** data del video in formato YYYY-MM-DD (obbligatoria alla creazione) */
  videoDate: string;
  /**
   * Categoria: opzionale finché la triage dell'archivio non è finita.
   * ⚠️ Diventerà obbligatoria (fase A4), e da lì il form admin dovrà
   * dichiarare `Validators.required` lato client — o il primo salvataggio col
   * select sul valore vuoto prende un 400 che parla in inglese.
   */
  categoria?: LessonCategory;
}

// ----- Documenti / Risorse (libreria file scaricabili, pagina /docs) -----

/** Categoria/tipo di materiale (la label IT vive nel componente). */
export type DocumentCategory =
  | 'PT4_FILTER'
  | 'PT4_REPORT'
  | 'PDF'
  | 'EXCEL'
  | 'WORD'
  | 'ALTRO';

/** Tier minimo per scaricare: USER = tutti i registrati, poi i due tier. */
export type DocumentVisibility = 'USER' | 'PESCE_ROSSO' | 'SQUALO';

/** Documento come esposto al client: nessun campo interno (storagePath). */
export interface DocumentResource {
  id: string;
  title: string;
  description: string;
  category: DocumentCategory;
  visibility: DocumentVisibility;
  fileName: string;
  fileExt: string;
  mimeType: string;
  sizeBytes: number;
  downloadCount: number;
  /** true se il ruolo corrente non sblocca il download (card bloccata) */
  locked: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Metadati per creare/modificare un documento (il file viaggia in multipart). */
export interface DocumentPayload {
  title: string;
  description: string;
  category: DocumentCategory;
  visibility: DocumentVisibility;
}

/** Iscritto come esposto al pannello admin (mai dati sensibili). */
export interface AdminUser {
  id: string;
  email: string;
  nickname?: string;
  role: Role;
  verified: boolean;
  /** scadenza abbonamento (ISO) se tier attivo; assente per USER/ADMIN */
  subscriptionExpiresAt?: string;
  /** saldo punti BFF */
  points?: number;
  lastActiveAt?: string;
  createdAt?: string;
}

// ----- Abbonamenti -----

/** I due tier acquistabili (sottoinsieme di Role). */
/**
 * Una sala su cui l'iscritto ha un identificativo vivo — la colonna «Sale»
 * dell'elenco. ⚠️ Ci sono solo le righe che rivendicano davvero un username
 * (in verifica o approvate): una colonna così intitolata che mostrasse un
 * username rifiutato direbbe una cosa falsa.
 */
export interface AffiliazioneCompatta {
  roomId: string;
  roomName: string;
  roomUsername?: string;
  roomUserId?: string;
  /** Dichiarato ma non ancora confermato da nessuno. */
  daVerificare: boolean;
}

/**
 * L'elenco iscritti: la pagina più le sale di ciascuno.
 *
 * ⚠️ Le affiliazioni viaggiano SULL'ENVELOPE e non dentro ogni `AdminUser`:
 * quel tipo è condiviso da sei rotte, e appenderci un campo che solo questa
 * popola lo renderebbe opzionale ovunque. Il server garantisce una chiave per
 * OGNI utente della pagina, anche vuota.
 */
export interface AdminUsersPage extends Paginated<AdminUser> {
  affiliazioniPerUtente: Record<string, AffiliazioneCompatta[]>;
}

// ── Registro degli staking (/admin/stakings) ────────────────────────────────

export type StakingStato = 'APERTO' | 'CHIUSO';
export type StakingTipo = 'FONDI' | 'EV';

/**
 * Una riga del registro: i fondi messi a disposizione di un giocatore e l'EV
 * che deve ancora recuperare.
 *
 * ⚠️ Gli importi sono in CENTESIMI INTERI, come sul filo: gli euro esistono
 * solo al momento di mostrarli (`staking-format.ts`). Con la conversione in due
 * punti, i due dovrebbero concordare su un fattore 100.
 * ⚠️ `saldoEvCent` è SEMPRE ≤ 0 (0 = in pari): il vincolo è imposto dal server
 * dentro la scrittura, non qui.
 */
export interface StakingRow {
  id: string;
  /** `null` su una riga anonimizzata: l'account è stato cancellato. */
  userId: string | null;
  userEmail?: string;
  userNickname?: string;
  stato: StakingStato;
  saldoFondiCent: number;
  saldoEvCent: number;
  chiusoAt?: string;
  nota?: string;
  anonimizzato: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StakingMovimento {
  id: string;
  tipo: StakingTipo;
  /** Positivo = accredito, negativo = addebito. In centesimi. */
  importoCent: number;
  causale: string;
  saldoFondiDopoCent: number;
  saldoEvDopoCent: number;
  createdByAdminEmail?: string;
  createdAt?: string;
}

export interface StakingDettaglio {
  riga: StakingRow;
  movimenti: StakingMovimento[];
}

/**
 * I due totali del registro, in CENTESIMI come ogni importo del modulo.
 *
 * ⚠️ Li calcola il SERVER sull'intero insieme filtrato, e non si ricavano
 * sommando `items`: quella somma è esatta finché i giocatori finanziati stanno
 * in una pagina e sbagliata dal 26° in poi, senza che niente si rompa.
 */
export interface StakingTotali {
  fondiCent: number;
  evCent: number;
}

/**
 * L'elenco del registro: la pagina PIÙ i totali dell'insieme filtrato.
 *
 * ⚠️ I totali viaggiano sull'envelope e non su una rotta gemella (idioma di
 * `CodaRedazione` qui sotto): due letture separate possono dissentire, e qui
 * dissentirebbero su una cifra di denaro.
 */
export type ElencoStakings = Paginated<StakingRow> & {
  totali: StakingTotali;
};

export type SubscriptionTier = 'PESCE_ROSSO' | 'SQUALO';
/** 'manuale' = concessione admin (mai selezionabile dall'utente). */
/**
 * ⚠️ `punti` c'è anche lato client: lo scrive il server su una richiesta coperta
 * interamente dai punti BFF, e senza di lui l'etichetta cade nel ramo di default
 * — che è «PayPal».
 */
export type PaymentMethod =
  | 'paypal'
  | 'skrill'
  | 'manuale'
  | 'punti'
  | 'contanti';

/**
 * Chi ha materialmente incassato un pagamento in contanti.
 *
 * ⚠️ Enum chiuso e non un id utente: un riferimento a un account entrerebbe
 * nella cascata GDPR e rischierebbe di comparire nell'export dell'abbonato,
 * che non deve leggere il nome del socio.
 */
export type Incassante = 'PIETRO' | 'EXIVEZZZ';
export type SubscriptionRequestStatus = 'pending' | 'approved' | 'rejected';

/** Richiesta di abbonamento come esposta a client/admin. */
export interface SubscriptionRequest {
  id: string;
  userId: string;
  userEmail: string;
  userNickname?: string;
  tier: SubscriptionTier;
  tierLabel: string;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  /** Chi ha incassato, sui soli pagamenti in contanti. */
  incassatoDa?: Incassante;
  /** codice sconto applicato (snapshot, legacy singolo) */
  discountCode?: string;
  /** codici sconto cumulati applicati (snapshot) */
  discountCodes?: string[];
  /** prezzo di listino e scontato (snapshot in euro) */
  listPriceEur?: number;
  /** Euro effettivamente dovuti: al netto dei buoni E dei punti. */
  discountedPriceEur?: number;
  /** Punti BFF addebitati (0 se nessuno). */
  pointsSpent: number;
  /** Euro coperti dai punti, congelati al tasso del momento. */
  pointsDiscountEur?: number;
  /** Valorizzato quando i punti sono stati restituiti (rifiuto/ritiro). */
  refundedPoints?: number;
  status: SubscriptionRequestStatus;
  decidedAt?: string;
  decisionNote?: string;
  resultingExpiresAt?: string;
  createdAt?: string;
}

/** Stato abbonamento dell'utente loggato (pagina /abbonati e account). */
export interface MySubscription {
  role: Role;
  /** tier corrente se abbonato, altrimenti null */
  tier: SubscriptionTier | null;
  subscriptionExpiresAt: string | null;
  pendingRequest: SubscriptionRequest | null;
}

/** Info di pagamento per la pagina /abbonati (email destinatarie + prezzi). */
export interface PaymentInfo {
  tiers: { tier: SubscriptionTier; label: string; priceEur: number }[];
  receivers: { paypal: string; skrill: string };
  durationDays: number;
  /**
   * Parametri del pagamento in punti. ⚠️ Arrivano da `payment-info`, che è
   * autenticato, e NON da `plans()`, che è pubblico e finisce nell'HTML
   * prerenderizzato di /abbonati: lì un tasso punti↔euro non può comparire.
   *
   * ⚠️ OPZIONALE per due ragioni vere, non per prudenza: la pagina costruisce un
   * `PaymentInfo` sintetico dalla risposta PUBBLICA di `plans()` mentre aspetta
   * la sessione — e quella risposta non ha (e non deve avere) questi parametri —
   * e fra il deploy del backend e quello del frontend il campo può non esserci
   * ancora.
   */
  punti?: { tasso: number; passo: number };
}

/** Dati PUBBLICI per le card di /abbonati: prezzi + durata, senza receivers. */
export interface SubscriptionPlans {
  tiers: { tier: SubscriptionTier; label: string; priceEur: number }[];
  durationDays: number;
}

/** Payload di richiesta abbonamento (dopo il pagamento off-site). */
export interface CreateSubscriptionRequest {
  tier: SubscriptionTier;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  /** Punti BFF da usare (multipli di `punti.passo`, o l'importo che azzera). */
  pointsSpent?: number;
  /** codice sconto opzionale (legacy, singolo) */
  discountCode?: string;
  /** codici sconto cumulati (ri-validati lato server) */
  discountCodes?: string[];
}

/** Esito validazione di più buoni cumulati (prezzo finale da mostrare). */
export interface DiscountsValidation {
  valid: true;
  codes: { code: string; kind: DiscountKind; value: number }[];
  listPriceEur: number;
  /** Prezzo dopo i soli buoni: i punti li sottrae il client (vedi `punti`). */
  discountedPriceEur: number;
  message: string;
  /**
   * Tutto ciò che serve al selettore dei punti. ⚠️ Il selettore NON richiama la
   * rete a ogni scatto: quella rotta ha un limite di 20 chiamate al minuto per
   * IP e uno stepper lo sfonderebbe, con un 429 che la pagina mostrerebbe come
   * «buono non valido». Qui arrivano tetto e prezzo in punti; la sottrazione è
   * locale e su interi, e l'autorità resta il server all'invio.
   */
  punti?: {
    saldo: number;
    tasso: number;
    passo: number;
    prezzoInPunti: number;
    massimo: number;
  };
}

// ----- Codici sconto -----

export type DiscountKind = 'PERCENT' | 'FIXED';
export type DiscountAudience = 'RESTRICTED' | 'PUBLIC';
/** Ambito d'uso del codice: solo abbonamenti, solo gadget o entrambi. */
export type DiscountScope = 'SUBSCRIPTION' | 'GADGET' | 'ALL';

/** Esito della validazione di un codice sconto (prezzo scontato da mostrare). */
export interface DiscountValidation {
  valid: true;
  code: string;
  kind: DiscountKind;
  value: number;
  listPriceEur: number;
  discountedPriceEur: number;
  message: string;
}

/** Codice sconto come esposto al pannello admin. */
export interface DiscountCode {
  id: string;
  code: string;
  kind: DiscountKind;
  value: number;
  audience: DiscountAudience;
  tiers: SubscriptionTier[];
  scope: DiscountScope;
  reusable: boolean;
  active: boolean;
  validFrom?: string;
  validUntil?: string;
  maxRedemptions?: number;
  redeemedCount: number;
  note?: string;
  /** numero di utenti ammessi (codici RESTRICTED) */
  eligibleCount?: number;
  createdAt?: string;
}

/** Utente ammesso a un codice (dettaglio admin). */
export interface DiscountEligibleUser {
  userId: string;
  userEmail?: string;
  redeemedAt?: string;
}

/** Codice + lista utenti ammessi (dettaglio admin). */
export interface DiscountCodeDetail extends DiscountCode {
  eligibles: DiscountEligibleUser[];
}

/** Payload di creazione/modifica codice sconto (admin). */
export interface DiscountCodePayload {
  code?: string;
  kind: DiscountKind;
  value: number;
  audience: DiscountAudience;
  tiers?: SubscriptionTier[];
  scope?: DiscountScope;
  reusable?: boolean;
  active?: boolean;
  validFrom?: string;
  validUntil?: string;
  maxRedemptions?: number;
  note?: string;
}

// ----- Audit azioni admin -----

export interface AdminActionLogEntry {
  id: string;
  adminEmail?: string;
  /** email dell'utente bersaglio (presente nel log globale) */
  userEmail?: string;
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  createdAt?: string;
}

// ----- Sessioni live -----

/** EXTERNAL = link esterno (Zoom/Discord); LIVEKIT = stanza on-site. */
export type LiveMode = 'EXTERNAL' | 'LIVEKIT';

export interface LiveSession {
  id: string;
  title: string;
  description?: string;
  stakes: LessonStakes;
  /** data/ora di inizio (ISO) */
  startsAt: string;
  durationMin?: number;
  platform?: string;
  /** modalità: link esterno o stanza on-site */
  mode: LiveMode;
  /** true se il tier corrente non sblocca l'accesso */
  locked: boolean;
  /** EXTERNAL + sbloccata: link di accesso esterno */
  joinUrl?: string;
  /** LIVEKIT: true se il tier sblocca la stanza (il token arriva da un endpoint dedicato) */
  canJoinLive?: boolean;
  /** LIVEKIT: la live è stata terminata dal coach (non più entrabile) */
  ended?: boolean;
  /** LIVEKIT: la sessione è registrabile (l'ingresso richiede consenso) */
  recordingEnabled?: boolean;
  /** LIVEKIT: stato della registrazione */
  recordingState?:
    | 'NONE'
    | 'STARTING'
    | 'ACTIVE'
    | 'PROCESSING'
    | 'READY'
    | 'DONE'
    | 'FAILED';
  /** LIVEKIT: id della lezione VOD creata (quando recordingState=DONE) */
  recordedLessonId?: string;
  /** LIVEKIT, solo admin: messaggio d'errore dell'ultima registrazione fallita */
  recordingError?: string;
  createdAt?: string;
}

export interface LiveSessionPayload {
  title: string;
  description?: string;
  stakes: LessonStakes;
  /** data/ora di inizio in ISO (il client converte da datetime-local) */
  startsAt: string;
  durationMin?: number;
  platform?: string;
  /** modalità (default EXTERNAL lato backend se omessa) */
  mode?: LiveMode;
  /** richiesto solo se mode === EXTERNAL */
  joinUrl?: string;
  /** coach esplicito (opzionale): id utente. Se assente, qualsiasi ADMIN è coach */
  hostUserId?: string;
  /** abilita la registrazione su questa sessione (richiede consenso all'ingresso) */
  recordingEnabled?: boolean;
}

/** Una lezione già aperta dall'utente (badge "già visto"). */
export interface LessonViewSummary {
  lessonId: string;
  aperture: number;
  primaAperturaAt?: string;
  ultimaAperturaAt?: string;
  /** presente solo nelle viste admin per-utente */
  titolo?: string;
  /** assente se il player non ha riportato l'avanzamento */
  percentualeMax?: number;
  secondiVisti?: number;
}

/** Chi ha aperto una certa lezione (vista admin). */
export interface LessonViewer {
  userId: string;
  nome: string;
  aperture: number;
  primaAperturaAt?: string;
  ultimaAperturaAt?: string;
  /** assente se il player non ha riportato l'avanzamento */
  percentualeMax?: number;
}

/** Riepilogo per lezione: spettatori distinti e aperture (vista admin). */
export interface LessonViewsRow {
  lessonId: string;
  titolo: string;
  spettatori: number;
  aperture: number;
  ultimaApertura?: string;
}

/** Una persona nel registro presenze di una live (vista admin). */
export interface LiveAttendanceEntry {
  userId: string;
  nickname: string;
  ruolo: 'coach' | 'audience';
  primoIngresso: string;
  ultimaUscita: string | null;
  minuti: number;
  ingressi: number;
  /** connessione ancora aperta: la live è in corso */
  ancoraInSala: boolean;
  /** durata dedotta e non misurata (evento di uscita mai arrivato) */
  durataStimata: boolean;
}

/** Registro presenze di una sessione live on-site. */
export interface LiveAttendanceReport {
  sessione: { id: string; titolo: string; inizio: string; fine: string | null };
  partecipanti: LiveAttendanceEntry[];
  totali: {
    partecipanti: number;
    mediaMinuti: number | null;
    troncato: boolean;
  };
}

/** Una live a cui un iscritto ha partecipato (pannello Iscritti). */
export interface UserLiveAttendance {
  sessionId: string;
  titolo: string;
  primoIngresso: string;
  minuti: number;
  ingressi: number;
}

/**
 * Correzioni applicate alla lezione al momento di pubblicare la registrazione.
 * Tutto opzionale: ciò che si omette resta derivato dalla sessione live.
 */
export interface PublishRecordingPayload {
  title?: string;
  description?: string;
  /** tag aggiuntivi: il marcatore 'live' lo mette il backend */
  tags?: string[];
  /** solo un ADMIN può cambiare il tier (decide il paywall) */
  stakes?: LessonStakes;
  freePreview?: boolean;
  videoDate?: string;
  /** categoria della lezione che nasce dalla VOD; il ripiego lo mette il backend */
  categoria?: LessonCategory;
  /** false = niente avviso Discord e niente email agli abbonati */
  notify?: boolean;
}

/** Token per entrare in una stanza on-site (LIVEKIT). */
export interface LiveRoomToken {
  token: string;
  url: string;
  role: 'coach' | 'audience';
  /** la sessione è registrabile → il coach vede i controlli di registrazione */
  recordingEnabled: boolean;
  /**
   * Inizio reale della registrazione in corso (ISO), o null se non si registra ora.
   * Ancora il timer "REC" al tempo effettivo invece che al proprio ingresso.
   */
  recordingStartedAt?: string | null;
}

/** Nota di rettifica pubblicata in calce a un articolo (§4.4). */
export interface NewsRettifica {
  at: string;
  nota: string;
}

/**
 * Articolo delle news.
 *
 * ⚠️ **Tutti i campi della redazione sono opzionali, e non per pigrizia**: il
 * frontend si deploya prima o dopo il backend a seconda del lotto, e un articolo
 * scritto a mano nel vecchio pannello non ha né `aiGeneratedAt` né rettifiche.
 * Un campo obbligatorio qui non farebbe fallire niente a compilazione — è solo un
 * tipo — ma farebbe scrivere codice che dà per certo un valore che può mancare.
 *
 * ⚠️ `revisionatoDaNome` è l'UNICO campo di questa interfaccia che l'API **non
 * espone ancora**: la proiezione pubblica del backend (`CAMPI_PUBBLICI`) porta
 * `autore`, `publishedAt`, `rettifiche`, `ultimaRettificaAt` e `aiGeneratedAt`,
 * ma di `revisionatoDa` tiene fuori sia l'ObjectId sia il nome — ed è giusto
 * così: la coda non deve trapelare. Finché quel nome non arriva, l'etichetta IA
 * **non si rende** (vedi `news-detail.component.ts`), il che oggi non si vede
 * perché nessun articolo ha `aiGeneratedAt`. Diventa visibile il giorno in cui la
 * pipeline pubblica il primo pezzo: è un **prerequisito di P4**, non un dettaglio
 * di tipizzazione.
 */
export interface News {
  _id: string;
  title: string;
  body: string;
  coverImageUrl?: string;
  /**
   * Copertina **social** generata dal backend (la targa 1200×675 con occhiello
   * e titolo). ⚠️ **Non è l'immagine della PAGINA dell'articolo**, e lì non va
   * mai renderizzata: la targa stampa il titolo, che l'`<h1>` ripete due
   * centimetri sotto. Si vede in due posti soli, e in due ordini diversi:
   * l'`og:image`, che vale `ogImageUrl || coverImageUrl || og.png` —
   * la stessa catena, nello stesso ordine, in cui la costruisce la Pages
   * Function (`functions/lib/render-news.mjs`) — e l'immagine della **card**
   * negli elenchi, che vale `coverImageUrl || ogImageUrl`, cioè l'ordine
   * **opposto**. ⚠️ La divergenza è una decisione, spiegata per esteso in
   * `shared/ui/news-card/news-card.component.ts`: in una chat vince la targa,
   * che porta il titolo dentro l'immagine; in un elenco, dove il titolo è già
   * scritto accanto, vince una foto vera.
   * ⚠️ **`||` e non `??`, ed è la differenza che due spec sorvegliano** (una in
   * `news-detail.component.spec.ts`, una in `scripts/lib/news-render.test.mjs`,
   * intitolate proprio così). Lo schema ha `trim: true`, quindi una
   * `ogImageUrl` può arrivare **stringa vuota**: con `??` quella stringa
   * vincerebbe di qua e non di là, e lo stesso articolo mostrerebbe la foto allo
   * scraper e l'`og.png` al browser. Scrivere `??` in questa riga è il modo più
   * rapido per far reintrodurre il difetto a chi legge il tipo e si fida.
   * Assente sui pezzi pubblicati
   * prima di questo lotto e su quelli in cui la generazione è fallita: è
   * **voluto** — nessuna URL di ripiego viene persistita, così la riga resta
   * fra quelle recuperabili col comando esplicito.
   */
  ogImageUrl?: string;
  /** Slug pubblico dell'articolo: è la forma buona del suo indirizzo (§4.5). */
  slug?: string;
  /**
   * Categoria dell'articolo. È in `CAMPI_PUBBLICI` fin dall'inizio — la
   * risposta la porta — ma qui mancava: la dichiara il 23/08/2026 il blocco
   * «Per approfondire», che la usa come ripiego quando nessuna parola del pezzo
   * aggancia una guida (`features/guides/guide-links.ts`).
   *
   * ⚠️ **Opzionale**, per la stessa ragione di `status` su `NewsAdmin`: il
   * backend legge in `.lean()`, che **non** applica i default di schema, quindi
   * una riga anteriore al campo arriva davvero senza. Dichiararla obbligatoria
   * non darebbe alcun errore utile — è solo un tipo — ma farebbe scrivere codice
   * che si fida.
   */
  categoria?: NewsCategory;
  /**
   * Prima pubblicazione. ⚠️ È questa la data che il lettore vede e che finisce
   * nei dati strutturati, **non** `createdAt`: fra la bozza e la pubblicazione
   * possono passare giorni.
   */
  publishedAt?: string;
  /** Byline reale (D40): il nome che la pagina `/redazione` dichiara. */
  autore?: string;
  /** Quando il pezzo è stato generato con l'ausilio dell'IA (interruttore dell'etichetta). */
  aiGeneratedAt?: string;
  /** Nome del revisore umano — vedi l'avviso sull'interfaccia. */
  revisionatoDaNome?: string;
  /** Note di rettifica, in ordine di pubblicazione. */
  rettifiche?: NewsRettifica[];
  /** Data dell'ultima rettifica: pilota `dateModified` (D45), mai `updatedAt`. */
  ultimaRettificaAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewsPayload {
  title: string;
  body: string;
  coverImageUrl?: string;
}

// ----- Redazione (news, lato admin) -----
// ⚠️ Specchio di `backend/src/news/news.types.ts` e dello schema `news`: i nomi
// dei campi sono quelli, **alla lettera**. Un nome sbagliato qui non dà errore
// di compilazione — si manifesta come una card vuota.

/** I cinque stati dell'articolo (`NEWS_STATUSES` lato backend). */
export type NewsStatus =
  | 'BOZZA'
  | 'IN_REVISIONE'
  | 'PUBBLICATO'
  | 'SCARTATO'
  | 'SCADUTO';

/**
 * Etichette italiane degli stati.
 *
 * ⚠️ Le affiliazioni non ne hanno una gemella perché lì l'italiano lo calcola il
 * server (`statusLabel` viaggia sulla riga). La coda della redazione torna
 * invece il documento **nudo**: `newsStatusLabel()` esiste sul backend ma non
 * entra in nessuna risposta. Finché è così l'etichetta si calcola qui, in UNA
 * sede sola — copia meccanica dello `switch` di `news.types.ts`. Mai una
 * seconda mappa dentro un componente.
 */
export const NEWS_STATUS_LABELS: Record<NewsStatus, string> = {
  BOZZA: 'Bozza',
  IN_REVISIONE: 'In revisione',
  PUBBLICATO: 'Pubblicato',
  SCARTATO: 'Scartato',
  SCADUTO: 'Scaduto',
};

/**
 * I cinque stati nell'ordine del backend (`NEWS_STATUSES`): alimenta le pillole
 * di filtro dell'archivio. ⚠️ L'ordine è quello della macchina a stati, non
 * alfabetico: si legge come il percorso di un articolo.
 */
export const NEWS_STATUSES: readonly NewsStatus[] = [
  'BOZZA',
  'IN_REVISIONE',
  'PUBBLICATO',
  'SCARTATO',
  'SCADUTO',
];

/**
 * Sentinella «tutti gli stati» della **query** della lista admin
 * (`NEWS_STATUS_TUTTI` lato backend). ⚠️ Non è uno stato: non entra in
 * `NEWS_STATUSES`, non ha una riga nella macchina a stati e non può finire su
 * `NewsAdmin.status`. Vale solo come valore di `?status=`.
 *
 * ⚠️ Maiuscolo: il `@IsIn` del DTO distingue le maiuscole, un `'tutti'` è un
 * 400 sull'intera chiamata.
 */
export const NEWS_STATUS_TUTTI = 'TUTTI' as const;

/** Cosa può valere `status` nella query admin: uno stato, oppure «tutti». */
export type NewsStatusFiltro = NewsStatus | typeof NEWS_STATUS_TUTTI;

/**
 * I valori ammessi dal filtro, nell'ordine delle pillole. «Tutti» sta per primo
 * perché è la vista dell'archivio: è l'unica che mostra anche `SCARTATO` e
 * `SCADUTO`, cioè gli stati che nessuna schermata raggiungeva.
 */
export const NEWS_STATUS_FILTRI: readonly NewsStatusFiltro[] = [
  NEWS_STATUS_TUTTI,
  ...NEWS_STATUSES,
];

/**
 * Etichette del filtro: gli stati riusano `NEWS_STATUS_LABELS` — mai una
 * seconda mappa — e la sentinella aggiunge la sua, che uno stato non ha perché
 * «in che stato è questa riga» su un filtro non è una domanda sensata.
 */
export const NEWS_FILTRO_LABELS: Record<NewsStatusFiltro, string> = {
  ...NEWS_STATUS_LABELS,
  [NEWS_STATUS_TUTTI]: 'Tutti',
};

/**
 * Le otto categorie: enum chiusa, **una sola per articolo e obbligatoria** (il
 * default lato schema è `online`). I tag restano liberi e separati.
 */
export type NewsCategory =
  | 'live'
  | 'online'
  | 'mtt'
  | 'cash'
  | 'industry'
  | 'regolamentazione'
  | 'strategia'
  | 'la-scuola';

/** Le stesse otto, nell'ordine del backend: alimenta pillole e select. */
export const NEWS_CATEGORIES: readonly NewsCategory[] = [
  'live',
  'online',
  'mtt',
  'cash',
  'industry',
  'regolamentazione',
  'strategia',
  'la-scuola',
];

/** ⚠️ Il **valore** è la chiave stabile (finisce nei filtri); l'etichetta no. */
export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  live: 'Poker live',
  online: 'Poker online',
  mtt: 'Tornei',
  cash: 'Cash game',
  industry: 'Industria',
  regolamentazione: 'Regolamentazione',
  strategia: 'Strategia',
  'la-scuola': 'La scuola',
};

/**
 * Provenienza della copertina (D57): pilota il layout della pagina pubblica —
 * `GENERATA` né credito né etichetta, `LICENZIATA` credito e licenza
 * obbligatori (il gate di pubblicazione risponde 400 senza), `AI` etichetta
 * visibile sotto l'immagine.
 */
export type NewsImageSource = 'GENERATA' | 'LICENZIATA' | 'AI';

/**
 * L'articolo **come lo vede l'admin**: la riga intera di Mongo, senza
 * proiezione — `GET /admin/news` non applica alcun `toView`.
 *
 * ⚠️ Tipo separato da `News` e non un suo allargamento: `News` è la proiezione
 * **pubblica** (`CAMPI_PUBBLICI`), e aggiungerle questi campi come opzionali
 * farebbe scrivere alla pagina pubblica codice che dà per certo un valore che lì
 * non arriva mai.
 *
 * ⚠️ Le `Date` del backend arrivano serializzate come stringhe ISO, come ovunque
 * in questo file.
 */
export interface NewsAdmin {
  _id: string;
  title: string;
  body: string;
  coverImageUrl?: string;
  /**
   * La targa **social** generata dal backend (vedi `News.ogImageUrl`): non è
   * l'immagine della pagina e non si rende mai qui dentro.
   *
   * ⚠️ Serve al pannello per una cosa sola, e non è cosmetica: il marcatore
   * «Senza copertina» dell'archivio si calcola su questo campo. `listAdmin`
   * non proietta in nessuno dei due rami — il ramo non-coda fa
   * `.find(filtro).sort(…).lean()`, quello di coda un aggregate che fa
   * `$unset` dei soli due campi temporanei — quindi il campo arriva già
   * intero, senza toccare il backend.
   *
   * ⚠️ Assente è un valore REALE e frequente: i pezzi pubblicati prima di
   * questo lotto non ne hanno, e su quelli in cui il disegno è fallito non si
   * persiste alcuna URL di ripiego, apposta — è ciò che li lascia
   * nell'elenco recuperabile col comando «Genera copertina».
   */
  ogImageUrl?: string;

  /**
   * Quando l'articolo è stato annunciato nel canale Discord delle news.
   *
   * ⚠️ **Assente copre DUE casi** e non sono distinguibili a posteriori: «mai
   * annunciato» e «tentato, rifiutato da Discord, marcatore rilasciato» — il
   * rilascio usa `$unset`, che cancella il campo. Per il pannello la differenza
   * non conta: in entrambi l'articolo **non è nel canale** e il comando serve.
   * Conta invece che la cosa sia **visibile**, perché il rifiuto del 23/08/2026
   * (canale Forum senza `thread_name`) non lasciava alcun segno fuori dai log
   * di Render.
   */
  discordPostedAt?: string;
  /**
   * ⚠️ **Opzionale, e non per prudenza.** `GET /admin/news?status=TUTTI` filtra
   * con `{}` e **non** con un `$in` sui cinque stati, di proposito: così una
   * riga priva di `status` (gli articoli storici, se `migraArticoliLegacy` è
   * fallita — il suo catch NON rilancia, o cadrebbe il boot dell'intera API)
   * resta visibile proprio nell'unica schermata che serve a ritrovare ciò che
   * non si vede. Il backend lo pinna con un test dedicato («TUTTI» vede anche
   * una riga senza `status`) e legge in `.lean()`, che **non** applica i
   * default di schema: quel campo arriva davvero `undefined`.
   *
   * Dichiararlo obbligatorio non dava alcun errore di compilazione utile — è
   * solo un tipo — ma faceva scrivere `status.toLowerCase()`: un TypeError
   * dentro un binding, cioè l'archivio che si rompe sulla riga che esiste per
   * farsi ritrovare.
   */
  status?: NewsStatus;
  categoria: NewsCategory;
  tags: string[];
  /** Prima pubblicazione: non si riscrive mai, nemmeno dopo un ritiro. */
  publishedAt?: string;
  /** Chiave pubblica dell'articolo; assente finché non è mai stato pubblicato. */
  slug?: string;
  /** Slug precedenti: sono ciò che tiene in vita i 301 (§4.5). */
  slugStorici: string[];
  /**
   * ⚠️ Le fonti sono la **condizione di liceità** (art. 101 LdA), non una
   * bibliografia: la card le rende come link, e un elenco vuoto blocca la
   * pubblicazione.
   */
  sourceUrls: string[];
  /** Nomi leggibili delle testate, in parallelo a `sourceUrls`. */
  sourceOutlets: string[];
  /** Rilievi della pipeline: si stampano **verbatim**, mai riscritti. */
  complianceFlags: string[];
  /** 0-1. ⚠️ Campo da mostrare, **mai** una chiave di ordinamento (D32). */
  confidence?: number;
  /** Byline reale pubblicata (default `Pietro Piraino`). */
  autore: string;
  clusterId?: string;
  simhash?: string;
  contentHash?: string;
  aiModel?: string;
  promptVersion?: string;
  /** Interruttore dell'etichetta IA in pagina. */
  aiGeneratedAt?: string;
  /** Prova della revisione umana (art. 50(4) AI Act): ObjectId del revisore. */
  revisionatoDa?: string;
  revisionatoAt?: string;
  /** Motivo dello scarto: **interno alla coda**, non lo legge il pubblico. */
  decisionNote?: string;
  /** Fine della finestra di attualità. ⚠️ Assente = evergreen, non "scaduto". */
  scadeIl?: string;
  scadutoAt?: string;
  /** Snooze (D35): la riga scende in fondo alla coda, lo stato NON cambia. */
  rimandatoFino?: string;
  /** Note di rettifica pubbliche, in ordine di pubblicazione. */
  rettifiche: NewsRettifica[];
  ultimaRettificaAt?: string;
  imageSource: NewsImageSource;
  imageCredit?: string;
  imageLicense?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * L'envelope della coda: paginazione **più** lo stato della modalità assenza.
 *
 * ⚠️ `pausaFino` è una **data**, non un booleano: "in pausa" è
 * `new Date(pausaFino) > now`, e una data passata significa pausa già finita.
 * Non normalizzarla a `null` lato client — è la stessa forma che il backend
 * scrive, e la sua scadenza automatica è la garanzia che una pausa dimenticata
 * non spenga la redazione per sempre.
 *
 * ⚠️ La chiave c'è **sempre**, anche filtrando per uno stato diverso da
 * `IN_REVISIONE`: il banner non deve sparire cambiando scheda.
 */
export type CodaRedazione = Paginated<NewsAdmin> & { pausaFino: string | null };

/** Badge della sidebar: `GET /admin/news/pending-count`. */
export interface NewsPendingCount {
  inCoda: number;
}

/**
 * Filtri della lista admin (default lato server: `IN_REVISIONE`, 25/pagina).
 *
 * ⚠️ `status` accetta anche la sentinella `'TUTTI'` (nessun filtro), e omettere
 * il campo **non** significa «tutti»: significa la coda. Chi vuole l'archivio
 * completo lo chiede esplicitamente.
 */
export interface AdminNewsListOpts {
  status?: NewsStatusFiltro;
  page?: number;
  limit?: number;
}

/**
 * Correzioni al volo ammesse in approvazione.
 *
 * ⚠️ Tutti i campi sono facoltativi e **`body` non c'è**: `approve` è una
 * decisione, non un editor — un testo da riscrivere passa dal `PATCH`. E il
 * `ValidationPipe` gira con `forbidNonWhitelisted`: una chiave in più fa 400
 * l'INTERA chiamata, non il campo.
 */
export interface NewsApprovePayload {
  title?: string;
  categoria?: NewsCategory;
  tags?: string[];
  imageSource?: NewsImageSource;
  imageCredit?: string;
  imageLicense?: string;
}

/** Stato della modalità assenza, sia in lettura sia come esito di `PUT`. */
export interface NewsPausaSettings {
  pausaFino: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ----- Tabelle preflop (soluzioni GTO) -----

/**
 * Identificatore di formato: gioco base (spin|husng) + varianti opzionali,
 * es. "spin", "husng_ante", "spin_ante_2.5x_nolimp". L'elenco reale arriva
 * dalla meta; la composizione/scomposizione è in preflop-display.ts.
 */
export type PreflopFormat = string;

export interface PreflopFormatMeta {
  format: PreflopFormat;
  /** profondità disponibili, in big blind (es. "1.5", "25") */
  depths: string[];
  /**
   * Solo formati asimmetrici: combinazioni di stack "BTN-SB-BB" per
   * profondità (es. "25" → ["25-1-25", …, "25-25-22"]).
   */
  stacksByDepth?: Record<string, string[]>;
}

export interface PreflopMeta {
  formats: PreflopFormatMeta[];
}

export interface PreflopPlayer {
  position: string;
  stack: number;
  is_active: boolean;
}

export interface PreflopAction {
  /** codice azione: chiave in freq/ev e segmento del percorso (es. F, C, X, R2.5, RAI) */
  code: string;
  type: 'FOLD' | 'CALL' | 'CHECK' | 'RAISE';
  betsize: number;
  betsize_by_pot: number | null;
  display: string;
  simple_group: string;
  advanced_group: string;
  next_position: string | null;
  is_hand_end: boolean;
  next_street: boolean;
  /** true: l'azione chiude la mano, non c'è un nodo successivo da esplorare */
  is_terminal: boolean;
  /** frequenza dell'azione sull'intero range (0..1) */
  total_freq: number;
}

export interface PreflopHandData {
  /** frequenza per codice azione (0..1; tutte ≈0 se la mano non arriva mai qui) */
  freq: Record<string, number>;
  /** EV in big blind per codice azione */
  ev: Record<string, number>;
  hand_ev: number;
}

export interface PreflopNode {
  format: PreflopFormat;
  depth: number;
  depth_label: string;
  stacks: string;
  /** percorso dalla radice, codici separati da "-" (vuoto = radice) */
  preflop_actions: string;
  history: string[];
  active_position: string;
  pot: number;
  players: PreflopPlayer[];
  actions: PreflopAction[];
  hands: Record<string, PreflopHandData>;
}

// ----- Allenamento (training drills) -----

export type DrillDifficulty = 'ALL' | 'STANDARD' | 'MIXED_ONLY' | 'MARGINAL';
export type DrillSpotType =
  | 'OPEN'
  | 'VS_OPEN'
  | 'VS_3BET'
  | 'VS_4BET_PLUS'
  | 'LIMPED';

/** Config inviata per avviare una sessione (insieme vuoto = "qualunque"). */
export interface DrillConfigPayload {
  formats: string[];
  depths: string[];
  positions: string[];
  spotTypes: DrillSpotType[];
  stacks?: string[];
  difficulty: DrillDifficulty;
  questionsPerSession: number;
}

/** Una combinazione (formato/depth/posizione/tipo-spot) con almeno uno spot
 *  reale — usata dal configuratore per disabilitare le selezioni impossibili. */
export interface DrillCombo {
  format: string;
  depth: string;
  position: string;
  spotType: DrillSpotType;
}

export interface DrillOptions {
  combos: DrillCombo[];
}

export interface DrillSessionView {
  id: string;
  status: 'active' | 'completed' | 'abandoned';
  config: DrillConfigPayload;
  served: number;
  answered: number;
  correct: number;
  totalEvLoss: number;
  avgEvLoss: number;
  accuracyPct: number;
  questionsPerSession: number;
  createdAt?: string;
  completedAt?: string;
}

/** Azione mostrata nei pulsanti (sottoinsieme di PreflopAction, senza freq/ev). */
export interface DrillQuestionAction {
  code: string;
  type: PreflopAction['type'];
  display: string;
  betsize: number;
  betsize_by_pot: number | null;
}

/** Un'azione già avvenuta, con la posizione che l'ha eseguita. */
export interface DrillActionLogEntry {
  position: string;
  code: string;
  type: PreflopAction['type'];
  betsize: number;
  display: string;
}

/** Posto al tavolo: stack residuo + fiche versate davanti (committed). */
export interface DrillSeat {
  position: string;
  stack: number;
  is_active: boolean;
  committed: number;
}

/** Domanda redatta: nessuna traccia della strategia. */
export interface DrillQuestion {
  questionId: string;
  format: PreflopFormat;
  depthLabel: string;
  stacks: string;
  preflopActions: string;
  activePosition: string;
  spotType: DrillSpotType;
  pot: number;
  players: DrillSeat[];
  history: string[];
  actionLog: DrillActionLogEntry[];
  hand: string;
  actions: DrillQuestionAction[];
}

export interface DrillNextQuestion {
  finished: boolean;
  served: number;
  total: number;
  question: DrillQuestion | null;
}

/** Reveal dopo la risposta: la verità GTO ora è visibile. */
export interface DrillAnswerResult {
  correct: boolean;
  score: number;
  chosenCode: string;
  bestCode: string;
  chosenEv: number;
  bestEv: number;
  evLoss: number;
  chosenFreq: number;
  handEv: number;
  freqs: Record<string, number>;
  evs: Record<string, number>;
  served: number;
  answered: number;
  correctSoFar: number;
  avgEvLoss: number;
  finished: boolean;
}

/**
 * Una configurazione salvata dallo studente. È esattamente un
 * `DrillConfigPayload` più un nome e un id — e non per pigrizia: «valida da
 * salvare» e «valida da avviare» devono restare la stessa cosa, o si finisce
 * con un preset che si salva e non si avvia.
 */
export interface DrillPreset extends DrillConfigPayload {
  id: string;
  nome: string;
}

export interface DrillStatsBucket {
  key: string;
  format: PreflopFormat;
  depthLabel: string;
  answered: number;
  correct: number;
  avgEvLoss: number;
}

export interface DrillStats {
  totalAnswered: number;
  totalCorrect: number;
  accuracyPct: number;
  avgEvLoss: number;
  totalEvLoss: number;
  sessionsCompleted: number;
  buckets: DrillStatsBucket[];
  worstBuckets: DrillStatsBucket[];
}

export interface DrillAttempt {
  id: string;
  sessionId: string;
  format: PreflopFormat;
  depthLabel: string;
  stacks: string;
  preflopActions: string;
  activePosition: string;
  spotType: string;
  hand: string;
  chosenCode: string;
  bestCode: string;
  evLoss: number;
  chosenFreq: number;
  correct: boolean;
  createdAt?: string;
}

export interface DrillHistory {
  items: DrillAttempt[];
  page: number;
  limit: number;
  total: number;
}

export interface DrillSessionsPage {
  items: DrillSessionView[];
  page: number;
  limit: number;
  total: number;
}

// ----- Negozio (Shop, acquisti in punti BFF) -----

export type ShopVoucherType = 'EUR_10' | 'EUR_25';
export type ShopOrderType = 'VOUCHER' | 'SUBSCRIPTION' | 'GADGET';
export type ShopOrderStatus =
  | 'COMPLETED'
  | 'RICEVUTO'
  | 'SPEDITO'
  | 'CONSEGNATO'
  | 'ANNULLATO';
/** Stati impostabili dall'admin sull'avanzamento di un ordine gadget. */
export type GadgetFulfillStatus = 'RICEVUTO' | 'SPEDITO' | 'CONSEGNATO';
/** Metodo di pagamento di un ordine gadget: punti BFF o euro off-site. */
export type ShopPaymentMethod = 'punti' | 'paypal' | 'skrill';

/** Catalogo a prezzo fisso (buoni + abbonamenti) per la vetrina. */
export interface ShopCatalog {
  vouchers: {
    type: ShopVoucherType;
    label: string;
    eurValue: number;
    pricePoints: number;
  }[];
  subscriptions: {
    tier: SubscriptionTier;
    label: string;
    pricePoints: number;
  }[];
}

/** Prodotto gadget come esposto al client. */
export interface GadgetResource {
  id: string;
  title: string;
  description: string;
  /** null = non acquistabile con i punti */
  pricePoints: number | null;
  /** null = non acquistabile in euro */
  priceEur: number | null;
  /** null = stock illimitato */
  stock: number | null;
  active: boolean;
  imageUrl?: string;
  outOfStock: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Metadati per creare/modificare un gadget (l'immagine viaggia in multipart). */
export interface GadgetPayload {
  title: string;
  description: string;
  pricePoints?: number;
  priceEur?: number;
  stock?: number;
  active?: boolean;
}

/** Indirizzo di spedizione di un ordine gadget. */
export interface ShippingAddress {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  zip: string;
  province: string;
  country: string;
  phone: string;
}

/** Ordine del Negozio come esposto a client/admin. */
export interface ShopOrder {
  id: string;
  userId: string;
  userEmail: string;
  userNickname?: string;
  type: ShopOrderType;
  typeLabel: string;
  status: ShopOrderStatus;
  statusLabel: string;
  pointsSpent: number;
  itemLabel: string;
  voucherCode?: string;
  tier?: SubscriptionTier;
  gadgetId?: string;
  shippingAddress?: ShippingAddress;
  paymentMethod?: ShopPaymentMethod;
  paymentReference?: string;
  amountEur?: number;
  listPriceEur?: number;
  discountedPriceEur?: number;
  discountCodes?: string[];
  trackingNote?: string;
  decisionNote?: string;
  refundedPoints?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Buono dell'utente (area personale + selettore /abbonati). */
export interface MyVoucher {
  code: string;
  kind: DiscountKind;
  value: number;
  source: 'admin' | 'shop';
  /** disponibile · riservato (in attesa) · usato · scaduto · disattivato */
  status: 'available' | 'reserved' | 'redeemed' | 'expired' | 'inactive';
  validUntil?: string;
  createdAt?: string;
}

// ----- Statistiche admin (GET /admin/stats) -----
// Ricalcate su backend/src/admin/admin-stats.types.ts: se là cambia una shape,
// va cambiata anche qui (non c'è un tipo condiviso fra i due repo).
//
// ⚠️ DUE convenzioni diverse per le percentuali, ed è voluto lato backend:
// `tassoRinnovo` e `conversione.tasso` sono FRAZIONI 0..1, `deltaPct` è già un
// NUMERO IN PUNTI PERCENTUALI (12.5 = +12,5%). Formattarli con lo stesso helper
// sbaglia di un fattore 100.

/** Serie mensile dell'incasso: `mese` = 'YYYY-MM' (mese italiano). */
export interface StatsMeseIncasso {
  mese: string;
  incassoEur: number;
  ordini: number;
  /** Righe senza snapshot di prezzo, ricostruite dal listino della data. */
  stimati: number;
  perMetodo: Array<{ metodo: string; incassoEur: number; ordini: number }>;
}

/** Attivazioni del mese che NON hanno portato cassa (€0). */
export interface StatsMeseSenzaCassa {
  mese: string;
  punti: number;
  manuale: number;
}

export interface StatsMeseCoorte {
  mese: string;
  scaduti: number;
  rinnovati: number;
  /** null sotto la coorte minima: la UI mostra "2 su 3", MAI "0%". */
  tassoRinnovo: number | null;
}

/** Clienti distinti di un mese, per come sono entrati. */
export interface StatsClientiPerTipo {
  nuovi: number;
  rinnovi: number;
  ritorni: number;
}

/** `paganti` e `nonPaganti` sono due righe separate e non vanno MAI sommate. */
export interface StatsMeseAcquisizione {
  mese: string;
  paganti: StatsClientiPerTipo;
  nonPaganti: StatsClientiPerTipo;
}

export interface AdminStatsView {
  /** Istante del calcolo: la risposta può arrivare dalla cache. */
  generatoIl: string;
  aggiornatoOgniMinuti: number;
  finestraMesi: number;

  abbonati: {
    /** Ruolo tier E scadenza nel futuro: gli abbonamenti in regola. */
    conAbbonamentoValido: number;
    /** Ruolo tier comunque sia messa la scadenza: chi passa il paywall ORA. */
    hannoAccessoOra: number;
    perTier: Array<{
      tier: Role;
      conAbbonamentoValido: number;
      hannoAccessoOra: number;
      /** Accesso a vita (scadenza assente): invisibile al cron notturno. */
      senzaScadenza: number;
      /** Scaduti con una data vera, che il cron declasserà. */
      daDeclassare: number;
    }>;
    /**
     * Accesso pieno che NON è un abbonamento: staking e coach.
     * ⚠️ Mai sommato ai due numeri qui sopra né agli incassi — sono persone che
     * entrano come un abbonato senza aver comprato niente e senza una scadenza.
     * Vuoto finché nessuno ha uno dei due ruoli.
     */
    accessoNonAbbonato: Array<{ ruolo: Role; utenti: number }>;
  };

  /** Incasso dei soli ABBONAMENTI: i gadget in euro non sono qui (vedi limiti). */
  incassoAbbonamenti: {
    ultimi30Eur: number;
    ordini30: number;
    precedenti30Eur: number;
    /** ⚠️ punti percentuali (12.5 = +12,5%); null se la base è zero. */
    deltaPct: number | null;
    /** Volume punti/omaggi: accanto agli euro, MAI sommato. */
    attivazioniSenzaCassa30: number;
    serieMensile: StatsMeseIncasso[];
    senzaCassaMensile: StatsMeseSenzaCassa[];
  };

  rinnovi: {
    /** Sempre il mese di calendario appena chiuso, anche se vuoto. */
    ultimoMeseChiuso: StatsMeseCoorte;
    serieMensile: StatsMeseCoorte[];
  };

  scadenze: {
    entro7: { utenti: number; valoreListinoEur: number };
    /** Cumulativo: include i 7 giorni. */
    entro30: { utenti: number; valoreListinoEur: number };
    perTier: Array<{
      tier: Role;
      entro7: number;
      entro30: number;
      valoreListinoEur: number;
    }>;
  };

  acquisizione: {
    serieMensile: StatsMeseAcquisizione[];
  };

  conversione: {
    registrazioniComplete: number;
    paganti: number;
    /** ⚠️ frazione 0..1; null senza denominatore. */
    tasso: number | null;
  };

  /** Quanto fidarsi del resto della pagina: ogni contatore è un'anomalia vera. */
  qualitaDati: {
    senzaScadenzaTotale: number;
    senzaScadenzaPerRuolo: Array<{ ruolo: Role; utenti: number }>;
    daDeclassare: number;
    stimati: number;
    approvedSenzaDecidedAt: number;
  };

  /** Da rendere IN PAGINA, non in un tooltip. */
  limiti: string[];
}

// ----- Statistiche video (GET /admin/stats/video) -----
// Ricalcate su backend/src/admin/admin-video-stats.types.ts.
// ⚠️ il query param si chiama `giorni` (non `days`), mentre /admin/stats usa
// `months`: due nomi diversi, non un refuso.

/** Una riga della tabella: una lezione coi numeri del suo video Bunny. */
export interface RigaVideoLezione {
  lezioneId: string;
  titolo: string;
  /** Titolo lato Bunny: può divergere da quello della lezione. */
  titoloVideo?: string;
  guid: string;
  visibility: string;
  stakes?: LessonStakes;
  videoDate?: string;
  /** Riproduzioni LIFETIME dell'embed. */
  visualizzazioni: number;
  tempoVisioneSecondi: number;
  tempoMedioSecondi: number;
  durataSecondi: number | null;
  /** ⚠️ frazione 0..1; null senza durata (una % senza denominatore è inventata). */
  percentualeVisione: number | null;
}

/** Una lezione ESCLUSA dalla tabella, col motivo già in italiano. */
export interface LezioneSaltata {
  lezioneId: string;
  titolo: string;
  dettaglio?: string;
}

/** Il totale è esatto, gli `esempi` sono troncati. */
export interface GruppoSaltate {
  totale: number;
  esempi: LezioneSaltata[];
}

export interface AdminVideoStatsView {
  generatoIl: string;
  aggiornatoOgniMinuti: number;

  /**
   * false = sezione degradata (Bunny giù o non configurato): la forma resta
   * completa ma `libreria`/`andamento` sono null e le liste vuote. La UI mostra
   * `motivo`, MAI degli zeri: uno zero si legge "nessuno guarda i video", che è
   * l'opposto di "non lo sappiamo".
   */
  disponibile: boolean;
  motivo?: string;

  /** Finestra del solo `andamento`: la tabella e la libreria sono lifetime. */
  periodo: { giorni: number; dal: string; al: string };

  /** Lifetime su TUTTI i video, inclusi i `videoNonAssociati`: NON è la somma
   * della tabella e non va presentato come confrontabile. */
  libreria: {
    video: number;
    visualizzazioni: number;
    tempoVisioneSecondi: number;
    tempoVisioneOre: number;
  } | null;

  andamento: {
    visualizzazioniPeriodo: number;
    serie: Array<{ giorno: string; visualizzazioni: number }>;
  } | null;

  /** Già ordinata per visualizzazioni decrescenti dal backend. */
  lezioni: RigaVideoLezione[];

  /** Lezioni assenti dalla tabella: da mostrare sempre se totale > 0. */
  saltate: {
    totale: number;
    senzaEmbedValido: GruppoSaltate;
    libreriaDiversa: GruppoSaltate;
    senzaStatistiche: GruppoSaltate;
  };

  /** Video su Bunny senza lezione: spiegano il divario libreria/tabella. */
  videoNonAssociati: {
    totale: number;
    esempi: Array<{ guid: string; titolo?: string; visualizzazioni: number }>;
  };

  qualitaDati: {
    guidDuplicati: number;
    paginaTroncata: boolean;
  };

  limiti: string[];
}

// ----- Affiliazioni (tracciamento poker room) -----
// Ricalcate sulle VISTE del backend (branch `affiliazioni`):
// `affiliations/poker-rooms.service.ts` (PokerRoomView / PokerRoomAdminView) e
// `affiliations/affiliations.service.ts` (MyAffiliationView / AffiliationAdminView).
// Non c'è un tipo condiviso fra i due repo: se là cambia una shape, va cambiata
// anche qui. ⚠️ Le `Date` del backend arrivano serializzate come stringhe ISO
// (come ovunque in questo file), quindi qui sono `string`.

/**
 * Sei stati, ognuno con una via di ritorno: la coppia {utente, sala} non viene
 * mai liberata, quindi uno stato senza uscita chiuderebbe fuori quell'utente da
 * quella sala per sempre. ⚠️ `ANNULLATO` (chiusura self-service dell'utente) è
 * uno stato vero, non l'assenza di riga: dimenticarlo lascia una card senza
 * etichetta e senza azioni.
 */
export type AffiliationStatus =
  | 'RICHIESTO'
  | 'IN_VERIFICA'
  | 'APPROVATO'
  | 'RIFIUTATO'
  | 'REVOCATO'
  | 'ANNULLATO';

/**
 * Gli stessi sei, nell'ordine del ciclo di vita: alimenta le pillole di filtro
 * del pannello admin. ⚠️ Nessuna mappa stato→etichetta qui: l'italiano lo
 * calcola il server (`statusLabel`), una sola fonte di verità per pagina utente,
 * pannello ed email.
 */
export const AFFILIATION_STATUSES: readonly AffiliationStatus[] = [
  'RICHIESTO',
  'IN_VERIFICA',
  'APPROVATO',
  'RIFIUTATO',
  'REVOCATO',
  'ANNULLATO',
];

/** Forma ammessa per l'identificativo dichiarato, configurata per sala. */
export type IdentifierFormat = 'LIBERO' | 'ALFANUMERICO' | 'NUMERICO';

/**
 * Poker room come la vede l'UTENTE (`GET /affiliations/rooms`).
 *
 * ⚠️ Non porta MAI `affiliateUrlTemplate` (il link esce solo come snapshot sulla
 * riga personale), `logoStoragePath` né `istruzioni` (possono citare bonus di
 * deposito: restano dietro la richiesta e viaggiano su `MyAffiliation`).
 */
export interface PokerRoom {
  id: string;
  name: string;
  /** chiave del deep-link `/affiliazioni?completa=<slug>` */
  slug: string;
  /** etichetta di raggruppamento (circuito), non una regola */
  network?: string;
  descrizione?: string;
  condizioni?: string;
  /**
   * Codice da digitare sul sito della sala quando non esiste un link tracciato
   * (AdmiralBet). ⚠️ Pubblico di proposito: è un'istruzione, non un segreto — la
   * card deve poterlo mostrare anche prima della richiesta.
   */
  codicePromozionale?: string;
  /** assente = logo non caricato: la card mostra il segnaposto */
  logoUrl?: string;
  identifierLabel: string;
  identifierHelp?: string;
  /** già clampati dal server: i validator del form si costruiscono da qui */
  identifierMinLen: number;
  identifierMaxLen: number;
  richiedeSecondoId: boolean;
  secondIdentifierLabel?: string;
  /** false = la sala non traccia chi ha già un account (tutte e otto, oggi) */
  consenteAccountEsistenti: boolean;
  ordine: number;
}

/** Poker room come la vede l'ADMIN: aggiunge i campi interni e di stato. */
export interface PokerRoomAdmin extends PokerRoom {
  istruzioni?: string;
  /** ⚠️ campo INTERNO: non mostrarlo fuori dal pannello admin */
  affiliateUrlTemplate: string;
  identifierFormat: IdentifierFormat;
  identifierCaseSensitive: boolean;
  active: boolean;
  /**
   * true = il template di QUESTA sala usa il segnaposto `{ref}`. ⚠️ Oggi è false
   * ovunque: verso la sala non parte alcun codice nostro.
   */
  supportaCodice: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Metadati per creare una sala (il logo viaggia in multipart, ed è facoltativo).
 *
 * ⚠️ `slug` si fissa alla creazione e non è più modificabile: è la chiave dei
 * deep-link `?completa=<slug>` già finiti nelle email spedite (vedi
 * `PokerRoomUpdatePayload`).
 */
export interface PokerRoomPayload {
  name: string;
  slug: string;
  network?: string;
  descrizione?: string;
  condizioni?: string;
  istruzioni?: string;
  affiliateUrlTemplate: string;
  codicePromozionale?: string;
  identifierLabel?: string;
  identifierHelp?: string;
  identifierFormat?: IdentifierFormat;
  identifierMinLen?: number;
  identifierMaxLen?: number;
  identifierCaseSensitive?: boolean;
  richiedeSecondoId?: boolean;
  secondIdentifierLabel?: string;
  consenteAccountEsistenti?: boolean;
  ordine?: number;
  /** ⚠️ assente = false: una sala si pubblica di proposito, non salvandola */
  active?: boolean;
}

/** Modifica sala: tutto facoltativo, `slug` escluso (il backend lo rifiuta). */
export type PokerRoomUpdatePayload = Partial<Omit<PokerRoomPayload, 'slug'>>;

/**
 * Risposta del PATCH sala: la vista admin più l'avviso sui link già spediti.
 */
export interface PokerRoomUpdated extends PokerRoomAdmin {
  /**
   * Presente SOLO quando il PATCH ha cambiato `affiliateUrlTemplate`: quante
   * righe sono ancora in attesa del link (`RICHIESTO`) e quindi ne portano uno
   * vecchio. Il motivo normale per cambiare un template è che il programma ha
   * ruotato il tracker: da quel momento quelle N persone si registrerebbero su
   * un indirizzo morto. Va STAMPATO nel pannello, con la scorciatoia "Reinvia".
   */
  righeAperteConLinkPrecedente?: number;
}

/**
 * Esito della cancellazione di una sala.
 *
 * ⚠️ Con tracciamenti esistenti è un **200** con `disattivata:true`, non un 4xx:
 * la chiamata MUTA comunque (`active:false`), quindi va trattata come successo e
 * l'elenco va ricaricato, o il pannello continua a mostrare attiva una sala che
 * non lo è più.
 */
export interface PokerRoomRemoved {
  ok: true;
  disattivata: boolean;
  tracciamenti: number;
  /** messaggio italiano già pronto per il pannello */
  messaggio: string;
}

/**
 * La riga come la vede l'UTENTE (`GET /affiliations/me`).
 *
 * ⚠️ Non porta MAI `adminNote`: è il blocco note dell'owner. Il campo che
 * l'utente legge è `decisionNote`.
 */
export interface MyAffiliation {
  id: string;
  roomId: string;
  roomName: string;
  /** assente se la sala non esiste più */
  roomSlug?: string;
  /**
   * La sala accetta ancora nuove richieste. false = disattivata: la card stampa
   * il motivo ("Questa sala non accetta nuove richieste") invece di un errore
   * generico — una sala disattivata sparisce dalla vetrina ma le righe già
   * aperte restano.
   */
  roomAttiva: boolean;
  /**
   * Codice di riferimento personale `AFF-XXXXXXXX`. ⚠️ È il **numero di pratica**
   * dell'utente (da citare scrivendoci), NON un codice da dare alla sala: verso
   * la sala non parte nulla di nostro.
   */
  refCode: string;
  /**
   * Link affiliato, letto dallo **snapshot** congelato sulla riga: è lo stesso
   * che l'utente ha in casella. ⚠️ Non ricomporlo mai dal template della sala.
   */
  affiliateUrl?: string;
  /**
   * Codice promozionale della sala, riletto dalla SALA a ogni lettura (non è uno
   * snapshot): una correzione dell'owner deve valere subito anche per chi il
   * link ce l'ha già. Dove c'è, è la sola stringa che attribuisce la
   * registrazione — va mostrata PRIMA del `refCode`.
   */
  codicePromozionale?: string;
  istruzioni?: string;
  status: AffiliationStatus;
  /** etichetta italiana calcolata dal server: non ricalcolarla nel client */
  statusLabel: string;
  identifierLabel?: string;
  /** conservato ESATTAMENTE come digitato dall'utente */
  roomUsername?: string;
  roomUserId?: string;
  accountEsistente: boolean;
  dichiaraProprieta: boolean;
  accettaTermini: boolean;
  /** motivo della decisione, scritto dall'admin e leggibile dall'utente */
  decisionNote?: string;
  richiestoAt?: string;
  linkInviatoAt?: string;
  datiInviatiAt?: string;
  decidedAt?: string;
  revocatoAt?: string;
  riaperture: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Risposta di `POST .../request`: la riga più se l'email è davvero partita.
 *
 * ⚠️ `emailSent:false` è un caso reale, non teorico (l'invio è best-effort): la
 * card deve mostrare comunque il link in pagina e dirlo, invece di lasciare
 * l'utente ad aspettare un'email che non arriverà.
 */
export interface MyAffiliationRequest extends MyAffiliation {
  emailSent: boolean;
}

/** Esito di un rinvio email (rotta utente e rotta admin: stessa forma). */
export interface AffiliationResendResult {
  emailSent: boolean;
  /** fra quanti minuti sarà possibile un altro invio (cooldown per-riga) */
  prossimoInvioTraMinuti?: number;
}

/** La riga come la vede l'ADMIN: aggiunge i campi interni. */
export interface AffiliationAdmin extends MyAffiliation {
  userId: string;
  /**
   * Chi ha aperto la pratica. `ADMIN` = inserita a mano dal pannello per
   * recuperare un'affiliazione preesistente: su quelle righe le dichiarazioni
   * dell'utente NON sono state prestate, e il pannello lo dice invece di
   * lasciarlo dedurre.
   */
  origine?: 'UTENTE' | 'ADMIN';
  userEmail: string;
  userNickname?: string;
  /**
   * Nota INTERNA dell'owner ("trovato nel back-office come FishKiller91"). ⚠️ Non
   * esce da nessuna vista utente e da nessuna email: non stamparla altrove.
   */
  adminNote?: string;
  decidedBy?: string;
  ownerNotifiedAt?: string;
}

/** Badge sul tab admin (`GET /admin/affiliations/pending-count`). */
export interface AffiliationsPendingCount {
  inVerifica: number;
}

/**
 * Corpo di `POST /affiliations/rooms/:roomId/request`: tre spunte e nient'altro.
 *
 * ⚠️ NIENTE `roomUsername`/`roomUserId` qui: l'username esiste solo dopo aver
 * creato il conto e arriva con `PUT .../identifier`. Un corpo che li porta prende
 * un **400** (`forbidNonWhitelisted`), non uno scarto silenzioso.
 * ⚠️ `dichiaraProprieta` e `accettaTermini` devono essere `true`: lato form sono
 * `Validators.requiredTrue`, che rispecchia l'`@Equals(true)` dei DTO.
 */
export interface AffiliationRequestPayload {
  accountEsistente: boolean;
  dichiaraProprieta: boolean;
  accettaTermini: boolean;
}

/**
 * Corpo di `PUT /affiliations/rooms/:roomId/identifier`.
 *
 * ⚠️ `accettaTermini` NON si ripete: un `PUT identifier` atterra sempre su una
 * riga che l'accettazione ce l'ha già (riaperture dopo un rifiuto comprese).
 */
export interface AffiliationIdentifierPayload {
  roomUsername: string;
  roomUserId?: string;
  dichiaraProprieta: boolean;
}

// ── Fonti della redazione (`/admin/news-sources`) ────────────────────────────
// Specchio di `backend/src/news-ingest/news-ingest.types.ts` e di
// `NewsSourceView` (`news-sources.service.ts`). ⚠️ Le date arrivano come
// stringhe ISO: qui sono `string`, non `Date`.

/** Trasporto: **come** si scarica la sorgente. Enum chiusa lato server. */
export type NewsStrategy =
  | 'WP_REST'
  | 'RSS2'
  | 'ATOM'
  | 'SITEMAP_NEWS'
  | 'HTML';

/** Implementazione che legge la risposta. */
export type NewsParserKey =
  | 'WP_REST_GENERICO'
  | 'RSS2_GENERICO'
  | 'SITEMAP_NEWS_GENERICO';

export type NewsSourceLanguage = 'it' | 'en';

/**
 * Stato di salute scritto dai tre rilevatori del tick.
 *
 * ⚠️ `MORTA` è **un'etichetta, non un interruttore**: il polling continua (serve
 * ad accorgersi che si è risanata). Spegnere resta un clic dell'owner, e il
 * pannello non deve suggerire che il sistema si sia auto-disabilitato.
 */
export type NewsSourceHealth = 'SANA' | 'DEGRADATA' | 'MORTA';

/** Le stesse etichette italiane di `newsSourceHealthLabel()` lato server. */
export const NEWS_SOURCE_HEALTH_LABELS: Record<NewsSourceHealth, string> = {
  SANA: 'Sana',
  DEGRADATA: 'Degradata',
  MORTA: 'Morta',
};

/** Etichette leggibili del trasporto (il valore grezzo non si mostra mai da solo). */
export const NEWS_STRATEGY_LABELS: Record<NewsStrategy, string> = {
  WP_REST: 'WordPress REST',
  RSS2: 'RSS 2.0',
  ATOM: 'Atom',
  SITEMAP_NEWS: 'Sitemap Google News',
  HTML: 'HTML',
};

/**
 * Quali parser ammette ogni trasporto — specchio di `PARSER_KEYS_BY_STRATEGY`.
 *
 * ⚠️ Una lista **vuota** non è un buco da riempire: dichiara che quella
 * strategia **non ha ancora un parser**, e il service risponde 400 a chi prova
 * a salvarla. Il form la mostra come non disponibile invece di offrirla e far
 * scoprire il limite con un errore.
 *
 * ⚠️ Oggi la relazione è **1:1**: il form deriva `parserKey` dalla strategia
 * invece di chiederlo, ma il campo resta obbligatorio nel corpo.
 */
export const NEWS_PARSER_KEYS_BY_STRATEGY: Record<
  NewsStrategy,
  readonly NewsParserKey[]
> = {
  WP_REST: ['WP_REST_GENERICO'],
  RSS2: ['RSS2_GENERICO'],
  SITEMAP_NEWS: ['SITEMAP_NEWS_GENERICO'],
  ATOM: [],
  HTML: [],
};

/**
 * Una riga di `GET /admin/news-sources`: configurazione **e** stato runtime
 * sullo stesso oggetto (array nudo, nessun envelope, ≤20 righe per disegno).
 *
 * ⚠️ Lo stato runtime è **in sola lettura**: nessuno di questi campi esiste nei
 * DTO, e mandarne uno è un 400 sull'intera chiamata (`forbidNonWhitelisted`).
 */
export interface NewsSource {
  id: string;
  name: string;
  slug: string;
  strategy: NewsStrategy;
  parserKey: NewsParserKey;
  endpointUrl: string;
  excludeCategoryIds: number[];
  /**
   * Non chiedere il **corpo** dell'articolo (WP REST: `content`).
   *
   * ⚠️ Serve dove la testata incorpora le immagini in base64 dentro al corpo
   * renderizzato: PokerItaliaWeb risponde **23,6 MB** contro un tetto di 5 e
   * non consegna mai niente, mentre Assopoker sta a 578 KB e Italiapokerclub a
   * 249 KB. Inerte fuori da WP REST.
   */
  escludiContenuto: boolean;
  lingua: NewsSourceLanguage;
  pollMinutes: number;
  /** ⚠️ Assente ⇒ il rilevatore di volume è **inerte** (nessun allarme). */
  baselineItemsPerDay?: number;
  note?: string;
  enabled: boolean;
  healthState: NewsSourceHealth;
  /** Quando lo stato è cambiato: "Morta da 3 giorni" si conta da qui. */
  healthChangedAt?: string;
  /**
   * Ultimo fetch riuscito. ⚠️ **Un 304 tocca questo e nient'altro**: dice che la
   * sorgente *risponde*, non che ha *portato* qualcosa.
   */
  lastSuccessAt?: string;
  /**
   * Ultimo item nuovo davvero ingerito: **è il campo che risponde alla domanda
   * del cruscotto**. Assente su una sorgente che non ha mai prodotto niente — e
   * quello è il caso peggiore, non un caso neutro.
   */
  lastItemAt?: string;
  lastErrorAt?: string;
  /** ⚠️ Va **stampato**, non nascosto dietro un tooltip: i log di Render hanno
   * ritenzione corta e su Atlas Flex non si scaricano — se non è qui, dopo non
   * è da nessuna parte. */
  lastErrorMessage?: string;
  consecutiveFailures: number;
  /** Prima di questo istante la sorgente **non viene interrogata**. */
  backoffUntil?: string;
  /** Da quando è sotto osservazione: di fatto, da quando è accesa. */
  osservataDa?: string;
  /** Mediana degli intervalli fra due item, in minuti. */
  medianGapMinutes?: number;
  /** EMA a 7 giorni degli item/giorno, aggiornata una volta al giorno. */
  emaItemsPerDay?: number;
}

/**
 * Una riga di `GET /admin/news-sources/seed`: le cinque fonti del censimento.
 *
 * ⚠️ **Non semina niente**: serve a *precompilare* il form. Non porta `id` né
 * `enabled` (una sorgente nasce spenta per default dello schema), e gli
 * hostname **non sono stati verificati** contro i siti veri — la conferma è
 * dell'owner, prima di accendere.
 */
export interface NewsSourceSeed {
  name: string;
  slug: string;
  strategy: NewsStrategy;
  parserKey: NewsParserKey;
  endpointUrl: string;
  excludeCategoryIds: number[];
  escludiContenuto?: boolean;
  lingua: NewsSourceLanguage;
  pollMinutes: number;
  baselineItemsPerDay: number;
  /** Ragione della cadenza o trappola nota: **testo da mostrare**. */
  note: string;
}

/**
 * Corpo di `POST /admin/news-sources` — i **soli dieci** campi scrivibili.
 *
 * ⚠️ `enabled` è omesso di proposito dal form: si nasce spenti e si accende dal
 * cruscotto, una fonte per volta, con una conferma.
 */
export interface NewsSourcePayload {
  name: string;
  slug: string;
  strategy: NewsStrategy;
  parserKey: NewsParserKey;
  endpointUrl: string;
  excludeCategoryIds?: number[];
  escludiContenuto?: boolean;
  lingua?: NewsSourceLanguage;
  pollMinutes?: number;
  baselineItemsPerDay?: number;
  note?: string;
  enabled?: boolean;
}

/** Corpo di `PATCH /admin/news-sources/:id`: tutti i campi opzionali. */
export type NewsSourceUpdatePayload = Partial<NewsSourcePayload>;

/**
 * Esito di `DELETE`. ⚠️ I grezzi già ingeriti **non** si cancellano a cascata:
 * scadono sul loro TTL di 45 giorni.
 */
export interface NewsSourceRemoved {
  eliminata: true;
  slug: string;
}

/**
 * `GET /health` (pubblico): l'unico modo dal frontend di sapere che cosa sta
 * davvero leggendo il codice in produzione.
 *
 * ⚠️ `newsIngest` e `newsPipeline` sono **due interruttori diversi**: il primo
 * ferma la **raccolta** (il polling delle fonti), il secondo la **generazione**
 * delle bozze. Con il primo su `off` accendere una fonte non produce nulla.
 */
export interface HealthStatus {
  status: string;
  db: string;
  sentry: string;
  deployHook: string;
  affiliations: string;
  /** `'on' | 'off'` — interruttore `NEWS_INGEST_ENABLED`. */
  newsIngest: string;
  /** `'on' | 'paused'` — modalità assenza della redazione. */
  newsPipeline: string;
  uptime: number;
}

// ───────────────────────────────────────────────────────────────────────────
// Replayer — mani di poker caricate dagli utenti (voce di registro A16)
// ───────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ **Il FORMATO è ciò che va in evidenza, non la sala** (decisione del
 * Titolare del 25/08/2026): all'utente interessa se sta guardando uno Spin & Go,
 * un Twister, un cash o un MTT. Il backend manda `gameTypeLabel` già pronta —
 * non ricalcolarla qui, o le due fonti divergono.
 */
export type HandGameType =
  | 'SPIN'
  | 'TWISTER'
  | 'MTT'
  | 'SNG'
  | 'HUSNG'
  | 'CASH';

export type HandStreetName = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER';

export interface HandPlayerView {
  seat: number;
  /** ⚠️ Nickname di un terzo, o la posizione se la mano è stata anonimizzata. */
  nome: string;
  chipsIniziali: number;
  posizione: string;
  isHero: boolean;
  /** Note solo per l'eroe e per chi ha mostrato allo showdown. */
  carte?: string[];
}

export interface HandActionView {
  seat: number;
  tipo: string;
  /** Quanto questa azione aggiunge al piatto. */
  importo: number;
  /** Totale investito nella strada dopo l'azione: le fiche davanti al posto. */
  totaleStrada: number;
  potDopo: number;
  /** Il tipo prima della promozione ad `ALLIN`. */
  tipoOriginale?: string;
}

export interface HandStreetView {
  strada: HandStreetName;
  board: string[];
  azioni: HandActionView[];
  /**
   * Il piatto **a inizio strada**, ante comprese.
   *
   * ⚠️ **Arriva dal server e non si ricalcola qui.** L'aritmetica del piatto è
   * dominio — la usano il replayer per animare la raccolta, la libreria per
   * stampare il piatto di ogni strada, e i netti ne dipendono — e con due copie
   * basta correggerne una perché due pagine del sito dichiarino due piatti
   * diversi per la stessa mano. La sede unica è `contiDiStrada` in
   * `backend/src/hands/hands.types.ts`.
   */
  pot: number;
  /** Quanto le puntate di questa strada aggiungono al piatto (ante escluse). */
  raccolto: number;
  /** L'eccedenza non chiamata che torna a chi l'ha messa. */
  restituzione: { seat: number; importo: number } | null;
}

export interface HandResultView {
  seat: number;
  vinto: number;
  mostrate?: string[];
}

/**
 * Una mano come la manda il backend.
 *
 * ⚠️ **Gli importi sono INTERI in unità minime**, e `decimali` dice quante cifre
 * valgono: `0` per le fiche di un torneo, `2` per il denaro (`180` = 1,80 €).
 * Non è un dettaglio di serializzazione — è il modo in cui un `number` in
 * virgola mobile non tocca mai l'aritmetica del piatto. Dividere per 100 solo
 * al momento di **stampare**, mai prima.
 */
export interface HandView {
  publicId: string;
  room: string;
  roomLabel: string;
  network: string;
  gameType: HandGameType;
  /** ⚠️ La stringa da mostrare per prima: «Spin & Go», «Twister», «Cash game»… */
  gameTypeLabel: string;
  playedAt: string | null;
  tableSize: number;
  tableMax: number;
  decimali: number;
  currency: string | null;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  players: HandPlayerView[];
  heroSeat: number | null;
  streets: HandStreetView[];
  board: string[];
  potFinale: number;
  rake: number;
  risultati: HandResultView[];
  /**
   * Quanto ciascuno ha guadagnato o perso. ⚠️ **Non deducibile da `risultati`**,
   * che i parser costruiscono filtrando `vinto > 0` e che quindi contiene i soli
   * **vincitori**: chi perde non compare affatto.
   */
  netti: { seat: number; netto: number }[];
  /**
   * Il **punto finale dell'eroe**, calcolato all'importazione dalle sue due
   * carte più il board completo.
   *
   * ⚠️ `null` significa «non calcolabile» — le carte dell'eroe non sono note,
   * oppure la mano è finita prima che ci fossero cinque carte comuni — **non**
   * «punto scarso». La cella resta vuota, e vuota è la risposta giusta.
   */
  punto: { categoria: string; rango: number; etichetta: string } | null;
  /** L'equity dell'eroe al momento dell'all-in, fra 0 e 1. */
  equityEroe: number | null;
  /** Le fiche che si attendeva, date quell'equity e quel piatto. */
  chipsAttese: number | null;
  /**
   * Fiche vinte meno fiche attese: **positivo = ha corso bene**, come in
   * Hand2Note. ⚠️ `null` quando non c'è un all-in da valutare, e `null` è
   * diverso da `0`, che significa «è andata esattamente come doveva».
   */
  evDiff: number | null;
  /** ⚠️ Va **mostrato**: su un all-in preflop l'equity è campionata, non esatta. */
  evStima: boolean;
  anonimizzata: boolean;
  likes: number;
  dislikes: number;
  createdAt: string;
  /**
   * L'anteprima social generata dal backend. ⚠️ Non la usa l'app Angular — la
   * pagina condivisa la compone la Pages Function, ed è lei a leggere questo
   * campo. Sta nel modello perché è quello che l'API risponde, e perché è ciò
   * che `check-hands-live.mjs` confronta con l'HTML servito.
   */
  ogImageUrl: string;
}

/** Una mano nella libreria personale: porta anche ciò che solo il proprietario vede. */
export interface HandMineView extends HandView {
  id: string;
  inVetrina: boolean;
  uploadId: string;
}

export interface HandQuota {
  /** `-1` = nessun tetto (amministratore). */
  tetto: number;
  usate: number;
  residue: number;
}

/**
 * L'esito dell'anteprima: che cosa **succederebbe**, senza che nulla sia stato
 * scritto. ⚠️ È metà della funzione, non un'ottimizzazione — la frase «ne
 * importo 43 e ne lascio fuori 144» deve poter essere letta **prima**.
 */
export interface HandUploadPreview {
  esito:
    | 'OK'
    | 'VUOTO'
    | 'TROPPO_GRANDE'
    | 'TROPPE_MANI'
    | 'FORMATO_NON_SUPPORTATO'
    | 'ILLEGGIBILE';
  messaggio: string;
  maniTrovate: number;
  maniNuove: number;
  maniDuplicate: number;
  maniScartate: number;
  motiviScarto: string[];
  quota: HandQuota;
  /** Quante ne entrerebbero davvero: `min(nuove, residue)`. */
  importabili: number;
  room?: string;
  roomLabel?: string;
  gameType?: HandGameType;
  /** Il formato riconosciuto ma non supportato («888poker», «GGPoker»…). */
  indizio?: string;
}

/**
 * L'ordine della vetrina.
 *
 * ⚠️ Chiuso, e i valori sono **gli stessi stringhe che il DTO del server
 * dichiara**: col `forbidNonWhitelisted` globale un valore non previsto non
 * viene ignorato, fa fallire l'intera chiamata con 400.
 */
export type HandVetrinaOrdine = 'recenti' | 'apprezzate';

/** L'esito di un'importazione, mostrato a schermo finché non si ricomincia. */
export interface EsitoImport {
  ids: string[];
  inVetrina: boolean;
}

export interface HandImportResult extends HandUploadPreview {
  uploadId: string;
  publicIds: string[];
}

export interface HandMineList {
  items: HandMineView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  quota: HandQuota;
}

export type HandReportReason =
  | 'DATI_PERSONALI'
  | 'CONTENUTO_ILLECITO'
  | 'NON_MIA'
  | 'FORMATO'
  | 'ALTRO';

// ───────────────────────────────────────────────────────────────────────────
// Conteggi mensili (voce di registro A18)
// ───────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Ogni importo di questa sezione è in CENTESIMI INTERI e ogni percentuale in
 * PUNTI BASE (5700 = 57,00%): gli euro esistono solo sul bordo, dove li digita
 * e li legge una persona (`features/admin/denaro.ts`). La conversione vive in
 * un punto per lato — con due punti che devono concordare su un fattore 100 si
 * registrano 125.050 € al posto di 1.250,50 €.
 *
 * ⚠️ I tipi qui sono RICALCATI a mano da `backend/src/conteggi/conteggi.types.ts`:
 * i due repo non condividono nulla, quindi se là cambia una forma va cambiata
 * anche qui.
 */
export type MeseContabileStato = 'APERTO' | 'CHIUSO';
export type VersoVoce = 'ENTRATA' | 'USCITA';
export type CategoriaUscita =
  | 'COACH'
  | 'INFRASTRUTTURA'
  | 'MARKETING'
  | 'COMMISSIONI'
  | 'ALTRO';
export type CategoriaEntrata =
  | 'COMMISSIONI_AGENTE'
  | 'CONTENUTI'
  | 'COACHING'
  | 'STAKING'
  | 'ALTRO';
export type CategoriaVoce = CategoriaUscita | CategoriaEntrata;
export type MetodoMovimento =
  | 'BONIFICO'
  | 'PAYPAL'
  | 'SKRILL'
  | 'CONTANTI'
  | 'TICKET'
  | 'ALTRO';
export type AgenteRakeback = 'LOTTOMATICA';
/** ⚠️ `PERSONALE` resta FUORI dalla divisione col socio. */
export type DestinazioneMargine = 'SCUOLA' | 'PERSONALE';

export interface MeseContabile {
  id: string;
  anno: number;
  mese: number;
  /** «settembre 2026», calcolata dal server: una sola definizione di etichetta. */
  etichetta: string;
  stato: MeseContabileStato;
  quotaTitolareBp: number;
  chiusoAt?: string;
  chiusoDaAdminEmail?: string;
  nota?: string;
  /** Se il riepilogo arriva dallo snapshot congelato o dal calcolo dal vivo. */
  riepilogoCongelato: boolean;
}

export interface VoceMese {
  id: string;
  verso: VersoVoce;
  categoria: CategoriaVoce;
  descrizione: string;
  controparte?: string;
  importoCent: number;
  metodo?: MetodoMovimento;
  /**
   * Da quale portafoglio è uscita (o in quale è entrata).
   *
   * ⚠️ Non è `controparte`: quella dice a CHI sono andati i soldi (LiveKit,
   * GTOwizard), questa da DOVE sono usciti. Assente = non ancora attribuita, ed
   * è visibile nel Riepilogo invece di essere indovinata.
   */
  cassa?: Cassa;
  pagataAt?: string;
  /** Presente ⇒ generata da una spesa ricorrente. */
  ricorrenteId?: string;
  createdAt?: string;
}

export interface SpesaRicorrente {
  id: string;
  descrizione: string;
  categoria: CategoriaUscita;
  controparte?: string;
  /** Chi la paga di solito: si copia sulla voce che genera. */
  cassaPredefinita?: Cassa;
  importoCentPredefinito: number;
  attiva: boolean;
  nota?: string;
}

export interface ContoRakeback {
  id: string;
  /** Vedi `Stakato.utente`: risolto in lettura, mai denormalizzato. */
  utente?: UtenteCollegato;
  agente: AgenteRakeback;
  username: string;
  nomeReale?: string;
  userId: string | null;
  backAgenteBp: number;
  backPlayerBp: number;
  scaglioneBaseBp: number;
  scaglionePassoCent: number;
  destinazione: DestinazioneMargine;
  /**
   * ⚠️ Cambia l'ARITMETICA del margine, non è un'etichetta: per uno stakato il
   * ticket al giocatore non si paga — si regola nel conteggio del pool —
   * quindi il margine del mese è l'intero incasso dall'agente.
   */
  stakato: boolean;
  /**
   * I ticket li paga l'AGENTE per conto suo: alla scuola arriva solo il
   * margine, al giocatore non si deve niente. Mai insieme a `stakato`.
   */
  ticketDallAgente?: boolean;
  attivo: boolean;
  ordine: number;
  nota?: string;
  anonimizzato: boolean;
}

/**
 * Una riga della tabella rakeback: gli ingressi PIÙ il calcolo.
 *
 * ⚠️ I sei campi calcolati arrivano dal SERVER e il client non li ricalcola
 * mai: l'aritmetica del rakeback (divisione intera con correzione dell'ulp,
 * scaglioni da 22,50 €) vive in un punto solo. Due copie direbbero due margini
 * per lo stesso mese.
 */
export interface RigaRakeback {
  /** ⚠️ La riga di uno stakato ha un margine diverso e nessun «resta da dare». */
  stakato: boolean;
  /** Il ticket lo paga l'agente: niente «pagato», da incassare il solo margine. */
  ticketDallAgente?: boolean;
  id: string;
  contoId: string;
  username: string;
  nomeReale?: string;
  backAgenteBp: number;
  backPlayerBp: number;
  scaglioneBaseBp: number;
  scaglionePassoCent: number;
  destinazione: DestinazioneMargine;
  ordine: number;
  rakeGeneratoCent: number;
  pagatoAlPlayerCent: number;
  metodoPagamento?: MetodoMovimento;
  nota?: string;
  scaglioni: number;
  erogatoBonusCent: number;
  spettanteDaAgenteCent: number;
  spettanteAlPlayerCent: number;
  profittoAgenteCent: number;
  nettoCassaCent: number;
  residuoAlPlayerCent: number;
}

export interface TotaliRakeback {
  rakeGeneratoCent: number;
  erogatoBonusCent: number;
  spettanteDaAgenteCent: number;
  spettanteAlPlayerCent: number;
  profittoAgenteCent: number;
  pagatoAlPlayerCent: number;
  nettoCassaCent: number;
}

/**
 * Dove sono materialmente finiti gli euro degli abbonamenti.
 *
 * ⚠️ `nonAttribuitoCent` sono contanti di cui non si sa chi li ha presi: si
 * mostra SOLO se > 0. Farli cadere fra gli «online» direbbe che dei contanti
 * sono arrivati su PayPal — una riga sbagliata invece di una riga che chiede di
 * essere sistemata.
 *
 * ⚠️ I quattro campi SOMMANO `abbonamentiCent`: righe rientrate che non tornano
 * col totale sopra si leggono come un buco.
 */
/**
 * I tre portafogli da cui il denaro esce e in cui entra.
 *
 * ⚠️ Ricalcata a mano da `CASSE` in `backend/src/conteggi/conteggi.types.ts`:
 * i due repo non condividono una riga di codice. ⚠️ E NON è un alias di
 * `Incassante`, benché oggi coincidano su due valori su tre — quello dice chi
 * ha materialmente preso i contanti di un abbonamento, questo da quale
 * portafoglio si muove il denaro. Il giorno in cui si apre un secondo conto
 * online cresce solo questa.
 */
export const CASSE = ['PIETRO', 'EXIVEZZZ', 'COMUNE'] as const;
export type Cassa = (typeof CASSE)[number];

/**
 * Le spese del mese ripartite per portafoglio.
 *
 * ⚠️ Le quattro voci SOMMANO `speseCent`: righe rientrate che non tornano col
 * numero sopra si leggono come un buco.
 */
export interface UscitePerCassa {
  pietroCent: number;
  exivezzzCent: number;
  comuneCent: number;
  /** Le righe su cui nessuno ha ancora detto da dove sono uscite. */
  nonAttribuitoCent: number;
}

/**
 * Dove gioca uno stakato che non ha un conto presso il nostro agente.
 *
 * ⚠️ Ricalcata a mano da `SKIN` in `backend/src/conteggi/conteggi.types.ts`: i
 * due repo non condividono una riga. Elenco CHIUSO e non testo libero — nel
 * progetto ci sono già tre elenchi di piattaforme, e il quarto non deve essere
 * quello che ammette «ipoker» e «iPoker» come due cose.
 */
export const SKIN = [
  'LOTTOMATICA',
  'GOLDBET',
  'SISAL',
  'SNAI',
  'PLANETWIN',
  'ADMIRALBET',
  'BETPASSION',
  'POKERSTARS',
  'ALTRA',
] as const;
export type Skin = (typeof SKIN)[number];

/**
 * Da dove arriva la back di uno stakato.
 *
 * ⚠️ Le due strade NON sono intercambiabili: chi ha un conto presso il nostro
 * agente lascia alla scuola la parte di back non accreditata in ticket, e
 * quella si sottrae dal conteggio; chi gioca altrove se l'è già presa sul
 * proprio conto gioco e non c'è niente da trattenere.
 */
export const FONTI_BACK = ['CONTO', 'MANUALE'] as const;
export type FonteBack = (typeof FONTI_BACK)[number];

/** L'anagrafica di un giocatore finanziato. */
/**
 * L'account del sito collegato a un'anagrafica dei conteggi.
 *
 * ⚠️ Il server lo RISOLVE a ogni lettura e non lo denormalizza: un'anagrafica
 * vive mesi e l'indirizzo può cambiarle sotto.
 */
/**
 * Il prospetto del proprio conteggio, come lo vede il giocatore.
 *
 * ⚠️⚠️ Ciascuno vede SOLO i propri numeri: qui non arrivano né altri
 * giocatori, né i totali della scuola, né la ripartizione fra i soci — in
 * particolare non esiste `spettanteDaAgenteCent` né alcun margine. È la prima
 * delle cinque misure di `gdpr/valutazione-prospetto-e-punti.md`, e il caso 25
 * di `verify-conteggi.mjs` la prova per SOTTRAZIONE.
 */
export interface ProspettoRakeback {
  username: string;
  backPlayerBp: number;
  scaglioneBaseBp: number;
  scaglionePassoCent: number;
  rakeGeneratoCent: number;
  erogatoBonusCent: number;
  spettanteAlPlayerCent: number;
  pagatoAlPlayerCent: number;
  residuoAlPlayerCent: number;
  /** Il ticket glielo accredita direttamente l'agente: pagato e residuo valgono 0. */
  ticketDallAgente?: boolean;
}

export interface ProspettoStakato {
  nome: string;
  dealScuolaBp: number;
  backCent: number;
  trattenutoCent: number;
  poolEvCent: number;
  diffCent: number;
  feeCent: number;
  altroCent: number;
  totaleCent: number;
  quotaScuolaCent: number;
  risultatoCent: number;
  aRecuperoCent: number;
  daRegolareCent: number;
}

export interface ProspettoMese {
  meseId: string;
  anno: number;
  mese: number;
  etichetta: string;
  /** Il mese è ancora aperto: i numeri possono cambiare, e si DICE. */
  provvisorio: boolean;
  rakeback?: ProspettoRakeback;
  stakato?: ProspettoStakato;
}

/** Una riga dell'anteprima dei punti sul rakeback. */
export interface RigaPunti {
  contoId: string;
  username: string;
  utente?: UtenteCollegato;
  margineCent: number;
  punti: number;
  giaAccreditati?: number;
  /** Accreditati, ma la cifra di oggi non corrisponde più. */
  disallineato: boolean;
  /** Perché questa riga NON prende punti. La riga resta, spenta. */
  motivoEsclusione?: string;
}

export interface AnteprimaPunti {
  righe: RigaPunti[];
  totalePunti: number;
  daAccreditare: number;
  /** Il mese è ancora aperto: il margine può cambiare dopo l'accredito. */
  provvisorio: boolean;
}

export interface UtenteCollegato {
  id: string;
  nickname?: string;
  email: string;
}

export interface Stakato {
  id: string;
  nome: string;
  userId: string | null;
  /** Assente se non collegato — il caso normale per molti giocatori censiti. */
  utente?: UtenteCollegato;
  /** La quota della scuola sul risultato del mese, in punti base. */
  dealScuolaBp: number;
  fonteBack: FonteBack;
  contoId: string | null;
  skin?: Skin;
  backBp?: number;
  attivo: boolean;
  ordine: number;
  nota?: string;
  anonimizzato: boolean;
}

export interface StakatoPayload {
  nome: string;
  userId?: string;
  dealScuolaBp: number;
  fonteBack: FonteBack;
  contoId?: string;
  skin?: Skin;
  backBp?: number;
  attivo?: boolean;
  ordine?: number;
  nota?: string;
}

/** Una riga del conteggio mensile: ingressi PIÙ calcolo, tutto dal server. */
export interface RigaStakato {
  id: string;
  stakatoId: string;
  nome: string;
  fonteBack: FonteBack;
  skin?: Skin;
  dealScuolaBp: number;
  rakeLordoCent?: number;
  backBp?: number;
  /** Il rake letto davvero dalla scheda Rakeback del mese (righe «dal conto»). */
  rakeLettoCent?: number;
  /** Il conto non ha una riga di rakeback in questo mese: la back vale 0. */
  contoFuoriMese?: boolean;
  /** La riga dice «dal conto» ma non è collegata ad alcun conto. */
  contoNonCollegato?: boolean;
  /** L'username del conto da cui si è letta la back. */
  contoUsername?: string;
  /** La back maturata: letta dal conto rakeback, o calcolata dal rake. */
  backCent: number;
  /** Quanto la scuola trattiene perché non accreditato in ticket. */
  trattenutoCent: number;
  poolEvCent: number;
  diffCent: number;
  feeCent: number;
  altroCent: number;
  /** Il debito EV a oggi, dal registro staking. Sempre ≤ 0. */
  debitoEvCent: number;
  totaleCent: number;
  quotaScuolaCent: number;
  risultatoCent: number;
  /**
   * Quanto passa dal registro EV, col segno del REGISTRO: positivo riduce un
   * debito (un recupero pagato da lui, o una compensazione in cui è la scuola
   * a scalare ciò che gli deve), negativo è un mese in perdita che ne crea uno
   * nuovo (make-up pieno: l'intera perdita).
   */
  aRecuperoCent: number;
  /**
   * La cassa: positiva = il giocatore bonifica; ⚠️ NEGATIVA = è la scuola a
   * rimborsarlo (bonifico da Pietro). Zero in un mese in perdita.
   */
  daRegolareCent: number;
  registrato: boolean;
  /** Registrato, ma con un importo che non corrisponde più al ricalcolo. */
  disallineato: boolean;
  nota?: string;
}

export interface RigaStakatoPayload {
  id: string;
  rakeLordoCent?: number;
  poolEvCent: number;
  diffCent: number;
  feeCent: number;
  altroCent: number;
  nota?: string;
}

export interface AbbonamentiPerDestinazione {
  pietroCent: number;
  exivezzzCent: number;
  /** `paypalCent + skrillCent`: il Riepilogo la mostra come una riga sola. */
  onlineCent: number;
  /** PayPal è il conto di Pietro, Skrill quello di Exivezzz (dal 11/09/2026). */
  paypalCent: number;
  skrillCent: number;
  nonAttribuitoCent: number;
}

/** La quota di un socio in un mese: maturato e denaro passato per la sua tasca. */
export interface QuotaSocio {
  maturatoCent: number;
  cassaCent: number;
}

/** Il conguaglio fra soci, la parte congelata nel mese. */
export interface SociMese {
  pietro: QuotaSocio;
  exivezzz: QuotaSocio;
  incassiNonAttribuitiCent: number;
  speseNonAttribuiteCent: number;
}

export const ESTREMI_VERSAMENTO = [
  'PIETRO',
  'EXIVEZZZ',
  'COMUNE',
  'ESTERNO',
] as const;
export type EstremoVersamento = (typeof ESTREMI_VERSAMENTO)[number];

export interface VersamentoView {
  id: string;
  data: string;
  da: EstremoVersamento;
  a: EstremoVersamento;
  importoCent: number;
  nota?: string;
}

export interface VersamentoPayload {
  data: string;
  da: EstremoVersamento;
  a: EstremoVersamento;
  importoCent: number;
  nota?: string;
}

export interface SaldoSocio {
  maturatoCent: number;
  cassaCent: number;
  ricevutiCent: number;
  datiCent: number;
  /** Positivo = la scuola gli deve; negativo = ha in mano più di quanto gli spetti. */
  saldoCent: number;
}

/** Il conguaglio fra soci, dal vivo. Solo i mesi CHIUSI entrano nel saldo. */
export interface SaldiSoci {
  mesiChiusi: number;
  pietro: SaldoSocio;
  exivezzz: SaldoSocio;
  /** `saldoPietro + saldoExivezzz`: il denaro non ancora in tasca a nessuno dei due. */
  creditoNonRiscossoCent: number;
  incassiNonAttribuitiCent: number;
  speseNonAttribuiteCent: number;
  provvisorio?: { etichetta: string; soci: SociMese };
  versamenti: VersamentoView[];
}

/** Un abbonamento del mese, dal punto di vista della CASSA. */
export interface RigaAbbonamento {
  id: string;
  userEmail: string;
  userNickname?: string;
  tier: string;
  metodo: PaymentMethod;
  /** Chi ha materialmente preso i contanti. Assente su tutto il resto. */
  incassatoDa?: Incassante;
  /**
   * ⚠️ Vale 0 sulle righe che non sono cassa: a distinguerle è `portaCassa`,
   * non l'importo. «Zero incassato» e «non è cassa» sono due cose diverse, e la
   * tabella le mostra diverse — zero contro trattino.
   */
  importoCent: number;
  portaCassa: boolean;
  /** Il prezzo è ricostruito dal listino storico, non snapshottato. */
  stimato: boolean;
  paymentReference?: string;
  decidedAt?: string;
}

export interface RiepilogoMese {
  entrate: {
    abbonamentiCent: number;
    /**
     * ⚠️ Su un mese chiuso PRIMA del 10/09/2026 lo snapshot non ha questo
     * campo: il server lo riempie a zeri in lettura (`snapshotCompleto`).
     */
    abbonamentiPerDestinazione: AbbonamentiPerDestinazione;
    gadgetCent: number;
    commissioniRakebackCent: number;
    /**
     * Quello che rientra dai giocatori finanziati: una voce scritta a mano,
     * con la sua riga nel conto economico.
     *
     * ⚠️ Su un mese chiuso PRIMA del 10/09/2026 lo snapshot congelato non ha
     * questo campo. Il server lo riempie a 0 in lettura (`snapshotCompleto`),
     * ma `eur()` fa comunque `?? 0`: qui la difesa è doppia di proposito,
     * perché i due repo non condividono una riga e questo tipo è ricalcato a
     * mano.
     */
    stakingCent: number;
    /**
     * La parte di `stakingCent` che viene dai CONTEGGI dei giocatori
     * finanziati, invece che da una voce scritta a mano. Le due si sommano e il
     * Riepilogo le mostra separate: una cifra inserita due volte si deve
     * VEDERE, invece di sparire dentro un totale che torna comunque.
     *
     * ⚠️ Su un mese chiuso prima di questo lotto lo snapshot non ce l'ha: il
     * server lo riempie a 0 in lettura.
     */
    stakingDaConteggiCent: number;
    /** ⚠️ Le entrate a mano che NON sono staking: le due sono complementari. */
    altreCent: number;
    totaleCent: number;
  };
  uscite: {
    speseCent: number;
    /**
     * ⚠️ Su un mese chiuso PRIMA di questo lotto lo snapshot non ha il campo:
     * il server lo riempie in lettura mettendo TUTTO in `nonAttribuitoCent`
     * (`snapshotCompleto`), perché quelle spese sono uscite da un portafoglio
     * vero che nessuno aveva dichiarato — zero sarebbe stato un buco, «comune»
     * una bugia.
     */
    perCassa: UscitePerCassa;
    totaleCent: number;
  };
  /**
   * Il conguaglio coi giocatori, col segno: `dovuto − pagato`.
   * Positivo = pagato meno del dovuto (resta alla scuola), negativo = pagato
   * di più. Entra nel margine, NON fra le entrate: ha segno, e le righe delle
   * entrate devono continuare a sommare `entrate.totaleCent`.
   */
  conguaglioGiocatoriCent: number;
  margineNettoCent: number;
  ripartizione: {
    titolareCent: number;
    socioCent: number;
    quotaTitolareBp: number;
  };
  /** ⚠️ Fuori dalla divisione: i conti marcati PERSONALE. */
  marginePersonaleCent: number;
  /** Il conguaglio fra soci, la parte congelata. Derivato sugli snapshot vecchi. */
  soci: SociMese;
  /** ⚠️ Partite di giro, NON conto economico. */
  cassaGiocatori: {
    attesoDaAgenteCent: number;
    pagatoAiGiocatoriCent: number;
    residuoDovutoCent: number;
    /** Righe che devono ancora ricevere qualcosa e senza alcun pagamento. */
    righeSenzaPagamento: number;
    senzaPagamentoCent: number;
  };
  /** Quante righe di abbonamento sono ricostruite dal listino invece che dallo snapshot. */
  abbonamentiStimati: number;
}

/**
 * Il mese intero in una risposta sola: niente paginazione, di proposito — un
 * conto economico letto a metà è un totale sbagliato.
 */
export interface DettaglioMese {
  mese: MeseContabile;
  voci: VoceMese[];
  righe: RigaRakeback[];
  /**
   * ⚠️ Si legge sempre DAL VIVO, anche su un mese chiuso, mentre
   * `riepilogo.entrate.abbonamentiCent` è congelato. Possono divergere: una
   * richiesta viene CANCELLATA alla chiusura dell'account, quindi se un iscritto
   * chiude dopo la chiusura del mese la riga sparisce e il totale no. La
   * schermata lo dice.
   */
  abbonamenti: RigaAbbonamento[];
  totaliRakeback: TotaliRakeback;
  /** Il conteggio dei giocatori finanziati, letto sempre dal vivo. */
  stakati: RigaStakato[];
  riepilogo: RiepilogoMese;
  /** ⚠️ Un tetto raggiunto si DICE, mai si tronca in silenzio. */
  troncato: boolean;
}

export interface VocePayload {
  verso: VersoVoce;
  categoria: CategoriaVoce;
  descrizione: string;
  controparte?: string;
  importoCent: number;
  metodo?: MetodoMovimento;
  cassa?: Cassa;
  pagataAt?: string;
}

export interface SpesaRicorrentePayload {
  descrizione: string;
  categoria: CategoriaUscita;
  controparte?: string;
  cassaPredefinita?: Cassa;
  importoCentPredefinito: number;
  attiva?: boolean;
  nota?: string;
}

export interface ContoRakebackPayload {
  agente: AgenteRakeback;
  stakato?: boolean;
  ticketDallAgente?: boolean;
  username: string;
  nomeReale?: string;
  userId?: string;
  backAgenteBp: number;
  backPlayerBp: number;
  scaglioneBaseBp?: number;
  scaglionePassoCent?: number;
  destinazione?: DestinazioneMargine;
  attivo?: boolean;
  ordine?: number;
  nota?: string;
}

export interface RigaRakebackPayload {
  contoId: string;
  rakeGeneratoCent: number;
  pagatoAlPlayerCent?: number;
  metodoPagamento?: MetodoMovimento;
  nota?: string;
}
