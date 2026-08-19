import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  RESPONSE_INIT,
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

  /**
   * Lo stato HTTP della risposta SSR, per poter rispondere 404 su un articolo
   * che non esiste.
   *
   * ⚠️ IL TOKEN E' DI `@angular/core`, NON di `@angular/ssr` (che ne esporta
   * altri, simili di nome). ⚠️ Ed e' `null` ovunque non ci sia una risposta da
   * mutare: nel browser e durante il prerender. Da qui l'`{ optional: true }`,
   * senza il quale l'app non partirebbe affatto lato client.
   *
   * COME FUNZIONA, verificato su @angular/ssr 22.0.0 e non a memoria: l'engine
   * crea l'oggetto `ResponseInit` PRIMA di renderizzare, lo passa come
   * `useValue`, e costruisce la `Response` con quello STESSO oggetto DOPO che il
   * render e' finito (`await applicationRef.whenStable()` sta in mezzo). Quindi
   * scrivere `status` durante il render arriva in tempo. E' un contratto di
   * MUTAZIONE, cioe' fragile per natura: `news-detail.component.spec.ts` lo
   * fissa con una spec, e se un domani Angular smettesse di rispettarlo il
   * ripiego dichiarato nel piano e' far riscrivere lo stato alla Function.
   *
   * PERCHE' CONTA: da quando `news/:id` e' `RenderMode.Server` non esiste piu'
   * nessun file, e senza questa riga OGNI id inventato risponderebbe 200 con la
   * pagina "News non trovata" — un soft-404 su infinite URL, esattamente il
   * difetto che `public/404.html` ha chiuso il 16/08/2026.
   */
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

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
        error: () => {
          this.notFound.set(true);
          // Vedi il commento su `responseInit`: 404 vero, non un 200 travestito.
          if (this.responseInit) this.responseInit.status = 404;
        },
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
