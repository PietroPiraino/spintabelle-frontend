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
import type { PreflopNode } from '../../../core/models/api.models';
import { SeoService } from '../../../core/services/seo.service';
import {
  BASE_LABELS,
  actionColorMap,
  depthDisplay,
  parseFormat,
} from '../preflop-display';
import { RangeGridComponent } from '../range-grid/range-grid.component';
import type { SituazioneRisolta } from './situazioni.resolver';
import { statistiche } from './situazione-stats';
import { faqSituazione, paragrafiSituazione } from './situazione-testo';
import {
  SITUAZIONI,
  Situazione,
  situazioneBySlug,
} from './situazioni.catalogo';

const SITE = 'https://bestfishforever.it';
const ID_LD = ['ld-situazione', 'ld-situazione-faq', 'ld-situazione-briciole'];

/**
 * La pagina statica di una situazione: la griglia GTO (sola lettura) piu' il
 * testo generato dai suoi numeri. `nodo` arriva dal resolver della rotta,
 * `slug` dal router (withComponentInputBinding).
 */
@Component({
  selector: 'app-situazione',
  imports: [RouterLink, RangeGridComponent],
  templateUrl: './situazione.component.html',
  styleUrl: './situazione.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SituazioneComponent {
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly slug = input<string>();
  /** Dal resolver `nodoSituazioneResolver` (chiave `dati` della rotta). */
  readonly dati = input<SituazioneRisolta | null>(null);

  protected readonly nodo = computed<PreflopNode | null>(
    () => this.dati()?.nodo ?? null,
  );

  protected readonly situazione = computed<Situazione | undefined>(() =>
    situazioneBySlug(this.slug() ?? ''),
  );
  protected readonly stats = computed(() => {
    const n = this.nodo();
    return n ? statistiche(n) : null;
  });
  protected readonly colorMap = computed(() => {
    const n = this.nodo();
    return n ? actionColorMap(n.actions) : {};
  });
  protected readonly paragrafi = computed(() => {
    const s = this.situazione();
    const n = this.nodo();
    const st = this.stats();
    return s && n && st ? paragrafiSituazione(s, n, st) : [];
  });
  protected readonly faq = computed(() => {
    const s = this.situazione();
    const n = this.nodo();
    const st = this.stats();
    return s && n && st ? faqSituazione(s, n, st) : [];
  });
  /** «Spin & Go · 10 bb» per l'occhiello e la legenda. */
  protected readonly etichetta = computed(() => {
    const n = this.nodo();
    if (!n) return '';
    const parti = parseFormat(n.format);
    return `${BASE_LABELS[parti.base]} · ${depthDisplay(n.depth_label, n.format)} bb`;
  });
  /** Le altre situazioni dello stesso gruppo (stesso formato e percorso), per il blocco «Altre profondita'». */
  protected readonly sorelle = computed(() => {
    const s = this.situazione();
    if (!s) return [];
    return SITUAZIONI.filter(
      (x) =>
        x.slug !== s.slug &&
        x.format === s.format &&
        x.preflop_actions === s.preflop_actions,
    );
  });
  /** I query param con cui il visualizzatore apre esattamente questo nodo. */
  protected readonly paramViewer = computed(() => {
    const n = this.nodo();
    if (!n) return {};
    return {
      formato: n.format,
      stack: n.depth_label,
      ...(n.preflop_actions ? { azioni: n.preflop_actions } : {}),
    };
  });

  constructor() {
    effect(() => {
      const s = this.situazione();
      const n = this.nodo();
      if (!s || !n) return;
      const url = `${SITE}/tabelle/${s.slug}/`;
      this.seo.setSeo({
        title: s.titolo,
        description: s.descrizione,
        path: `/tabelle/${s.slug}`,
      });
      // WebPage e non Dataset: un Dataset promette una distribuzione
      // scaricabile e una licenza, e non e' quello che questa pagina e'.
      this.seo.setJsonLd('ld-situazione', {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': url,
        url,
        name: s.h1,
        description: s.descrizione,
        inLanguage: 'it',
        dateModified: this.dati()?.esportato,
        about: { '@type': 'Thing', name: s.h1 },
        isPartOf: { '@type': 'WebSite', url: `${SITE}/` },
        publisher: {
          '@type': 'Organization',
          name: 'Best Fish Forever',
          url: `${SITE}/`,
          logo: { '@type': 'ImageObject', url: `${SITE}/logo-256.png` },
        },
      });
      this.seo.setJsonLd('ld-situazione-faq', {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: this.faq().map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      });
      this.seo.setJsonLd('ld-situazione-briciole', {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Tabelle preflop', item: `${SITE}/tabelle/` },
          { '@type': 'ListItem', position: 2, name: s.h1, item: url },
        ],
      });
    });
    this.destroyRef.onDestroy(() => {
      for (const id of ID_LD) this.seo.removeJsonLd(id);
    });
  }
}
