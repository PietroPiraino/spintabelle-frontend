// Le FONTI di un articolo, per la resa all'edge.
//
// ⚠️ COPIA di `src/app/features/news/fonti.ts`, che è la canonica: la Function
// non può importare il sorgente Angular (due build diverse — stessa scelta di
// `guide-links.mjs` e `markdown.mjs`). `scripts/lib/news-fonti.test.mjs` fa
// girare le due copie sugli stessi casi e pretende lo stesso risultato: chi
// cambia una regola qui la cambia anche là, o la prova diventa rossa.
//
// Le ragioni di ogni regola sono scritte nella copia canonica.

export function fontiDiArticolo(urls, testate) {
  const lista = Array.isArray(urls) ? urls : [];
  const nomi = Array.isArray(testate) ? testate : [];
  const grezze = [];
  const visti = new Set();
  lista.forEach((valore, i) => {
    const url = typeof valore === 'string' ? valore.trim() : '';
    if (!/^https?:\/\//i.test(url) || visti.has(url)) return;
    visti.add(url);
    const scritto = typeof nomi[i] === 'string' ? nomi[i].trim() : '';
    const nome = scritto && !/^https?:\/\//i.test(scritto) ? scritto : nomeHost(url);
    grezze.push({ url, etichetta: nome });
  });

  const totali = new Map();
  for (const v of grezze) {
    const k = v.etichetta.toLowerCase();
    totali.set(k, (totali.get(k) ?? 0) + 1);
  }
  const contati = new Map();
  return grezze.map((v) => {
    const k = v.etichetta.toLowerCase();
    if ((totali.get(k) ?? 0) < 2) return v;
    const n = (contati.get(k) ?? 0) + 1;
    contati.set(k, n);
    return { url: v.url, etichetta: `${v.etichetta} (${n})` };
  });
}

function nomeHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
}
