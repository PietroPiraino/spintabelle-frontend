/**
 * La metà "mani" della guardia, e gira contro la **PRODUZIONE**.
 *
 * ⚠️ **Deliberatamente FUORI da `npm run build`**, come `check-news-live.mjs`:
 * sonda il sito vero, non `dist/`, quindi in catena farebbe dipendere ogni
 * deploy dallo stato del deploy precedente e farebbe fallire un build per un
 * singhiozzo dell'API. Si lancia **a mano dopo ogni deploy** che tocchi le
 * pagine delle mani.
 *
 * ⚠️ **PERCHÉ ESISTE.** `functions/` sta **fuori da `dist/`**: nessuna guardia
 * di build può vedere l'HTML che l'edge compone. `check-routes.mjs` confronta le
 * liste, `check-prerender-content.mjs` apre gli artefatti — e queste risposte
 * artefatti non lo sono. Un push che spedisce la metà Angular e dimentica quella
 * di bordo compila verde, si deploya verde e serve la pagina vecchia: è successo
 * il 19/08/2026 sulle news.
 *
 * ⚠️ **IL CONTROLLO PIÙ IMPORTANTE È IL `noindex`.** È la misura da cui dipende
 * la difendibilità del trattamento dei nickname di terzi (decisione D2, voce di
 * registro A16): senza, un nome diventa *cercabile* invece che raggiungibile da
 * chi ha il collegamento. E cade in silenzio — basta che qualcuno «uniformi» il
 * renderer delle mani a quello delle news, che il `noindex` lo toglie.
 *
 * Uso:
 *   node scripts/check-hands-live.mjs                    # cerca una mano in vetrina
 *   node scripts/check-hands-live.mjs <publicId>         # su una mano precisa
 *   BASE=https://ramo.spintabelle-frontend.pages.dev node scripts/check-hands-live.mjs
 */

const BASE = process.env.BASE ?? 'https://bestfishforever.it';
const API = process.env.API ?? 'https://api.bestfishforever.it';
const idArg = process.argv[2] ?? null;

let passati = 0;
let falliti = 0;
const problemi = [];

const ok = (n) => {
  passati++;
  console.log(`  ✓ ${n}`);
};
const ko = (n, d) => {
  falliti++;
  problemi.push(`${n}: ${d}`);
  console.log(`  ✗ ${n}\n      ${d}`);
};
const verifica = (n, cond, d) => (cond ? ok(n) : ko(n, d));

async function prendi(url, opts = {}) {
  const r = await fetch(url, { redirect: 'manual', ...opts });
  const testo = r.status >= 200 && r.status < 300 ? await r.text() : '';
  return { status: r.status, headers: r.headers, testo };
}

