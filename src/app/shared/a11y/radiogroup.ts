/**
 * Frecce dentro un `role="radiogroup"` (roving tabindex).
 *
 * ⚠️ ESISTE PERCHÉ IL RUOLO PROMETTE: uno screen reader su `role="radiogroup"`
 * annuncia «1 di 3» e si aspetta che le frecce spostino la scelta. Dichiarare
 * il ruolo e non implementarlo è peggio che non dichiararlo — costruisce
 * un'aspettativa e poi non la mantiene.
 *
 * ⚠️ Sta in `shared/` e non copiata in ogni componente perché i consumatori
 * sono già due il giorno in cui nasce (le sezioni stakes di /lezioni e il
 * gioco base di /allenamento), e il progetto ha già pagato quattro volte il
 * prezzo di un primitivo arrivato dopo le copie — è la storia di `.page-hero`.
 *
 * Il chiamante passa quanti sono e quale è attivo; questa funzione decide il
 * prossimo, lo comunica con `scegli` e ci porta il fuoco. Il `[role="radio"]`
 * si cerca dentro `event.currentTarget`, cioè il contenitore su cui il
 * `(keydown)` è dichiarato: se il gruppo non porta quel ruolo sui figli, il
 * fuoco semplicemente non si sposta — non lancia.
 */
export function frecceRadiogroup(
  event: KeyboardEvent,
  totale: number,
  corrente: number,
  scegli: (indice: number) => void,
): void {
  const avanti = event.key === 'ArrowRight' || event.key === 'ArrowDown';
  const indietro = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
  if (!avanti && !indietro) return;
  if (totale < 2) return;
  event.preventDefault();
  const i = corrente < 0 ? 0 : corrente;
  const j = (i + (avanti ? 1 : totale - 1)) % totale;
  scegli(j);
  const bottoni = (
    event.currentTarget as HTMLElement
  ).querySelectorAll<HTMLElement>('[role="radio"]');
  bottoni[j]?.focus();
}
