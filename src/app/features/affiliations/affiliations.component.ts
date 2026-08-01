import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Placeholder "in arrivo". Sostituire con la pagina reale in Fase 3 di
// PLAN-affiliazioni.md (elenco sale + richiesta + invio username).
// ⚠️ La pagina è PUBBLICA e PRERENDERIZZATA: questo testo finisce nell'HTML
// indicizzabile. Niente marchi di operatore, niente nomi di formato, niente
// condizioni o percentuali — quelle stanno dietro login (§9.3, §11 del piano).
@Component({
  selector: 'app-affiliations',
  imports: [RouterLink],
  template: `
    <section class="section">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow">Affiliazioni</span>
          <h1>Il nostro programma di affiliazione</h1>
          <p class="lead">
            Stiamo preparando questa sezione. La richiesta partirà dal tuo
            account e le condizioni sono riservate agli iscritti Best Fish
            Forever.
          </p>
        </div>
        <a routerLink="/" class="btn btn--primary">Torna alla home</a>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AffiliationsComponent {}
