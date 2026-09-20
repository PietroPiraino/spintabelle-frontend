import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { ParticleSchoolComponent } from './particle-school/particle-school.component';
import { COACHES } from './coaches.data';
import type { EmblemId } from './particle-school/emblem-shapes';

@Component({
  selector: 'app-about',
  imports: [RouterLink, ParticleSchoolComponent],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent implements OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);
  private revealObserver?: IntersectionObserver;

  protected readonly coaches = COACHES;
  /** Seme che il banco di particelle forma per ogni coach (♣ alla CTA). */
  protected readonly emblems: Record<string, EmblemId> = {
    exivezzz: 'spade',
    nagato: 'heart', // il cuore della scuola: l'ha fondata lui
    bastogne: 'diamond',
  };

  constructor() {
    // Un `Person` per coach: e' il segnale E-E-A-T della pagina (chi insegna
    // esiste ed e' nominato), e il modo in cui un motore collega nickname e
    // nome. ⚠️ SENZA `bio` e `tag`: nominano reti e sale (People's Poker,
    // PokerStars), e i dati strutturati sono testo pubblico esattamente come
    // la pagina — art. 9 DL 87/2018. Un id per coach, tolti alla distruzione.
    for (const c of COACHES) {
      this.seo.setJsonLd(`ld-coach-${c.id}`, {
        '@context': 'https://schema.org',
        '@type': 'Person',
        '@id': `https://bestfishforever.it/chi-siamo/#${c.id}`,
        name: c.nome,
        alternateName: c.nickname,
        jobTitle: c.eyebrow,
        url: 'https://bestfishforever.it/chi-siamo/',
        memberOf: {
          '@type': 'EducationalOrganization',
          name: 'Best Fish Forever',
          url: 'https://bestfishforever.it/',
        },
        knowsAbout: ['Poker', 'Spin & Go', 'Twister'],
      });
    }
    this.destroyRef.onDestroy(() => {
      for (const c of COACHES) this.seo.removeJsonLd(`ld-coach-${c.id}`);
    });

    // Reveal dei pannelli allo scroll: aggiunge .is-visible una volta sola.
    // Imperativo sul DOM, nessun segnale toccato → zero CD in zoneless.
    afterNextRender(() => {
      const panels = (this.host.nativeElement as HTMLElement).querySelectorAll('.coachpanel');
      if (panels.length === 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        panels.forEach((panel) => panel.classList.add('is-visible'));
        return;
      }
      this.revealObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              this.revealObserver?.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.18 },
      );
      panels.forEach((panel) => this.revealObserver!.observe(panel));
    });
  }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
  }
}
