import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Placeholder "in arrivo": qui andranno le offerte di rakeback / affiliazione
// con le poker room. Sostituire con la pagina reale (link affiliati, condizioni,
// come iscriversi). Pagina PUBBLICA (decisione owner) — è materiale di richiamo.
@Component({
  selector: 'app-affiliations',
  imports: [RouterLink],
  template: `
    <section class="section">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow">Affiliazioni</span>
          <h1>Le nostre offerte di rakeback</h1>
          <p class="lead">
            Stiamo preparando le condizioni di rakeback e i vantaggi riservati
            agli iscritti Best Fish Forever. Questa sezione sta arrivando.
          </p>
        </div>
        <a routerLink="/" class="btn btn--primary">Torna alla home</a>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AffiliationsComponent {}
