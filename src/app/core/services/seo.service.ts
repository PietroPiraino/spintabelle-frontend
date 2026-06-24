import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

const SITE = 'https://spintabelle.it';
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
    const image = d.image || DEFAULT_IMAGE;
    const url = d.path ? `${SITE}${d.path}` : `${SITE}/`;

    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: d.description });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: d.description });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: d.description });
    this.meta.updateTag({ name: 'twitter:image', content: image });
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
}
