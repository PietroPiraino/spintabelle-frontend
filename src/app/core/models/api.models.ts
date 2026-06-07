export type Role = 'USER' | 'SUBSCRIBER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  /** assente per gli account creati prima dell'introduzione del nickname */
  nickname?: string;
  role: Role;
  verified: boolean;
}

export interface AuthResponse {
  accessToken: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  nickname: string;
}

export type LessonVisibility = 'USER' | 'SUBSCRIBER';

export interface Lesson {
  id: string;
  title: string;
  description: string;
  tags: string[];
  visibility: LessonVisibility;
  /** true se il ruolo corrente non sblocca il video (vimeoEmbedUrl assente) */
  locked: boolean;
  vimeoEmbedUrl?: string;
  createdAt?: string;
}

export interface LessonPayload {
  title: string;
  description: string;
  vimeoEmbedUrl: string;
  tags: string[];
  visibility: LessonVisibility;
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
