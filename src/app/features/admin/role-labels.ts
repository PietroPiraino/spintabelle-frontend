import { Role } from '../../core/models/api.models';

/**
 * Etichette italiane dei ruoli/tier, per le viste admin.
 *
 * Mappa UNICA per i TRE punti che le stampano (iscritti, statistiche,
 * panoramica) — stesso idioma di `action-labels.ts`: un rebranding di tier
 * fatto in una sola copia lascerebbe l'etichetta vecchia nelle altre viste.
 * ⚠️ Non confondere con `VISIBILITY_LABELS` in admin-stats: lì `USER` è
 * "Gratis" (visibilità di una lezione), qui è "Iscritto" (ruolo).
 */
export const ROLE_LABELS: Record<Role, string> = {
  USER: 'Iscritto',
  PESCE_ROSSO: 'Pesce Rosso',
  SQUALO: 'Squalo',
  // ⚠️ «Stakato» e non «Finanziato»: è il termine che i giocatori italiani
  // usano davvero, ed è coerente con la sezione che si chiama già «Stakings».
  // Regge come etichetta di un badge; nella PROSA si scrive «in staking», che
  // non chiede l'accordo di genere che un template non può fare.
  STAKATO: 'Stakato',
  // ⚠️ «Coach» e non «Allenatore»/«Istruttore»: è la parola che il prodotto
  // usa già ovunque — il token della sala conia `role: 'coach'`, il messaggio
  // d'errore dice «Solo il coach può gestire la stanza», i comandi si chiamano
  // «Controlli sessione del coach». Un secondo nome qui farebbe chiamare la
  // stessa persona in due modi fra il pannello e la sala.
  COACH: 'Coach',
  ADMIN: 'Admin',
};

/** Etichetta leggibile o, per un ruolo non mappato, il valore grezzo. */
export function roleLabel(role: Role): string {
  return ROLE_LABELS[role] ?? role;
}
