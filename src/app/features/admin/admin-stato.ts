/**
 * I toni della pastiglia di stato del pannello — l'unica fonte di verità del
 * vocabolario, sul modello di `news.types.ts` e `affiliations.types.ts`.
 *
 * ⚠️ Sono i toni del PERCORSO: dove si trova una riga fra il primo e l'ultimo
 * passo. News, affiliazioni e negozio sono la stessa macchina a stati vista da
 * tre porte diverse, e prima ne disegnavano il risultato con tre classi
 * distinte (`an-chip`, `aff-chip`, `shop-chip`) la cui dichiarazione base era
 * identica, copiata tre volte.
 *
 * ⚠️ NON sono i toni di `/admin/fonti`. Là la domanda è «funziona?» e non «a
 * che punto è?», e le due risposte userebbero le stesse parole (`ok`, `attesa`,
 * `allarme`) per colori diversi: una parola che vale due colori a seconda della
 * sezione è peggio di due vocabolari separati. Quelli si chiamano
 * `sana`/`degradata`/`morta` e vivono nel foglio di quella sezione, appoggiati
 * sulla stessa base `.admin-stato`.
 *
 * ⚠️ E un tono NON è un colore: è un significato. Chi aggiunge uno stato
 * risponde a «bene, in attesa, male o spento?», non sceglie una tinta — che è
 * la ragione per cui questo è un attributo e non sedici classi modificatrici.
 */
export type TonoStato =
  /** Non ancora in gioco: una bozza, una richiesta mai completata. */
  | 'spento'
  /** Chiuso dal tempo e non da una persona: muto, ma distinto dalla bozza. */
  | 'neutro'
  /** Aspetta qualcuno: l'unico tono che indica una coda da smaltire. */
  | 'attesa'
  /** Vivo, online, approvato. */
  | 'ok'
  /** Finito bene ma non più attivo: consegnato, completato. */
  | 'concluso'
  /** Deciso in negativo: scartato, rifiutato, revocato, annullato. */
  | 'allarme'
  /**
   * ⚠️ Non è uno stato in più: è la sua ASSENZA — una riga storica che una
   * migrazione non ha toccato. Si disegna col bordo tratteggiato, perché col
   * chrome degli altri sembrerebbe uno stato legittimo della macchina e la riga
   * parrebbe decidibile quando non lo è.
   */
  | 'ignoto';
