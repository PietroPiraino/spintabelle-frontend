import { PrerenderFallback, RenderMode, ServerRoute } from '@angular/ssr';
import { environment } from '../environments/environment';

const API = environment.API_URL;

/**
 * Mappa RenderMode per l'SSG (outputMode 'static' → solo Prerender e Client).
 *
 * - PRERENDER: pagine pubbliche statiche ad alto valore SEO → HTML generato al
 *   build con meta/canonical/OG/JSON-LD già nel sorgente (li applica il listener
 *   NavigationEnd + i componenti, che girano anche in prerender). Chiude il gap
 *   delle anteprime social (scraper che leggono solo l'HTML iniziale).
 * - CLIENT (default via `**`): rotte gated/auth/token-based/404 → nessun HTML
 *   statico, servite dallo shell SPA (index.csr.html) via il fallback _redirects.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'tabelle', renderMode: RenderMode.Prerender },
  { path: 'simulatore-varianza', renderMode: RenderMode.Prerender },
  { path: 'chi-siamo', renderMode: RenderMode.Prerender },
  { path: 'abbonati', renderMode: RenderMode.Prerender },
  { path: 'news', renderMode: RenderMode.Prerender },
  { path: 'affiliazioni', renderMode: RenderMode.Prerender },
  { path: 'privacy', renderMode: RenderMode.Prerender },
  { path: 'cookie-policy', renderMode: RenderMode.Prerender },

  // News per-articolo: un HTML statico per ogni id noto al build (anteprime
  // social per-articolo), con fallback client per gli id usciti dopo il build
  // o non raggiungibili. getPrerenderParams enumera gli id dal backend a
  // build-time; se l'API non risponde, nessun articolo viene prerenderizzato
  // (fallback client) ma il build NON fallisce.
  {
    path: 'news/:id',
    renderMode: RenderMode.Prerender,
    fallback: PrerenderFallback.Client,
    async getPrerenderParams() {
      // Il backend limita `limit` (≥500 → 400), quindi pagino a 50 fino a
      // esaurire i risultati (cap 20 pagine = 1000 news, guardia anti-loop).
      try {
        const ids: { id: string }[] = [];
        for (let page = 1; page <= 20; page++) {
          const res = await fetch(`${API}/news?page=${page}&limit=50`);
          if (!res.ok) break;
          const data: unknown = await res.json();
          const items = Array.isArray(data)
            ? data
            : ((data as { items?: unknown[] })?.items ?? []);
          for (const n of items) {
            const id = (n as { _id?: unknown })?._id;
            if (typeof id === 'string') ids.push({ id });
          }
          const totalPages =
            Number((data as { totalPages?: unknown })?.totalPages) || 1;
          if (items.length === 0 || page >= totalPages) break;
        }
        return ids;
      } catch {
        return [];
      }
    },
  },

  // Tutto il resto (allenamento, lezioni, live, docs, negozio, account, admin,
  // login, registrazione, verifica/reset token, wildcard 404) → client.
  { path: '**', renderMode: RenderMode.Client },
];
