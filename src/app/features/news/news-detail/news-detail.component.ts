import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { News } from '../../../core/models/api.models';
import { AI_DISCLOSURE } from '../../../core/news.constants';
import { NewsService } from '../../../core/services/news.service';
import { SeoService } from '../../../core/services/seo.service';
import { MarkdownComponent } from '../../../shared/ui/markdown/markdown.component';

/**
 * La pagina di un articolo DENTRO lo SPA. ⚠️ Non è la prima stesura di questa
 * pagina: l'HTML che ricevono il lettore al primo colpo, gli scraper social e i
 * motori lo scrive `functions/news/[[path]].ts` all'edge (titolo, meta,
 * canonical, JSON-LD, corpo). Questo componente subentra al montaggio e per la
 * navigazione interna — e per questo `applySeo` qui sotto deve dire le STESSE
 * cose di `functions/lib/render-news.mjs`, o la pagina cambia meta un secondo
 * dopo essere stata aperta.
 *
 * ⚠️ QUI C'ERA UN AGGANCIO A `RESPONSE_INIT` (il token di `@angular/core` che
 * lascia mutare lo stato della risposta durante una resa lato server), per
 * rispondere 404 su un articolo inesistente. È stato tolto il 19/08/2026
 * insieme all'SSR: senza `outputMode: 'server'` quel token è `null` sempre —
 * nel browser e in prerender — quindi non era più una difesa, era una difesa
 * APPARENTE, il tipo di codice che si legge come «il 404 è gestito».
 * ⚠️ Il 404 vero c'è ancora, e lo produce la Function: risponde 404 con il corpo
 * di `public/404.html` quando l'API risponde 404. Il ramo `notFound` qui sotto
 * copre un caso diverso e va lasciato dov'è — chi è già dentro lo SPA e apre un
 * articolo cancellato mentre naviga: lì non c'è nessuna risposta HTTP da
 * marcare, c'è solo una pagina da mostrare.
 *
 * ---
 *
 * IDENTITÀ EDITORIALE (Fase 4 del piano redazione, §4.2/§4.3/§4.4). Tre cose
 * sono arrivate qui il 19/08/2026, e per ciascuna conta **dove** sta:
 *
 * - **byline** e **data di pubblicazione** e **note di rettifica** stanno anche
 *   in `functions/lib/render-news.mjs`, perché sono contenuto della pagina: chi
 *   legge il crawler è l'edge, e una byline che esiste solo dopo l'idratazione,
 *   per Google, non esiste;
 * - l'**etichetta IA del testo** sta **solo qui**. È volontaria (l'esonero
 *   dell'art. 50(4) è già soddisfatto da revisione + responsabilità editoriale)
 *   e l'asimmetria con l'etichetta dell'IMMAGINE — che dovrà stare in entrambi i
 *   renderer — è **voluta**: le ragioni per esteso in `core/news.constants.ts`,
 *   e non vanno appiattite unendo le due frasi.
 *
 * ⚠️ COSA MANCA ANCORA QUI, ED È UN PREREQUISITO DI P4 (non un backlog): **l'elenco
 * delle fonti** (`sourceUrls`/`sourceOutlets`, già nella proiezione pubblica del
 * backend) non è reso né qui né all'edge. La policy editoriale pubblicata promette
 * che un articolo derivato da fonti le elenchi in fondo — oggi è scritta «da questa
 * policy in avanti» proprio perché quella resa non c'è. Il giorno in cui la pipeline
 * pubblica il primo pezzo derivato, l'elenco deve già esserci **in entrambi i
 * renderer**, come byline e note di rettifica: è contenuto della pagina, e una fonte
 * che compare solo dopo l'idratazione, per un motore, non esiste.
 */
