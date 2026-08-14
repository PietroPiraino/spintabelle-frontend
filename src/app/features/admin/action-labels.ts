/**
 * Etichette italiane delle azioni del log admin (`AdminActionLog.action`).
 *
 * Mappa UNICA per i TRE punti che stampano le stesse azioni: il log globale
 * (admin-audit), lo storico del singolo iscritto (admin-users) e la striscia
 * "Ultime azioni" della Panoramica (admin-overview). Prima viveva copiata in
 * due componenti e aggiornarne una sola lasciava lo slug grezzo visibile
 * nell'altra — un'azione nuova va aggiunta QUI e in nessun altro posto.
 */
export const ACTION_LABELS: Record<string, string> = {
  'set-expiry': 'Scadenza modificata',
  'grant-subscription': 'Abbonamento concesso',
  'set-role': 'Ruolo modificato',
  'edit-profile': 'Dati modificati',
  'grant-discount-eligibility': 'Codice sconto assegnato',
  'revoke-discount-eligibility': 'Codice sconto revocato',
  'create-discount': 'Codice sconto creato',
  'update-discount': 'Codice sconto modificato',
  'delete-discount': 'Codice sconto eliminato',
  'create-gadget': 'Gadget creato',
  'update-gadget': 'Gadget modificato',
  'delete-gadget': 'Gadget eliminato',
  'fulfill-order': 'Ordine evaso',
  'cancel-order': 'Ordine annullato',
  'approve-affiliation': 'Affiliazione approvata',
  'reject-affiliation': 'Affiliazione rifiutata',
  'revoke-affiliation': 'Affiliazione revocata',
  'note-affiliation': 'Nota interna affiliazione',
  'resend-affiliation': 'Email affiliazione reinviata',
  'create-poker-room': 'Sala creata',
  'update-poker-room': 'Sala modificata',
  'delete-poker-room': 'Sala eliminata',
};

/** Etichetta leggibile o, per un'azione non ancora mappata, lo slug grezzo. */
export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}
