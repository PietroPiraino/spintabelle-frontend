/**
 * Le FONTI di un articolo, come il lettore le vede in fondo alla pagina.
 *
 * PERCHÉ ESISTE. La policy editoriale e la pagina `/redazione` promettono che
 * un articolo derivato da fonti esterne ne pubblica l'elenco in fondo, con il
 * collegamento. I dati c'erano da sempre (`sourceUrls`/`sourceOutlets` sono
 * nella proiezione pubblica), ma fino al 17/10/2026 nessuna delle due rese li
 * stampava: gli articoli della redazione automatica sono usciti per otto
 * settimane senza la fonte citata in pagina.
 *
 * ⚠️ DUE COPIE, e questa è la canonica: la resa all'edge ne tiene una in
 * `functions/lib/fonti.mjs` (la Function non può importare il sorgente
 * Angular — stessa scelta di `guide-links`), e `scripts/lib/news-fonti.test.mjs`
 * fa girare ENTRAMBE sugli stessi casi pretendendo lo stesso risultato. Due
 * rese che stampano fonti diverse per lo stesso articolo cambierebbero il
 * blocco all'idratazione.
 *
 * ⚠️ NESSUN IMPORT in questo file: il test Node lo importa così com'è.
 */

/** Una riga del blocco: dove porta e che cosa c'è scritto. */
export interface VoceFonte {
  url: string;
  etichetta: string;
}

/**
 * Le voci, nell'ordine in cui la pipeline le ha scritte.
 *
 * - Le due liste sono **parallele** (le scrive così `fontiDelleSchede` nel
 *   backend): la testata si appaia all'indirizzo per posizione.
 * - Solo indirizzi `http(s)`: un valore scritto a mano nel form che non lo è
 *   non diventa un collegamento.
 * - Un indirizzo ripetuto compare una volta.
 * - Senza testata — o con la testata uguale all'indirizzo, che è il ripiego
 *   della pipeline — si mostra il nome dell'host, senza `www.`.
 * - ⚠️ Una testata con PIÙ articoli li numera («Somuchpoker (1)»,
 *   «Somuchpoker (2)»): due collegamenti con la stessa scritta sembrerebbero
 *   un doppione, e invece sono due fonti diverse.
 */
export function fontiDiArticolo(urls: unknown, testate: unknown): VoceFonte[] {
  const lista = Array.isArray(urls) ? urls : [];
  const nomi = Array.isArray(testate) ? testate : [];
  const grezze: VoceFonte[] = [];
  const visti = new Set<string>();
  lista.forEach((valore, i) => {
    const url = typeof valore === 'string' ? valore.trim() : '';
    if (!/^https?:\/\//i.test(url) || visti.has(url)) return;
    visti.add(url);
    const scritto = typeof nomi[i] === 'string' ? (nomi[i] as string).trim() : '';
    const nome = scritto && !/^https?:\/\//i.test(scritto) ? scritto : nomeHost(url);
    grezze.push({ url, etichetta: nome });
  });

  const totali = new Map<string, number>();
  for (const v of grezze) {
    const k = v.etichetta.toLowerCase();
    totali.set(k, (totali.get(k) ?? 0) + 1);
  }
  const contati = new Map<string, number>();
  return grezze.map((v) => {
    const k = v.etichetta.toLowerCase();
    if ((totali.get(k) ?? 0) < 2) return v;
    const n = (contati.get(k) ?? 0) + 1;
    contati.set(k, n);
    return { url: v.url, etichetta: `${v.etichetta} (${n})` };
  });
}

function nomeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
}
