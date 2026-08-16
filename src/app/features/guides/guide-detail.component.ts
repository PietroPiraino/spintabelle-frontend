import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { GUIDE, Guide, guidaBySlug } from './guides.data';

const SITE = 'https://bestfishforever.it';

@Component({
  selector: 'app-guide-detail',
  imports: [RouterLink, DatePipe],
  templateUrl: './guide-detail.component.html',
  styleUrl: './guide-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuideDetailComponent {
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  /** Legato dal router (withComponentInputBinding): /guide/:slug */
  readonly slug = input<string>();

  protected readonly guida = computed<Guide | undefined>(() =>
    guidaBySlug(this.slug() ?? ''),
  );

  /** Le guide indicate in `correlate`, risolte e senza buchi se uno slug non esiste. */
  protected readonly correlate = computed(() =>
    (this.guida()?.correlate ?? [])
      .map((s) => GUIDE.find((g) => g.slug === s))
      .filter((g): g is Guide => g !== undefined),
  );

  constructor() {
    // ⚠️ Title/description/canonical NON arrivano dai `data` della rotta: qui la
    // rotta e' una sola (`guide/:slug`) per N pagine, quindi i meta devono venire
    // dal contenuto. Stesso schema di news-detail. In prerender questo gira
    // davvero, quindi ogni guida esce con i propri meta nell'HTML statico.
    effect(() => {
      const g = this.guida();
      if (!g) return;
      const url = `${SITE}/guide/${g.slug}/`;
      this.seo.setSeo({
        title: g.titolo,
        description: g.descrizione,
        path: `/guide/${g.slug}`,
      });
      this.seo.setJsonLd('ld-guida', {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: g.h1,
        description: g.descrizione,
        inLanguage: 'it',
        dateModified: g.aggiornata,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        author: {
          '@type': 'Organization',
          name: 'Best Fish Forever',
          url: `${SITE}/`,
        },
        publisher: {
          '@type': 'Organization',
          name: 'Best Fish Forever',
          url: `${SITE}/`,
          logo: { '@type': 'ImageObject', url: `${SITE}/logo-256.png` },
        },
      });
      this.seo.setJsonLd('ld-guida-faq', {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: g.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      });
      this.seo.setJsonLd('ld-guida-briciole', {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Guide', item: `${SITE}/guide/` },
          { '@type': 'ListItem', position: 2, name: g.h1, item: url },
        ],
      });
    });

    this.destroyRef.onDestroy(() => {
      this.seo.removeJsonLd('ld-guida');
      this.seo.removeJsonLd('ld-guida-faq');
      this.seo.removeJsonLd('ld-guida-briciole');
    });
  }
}