@Component({
  selector: 'app-news-detail',
  imports: [RouterLink, DatePipe, MarkdownComponent],
  templateUrl: './news-detail.component.html',
  styleUrl: './news-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsDetailComponent {
  private readonly newsApi = inject(NewsService);
  private readonly seo = inject(SeoService);

  /** Param della rotta news/:id (component input binding) */
  readonly id = input.required<string>();

  protected readonly news = signal<News | null>(null);
  protected readonly notFound = signal(false);

  /** Rotta della policy editoriale, per il collegamento dentro l'etichetta. */
  protected readonly rottaPolicy = AI_DISCLOSURE.ancoraRotta;

  /**
   * La data che il lettore vede: **`publishedAt`**, non `createdAt`. Fra la
   * creazione della bozza e la pubblicazione possono passare giorni, e la data
   * di una notizia è quella in cui è uscita. `createdAt` resta solo come rete
   * per i pezzi anteriori al campo (dove comunque la migrazione ha fatto
   * ereditare l'uno dall'altro, quindi oggi il valore è lo stesso).
   */
  protected readonly dataPubblica = computed(() => {
    const n = this.news();
    return n ? (n.publishedAt ?? n.createdAt) : '';
  });

  /** Le note di rettifica da stampare fra intestazione e corpo (§4.4). */
  protected readonly rettifiche = computed(() => this.news()?.rettifiche ?? []);

  /**
   * L'etichetta IA, già spezzata nelle due metà attorno al collegamento —
   * oppure `null` quando non va resa.
   *
   * ⚠️ **Servono DUE condizioni, non una.** Che il pezzo sia stato generato
   * (`aiGeneratedAt`) è l'interruttore; il nome del revisore è il contenuto. La
   * frase *afferma* che una persona ha verificato e approvato l'articolo, e la
   * policy editoriale pubblicata promette di dire **chi**: senza quel nome le
   * uscite possibili sarebbero stampare «da undefined», oppure ripiegare sulla
   * byline — cioè scrivere una cosa falsa il giorno in cui autore e revisore non
   * coincidono più. Non renderla affatto è l'unica terza via, ed è accettabile
   * proprio perché questa etichetta è volontaria (§4.3): la sua assenza è
   * cosmetica, un nome sbagliato no.
   *
   * ⚠️ CONSEGUENZA OPERATIVA, DA NON SCOPRIRE A COSE FATTE: oggi l'API pubblica
   * **non** espone il nome del revisore (vedi `News.revisionatoDaNome` in
   * `api.models.ts`). Oggi non si vede, perché nessun articolo ha
   * `aiGeneratedAt`; il giorno in cui la pipeline pubblica il primo pezzo,
   * l'etichetta resterebbe muta. È un prerequisito di P4, non un dettaglio.
   */
  protected readonly etichettaIa = computed(() => {
    const n = this.news();
    if (!n?.aiGeneratedAt) return null;
    const revisore = (n.revisionatoDaNome ?? '').trim();
    if (!revisore) return null;
    return {
      apertura: AI_DISCLOSURE.apertura(revisore),
      ancora: AI_DISCLOSURE.ancora,
      chiusura: AI_DISCLOSURE.chiusura,
    };
  });

  constructor() {
    effect(() => {
      const id = this.id();
      this.news.set(null);
      this.notFound.set(false);
      this.newsApi.getById(id).subscribe({
        next: (news) => {
          this.news.set(news);
          this.applySeo(news);
        },
        error: () => this.notFound.set(true),
      });
    });
    // Rimuovi i dati strutturati specifici dell'articolo lasciando la pagina:
    // altrimenti il NewsArticle resterebbe nel <head> anche sulle altre pagine.
    inject(DestroyRef).onDestroy(() => this.seo.removeJsonLd('ld-news-article'));
  }

  /** Titolo + description + immagine dinamici, e dati strutturati NewsArticle. */
  private applySeo(news: News): void {
    const description = this.excerpt(news.body);
    const pubblicato = news.publishedAt ?? news.createdAt;
    this.seo.setSeo({
      title: news.title,
      description,
      // ⚠️ DUE campi, e non uno — e la stessa catena, nello stesso ordine, sta
      // in `functions/lib/render-news.mjs`: le due rese si **sostituiscono**,
      // non si fondono, quindi aggiornarne una sola vorrebbe dire un'anteprima
      // che cambia a seconda di chi guarda (lo scraper legge la prima, il
      // browser la seconda).
      // `ogImageUrl` è la targa 1200×675 generata da noi, e serve SOLO alle
      // anteprime social: in pagina non si vede mai — l'`<img>` del template
      // resta `coverImageUrl`, cioè la foto vera (i tre articoli storici hanno
      // quella, un pezzo generato non ne ha nessuna).
      // ⚠️ **`||` e non `??`, ed è la differenza che conta.** All'edge la catena
      // è `ogImage || copertina || OG_PREDEFINITA`: con `??` qui, una
      // `ogImageUrl` **stringa vuota** vincerebbe di là no e di qua sì, e lo
      // stesso articolo mostrerebbe la foto allo scraper e l'`og.png` al
      // browser. Cioè proprio l'anteprima-che-cambia-a-seconda-di-chi-guarda che
      // questo commento dichiara inaccettabile due righe più sopra. Lo schema ha
      // `trim: true`, quindi `'  '` diventa `''` e il caso non è di fantasia.
      image: news.ogImageUrl || news.coverImageUrl,
      path: `/news/${this.id()}`,
    });
    this.seo.setJsonLd('ld-news-article', {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: news.title,
      description,
      // ⚠️ Qui resta `coverImageUrl` e NON la targa: i dati strutturati
      // descrivono l'articolo, e l'immagine dell'articolo è quella che il
      // lettore vede in pagina. La targa è un'insegna per le chat, non
      // un'illustrazione del pezzo. Il gemello all'edge fa lo stesso.
      ...(news.coverImageUrl ? { image: [news.coverImageUrl] } : {}),
      datePublished: pubblicato,
      // ⚠️ `ultimaRettificaAt`, MAI `updatedAt` (D45). Con `updatedAt` qualunque
      // salvataggio dell'admin — un refuso, un tag — alzava la data e la pagina
      // si dichiarava aggiornata senza esserlo: per un motore è freschezza
      // gonfiata. Solo una rettifica pubblicata muove questa data.
      dateModified: news.ultimaRettificaAt ?? pubblicato,
      // ⚠️ `Person`, non `Organization` (D40): i dati strutturati devono dire
      // quello che dice la pagina, e una byline umana in chiaro accoppiata a un
      // autore-azienda è esattamente la discrepanza che le linee guida sulla
      // reputazione del sito leggono come una maschera.
      ...(news.autore
        ? {
            author: {
              '@type': 'Person',
              name: news.autore,
              url: 'https://bestfishforever.it/redazione/',
            },
          }
        : {}),
      publisher: {
        '@type': 'Organization',
        name: 'Best Fish Forever',
        logo: {
          '@type': 'ImageObject',
          url: 'https://bestfishforever.it/logo-256.png',
        },
      },
    });
  }

  /** Estratto pulito dal Markdown del corpo (per description/og), ~155 caratteri. */
  private excerpt(body: string): string {
    const text = body
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // immagini md
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // link md → testo
      .replace(/[#>*_`~|-]/g, ' ') // simboli md
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > 155 ? `${text.slice(0, 152).trimEnd()}…` : text;
  }
}
