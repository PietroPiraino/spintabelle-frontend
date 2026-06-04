import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <section class="section not-found">
      <div class="container not-found__inner">
        <p class="not-found__code" aria-hidden="true">4<span>♠</span>4</p>
        <h1>Mano foldata</h1>
        <p class="lead">Questa pagina non esiste o è stata spostata dal tavolo.</p>
        <a routerLink="/" class="btn btn--primary">Torna alla home</a>
      </div>
    </section>
  `,
  styles: `
    .not-found {
      display: flex;
      align-items: center;
      min-height: calc(100dvh - 220px);
    }

    .not-found__inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 1.2rem;

      .lead {
        margin-inline: auto;
      }
    }

    .not-found__code {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: clamp(5rem, 16vw, 9rem);
      line-height: 1;
      color: var(--cream-100);

      span {
        color: var(--copper-400);
        filter: drop-shadow(0 0 20px rgba(224, 125, 60, 0.5));
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {}
