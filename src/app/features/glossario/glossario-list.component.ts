import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { HeroCardsComponent } from '../../shared/ui/hero-cards/hero-cards.component';
import { VOCI, Voce } from './glossario.data';

const SITE = 'https://bestfishforever.it';

interface Lettera {
  lettera: string;
  id: string;
  voci: Voce[];
}

/**
 * L'indice del glossario: TUTTE le definizioni in chiaro, raggruppate per
 * lettera. Non e' una scelta di stile: e' la pagina che risponde a «glossario
 * poker» e «termini poker italiano», e il concorrente che la vince ha un
 * indice da 7.354 parole con le definizioni dentro (misurato 20/09/2026). Un
 * elenco di soli titoli sarebbe una pagina di link, cioe' niente.
 */
@Component({
  selector: 'app-glossario-list',
  imports: [RouterLink, HeroCardsComponent],
  template: `
    <section class="section">
      <div class="container">
        <header class="page-hero page-hero--center">
          <div class="page-hero__ornament">
            <app-hero-cards />
          </div>
          <span class="eyebrow">Glossario</span>
          <h1>
            I termini del <span class="text-gradient">poker</span> spiegati in
            italiano
          </h1>
          <p class="lead">
            Ogni voce dice cosa significa la parola e come si usa negli Spin
            &amp; Go e nei Twister, con un numero concreto e un esempio. Sono
            gratuite e non serve un account.
          </p>
        </header>

        <nav class="glossario__lettere" aria-label="Lettere">
          @for (l of lettere; track l.lettera) {
            <a routerLink="." [fragment]="l.id">{{ l.lettera }}</a>
          }
        </nav>

        @for (l of lettere; track l.lettera) {
          <section class="glossario__gruppo" [attr.aria-labelledby]="l.id">
            <h2 [id]="l.id">{{ l.lettera }}</h2>
            <ul class="glossario__voci">
              @for (v of l.voci; track v.slug) {
                <li>
                  <h3>
                    <a [routerLink]="['/glossario', v.slug]">{{ v.termine }}</a>
                  </h3>
                  <p>{{ v.definizione }}</p>
                </li>
              }
            </ul>
          </section>
        }

        <div class="seo-block__cta glossario__cta">
          <p>
            Il glossario e' la porta d'ingresso: le
            <a routerLink="/guide">guide di strategia</a> spiegano come si
            mettono insieme questi concetti, e la
            <a routerLink="/guide/strategia-spin-and-go"
              >guida completa agli Spin &amp; Go</a
            >
            e' il punto da cui partire.
          </p>
        </div>
      </div>
    </section>
  `,
  styles: `
    .glossario__lettere {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      justify-content: center;
      margin-bottom: 2rem;
    }

    // Bersaglio di tocco dichiarato (44px): un elenco di lettere e' fatto di
    // bersagli piccoli per natura, e senza il minimo la riga sta sui 30px.
    .glossario__lettere a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 44px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface-1);
      font-family: var(--font-mono);
      font-size: 0.9rem;
      color: var(--text);
      text-decoration: none;
    }

    .glossario__lettere a:hover {
      color: var(--copper-600);
      border-color: var(--copper-600);
    }

    .glossario__gruppo {
      max-width: 74ch;
      margin-inline: auto;
      margin-bottom: 2rem;
    }

    .glossario__gruppo h2 {
      font-family: var(--font-mono);
      font-size: 1rem;
      letter-spacing: 0.08em;
      color: var(--text-faint);
      border-bottom: 1px solid var(--line);
      padding-bottom: 0.4rem;
      margin-bottom: 1rem;
      // Il fragment porta l'h2 sotto l'header fisso: senza il margine di
      // scorrimento la lettera resta coperta.
      scroll-margin-top: 5rem;
    }

    .glossario__voci {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 1rem;
    }

    .glossario__voci li {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .glossario__voci h3 {
      font-size: 1.08rem;
      line-height: 1.35;
      margin: 0;
    }

    .glossario__voci a {
      color: var(--cream-100);
      text-decoration: none;
    }

    .glossario__voci a:hover {
      color: var(--ember);
    }

    .glossario__voci p {
      font-size: 0.93rem;
      color: var(--text-muted);
      line-height: 1.6;
      margin: 0;
    }

    .glossario__cta {
      max-width: 74ch;
      margin-inline: auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossarioListComponent {
  private readonly seo = inject(SeoService);

  protected readonly lettere = raggruppaPerLettera(VOCI);

  constructor() {
    // DefinedTermSet con dentro ogni voce: dice a Google che questa pagina e'
    // il contenitore del glossario. Title/description arrivano dai `data`
    // della rotta come per ogni pagina statica.
    this.seo.setJsonLd('ld-glossario-set', {
      '@context': 'https://schema.org',
      '@type': 'DefinedTermSet',
      '@id': `${SITE}/glossario/#set`,
      name: 'Glossario del poker di Best Fish Forever',
      url: `${SITE}/glossario/`,
      inLanguage: 'it',
      hasDefinedTerm: VOCI.map((v) => ({
        '@type': 'DefinedTerm',
        '@id': `${SITE}/glossario/${v.slug}/#termine`,
        name: v.termine,
        description: v.definizione,
        url: `${SITE}/glossario/${v.slug}/`,
      })),
    });
  }
}

/**
 * Gruppi per iniziale, ordinati con il collatore italiano cosi' «È» e «E»
 * stanno insieme. Le cifre e i simboli finiscono sotto «#».
 */
export function raggruppaPerLettera(voci: readonly Voce[]): Lettera[] {
  const collatore = new Intl.Collator('it', { sensitivity: 'base' });
  const gruppi = new Map<string, Voce[]>();
  for (const v of [...voci].sort((a, b) => collatore.compare(a.termine, b.termine))) {
    const iniziale = v.termine
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .charAt(0)
      .toUpperCase();
    const lettera = /[A-Z]/.test(iniziale) ? iniziale : '#';
    if (!gruppi.has(lettera)) gruppi.set(lettera, []);
    gruppi.get(lettera)!.push(v);
  }
  return [...gruppi.entries()]
    .sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
    .map(([lettera, lista]) => ({
      lettera,
      id: `lettera-${lettera === '#' ? 'altro' : lettera.toLowerCase()}`,
      voci: lista,
    }));
}
