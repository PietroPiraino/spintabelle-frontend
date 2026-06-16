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
export type PaymentMethod = 'paypal' | 'skrill';
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

/** Payload di richiesta abbonamento (dopo il pagamento off-site). */
export interface CreateSubscriptionRequest {
  tier: SubscriptionTier;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
}

// ----- Sessioni live -----

export interface LiveSession {
  id: string;
  title: string;
  description?: string;
  stakes: LessonStakes;
  /** data/ora di inizio (ISO) */
  startsAt: string;
  durationMin?: number;
  platform?: string;
  /** true se il tier corrente non sblocca il link di accesso */
  locked: boolean;
  joinUrl?: string;
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
  joinUrl: string;
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
