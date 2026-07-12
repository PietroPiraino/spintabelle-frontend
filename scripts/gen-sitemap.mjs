// Genera dist/frontend/browser/sitemap.xml al build: pagine pubbliche statiche
// + una entry per ogni news (dinamica, letta dal backend a build-time).
// Fail-safe: qualsiasi errore (API giù, scrittura) NON fa fallire il build —
// esce comunque 0 lasciando in dist la sitemap statica copiata da public/.
// Eseguito da `npm run build` DOPO `ng build` (vedi package.json).

import { writeFileSync } from 'node:fs';

const SITE = 'https://bestfishforever.it';
const API = 'https://api.bestfishforever.it';
const OUT = 'dist/frontend/browser/sitemap.xml';

// Mirror delle pagine statiche di public/sitemap.xml (esclusa /affiliazioni:
// placeholder senza contenuti reali).
const staticUrls = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/abbonati', changefreq: 'monthly', priority: '0.9' },
  { loc: '/chi-siamo', changefreq: 'monthly', priority: '0.7' },
  { loc: '/tabelle', changefreq: 'monthly', priority: '0.7' },
  { loc: '/simulatore-varianza', changefreq: 'monthly', priority: '0.7' },
  { loc: '/news', changefreq: 'weekly', priority: '0.6' },
  { loc: '/privacy', changefreq: 'yearly', priority: '0.2' },
  { loc: '/cookie-policy', changefreq: 'yearly', priority: '0.2' },
];

async function newsUrls() {
  // Il backend limita `limit` (≥500 → 400): pagino a 50 (cap 20 pagine).
  try {
    const out = [];
    for (let page = 1; page <= 20; page++) {
      const res = await fetch(`${API}/news?page=${page}&limit=50`);
      if (!res.ok) break;
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      for (const n of items) {
        if (typeof n?._id !== 'string') continue;
        out.push({
          loc: `/news/${n._id}`,
          changefreq: 'monthly',
          priority: '0.5',
          lastmod: String(n.updatedAt || n.createdAt || '').slice(0, 10) || null,
        });
      }
      const totalPages = Number(data?.totalPages) || 1;
      if (items.length === 0 || page >= totalPages) break;
    }
    return out;
  } catch {
    return [];
  }
}

function toXml(urls) {
  const body = urls
    .map((u) => {
      const lastmod = u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : '';
      return `  <url>\n    <loc>${SITE}${u.loc}</loc>${lastmod}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

const news = await newsUrls();
try {
  writeFileSync(OUT, toXml([...staticUrls, ...news]));
  console.log(
    `✅ sitemap.xml: ${staticUrls.length} pagine + ${news.length} news → ${OUT}`,
  );
} catch (e) {
  console.warn('⚠️ sitemap non aggiornata (resta quella statica):', e?.message || e);
}
process.exit(0);
