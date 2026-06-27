/**
 * Ruoli in scala: ADMIN ≥ SQUALO ≥ PESCE_ROSSO ≥ USER.
 * I due tier a pagamento (Pesce Rosso = low stakes, Squalo = tutto) gateano i
 * contenuti tramite il rango, come lato backend (roles.enum.ts).
 */
export type Role = 'USER' | 'PESCE_ROSSO' | 'SQUALO' | 'ADMIN';

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
export type SubscriptionTier = 'PESCE_ROSSO' | 'SQUALO';
/** 'manuale' = concessione admin (mai selezionabile dall'utente). */
export type PaymentMethod = 'paypal' | 'skrill' | 'manuale';
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
  /** codice sconto applicato (snapshot, legacy singolo) */
  discountCode?: string;
  /** codici sconto cumulati applicati (snapshot) */
  discountCodes?: string[];
  /** prezzo di listino e scontato (snapshot in euro) */
  listPriceEur?: number;
  discountedPriceEur?: number;
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
  discountedPriceEur: number;
  message: string;
}

// ----- Codici sconto -----

export type DiscountKind = 'PERCENT' | 'FIXED';
export type DiscountAudience = 'RESTRICTED' | 'PUBLIC';

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

export interface News {
  _id: string;
  title: string;
  body: string;
  coverImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewsPayload {
  title: string;
  body: string;
  coverImageUrl?: string;
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
  pricePoints: number;
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
  pricePoints: number;
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
