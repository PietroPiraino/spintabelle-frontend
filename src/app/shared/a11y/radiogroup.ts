/**
 * Frecce dentro un gruppo a scelta esclusiva (roving tabindex).
 *
 * ⚠️ ESISTE PERCHÉ IL RUOLO PROMETTE: uno screen reader su `role="radiogroup"`
 * annuncia «1 di 3» e si aspetta che le frecce spostino la scelta. Dichiarare
 * il ruolo e non implementarlo è peggio che non dichiararlo — costruisce
 * un'aspettativa e poi non la mantiene. Vale identico per `role="tablist"`.
 *
 * ⚠️ Sta in `shared/` e non copiata in ogni componente perché i consumatori
 * sono già due il giorno in cui nasce (le sezioni stakes di /lezioni e il
 * gioco base di /allenamento), e il progetto ha già pagato quattro volte il
 * prezzo di un primitivo arrivato dopo le copie — è la storia di `.page-hero`.
 *
 * Il chiamante passa quanti sono e quale è attivo; questa funzione decide il
 * prossimo, lo comunica con `scegli` e ci porta il fuoco. Il figlio si cerca
 * dentro `event.currentTarget`, cioè il contenitore su cui il `(keydown)` è
 * dichiarato: se il gruppo non porta quel ruolo sui figli, il fuoco
 * semplicemente non si sposta — non lancia.
 */
function frecce(
  event: KeyboardEvent,
  totale: number,
  corrente: number,
  scegli: (indice: number) => void,
  selettore: string,
): void {
  const avanti = event.key === 'ArrowRight' || event.key === 'ArrowDown';
  const indietro = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
  // `Home`/`End` sono standard su una tablist e innocui su un radiogroup:
  // stanno nel nucleo condiviso invece che in uno solo dei due.
  const primo = event.key === 'Home';
  const ultimo = event.key === 'End';
  if (!avanti && !indietro && !primo && !ultimo) return;
  if (totale < 1) return;
  if (totale < 2 && !primo && !ultimo) return;
  event.preventDefault();
  const i = corrente < 0 ? 0 : corrente;
  const j = primo
    ? 0
    : ultimo
      ? totale - 1
      : (i + (avanti ? 1 : totale - 1)) % totale;
  scegli(j);
  const bottoni = (
    event.currentTarget as HTMLElement
  ).querySelectorAll<HTMLElement>(selettore);
  bottoni[j]?.focus();
}

/** Frecce dentro un `role="radiogroup"`: i figli portano `role="radio"`. */
export function frecceRadiogroup(
  event: KeyboardEvent,
  totale: number,
  corrente: number,
  scegli: (indice: number) => void,
): void {
  frecce(event, totale, corrente, scegli, '[role="radio"]');
}

/**
 * Frecce dentro un `role="tablist"`: i figli portano `role="tab"`.
 *
 * ⚠️ DUE NOMI e non un solo `frecce(…, selettore)` esportato: un
 * `frecceRadiogroup` invocato su una tablist sarebbe una riga che mente al
 * lettore, e il selettore passato dal chiamante è precisamente il dettaglio
 * che nessun chiamante deve poter sbagliare. L'implementazione resta una.
 */
export function frecceTablist(
  event: KeyboardEvent,
  totale: number,
  corrente: number,
  scegli: (indice: number) => void,
): void {
  frecce(event, totale, corrente, scegli, '[role="tab"]');
}
