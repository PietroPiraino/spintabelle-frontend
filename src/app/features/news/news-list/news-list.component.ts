import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  NEWS_CATEGORIES,
  NEWS_CATEGORY_LABELS,
  News,
  NewsCategory,
} from '../../../core/models/api.models';
import { NewsService } from '../../../core/services/news.service';
import { NewsCardComponent } from '../../../shared/ui/news-card/news-card.component';
import { HeroCardsComponent } from '../../../shared/ui/hero-cards/hero-cards.component';

@Component({
  selector: 'app-news-list',
  imports: [NewsCardComponent, HeroCardsComponent],
  templateUrl: './news-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsListComponent {
  private readonly newsApi = inject(NewsService);

  protected readonly items = signal<News[] | null>(null);
  protected readonly loadingMore = signal(false);
  protected readonly hasMore = signal(false);

  /**
   * L'errore di rete, che prima non esisteva.
   *
   * ⚠️ Fino al 27/08/2026 il ramo `error` faceva `items.update(c => c ?? [])`:
   * su un 500 o su una rete caduta la pagina mostrava lo stato vuoto, cioè
   * «Nessuna news pubblicata, torna a trovarci presto» — un guasto presentato
   * come «non abbiamo ancora scritto niente», su un sito che pubblica ogni
   * giorno. È il difetto che /lezioni e /docs hanno già corretto: banner con
   * «Riprova», mai un catalogo vuoto travestito.
   */
  protected readonly error = signal<string | null>(null);

  /** Il filtro per categoria. `null` = tutte. */
  protected readonly categoria = signal<NewsCategory | null>(null);

  protected readonly categorie = NEWS_CATEGORIES;
  protected readonly etichette = NEWS_CATEGORY_LABELS;

  protected readonly etichettaAttiva = computed(() => {
    const c = this.categoria();
    return c ? this.etichette[c] : null;
  });

  private page = 1;
  private readonly pageSize = 9;

  /**
   * Contatore delle richieste: vince solo l'ultima partita.
   *
   * ⚠️ Non era teorico e lo è diventato ancora meno con le pillole: cambiare
   * filtro due volte in fretta può far atterrare la risposta della prima
   * DOPO quella della seconda, e l'elenco mostrerebbe la categoria sbagliata
   * senza che nulla sia in errore. È la difesa che /lezioni e /docs hanno
   * entrambe (`requestSeq`), e qui mancava.
   */
  private seq = 0;

  constructor() {
    this.load();
  }

  /** Cambia (o toglie) il filtro e ricarica dalla prima pagina. */
  protected filtra(c: NewsCategory | null): void {
    if (this.categoria() === c) return;
    this.categoria.set(c);
    this.page = 1;
    this.items.set(null);
    this.hasMore.set(false);
    this.load();
  }

  protected loadMore(): void {
    if (this.loadingMore()) return;
    this.page += 1;
    this.load();
  }

  protected riprova(): void {
    this.error.set(null);
    this.load();
  }

  private load(): void {
    this.loadingMore.set(true);
    this.error.set(null);
    const mia = ++this.seq;
    const paginaChiesta = this.page;

    this.newsApi.getNews(this.page, this.pageSize, this.categoria() ?? undefined).subscribe({
      next: (res) => {
        if (mia !== this.seq) return;
        this.items.update((current) => {
          const base = current ?? [];
          // ⚠️ Deduplica per id: fra una pagina e l'altra un articolo nuovo
          // sposta l'offset di uno, e senza questo filtro l'ultimo della
          // pagina precedente ricompare in cima alla successiva.
          const visti = new Set(base.map((n) => n._id));
          return [...base, ...res.items.filter((n) => !visti.has(n._id))];
        });
        this.hasMore.set(res.page < res.totalPages);
        this.loadingMore.set(false);
      },
      error: () => {
        if (mia !== this.seq) return;
        // ⚠️ La pagina torna indietro. `loadMore()` la incrementa PRIMA della
        // richiesta: senza questo, un tocco andato male salta nove articoli
        // per sempre, e la pressione successiva carica la 3 saltando la 2 —
        // l'elenco continua e nessuno si accorge del buco.
        this.page = Math.max(1, paginaChiesta - 1);
        this.error.set(
          'Non siamo riusciti a caricare le notizie. Controlla la connessione e riprova.',
        );
        this.loadingMore.set(false);
      },
    });
  }
}
