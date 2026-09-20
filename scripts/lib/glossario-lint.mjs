// Lint delle voci del glossario (/glossario). Libreria PURA: nessun accesso al
// filesystem, cosi' `glossario-lint.test.mjs` la prova su fixture e
// `check-glossario.mjs` la applica ai dati veri (o a un lotto in scratchpad).
//
// Perche' esiste: le voci sono testo PUBBLICO e indicizzabile scritto a decine
// per volta, e i tre modi in cui possono andare male sono tutti muti a occhio
// — una voce troppo corta (la guardia del build la boccerebbe dopo, a deploy
// pronto), un `correlati` verso uno slug che non esiste (link rotto con 404
// vero, `PrerenderFallback.None`), e una parola che l'art. 9 DL 87/2018 vieta
// in un contenuto pubblico. Lo script di validazione delle guide del
// 16/08/2026 faceva la stessa cosa e non e' sopravvissuto alla sua sessione:
// questo e' committato.
//
// ⚠️ Le liste art. 9 arrivano da `src/app/core/art9.constants.ts` (copia del
// backend, con test di deriva): qui non se ne scrive nessuna.

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TITOLO_MAX = 60;
const DEFINIZIONE_MAX = 160;
const PAROLE_MIN = 120;
const PAROLE_OBIETTIVO = 180;
const CORRELATI_MIN = 2;
const CORRELATI_MAX = 4;

/** Prefissi interni ammessi negli href di `guida`/`strumento`. */
export const HREF_AMMESSI = [
  '/guide/',
  '/tabelle',
  '/allenamento',
  '/simulatore-varianza',
  '/replayer',
  '/docs',
  '/lezioni',
  '/live',
  '/glossario/',
];

/** Caratteri di seme: `semi-nudi.test.mjs` li vieta gia' nei sorgenti, qui si spiega perche'. */
const SEMI_RE = /[\u2660\u2661\u2662\u2663\u2664\u2665\u2666\u2667]/;

export function contaParole(testo) {
  return String(testo ?? '')
    .split(/\s+/)
    .filter((p) => p.length > 0).length;
}

/**
 * Le parole che contano per la lunghezza di una voce: definizione,
 * spiegazione ed esempio. Titolo, varianti e i testi dei link non sono prosa.
 */
export function paroleDiVoce(v) {
  return contaParole(
    [v.definizione, ...(v.spiegazione ?? []), v.esempio ?? ''].join(' '),
  );
}

/**
 * Tutto il testo pubblico di una voce. E' la COPIA di `testiDiVoce()` di
 * `glossario.data.ts`: il test di questa libreria le confronta su una voce
 * campione, cosi' un campo aggiunto di la' entra anche di qua.
 */
export function testiDiVoce(v) {
  return [
    v.termine,
    ...(v.varianti ?? []),
    v.titolo,
    v.definizione,
    ...(v.spiegazione ?? []),
    ...(v.esempio ? [v.esempio] : []),
    ...(v.guida ? [v.guida.testo] : []),
    ...(v.strumento ? [v.strumento.testo] : []),
  ];
}

function hrefAmmesso(href) {
  if (typeof href !== 'string' || !href.startsWith('/')) return false;
  if (href.endsWith('/') && href !== '/') return false; // senza slash finale: idioma dei routerLink
  return HREF_AMMESSI.some(
    (p) => href === p || href === p.replace(/\/$/, '') || href.startsWith(p),
  );
}

/**
 * Lint di un elenco di voci.
 *
 * @param voci     le voci (o un lotto in scratchpad)
 * @param opzioni  { slugGuide: string[]           — gli slug delle guide (per `guida.href`)
 *                   art9: { liste: [{nome, termini}], terminiPresenti } — da art9.constants.ts
 *                   tutteLeVoci?: Voce[]            — quando `voci` e' un lotto, l'insieme
 *                                                    completo contro cui risolvere `correlati` }
 * @returns {Array<{slug: string, campo: string, motivo: string}>}
 */
