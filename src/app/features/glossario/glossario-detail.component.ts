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
import { VOCI, Voce, voceBySlug } from './glossario.data';

const SITE = 'https://bestfishforever.it';
const ID_SET = `${SITE}/glossario/#set`;

@Component({
  selector: 'app-glossario-detail',
  imports: [RouterLink, DatePipe],
  templateUrl: './glossario-detail.component.html',
  styleUrl: './glossario-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossarioDetailComponent {
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  /** Legato dal router (withComponentInputBinding): /glossario/:slug */
  readonly slug = input<string>();

  protected readonly voce = computed<Voce | undefined>(() =>
    voceBySlug(this.slug() ?? ''),
  );

  /** Le voci di `correlati`, risolte e senza buchi se uno slug non esiste. */
  protected readonly correlati = computed(() =>
    (this.voce()?.correlati ?? [])
      .map((s) => VOCI.find((v) => v.slug === s))
      .filter((v): v is Voce => v !== undefined),
  );

  constructor() {
    // ⚠️ Title/description/canonical NON arrivano dai `data` della rotta: la
    // rotta e' una sola (`glossario/:slug`) per N pagine, quindi i meta vengono
    // dal contenuto — idioma di guide-detail e news-detail. In prerender questo
    // gira davvero: ogni voce esce con i propri meta nell'HTML statico.
    effect(() => {
      const v = this.voce();
      if (!v) return;
      const url = `${SITE}/glossario/${v.slug}/`;
      this.seo.setSeo({
        title: v.titolo,
        description: v.definizione,
        path: `/glossario/${v.slug}`,
      });
      // Il termine, nel suo insieme: e' il tipo che Google prevede per una
      // voce di glossario. Non porta data ne' editore, che stanno nel WebPage.
      this.seo.setJsonLd('ld-voce', {
        '@context': 'https://schema.org',
        '@type': 'DefinedTerm',
        '@id': `${url}#termine`,
        name: v.termine,
        ...(v.varianti?.length ? { alternateName: v.varianti } : {}),
        description: v.definizione,
        url,
        inLanguage: 'it',
        inDefinedTermSet: {
          '@type': 'DefinedTermSet',
          '@id': ID_SET,
          name: 'Glossario del poker di Best Fish Forever',
          url: `${SITE}/glossario/`,
        },
      });
      this.seo.setJsonLd('ld-voce-pagina', {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': url,
        url,
        name: v.titolo,
        description: v.definizione,
        inLanguage: 'it',
        dateModified: v.aggiornata,
        mainEntity: { '@id': `${url}#termine` },
        publisher: {
          '@type': 'Organization',
          name: 'Best Fish Forever',
          url: `${SITE}/`,
          logo: { '@type': 'ImageObject', url: `${SITE}/logo-256.png` },
        },
      });
      this.seo.setJsonLd('ld-voce-briciole', {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Glossario',
            item: `${SITE}/glossario/`,
          },
          { '@type': 'ListItem', position: 2, name: v.termine, item: url },
        ],
      });
    });

    this.destroyRef.onDestroy(() => {
      this.seo.removeJsonLd('ld-voce');
      this.seo.removeJsonLd('ld-voce-pagina');
      this.seo.removeJsonLd('ld-voce-briciole');
    });
  }
}
