import { Role } from './api.models';

/**
 * La scala dei ruoli lato client: SPECCHIO di
 * `backend/src/common/auth/roles.enum.ts`, mai una seconda verità.
 *
 * ⚠️ Il server resta l'autorità su ogni gate: qui il rango serve solo a non
 * mostrare un comando che il server rifiuterebbe (l'upsell «Abbonati» a chi ha
 * già accesso, una card del Negozio che sarebbe un downgrade). Un controllo che
 * esiste SOLO qui non è un controllo.
 *
 * ⚠️ Prima di questo file i ranghi erano scritti a mano in due punti — le
 * computed di `AuthService` e una tabella privata in `shop.component.ts` — con
 * valori diversi (0-based là, 1-based qui) e nessuno che li tenesse allineati.
 * Aggiungere un ruolo ne aggiornava uno solo, e il difetto era muto.
 */
const ROLE_RANK: Record<Role, number> = {
  USER: 1,
  PESCE_ROSSO: 2,
  SQUALO: 3,
  // Accesso pieno ai contenuti come uno Squalo. Il rango CONDIVISO è
  // deliberato: non sono un gradino in più della scala, sono lo stesso gradino
  // raggiunto per un'altra via (staking, o essere del personale).
  STAKATO: 3,
  COACH: 3,
  ADMIN: 4,
};

/**
 * I soli ruoli utilizzabili come SOGLIA, esattamente come lato server.
 * ⚠️ `roleSatisfies(x, 'COACH')` non compila: a rango pari sarebbe vero per
 * ogni Squalo, quindi una condizione «solo i coach» scritta col rango sarebbe
 * vera per tutti gli abbonati high, in silenzio.
 */
export type ContentLevel = 'USER' | 'PESCE_ROSSO' | 'SQUALO' | 'ADMIN';

/** True se `role` arriva almeno al livello richiesto. */
export function roleSatisfies(
  role: Role | undefined | null,
  required: ContentLevel,
): boolean {
  const rank = role ? ROLE_RANK[role] : 0;
  return (rank ?? 0) >= ROLE_RANK[required];
}

/**
 * L'ordine in cui i ruoli si mostrano nei menu e nei filtri del pannello: dal
 * meno al più privilegiato, con i due accessi «non comprati» prima di Admin.
 *
 * ⚠️ Non si deriva da `ROLE_RANK` perché tre ruoli condividono il rango 3 e
 * l'ordine risulterebbe indeterminato.
 */
export const ROLE_ORDER = [
  'USER',
  'PESCE_ROSSO',
  'SQUALO',
  'STAKATO',
  'COACH',
  'ADMIN',
] as const satisfies readonly Role[];

type RuoliFuoriElenco = Exclude<Role, (typeof ROLE_ORDER)[number]>;
/**
 * ⚠️ Guardia di completezza, ed è l'unica cosa che rende `ROLE_ORDER` sicura.
 * Un elenco di ruoli scritto a mano è tipizzato `Role[]` anche quando ne
 * dimentica uno: compila, il build è verde, e la tendina del pannello Iscritti
 * mostra quattro voci su sei — cioè il ruolo nuovo non è assegnabile da nessuna
 * parte, senza un solo errore. Questa riga NON compila se un ruolo manca, e
 * l'errore lo nomina.
 */
const _tuttiIRuoliSonoInElenco: [RuoliFuoriElenco] extends [never]
  ? true
  : RuoliFuoriElenco = true;
void _tuttiIRuoliSonoInElenco;

/**
 * I ruoli con un abbonamento A TEMPO — i soli che hanno una scadenza e che il
 * job notturno del server può declassare. Stakato e Coach non ne fanno parte:
 * il loro accesso non scade.
 */
export const RUOLI_CON_SCADENZA = ['PESCE_ROSSO', 'SQUALO'] as const;
export type RuoloConScadenza = (typeof RUOLI_CON_SCADENZA)[number];
export const haScadenza = (role: Role | undefined | null): boolean =>
  !!role && (RUOLI_CON_SCADENZA as readonly string[]).includes(role);
