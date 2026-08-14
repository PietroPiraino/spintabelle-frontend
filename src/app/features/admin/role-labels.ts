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
  ADMIN: 'Admin',
};

/** Etichetta leggibile o, per un ruolo non mappato, il valore grezzo. */
export function roleLabel(role: Role): string {
  return ROLE_LABELS[role] ?? role;
}
