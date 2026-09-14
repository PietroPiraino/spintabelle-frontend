import {
  MyAffiliation,
  MyVoucher,
  ShopOrderStatus,
} from '../../core/models/api.models';

// ── Le schede ─────────────────────────────────────────────────────────────────

/**
 * Le quattro schede di /account. ⚠️ `conteggi` compare SOLO a chi ha un
 * prospetto (quasi nessuno): una scheda vuota sulla pagina di tutti sarebbe
 * rumore per il 99% e non direbbe niente all'1%.
 */
export const VISTE_ACCOUNT = [
  'panoramica',
  'acquisti',
  'conteggi',
  'profilo',
] as const;
export type VistaAccount = (typeof VISTE_ACCOUNT)[number];

/**
 * `?vista=` arriva dall'URL come stringa qualunque: si controlla, non si
 * casta (idioma di `/admin/statistiche`). `?vista=tutto` è una stringa come
 * le altre e cade sulla Panoramica.
 */
export function isVistaAccount(v: unknown): v is VistaAccount {
  return (
    typeof v === 'string' && (VISTE_ACCOUNT as readonly string[]).includes(v)
  );
}

export const ETICHETTE_VISTE: Record<VistaAccount, string> = {
  panoramica: 'Panoramica',
  acquisti: 'Acquisti e punti',
  conteggi: 'Conteggi',
  profilo: 'Profilo e sicurezza',
};

// ── Lo stato di un blocco asincrono ──────────────────────────────────────────

/**
 * Ogni blocco che aspetta una risposta ha QUATTRO stati, e «vuoto» esiste
 * solo dopo una risposta: fino al 14/09/2026 buoni, ordini e punti nascevano
 * `[]` e con l'API in carico — o giù — la pagina dichiarava «Non hai ancora
 * buoni sconto», che è una bugia esattamente come «non risulti tracciato».
 * In carico si mostra uno scheletro con l'altezza dichiarata; in errore una
 * banda con «Riprova» che rifà LA SOLA chiamata.
 */
export type Carico<T> =
  | { stato: 'carico' }
  | { stato: 'ok'; dati: T }
  | { stato: 'errore'; messaggio: string };

export const CARICO: Carico<never> = { stato: 'carico' };

export function ok<T>(dati: T): Carico<T> {
  return { stato: 'ok', dati };
}

export function errore<T>(messaggio: string): Carico<T> {
  return { stato: 'errore', messaggio };
}

// ── Le pillole di stato (`.pill-stato`, vocabolario delle pagine pubbliche) ──

/** I toni della pillola pubblica: felt · oro · rame · danger · muto. */
export type TonoPillola = 'ok' | 'wait' | 'todo' | 'ko' | 'off';

/**
 * ⚠️ `switch` ESAUSTIVI con `never` nel default: fino al 14/09/2026 la classe
 * del chip si interpolava dallo stato (`'account__chip--' + v.status`), quindi
 * uno stato nuovo produceva in silenzio una classe che nessun foglio dichiara
 * — una pillola senza colore. Qui TypeScript non lascia aggiungere uno stato
 * senza deciderne la resa.
 */
export function tonoBuono(status: MyVoucher['status']): TonoPillola {
  switch (status) {
    case 'available':
      return 'ok';
    case 'reserved':
      return 'wait';
    case 'redeemed':
    case 'expired':
    case 'inactive':
      return 'off';
    default: {
      const _mai: never = status;
      return _mai;
    }
  }
}

export function etichettaBuono(status: MyVoucher['status']): string {
  switch (status) {
    case 'available':
      return 'Disponibile';
    case 'reserved':
      return 'In attesa di approvazione';
    case 'redeemed':
      return 'Usato';
    case 'expired':
      return 'Scaduto';
    case 'inactive':
      return 'Disattivato';
    default: {
      const _mai: never = status;
      return _mai;
    }
  }
}

export function tonoOrdine(status: ShopOrderStatus): TonoPillola {
  switch (status) {
    case 'COMPLETED':
    case 'CONSEGNATO':
      return 'ok';
    case 'RICEVUTO':
    case 'SPEDITO':
      return 'wait';
    case 'ANNULLATO':
      return 'off';
    default: {
      const _mai: never = status;
      return _mai;
    }
  }
}

/**
 * I tre GRUPPI delle affiliazioni: «Dove sei tracciato», «In corso», «Da
 * riprendere». ⚠️ Il terzo mancava fino al 14/09/2026: rifiutate, revocate e
 * annullate non cadevano in nessun gruppo, e la pagina stampava «Non risulti
 * tracciato su nessuna sala» a chi aveva appena ricevuto l'email di rifiuto —
 * col motivo rimasto nella sola email. Ogni stato terminale ha una via di
 * ritorno: qui si vede.
 */
export type GruppoAffiliazione = 'tracciate' | 'inCorso' | 'daRiprendere';

export function gruppoAffiliazione(
  status: MyAffiliation['status'],
): GruppoAffiliazione {
  switch (status) {
    case 'APPROVATO':
      return 'tracciate';
    case 'RICHIESTO':
    case 'IN_VERIFICA':
      return 'inCorso';
    case 'RIFIUTATO':
    case 'REVOCATO':
    case 'ANNULLATO':
      return 'daRiprendere';
    default: {
      const _mai: never = status;
      return _mai;
    }
  }
}

/** Gli stessi toni che /affiliazioni dà agli stessi stati. */
export function tonoAffiliazione(status: MyAffiliation['status']): TonoPillola {
  switch (status) {
    case 'APPROVATO':
      return 'ok';
    case 'IN_VERIFICA':
      return 'wait';
    case 'RICHIESTO':
      return 'todo';
    case 'RIFIUTATO':
    case 'REVOCATO':
      return 'ko';
    case 'ANNULLATO':
      return 'off';
    default: {
      const _mai: never = status;
      return _mai;
    }
  }
}

// ── Scadenza dell'abbonamento ────────────────────────────────────────────────

const GIORNO_MS = 86_400_000;

/** Sotto questa soglia la scadenza si annuncia e il rinnovo diventa la CTA. */
export const SCADENZA_VICINA_GIORNI = 7;

/**
 * Giorni interi che mancano alla scadenza (negativi = passata). ⚠️ Fra la
 * scadenza e il cron delle 3:00 il ruolo è ancora il tier: la pagina lo dice
 * invece di stampare «valido fino a ieri».
 */
export function giorniResidui(iso: string | null | undefined, ora: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - ora.getTime()) / GIORNO_MS);
}
