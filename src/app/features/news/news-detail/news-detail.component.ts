import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { News } from '../../../core/models/api.models';
import { AI_DISCLOSURE } from '../../../core/news.constants';
import { NewsService } from '../../../core/services/news.service';
import { SeoService } from '../../../core/services/seo.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { MarkdownComponent } from '../../../shared/ui/markdown/markdown.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';

/**
 * Il dominio, scritto qui come in `guide-detail.component.ts`. ⚠️ **Mai
 * `location.href`** per gli indirizzi di condivisione: da un'anteprima di ramo
 * porterebbe l'host `*.pages.dev`, e in generale si porta dietro query string e
 * frammento — cioè si diffonderebbero link permanenti verso una copia o verso
 * uno stato di navigazione, non verso l'articolo.
 */
const SITE = 'https://bestfishforever.it';

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
  imports: [RouterLink, DatePipe, IconComponent, MarkdownComponent],
  templateUrl: './news-detail.component.html',
  styleUrl: './news-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsDetailComponent {
  private readonly newsApi = inject(NewsService);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);

  /**
   * Campo d'appoggio per il ripiego della copia (idioma di
   * `affiliations.component.ts`): fuori da un contesto sicuro
   * `navigator.clipboard` è `undefined`. ⚠️ È renderizzato **fuori schermo, mai
   * `display: none`** — un campo non renderizzato non si può selezionare, e il
   * ripiego non partirebbe affatto.
   */
  private readonly copyFallback =
    viewChild<ElementRef<HTMLInputElement>>('copyFallback');

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
   * L'indirizzo da diffondere: **l'URL canonica dell'articolo, costruita sullo
   * SLUG**. È l'unica fonte dei tre collegamenti *e* del «Copia link».
   *
   * ⚠️ SULLO SLUG E NON SUL PARAMETRO DI ROTTA, che è ciò che questa pagina
   * riceve quando si arriva da un ObjectId o da uno slug storico. Lì la Function
   * risponde 301 prima che l'app si monti, quindi la deriva del canonical
   * (`applySeo` passa ancora `path: /news/${this.id()}`) è preesistente e
   * innocua — ma **non va ereditata qui**: condividere `/news/65f0…aa/`
   * significherebbe diffondere link permanenti verso un indirizzo che il sito
   * stesso dichiara non canonico. Sistemare il canonical è un'altra cosa ed è
   * fuori perimetro per scelta del piano.
   *
   * ⚠️ La forma è la stessa di `percorsoCanonico` in
   * `functions/lib/render-news.mjs` — `/news/<encodeURIComponent(chiave)>/`,
   * slash finale compreso: è quella servita a 200, quella che il canonical
   * dichiara e quella che la sitemap pubblica.
   */
  protected readonly urlCondivisione = computed(() => {
    const slug = (this.news()?.slug ?? '').trim();
    return `${SITE}/news/${encodeURIComponent(slug || this.id())}/`;
  });

  /**
   * I tre indirizzi di condivisione. ⚠️ Gemelli di `linkCondivisione` in
   * `functions/lib/render-news.mjs`: le due rese della pagina si
   * **sostituiscono**, quindi i tre collegamenti vanno scritti due volte e i due
   * elenchi devono restare identici (a sorvegliarli è
   * `scripts/lib/news-render.test.mjs`, che rilegge questo sorgente).
   *
   * Qui l'escape dell'attributo lo fa Angular con il binding `[href]`: la regola
   * «`encodeURIComponent` prima, escape dopo» resta la stessa, ma il secondo
   * passo non si scrive a mano come all'edge.
   */
  protected readonly condivisione = computed(() => {
    const url = this.urlCondivisione();
    const titolo = this.news()?.title ?? '';
    const u = encodeURIComponent(url);
    const t = encodeURIComponent(titolo);
    return {
      // WhatsApp non ha un campo separato per l'URL: titolo e indirizzo
      // viaggiano in un unico testo, quindi si codificano insieme.
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${titolo} ${url}`)}`,
      telegram: `https://t.me/share/url?url=${u}&text=${t}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    };
  });

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

  // ── Copia del link ────────────────────────────────────────────────────────

  /**
   * Copia negli appunti l'indirizzo dell'articolo. Copia integrale dell'idioma
   * di `affiliations.component.ts`: `navigator.clipboard` → ripiego su campo
   * d'appoggio + `execCommand` → se fallisce anche quello, un toast che dice
   * cosa fare. **Mai un bottone morto.**
   *
   * ⚠️ IL VALORE COPIATO È `urlCondivisione()`, LO STESSO DEI TRE COLLEGAMENTI —
   * mai `location.href`, che porta con sé query string, frammento e, su
   * un'anteprima di ramo, l'host `*.pages.dev`.
   *
   * ⚠️ Questo controllo esiste **solo qui**, e non nella resa all'edge: là
   * nessun gestore lo ascolterebbe (il codice che lo fa funzionare arriva
   * insieme all'app, che quell'HTML lo cancella), cioè sarebbe un bottone morto.
   * L'asimmetria è pinnata nei due versi in `scripts/lib/news-render.test.mjs`.
   */
  protected copiaLink(): void {
    const url = this.urlCondivisione();
    const clip = navigator.clipboard;
    if (clip?.writeText) {
      void clip.writeText(url).then(
        () => this.toast.success('Link copiato.'),
        () => this.copiaConRipiego(url),
      );
      return;
    }
    this.copiaConRipiego(url);
  }

  private copiaConRipiego(url: string): void {
    const input = this.copyFallback()?.nativeElement;
    if (input) {
      input.value = url;
      input.select();
      input.setSelectionRange(0, url.length);
      let done = false;
      try {
        done = document.execCommand('copy');
      } catch {
        done = false;
      }
      input.blur();
      if (done) {
        this.toast.success('Link copiato.');
        return;
      }
    }
    // ⚠️ E QUI NON SI MANDA NESSUNO NELLA BARRA DEGLI INDIRIZZI. La prima
    // stesura di questo messaggio diceva «oppure copia l'indirizzo dalla barra
    // del browser», cioè indirizzava proprio a `location.href` — il valore che
    // il docblock qui sopra e un caso di `news-render.test.mjs` vietano. Non è
    // teoria: le card di `/news` e della home collegano per `_id`
    // (`shared/ui/news-card`), quindi chi arriva da lì ha nella barra
    // `/news/65f0…aa/`, cioè l'indirizzo che il sito stesso dichiara non
    // canonico — e il fallimento della copia sarebbe l'unico momento in cui
    // glielo consigliamo. I tre collegamenti, che portano l'URL buona, sono
    // proprio lì accanto e funzionano anche senza appunti.
    this.toast.error(
      'Copia non riuscita: usa uno dei pulsanti di condivisione qui accanto.',
    );
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
