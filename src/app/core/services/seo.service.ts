import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

const SITE = 'https://bestfishforever.it';
const DEFAULT_IMAGE = `${SITE}/og.png`;

export interface SeoData {
  /** Titolo senza il suffisso brand (lo aggiunge il service). */
  title: string;
  description: string;
  /** URL assoluto dell'immagine OG; default og.png. */
  image?: string;
  /** Path della pagina (es. "/news/123") per og:url + canonical. */
  path?: string;
}

/**
 * Imposta meta SEO per-pagina (title + description + OpenGraph + Twitter +
 * canonical) e dati strutturati JSON-LD. NB: senza SSR i meta vengono settati
 * via JS → utili per Google (che esegue il JS), meno per gli scraper social che
 * leggono solo l'HTML iniziale. Per quelli serve il prerender/SSR (vedi #27).
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);

  setSeo(d: SeoData): void {
    const fullTitle = `${d.title} — Best Fish Forever`;
    this.title.setTitle(fullTitle);
    this.applyMeta(fullTitle, d.description, this.absUrl(d.path), d.image);
  }

  /**
   * URL assoluto e canonico per una rotta, normalizzato allo **slash finale**.
   * Perché: l'SSG (`outputMode: 'static'`) emette un `<rotta>/index.html` per
   * pagina → Cloudflare serve la pagina reale (200) su `/abbonati/` e fa 308
   * dalla forma senza slash. Canonical + og:url (e la sitemap, vedi
   * `gen-sitemap.mjs`) devono puntare alla forma SERVITA A 200, non a quella che
   * redirige: altrimenti Search Console classifica gli URL come "pagina con
   * reindirizzamento" / "canonical alternato" e il canonical rimanda a un 308
   * (sconsigliato dalle linee guida Google). La root resta `/`.
   */
  private absUrl(path: string | undefined): string {
    let p = (path ?? '/').split('?')[0].split('#')[0];
    if (!p.startsWith('/')) p = `/${p}`;
    if (!p.endsWith('/')) p += '/';
    return `${SITE}${p}`;
  }

  /**
   * Aggiorna i meta per-pagina (description + OG/Twitter + canonical) dai dati
   * della rotta, SENZA toccare il <title> (già impostato dal TitleStrategy del
   * router). Usato dal listener globale di navigazione in app.config: senza di
   * esso ogni pagina eredita canonical + description statici della home, che
   * fa auto-canonicalizzare /tabelle, /abbonati, ecc. verso "/".
   * `fullTitle` è il titolo completo della rotta (già col suffisso brand).
   */
  setRouteMeta(
    fullTitle: string,
    description: string,
    path: string,
    image?: string,
  ): void {
    this.applyMeta(fullTitle, description, this.absUrl(path), image);
  }

  private applyMeta(
    fullTitle: string,
    description: string,
    url: string,
    image?: string,
  ): void {
    const img = image || DEFAULT_IMAGE;
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:image', content: img });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: img });
    this.setCanonical(url);
  }

  private setCanonical(url: string): void {
    let link = this.doc.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  /** Inserisce/aggiorna uno <script type="application/ld+json"> con un dato id. */
  setJsonLd(id: string, data: Record<string, unknown>): void {
    let el = this.doc.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = this.doc.createElement('script');
      el.type = 'application/ld+json';
      el.id = id;
      this.doc.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }

  /**
   * Rimuove uno <script type="application/ld+json"> per id. Da chiamare quando
   * una pagina che ha aggiunto dati strutturati specifici viene distrutta:
   * senza questo lo schema (es. un FAQPage) resterebbe nel <head> anche sulle
   * altre pagine, sporcando i loro dati strutturati.
   */
  removeJsonLd(id: string): void {
    this.doc.getElementById(id)?.remove();
  }
}
