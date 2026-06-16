import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Placeholder "in arrivo": qui andranno i file scaricabili di supporto al
// gioco (HUD, cheat sheet, range PDF…). La rotta è riservata agli iscritti
// (authGuard in app.routes.ts); all'interno alcuni materiali saranno poi
// gating-ati ai soli abbonati (auth.isSubscriber()). Sostituire col contenuto reale.
@Component({
  selector: 'app-docs',
  imports: [RouterLink],
  template: `
    <section class="section">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow">Docs</span>
          <h1>Materiali di supporto al gioco</h1>
          <p class="lead">
            Cheat sheet, HUD e file scaricabili per allenarti al tavolo: questa
            sezione sta arrivando. Torna a trovarci a breve.
          </p>
        </div>
        <a routerLink="/tabelle" class="btn btn--primary">Intanto vai alle tabelle</a>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocsComponent {}
