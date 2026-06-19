import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
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
  private revealObserver?: IntersectionObserver;

  protected readonly coaches = COACHES;
  /** Seme che il banco di particelle forma per ogni coach (♣ alla CTA). */
  protected readonly emblems: Record<string, EmblemId> = {
    exivezzz: 'spade',
    nagato: 'heart', // il cuore della scuola: l'ha fondata lui
    bastogne: 'diamond',
  };

  constructor() {
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
