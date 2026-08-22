import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { News } from '../../../core/models/api.models';
import { stripMarkdown } from '../../../core/utils/strip-markdown';

/**
 * Lunghezza massima dell'anteprima: ~3 righe di card, cioè quanto il
 * `-webkit-line-clamp` mostra davvero.
 */
const EXCERPT_MAX = 200;

/** Taglia all'ultima parola intera prima del limite, senza mozzarla a metà. */
function troncaAlleParole(testo: string, max: number): string {
  if (testo.length <= max) return testo;
  const tagliato = testo.slice(0, max);
  const spazio = tagliato.lastIndexOf(' ');
  const base = spazio > max * 0.6 ? tagliato.slice(0, spazio) : tagliato;
  return `${base.replace(/[.,;:!?…]+$/, '')}…`;
}

@Component({
  selector: 'app-news-card',
  imports: [RouterLink, DatePipe],
  template: `
    <article class="card card--hover news-card">
      @if (immagine(); as img) {
        <!--
          ⚠️ Attributo alt vuoto di proposito: sia la foto sia la targa sono
          decorative in un elenco — la targa STAMPA il titolo, che l'h3 qui
          sotto ripete in testo. Un alt col titolo lo farebbe leggere due volte
          di fila a uno screen reader.
        -->
        <img
          class="news-card__cover"
          [class.news-card__cover--targa]="!news().coverImageUrl"
          [src]="img"
          alt=""
          loading="lazy"
        />
      }
      <div class="news-card__body">
        <time class="news-card__date" [attr.datetime]="news().createdAt">
          {{ news().createdAt | date: 'dd MMMM yyyy' }}
        </time>
        <h3 class="news-card__title">
          <a [routerLink]="['/news', news()._id]">{{ news().title }}</a>
        </h3>
        <p class="news-card__excerpt">{{ excerpt() }}</p>
        <a [routerLink]="['/news', news()._id]" class="btn btn--link">Leggi tutto →</a>
      </div>
    </article>
  `,
  styles: `
    .news-card {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      height: 100%;
    }

    .news-card__cover {
      width: 100%;
      aspect-ratio: 21 / 9;
      object-fit: cover;
      border-bottom: 1px solid var(--line);
    }

    /*
      ⚠️ La targa ha una scatola SUA, e non è una rifinitura: è 16:9 (1200×675)
      mentre quella delle foto è 21:9, quindi object-fit: cover la
      ritaglierebbe di 81px sopra e 80px sotto — MISURATO simulando il ritaglio
      sul file vero, non stimato — e la prima cosa che sparisce è la scritta
      «BEST FISH FOREVER» in cima. Qui la scatola combacia con l'immagine e non
      si taglia niente.

      Il prezzo, accettato: in un elenco misto una card con la targa è un filo
      più alta di una con la foto. Le foto sono i tre articoli storici, la targa
      è tutto ciò che si pubblica da qui in avanti — quindi la disuniformità è
      transitoria, mentre un marchio decapitato non lo sarebbe.
    */
    .news-card__cover--targa {
      aspect-ratio: 16 / 9;
    }

    .news-card__body {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      padding: 1.3rem 1.4rem 1.4rem;
      flex: 1;
    }

    .news-card__date {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--copper-400);
    }

    .news-card__title {
      font-size: 1.2rem;

      a {
        color: var(--cream-100);

        &:hover {
          color: var(--ember);
        }
      }
    }

    .news-card__excerpt {
      font-size: 0.93rem;
      color: var(--text-muted);
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .btn--link {
      margin-top: auto;
      align-self: flex-start;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsCardComponent {
  readonly news = input.required<News>();

  /**
   * L'immagine della card: la FOTO se c'è, altrimenti la targa social.
   *
   * ⚠️ **L'ordine è l'OPPOSTO di quello dell'`og:image`** (`ogImageUrl ||
   * coverImageUrl`, vedi `News.ogImageUrl`), e la divergenza è una decisione,
   * non una svista. In un'anteprima di chat la targa vince perché stampa il
   * titolo *dentro* l'immagine, che è l'unica cosa che si vede scorrendo una
   * conversazione; in un elenco il titolo è già scritto due centimetri sotto,
   * quindi una foto vera dice qualcosa che la targa non può dire.
   *
   * ⚠️ `||` e non `??`, per la stessa ragione scritta su `News.ogImageUrl`: lo
   * schema ha `trim: true`, quindi entrambi i campi possono arrivare **stringa
   * vuota**, e con `??` una stringa vuota vincerebbe — cioè una card con un
   * `<img>` senza sorgente al posto della targa che c'è.
   */
  protected readonly immagine = computed(
    () => this.news().coverImageUrl || this.news().ogImageUrl || '',
  );

  /**
   * Anteprima in chiaro e TRONCATA.
   * ⚠️ Il troncamento è nel DOM, non solo nel CSS. Prima qui finiva il corpo
   * INTERO dell'articolo, ritagliato a 3 righe da `-webkit-line-clamp`: una
   * clip visiva non nasconde niente a un crawler, che legge il nodo di testo
   * per intero. Misurato sull'HTML prerenderizzato: 1.562 parole di articoli
   * dentro la home, invisibili a schermo. E poiché questa card è usata dalla
   * home E da /news, il testo di ogni articolo esisteva su TRE URL — home,
   * indice news e pagina dell'articolo — cioè lo stesso contenuto duplicato
   * tre volte sul dominio che deve posizionarsi.
   */
  protected readonly excerpt = computed(() =>
    troncaAlleParole(stripMarkdown(this.news().body), EXCERPT_MAX),
  );
}
