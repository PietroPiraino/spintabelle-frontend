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
import { IconComponent, IconName } from '../../shared/ui/icon/icon.component';
import { Hero3dComponent } from './hero-3d/hero-3d.component';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, Hero3dComponent, NewsCardComponent, SuitDividerLiveComponent, IconComponent],
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
      a: "Da zero, purché tu conosca le regole del Texas Hold'em. Il percorso parte dalle decisioni preflop, che nel 3-max hyper turbo sono la maggior parte del gioco, e sale verso gli spot postflop ricorrenti e l'heads-up finale. Chi gioca già da tempo di solito usa le tabelle come riferimento e le lezioni per colmare i buchi.",
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

  /**
   * La vetrina: una card per sezione del sito.
   * ⚠️ Sostituisce il vecchio blocco "Offerta", che aveva DUE sole card
   * (Tabelle e Lezioni) ed era rimasto indietro: Guide, Simulatore, Live e
   * Docs — cioe' il lavoro degli ultimi mesi — non comparivano in home da
   * nessuna parte. `Tabelle` sta in cima perche' dal 23/08/2026 non e' piu'
   * una voce di primo livello dell'header: questa e' la sua vetrina.
   * ⚠️ Niente /negozio e niente /allenamento: sono dietro `authGuard`, e in
   * una vetrina pubblica manderebbero l'anonimo dritto sul redirect al login.
   * `tint` pilota la sola tinta radiale della card (vedi .offer__card).
   */
  protected readonly prodotti = [
    {
      tint: 'rgba(0, 212, 212, 0.12)',
      title: 'Tabelle preflop',
      text: 'L’albero delle azioni percorribile nodo per nodo, con frequenza ed EV di tutte e 169 le mani. Gratis per gli iscritti.',
      link: '/tabelle',
      cta: 'Consulta le tabelle',
    },
    {
      tint: 'rgba(255, 106, 31, 0.12)',
      title: 'Lezioni video',
      text: 'Il percorso dei coach, per argomento e per livello: si cerca il tema che serve, si studia, si torna al tavolo.',
      link: '/lezioni',
      cta: 'Entra in aula',
    },
    {
      tint: 'rgba(255, 181, 71, 0.14)',
      title: 'Guide di strategia',
      text: 'Dieci guide che spiegano il formato dalle fondamenta. Si leggono subito: non serve nemmeno un account.',
      link: '/guide',
      cta: 'Leggi le guide',
    },
    {
      tint: 'rgba(120, 180, 255, 0.13)',
      title: 'Simulatore di varianza',
      text: 'Migliaia di percorsi di bankroll simulati nel browser: downswing normali, rischio di rovina, buy-in necessari. Anche questo senza account.',
      link: '/simulatore-varianza',
      cta: 'Prova il simulatore',
    },
    {
      tint: 'rgba(255, 90, 90, 0.12)',
      title: 'Lezioni dal vivo',
      text: 'Sessioni con i coach in una sala dentro il sito: si guarda, si chiede, e chi vuole condivide lo schermo per farsi rivedere una sessione.',
      link: '/live',
      cta: 'Vedi il calendario',
    },
    {
      tint: 'rgba(150, 220, 150, 0.12)',
      title: 'Materiali e filtri',
      text: 'Filtri e report per PokerTracker 4, PDF e fogli di calcolo: quello che si usa lontano dal tavolo, quando si rivede una sessione.',
      link: '/docs',
      cta: 'Apri la libreria',
    },
  ];

  // ⚠️ `suit` è un NOME DI ICONA, non un carattere. Fino al 27/08/2026 qui
  // c'erano `♠ ♦ ♣` come testo, stampati dal template in uno `<span>`: su iOS
  // `♦` prende la presentazione **emoji**, si porta dentro i propri colori e il
  // `color: var(--copper-500)` di `.value-prop__suit` non arrivava a schermo —
  // due semi su tre nel rame del marchio, uno azzurro di sistema, sulla prima
  // schermata della home. La guardia non lo vedeva perché leggeva solo gli
  // `.html`; ora legge anche i `.ts`.
  protected readonly valueProps: { suit: IconName; title: string; text: string }[] = [
    {
      suit: 'spade',
      title: 'Studio guidato',
      text: 'Percorsi di lezioni video tenuti dai coach della scuola: dal preflop agli spot postflop più complessi, in italiano.',
    },
    {
      suit: 'diamond',
      title: 'Tabelle di gioco',
      text: 'Le tabelle GTO per Spin & Go e Twister, consultabili ovunque: la teoria sempre in tasca, anche tra un game e l’altro.',
    },
    {
      suit: 'club',
      title: 'Community vera',
      text: 'Discord attivo, review delle mani, sessioni condivise e il canale YouTube con contenuti gratuiti ogni settimana.',
    },
  ];
}
