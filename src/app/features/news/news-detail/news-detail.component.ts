import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { News } from '../../../core/models/api.models';
import { NewsService } from '../../../core/services/news.service';
import { SeoService } from '../../../core/services/seo.service';
import { MarkdownComponent } from '../../../shared/ui/markdown/markdown.component';

/**
 * La pagina di un articolo DENTRO lo SPA. ⚠️ Non è la prima stesura di questa
 * pagina: l'HTML che ricevono il lettore al primo colpo, gli scraper social e i
 * motori lo scrive `functions/news/[[path]].ts` all'edge (titolo, meta,
 * canonical, JSON-LD, corpo). Questo componente subentra al montaggio e per la
 * navigazione interna — e per questo `applySeo` qui sotto deve dire le STESSE
 * cose di `functions/lib/render-news.mjs`, o la pagina cambia meta un secondo
 * dopo essere stata aperta.
 *
 * ⚠️ QUI C'ERA UN AGGANCIO A `RESPONSE_INIT` (il token di `@angular/core` che
 * lascia mutare lo stato della risposta durante una resa lato server), per
 * rispondere 404 su un articolo inesistente. È stato tolto il 19/08/2026
 * insieme all'SSR: senza `outputMode: 'server'` quel token è `null` sempre —
 * nel browser e in prerender — quindi non era più una difesa, era una difesa
 * APPARENTE, il tipo di codice che si legge come «il 404 è gestito».
 * ⚠️ Il 404 vero c'è ancora, e lo produce la Function: risponde 404 con il corpo
 * di `public/404.html` quando l'API risponde 404. Il ramo `notFound` qui sotto
 * copre un caso diverso e va lasciato dov'è — chi è già dentro lo SPA e apre un
 * articolo cancellato mentre naviga: lì non c'è nessuna risposta HTTP da
 * marcare, c'è solo una pagina da mostrare.
 */
@Component({
  selector: 'app-news-detail',
  imports: [RouterLink, DatePipe, MarkdownComponent],
  templateUrl: './news-detail.component.html',
  styleUrl: './news-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsDetailComponent {
  private readonly newsApi = inject(NewsService);
  private readonly seo = inject(SeoService);

  /** Param della rotta news/:id (component input binding) */
  readonly id = input.required<string>();

  protected readonly news = signal<News | null>(null);
  protected readonly notFound = signal(false);

  constructor() {
    effect(() => {
      const id = this.id();
      this.news.set(null);
      this.notFound.set(false);
      this.newsApi.getById(id).subscribe({
        next: (news) => {
          this.news.set(news);
          this.applySeo(news);
        },
        error: () => this.notFound.set(true),
      });
    });
    // Rimuovi i dati strutturati specifici dell'articolo lasciando la pagina:
    // altrimenti il NewsArticle resterebbe nel <head> anche sulle altre pagine.
    inject(DestroyRef).onDestroy(() => this.seo.removeJsonLd('ld-news-article'));
  }

  /** Titolo + description + immagine dinamici, e dati strutturati NewsArticle. */
  private applySeo(news: News): void {
    const description = this.excerpt(news.body);
    this.seo.setSeo({
      title: news.title,
      description,
      image: news.coverImageUrl,
      path: `/news/${this.id()}`,
    });
    this.seo.setJsonLd('ld-news-article', {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: news.title,
      description,
      ...(news.coverImageUrl ? { image: [news.coverImageUrl] } : {}),
      datePublished: news.createdAt,
      dateModified: news.updatedAt,
      publisher: {
        '@type': 'Organization',
        name: 'Best Fish Forever',
        logo: {
          '@type': 'ImageObject',
          url: 'https://bestfishforever.it/logo-256.png',
        },
      },
    });
  }

  /** Estratto pulito dal Markdown del corpo (per description/og), ~155 caratteri. */
  private excerpt(body: string): string {
    const text = body
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // immagini md
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // link md → testo
      .replace(/[#>*_`~|-]/g, ' ') // simboli md
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > 155 ? `${text.slice(0, 152).trimEnd()}…` : text;
  }
}
