import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { News } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { NewsService } from '../../core/services/news.service';
import { SeoService } from '../../core/services/seo.service';
import { NewsCardComponent } from '../../shared/ui/news-card/news-card.component';
import { SuitDividerLiveComponent } from '../../shared/suit-divider-live/suit-divider-live.component';
import { SOCIAL_LINKS } from '../../core/social-links';
import { Hero3dComponent } from './hero-3d/hero-3d.component';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, Hero3dComponent, NewsCardComponent, SuitDividerLiveComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent {
  protected readonly auth = inject(AuthService);
  private readonly newsApi = inject(NewsService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly social = SOCIAL_LINKS;

  /**
   * FAQ della home: UNICA sorgente per il testo a schermo e per il JSON-LD
   * FAQPage (vedi `applyStructuredData`). Sono le domande che una persona fa
   * prima di iscriversi a una scuola, con risposte vere — non parole chiave
   * travestite da domande.
   * ⚠️ Niente prezzi qui dentro: `SUB_PRICE_*` è configurabile da env e vince
   * sul default nel codice (precedente noto: cambiare il fallback non cambiò il
   * prezzo in produzione). Un numero scritto a mano qui invecchierebbe in
   * silenzio, e finirebbe pure nei dati strutturati.
   */
  protected readonly faq: readonly { q: string; a: string }[] = [
    {
      q: 'Che cos’è Best Fish Forever?',
      a: "È una scuola di poker italiana specializzata nei tornei 3-max hyper turbo, quelli conosciuti come Spin & Go o Twister. Offre lezioni video dei coach, tabelle GTO preflop navigabili, esercizi di allenamento, lezioni dal vivo e una community su Discord.",
    },
    {
      q: 'Cosa sono gli Spin & Go?',
      a: "Sono tornei da tre giocatori con struttura hyper turbo: si parte da 25 big blind e i livelli salgono ogni pochi minuti. A inizio torneo viene estratto un moltiplicatore che determina il montepremi. Su alcune sale lo stesso formato si chiama Twister: la struttura è la stessa, cambiano moltiplicatori e ripartizione del montepremi.",
    },
    {
      q: 'Serve pagare per iniziare?',
      a: "No. La registrazione è gratuita e dà accesso alle tabelle GTO preflop, agli esercizi di allenamento e al simulatore di varianza. L'abbonamento serve per la parte guidata: lezioni video, materiali di supporto e sessioni dal vivo con i coach.",
    },
    {
      q: 'Che differenza c’è tra i due piani di abbonamento?',
      a: "I piani si chiamano Pesce Rosso e Squalo e si distinguono per i limiti di gioco coperti: il primo copre i buy-in bassi, il secondo tutto il materiale, compresi i contenuti sui limiti alti. Prezzi e dettagli aggiornati sono nella pagina degli abbonamenti.",
    },
    {
      q: 'Da che livello si può partire?',
      a: "Da zero, purché tu conosca le regole del Texas Hold'em. Il percorso parte dalle decisioni preflop, che nel 3-max hyper turbo sono la maggior parte del gioco, e sale verso gli spot postflop ricorrenti e l'ICM di fine torneo. Chi gioca già da tempo di solito usa le tabelle come riferimento e le lezioni per colmare i buchi.",
    },
    {
      q: 'Le lezioni sono in italiano?',
      a: 'Sì, tutte: lezioni video, tabelle, materiali e sessioni dal vivo. È il motivo principale per cui molti giocatori italiani arrivano qui — il materiale serio su questo formato è quasi tutto in inglese.',
    },
    {
      q: 'Ci sono lezioni dal vivo?',
      a: "Sì. Si svolgono in una sala interna al sito: il coach trasmette video, audio e schermo, chi partecipa può fare domande e, su richiesta, condividere il proprio schermo per farsi rivedere una sessione. Le registrazioni vengono poi pubblicate come lezioni.",
    },
    {
      q: 'Cosa sono le tabelle GTO preflop?',
      a: "Sono la strategia di equilibrio per ogni situazione preflop del formato: per ognuna delle 169 mani di partenza dicono con che frequenza aprire, rilanciare, chiamare o passare, a una data profondità di stack e posizione. Sul sito non sono un PDF ma un albero navigabile nodo per nodo, con frequenze ed EV per mano.",
    },
  ];

  protected readonly latestNews = toSignal(
    this.newsApi.getLatest(3).pipe(catchError(() => of([] as News[]))),
    { initialValue: [] as News[] },
  );

  constructor() {
    this.applyStructuredData();
  }

  /**
   * FAQPage dalla stessa `faq` mostrata a schermo, rimossa su destroy.
   * NB: title/description/OG/canonical li imposta il listener globale in
   * app.config dai `data` della rotta — qui solo il JSON-LD. L'
   * `EducationalOrganization` del sito sta invece statico in index.html.
   */
  private applyStructuredData(): void {
    this.seo.setJsonLd('ld-home-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
    this.destroyRef.onDestroy(() => this.seo.removeJsonLd('ld-home-faq'));
  }

  protected readonly valueProps = [
    {
      suit: '♠',
      title: 'Studio guidato',
      text: 'Percorsi di lezioni video tenuti dai coach della scuola: dal preflop agli spot postflop più complessi, in italiano.',
    },
    {
      suit: '♦',
      title: 'Tabelle di gioco',
      text: 'Le tabelle GTO per Spin & Go e Twister, consultabili ovunque: la teoria sempre in tasca, anche tra un game e l’altro.',
    },
    {
      suit: '♣',
      title: 'Community vera',
      text: 'Discord attivo, review delle mani, sessioni condivise e il canale YouTube con contenuti gratuiti ogni settimana.',
    },
  ];
}