export function lintVoci(voci, opzioni) {
  const rilievi = [];
  const segnala = (slug, campo, motivo) => rilievi.push({ slug, campo, motivo });
  const slugGuide = new Set(opzioni?.slugGuide ?? []);
  const insieme = opzioni?.tutteLeVoci ?? voci;
  const slugNoti = new Set(insieme.map((v) => v.slug));
  const visti = new Map();

  for (const v of voci) {
    const s = v.slug ?? '(senza slug)';
    if (!SLUG_RE.test(String(v.slug ?? ''))) {
      segnala(s, 'slug', 'deve essere kebab-case (minuscole, cifre e trattini)');
    }
    if (visti.has(v.slug)) segnala(s, 'slug', 'duplicato');
    visti.set(v.slug, true);

    if (!v.termine?.trim()) segnala(s, 'termine', 'vuoto');
    if (!v.query?.trim()) {
      segnala(s, 'query', 'manca la query misurata: ogni voce nasce da una domanda reale');
    }
    if (!v.titolo?.trim()) segnala(s, 'titolo', 'vuoto');
    else if (v.titolo.length > TITOLO_MAX) {
      segnala(s, 'titolo', `${v.titolo.length} caratteri, massimo ${TITOLO_MAX} (Google lo taglia)`);
    }
    if (/best fish forever/i.test(v.titolo ?? '')) {
      segnala(s, 'titolo', 'senza il suffisso del marchio: lo aggiunge SeoService');
    }

    const def = v.definizione ?? '';
    if (!def.trim()) segnala(s, 'definizione', 'vuota');
    else {
      if (def.length > DEFINIZIONE_MAX) {
        segnala(s, 'definizione', `${def.length} caratteri, massimo ${DEFINIZIONE_MAX} (e' la meta description)`);
      }
      if (!/[.!?]$/.test(def.trim())) segnala(s, 'definizione', 'deve chiudere con un punto');
    }

    const nParagrafi = (v.spiegazione ?? []).length;
    if (nParagrafi < 2 || nParagrafi > 4) {
      segnala(s, 'spiegazione', `${nParagrafi} paragrafi, ne servono da 2 a 4`);
    }
    const parole = paroleDiVoce(v);
    if (parole < PAROLE_MIN) {
      segnala(s, 'parole', `${parole} parole, minimo ${PAROLE_MIN} (obiettivo ${PAROLE_OBIETTIVO})`);
    }

    const correlati = v.correlati ?? [];
    if (correlati.length < CORRELATI_MIN || correlati.length > CORRELATI_MAX) {
      segnala(s, 'correlati', `${correlati.length} voci, ne servono da ${CORRELATI_MIN} a ${CORRELATI_MAX}`);
    }
    for (const c of correlati) {
      if (c === v.slug) segnala(s, 'correlati', 'rimanda a se stessa');
      else if (!slugNoti.has(c)) segnala(s, 'correlati', `«${c}» non esiste`);
    }
    if (new Set(correlati).size !== correlati.length) segnala(s, 'correlati', 'contiene doppioni');

    if (v.guida) {
      if (!hrefAmmesso(v.guida.href)) segnala(s, 'guida.href', `«${v.guida.href}» non e' un link interno ammesso`);
      else if (v.guida.href.startsWith('/guide/')) {
        const slug = v.guida.href.slice('/guide/'.length);
        if (slugGuide.size && !slugGuide.has(slug)) segnala(s, 'guida.href', `la guida «${slug}» non esiste`);
      }
      if (!v.guida.testo?.trim()) segnala(s, 'guida.testo', 'vuoto');
    }
    if (v.strumento) {
      if (!hrefAmmesso(v.strumento.href)) {
        segnala(s, 'strumento.href', `«${v.strumento.href}» non e' un link interno ammesso`);
      }
      if (!v.strumento.testo?.trim()) segnala(s, 'strumento.testo', 'vuoto');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v.aggiornata ?? ''))) {
      segnala(s, 'aggiornata', 'serve una data ISO YYYY-MM-DD');
    }

    // Testo pubblico: art. 9, entita' HTML, Markdown, semi.
    const testi = testiDiVoce(v);
    for (const testo of testi) {
      if (/&(amp|lt|gt|quot|#\d+);/.test(testo)) {
        segnala(s, 'testo', `contiene un'entita' HTML («${testo.match(/&(amp|lt|gt|quot|#\d+);/)[0]}»): con l'interpolazione Angular esce cosi' com'e'`);
      }
      if (/<[a-z][^>]*>/i.test(testo)) segnala(s, 'testo', 'contiene un tag HTML');
      if (/(^|\s)[#*_`]{1,3}\S|\]\(/.test(testo)) segnala(s, 'testo', 'contiene Markdown');
      if (SEMI_RE.test(testo)) segnala(s, 'testo', 'contiene un carattere di seme: si scrive «picche», «cuori»');
      if (/https?:\/\//i.test(testo)) segnala(s, 'testo', 'contiene un URL assoluto');
    }
    if (opzioni?.art9) {
      const { liste, terminiPresenti } = opzioni.art9;
      for (const { nome, termini } of liste) {
        for (const testo of testi) {
          const trovati = terminiPresenti(testo, termini);
          for (const t of trovati) segnala(s, 'art9', `${nome}: «${t}»`);
        }
      }
    }
  }
  return rilievi;
}

/**
 * Lint dei rimandi guida → glossario (`Guide.termini`): ogni slug deve
 * esistere e il `termine` deve essere quello della voce (un'etichetta che
 * invecchia e' il difetto che `guide-links.test.mjs` pinna sui titoli).
 */
export function lintTermini(guide, voci) {
  const rilievi = [];
  const perSlug = new Map(voci.map((v) => [v.slug, v]));
  for (const g of guide) {
    for (const t of g.termini ?? []) {
      const v = perSlug.get(t.slug);
      if (!v) rilievi.push({ slug: g.slug, campo: 'termini', motivo: `«${t.slug}» non esiste nel glossario` });
      else if (v.termine !== t.termine) {
        rilievi.push({ slug: g.slug, campo: 'termini', motivo: `«${t.termine}» non e' il termine della voce («${v.termine}»)` });
      }
    }
  }
  return rilievi;
}

/** Riga di riepilogo per il CLI: slug · query · parole · lunghezze. */
export function riepilogoVoce(v) {
  return {
    slug: v.slug,
    query: v.query,
    parole: paroleDiVoce(v),
    def: (v.definizione ?? '').length,
    titolo: (v.titolo ?? '').length,
  };
}
