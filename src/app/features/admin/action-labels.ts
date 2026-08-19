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
  // Redazione — le decisioni sulla coda. ⚠️ Il backend le SCRIVE già (Fase 0 è
  // live): senza queste righe il tab Log, lo storico per-iscritto e la
  // Panoramica stampano lo slug grezzo ("approve-news") su ogni decisione
  // presa finora.
  'approve-news': 'Articolo pubblicato',
  'reject-news': 'Articolo scartato',
  'postpone-news': 'Articolo riportato in bozza',
  'snooze-news': 'Articolo rimandato',
  'retract-news': 'Articolo ritirato',
  'rectify-news': 'Rettifica pubblicata',
  'create-news': 'Articolo creato',
  'update-news': 'Articolo modificato',
  'delete-news': 'Articolo eliminato',
  // Redazione — modalità assenza (§3.5). ⚠️ Sono due azioni e non una con un
  // flag: nel log si legge a colpo d'occhio quando la generazione si è fermata
  // e quando è ripartita, che è l'unica domanda che si fa a quel registro.
  'news-pause': 'Generazione news in pausa',
  'news-resume': 'Generazione news riattivata',
  // Sorgenti dell'ingest (Fase 2): dichiarate nella union AdminAction ma non
  // ancora scritte da nessun call-site — l'etichetta c'è perché il giorno in cui
  // lo saranno il log non debba mostrare uno slug.
  'create-news-source': 'Fonte news aggiunta',
  'update-news-source': 'Fonte news modificata',
  'delete-news-source': 'Fonte news rimossa',
};

/** Etichetta leggibile o, per un'azione non ancora mappata, lo slug grezzo. */
export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}