async function main() {
  console.log(`Sito: ${BASE}\nAPI:  ${API}\n`);

  // ── quale mano provare ────────────────────────────────────────────────
  let publicId = idArg;
  let record = null;
  if (!publicId) {
    const v = await fetch(`${API}/hands/vetrina?limit=1`).then((r) => r.json());
    const primo = v?.items?.[0];
    if (!primo) {
      console.log(
        '⚠️  Nessuna mano in vetrina: passa un publicId esplicito.\n' +
          '    node scripts/check-hands-live.mjs <publicId>\n',
      );
      process.exit(0);
    }
    publicId = primo.publicId;
    record = primo;
  }
  if (!record) {
    record = await fetch(`${API}/hands/${publicId}`).then((r) => r.json());
  }
  console.log(`Mano: ${publicId} (${record?.gameTypeLabel ?? '?'})\n`);

  const url = `${BASE}/replayer/${publicId}/`;

  // ── la pagina ─────────────────────────────────────────────────────────
  console.log('§1 — La pagina della mano\n');
  const p = await prendi(url);
  verifica('risponde 200', p.status === 200, `status ${p.status}`);

  verifica(
    "l'ha composta la Pages Function",
    p.headers.get('x-bff-hand') === 'edge',
    `x-bff-hand: ${p.headers.get('x-bff-hand') ?? '(assente)'} — se manca, la Function non viene invocata: controlla l'include in public/_routes.json`,
  );

  const h1 = [...p.testo.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
  verifica('ha esattamente un <h1>', h1.length === 1, `${h1.length} h1 trovati`);

  const parole = (p.testo.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? '')
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  verifica('il <main> ha contenuto vero', parole > 25, `${parole} parole`);

  // ── il noindex, nei due versi ─────────────────────────────────────────
  console.log('\n§2 — ⚠️ Il noindex (la misura su cui poggia il trattamento)\n');

  verifica(
    'il meta robots dice noindex',
    /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(p.testo),
    'la pagina NON dichiara noindex nel corpo: i nickname dei terzi diventano cercabili',
  );

  verifica(
    "l'header X-Robots-Tag dice noindex",
    /noindex/i.test(p.headers.get('x-robots-tag') ?? ''),
    `x-robots-tag: ${p.headers.get('x-robots-tag') ?? '(assente)'} — gli header di public/_headers NON si applicano alle Function: deve metterlo la Function`,
  );

  verifica(
    'la mano NON è in nessuna sitemap',
    !(await fetch(`${BASE}/sitemap.xml`).then((r) => r.text())).includes(publicId),
    'la mano compare nella sitemap: va tolta',
  );

  // ── un solo indirizzo buono ───────────────────────────────────────────
  console.log('\n§3 — Un solo indirizzo buono\n');

  const senzaSlash = await prendi(`${BASE}/replayer/${publicId}`);
  verifica(
    'la forma senza barra finale fa 301',
    senzaSlash.status === 301,
    `status ${senzaSlash.status} (Cloudflare non normalizza quando risponde una Function)`,
  );
  verifica(
    'e punta alla forma con la barra',
    (senzaSlash.headers.get('location') ?? '').endsWith(`/replayer/${publicId}/`),
    `location: ${senzaSlash.headers.get('location') ?? '(assente)'}`,
  );

  const canonical = p.testo.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1];
  verifica(
    'il canonical è la forma con la barra',
    canonical === `https://bestfishforever.it/replayer/${publicId}/`,
    `canonical: ${canonical ?? '(assente)'}`,
  );

  const inventata = await prendi(`${BASE}/replayer/ZZZZZZZZZZ/`);
  verifica(
    'un indirizzo inventato dà 404 VERO (non 200, non 301)',
    inventata.status === 404,
    `status ${inventata.status} — un 200 sarebbe un soft-404 su URL infinite`,
  );

  // ── coerenza col record dell'API ──────────────────────────────────────
  console.log("\n§4 — La pagina dice quello che dice l'API\n");

  verifica(
    'il titolo porta il FORMATO, non la sala',
    p.testo.includes(`Mano di ${record.gameTypeLabel}`),
    `atteso «Mano di ${record.gameTypeLabel}» nel titolo`,
  );

  const ogTitle = p.testo.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? '';
  const ogDesc = p.testo.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? '';
  const nick = (record.players ?? []).map((x) => x.nome).filter(Boolean);

  verifica(
    "⚠️ NESSUN nickname nell'anteprima social",
    !nick.some((n) => ogTitle.includes(n) || ogDesc.includes(n)),
    "un nickname è finito in og:title/og:description: è la superficie più inoltrata e meno controllabile",
  );

  verifica(
    "⚠️ NESSUN nome di sala nell'anteprima social (art. 9 DL 87/2018)",
    !ogTitle.includes(record.roomLabel) && !ogDesc.includes(record.roomLabel),
    `«${record.roomLabel}» è finita nell'anteprima`,
  );

  const ogImg = p.testo.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? '';
  const attesa = record.ogImageUrl || 'https://bestfishforever.it/og.png';
  verifica(
    "l'og:image segue la catena calcolata dal record",
    ogImg === attesa,
    `og:image: ${ogImg} — attesa ${attesa}`,
  );

  // ── che siamo ancora in directory mode ────────────────────────────────
  console.log('\n§5 — Siamo ancora in directory mode\n');
  // ⚠️ `/account` e non più `/negozio`: vedi la nota gemella in
  // check-news-live.mjs — il Negozio è pubblico e indicizzato dal 27/08/2026.
  const gated = await fetch(`${BASE}/account`, { method: 'HEAD' });
  verifica(
    '/account porta ancora X-Robots-Tag',
    /noindex/i.test(gated.headers.get('x-robots-tag') ?? ''),
    "public/_headers non si applica più: probabile passaggio ad advanced mode (_worker.js), che spegnerebbe la deindicizzazione di TUTTE le rotte client",
  );

  const indice = await prendi(`${BASE}/replayer/`);
  verifica(
    "⚠️ la pagina INDICE /replayer/ resta quella prerenderizzata",
    indice.status === 200 && indice.testo.includes('Replayer delle mani'),
    `status ${indice.status} — se è 404, l'\`exclude\` di public/_routes.json è saltato e la Function si è mangiata la pagina statica`,
  );

  console.log(`\n${'─'.repeat(60)}`);
  if (falliti) {
    console.log(`❌ ${passati} passati, ${falliti} FALLITI\n`);
    for (const x of problemi) console.log(`   • ${x}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${passati}/${passati} controlli passati sulla produzione\n`);
  }
}

main().catch((e) => {
  console.error('\n❌ Errore non gestito:', e);
  process.exit(1);
});
