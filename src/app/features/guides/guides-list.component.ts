import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { GUIDE } from './guides.data';

@Component({
  selector: 'app-guides-list',
  imports: [RouterLink],
  template: `
    <section class="section">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow">Guide</span>
          <h1>Guide di strategia per Spin &amp; Go e Twister</h1>
          <p class="lead">
            Le basi del formato spiegate per intero e in italiano: preflop,
            bankroll, varianza e ICM. Sono gratuite e non serve un account.
          </p>
        </div>

        <ul class="guide-index">
          @for (g of guide; track g.slug) {
            <li class="card card--pad card--hover">
              <span class="eyebrow">{{ g.occhiello }}</span>
              <h2>
                <a [routerLink]="['/guide', g.slug]">{{ g.h1 }}</a>
              </h2>
              <p>{{ g.descrizione }}</p>
            </li>
          }
        </ul>

        @if (guide.length === 0) {
          <div class="empty-state">
            <div class="empty-state__suit" aria-hidden="true">♠ ♥ ♣ ♦</div>
            <p>Le prime guide stanno arrivando.</p>
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    .guide-index {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr));
    }

    .guide-index li {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .guide-index h2 {
      font-size: 1.15rem;
      line-height: 1.35;
    }

    .guide-index a {
      color: var(--cream-100);
      text-decoration: none;
    }

    .guide-index a:hover {
      color: var(--ember);
    }

    .guide-index p {
      font-size: 0.93rem;
      color: var(--text-muted);
      line-height: 1.6;
      margin: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuidesListComponent {
  private readonly seo = inject(SeoService);

  protected readonly guide = GUIDE;

  constructor() {
    // ItemList dell'indice: dice a Google che questa pagina e' il contenitore
    // della sezione, non un articolo. Title/description arrivano dai `data`
    // della rotta come per ogni pagina statica.
    this.seo.setJsonLd('ld-guide-indice', {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: this.guide.map((g, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: g.h1,
        url: `https://bestfishforever.it/guide/${g.slug}/`,
      })),
    });
  }
}
