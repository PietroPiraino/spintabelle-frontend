/**
 * Tipi dei 3 Max Hyper Awards (backend `src/awards/`, voce di registro A20).
 *
 * ⚠️ Copia a mano dei tipi del backend: due repo che non condividono codice.
 * Le tuple chiuse (categorie, fasi) devono restare allineate a
 * `backend/src/awards/awards.types.ts`.
 */

export const AWARDS_CATEGORIE = [
  'sng-assoluto',
  'sng-mid',
  'sng-low',
  'sng-grinder',
  'twister-assoluto',
  'twister-mid',
  'twister-low',
  'twister-grinder',
  'fish',
] as const;
export type AwardsCategoria = (typeof AWARDS_CATEGORIE)[number];

export type AwardsFase =
  | 'PRIMA'
  | 'PROPOSTE'
  | 'CONTATTI'
  | 'ATTESA_VOTO'
  | 'VOTO'
  | 'ATTESA_RISULTATI'
  | 'RISULTATI';

export type AwardsFormato = 'spin' | 'twister' | 'comunita';

export interface FinalistaPubblico {
  id: string;
  nickname: string;
}

export interface CategoriaPubblica {
  categoria: AwardsCategoria;
  etichetta: string;
  descrizione: string;
  formato: AwardsFormato;
  /** `null` finché la rosa finale non è pubblicata. */
  finalisti: FinalistaPubblico[] | null;
  /** `null` finché i risultati non sono pubblicati. */
  vincitori: FinalistaPubblico[] | null;
}

/** Le date dell'edizione, come istanti ISO. */
export interface DateAwards {
  proposteDal: string;
  proposteAl: string;
  contattiAl: string;
  votoDal: string;
  votoAl: string;
  cerimoniaAt: string;
}

/** `GET /awards/edizione` — pubblica, risponde sempre 200. */
export type EdizioneAwards =
  | {
      disponibile: true;
      anno: number;
      fase: AwardsFase;
      raccoltaAttiva: boolean;
      date: DateAwards;
      categorie: CategoriaPubblica[];
    }
  | { disponibile: false; motivo: string };

export type StatoCandidatura = 'INVITATO' | 'ACCETTATA' | 'RIFIUTATA' | 'RITIRATA';

export interface PropostaAwards {
  categoria: AwardsCategoria;
  nickname: string;
}

/** `GET /awards/me`. */
export interface AwardsMio {
  proposte: PropostaAwards[];
  voti: { categoria: AwardsCategoria; candidatoId: string }[];
  candidature: {
    id: string;
    nickname: string;
    categorie: {
      categoria: AwardsCategoria;
      stato: StatoCandidatura;
      finalista: boolean;
      vincitore: boolean;
    }[];
  }[];
}

// ── Invito (lato della persona contattata) ─────────────────────────────────

/** `POST /awards/invito/anteprima`. */
export interface AnteprimaInvito {
  nickname: string;
  categorie: { categoria: AwardsCategoria; etichetta: string; descrizione: string }[];
  giaAccettate: AwardsCategoria[];
  consenso: { versione: string; testo: string };
  scadeAt: string;
}

// ── Pannello ────────────────────────────────────────────────────────────────

export interface EdizioneAwardsAdmin extends DateAwards {
  anno: number;
  fase: AwardsFase;
  finalistiPubblicatiAt: string | null;
  risultatiPubblicatiAt: string | null;
}

export interface VoceSpoglio {
  nickname: string;
  nicknameKey: string;
  proposte: number;
  candidato: { id: string; stato: StatoCandidatura | null } | null;
}

export interface CategoriaSpoglio {
  categoria: AwardsCategoria;
  etichetta: string;
  totale: number;
  voci: VoceSpoglio[];
}

export type StatoInvito = 'VALIDO' | 'USATO' | 'SCADUTO' | 'ASSENTE';

export interface CandidatoAdmin {
  id: string;
  nickname: string;
  categorie: {
    categoria: AwardsCategoria;
    etichetta: string;
    stato: StatoCandidatura;
    finalista: boolean;
    vincitore: boolean;
  }[];
  invito: { stato: StatoInvito; scadeAt: string | null };
  account: { nickname: string; email: string } | null;
  consenso: { versione: string; at: string } | null;
}

/** Creazione e rinnovo: il link arriva UNA volta sola. */
export interface CandidatoConLink {
  candidato: CandidatoAdmin;
  link: string;
}
