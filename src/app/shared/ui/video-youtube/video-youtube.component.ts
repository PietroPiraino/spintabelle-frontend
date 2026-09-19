import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { IconComponent } from '../icon/icon.component';

/**
 * La facciata del video YouTube: **copertina nostra → clic → player**.
 *
 * ⚠️⚠️ **QUESTO COMPONENTE È LA CONDOTTA SU CUI POGGIA UN TESTO PUBBLICATO.**
 * L'iframe di YouTube archivia informazioni nel terminale, quindi l'art. 122
 * Codice Privacy si applica; l'esimente che invochiamo è quella del «servizio
 * esplicitamente richiesto», e regge **solo** perché prima del clic non esiste
 * alcun iframe e non parte alcuna richiesta verso Google. Montare il player al
 * caricamento della pagina non romperebbe una funzione: farebbe **saltare la
 * valutazione** (`gdpr/valutazione-analytics.md` §10.2 e la condizione 17),
 * e renderebbe false due frasi pubblicate in cookie policy e informativa.
 *
 * ⚠️ Per la stessa ragione **la copertina arriva dal NOSTRO CDN** e mai da
 * `i.ytimg.com`: servirla da lì farebbe contattare un server di Google a ogni
 * visitatore della home *senza alcuna azione* (§10.3). Il backend la ri-ospita,
 * e rifiuta di approvare un video la cui copertina non ce l'abbia fatta.
 *
 * ⚠️ **Il clic NON è consenso** ex art. 7 GDPR: è una richiesta esplicita del
 * servizio. **Mai scrivere «acconsenti cliccando»** in nessuna etichetta.
 *
 * ⚠️ **Un solo punto di montaggio, ed è esso stesso una garanzia**: due copie
 * sarebbero due punti da tenere allineati, e la spec che verifica «nessun
 * iframe prima del clic» ne guarderebbe uno solo. È la stessa ragione scritta
 * accanto all'`<ng-template #media>` delle lezioni.
 */
@Component({
  selector: 'app-video-youtube',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="vy">
      @if (riproduci() && urlEmbed(); as src) {
        <iframe
          class="vy__frame"
          [src]="src"
          [title]="video().titolo"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin"
        ></iframe>
      } @else {
        <button type="button" class="vy__poster" (click)="avvia()">
          @if (video().miniaturaUrl) {
            <img
              class="vy__thumb"
              [src]="video().miniaturaUrl"
              alt=""
              width="1280"
              height="720"
              loading="lazy"
              decoding="async"
            />
          }
          <span class="vy__play" aria-hidden="true">
            <app-icon name="play" [size]="28" />
          </span>
          <!--
            ⚠️ Il nome accessibile NOMINA il video e dice dove si apre. Un
            «Play» generico, su una pagina che ha altri comandi, non dice a chi
            naviga con uno screen reader che cosa sta per partire.
          -->
          <span class="visually-hidden">
            Guarda «{{ video().titolo }}» — il video si apre qui nella pagina
          </span>
        </button>
      }
    </div>
  `,
  styles: [
    `
      .vy {
        position: relative;
        /* La scatola è riservata PRIMA che arrivi qualunque immagine: è ciò
           che tiene il blocco a spostamento zero su una pagina con CLS 0. */
        aspect-ratio: 16 / 9;
        width: 100%;
        overflow: hidden;
        border-radius: var(--radius);
        background: var(--surface-2);
      }
      .vy__frame,
      .vy__poster {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: 0;
      }
      .vy__poster {
        display: grid;
        place-items: center;
        padding: 0;
        cursor: pointer;
        background: var(--surface-2);
      }
      .vy__thumb {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        /* ⚠️ "cover" non è cosmesi: ritaglia esattamente le bande nere di
           una copertina 4:3, che è il ripiego quando maxresdefault non
           esiste. Risolve nel CSS un problema che sul server costerebbe una
           dipendenza di manipolazione immagini.
           ⚠️ E dentro questa stringa di stili NON si scrivono backtick: sono
           gli stessi che la delimitano, e la chiuderebbero a meta' — l'errore
           che Angular riporta come "Failed to resolve styles at position 1". */
        object-fit: cover;
        display: block;
      }
      .vy__play {
        position: relative;
        display: grid;
        place-items: center;
        /* 64px: il bersaglio di tocco è abbondantemente sopra i 44 richiesti,
           e qui è anche l'affordance principale del blocco. */
        width: 64px;
        height: 64px;
        border-radius: 50%;
        color: var(--navy-900, #16223f);
        background: var(--gold-400, #f0c040);
        box-shadow: var(--shadow-pop, 0 8px 24px rgb(0 0 0 / 35%));
        transition: transform 140ms ease;
      }
      .vy__poster:hover .vy__play,
      .vy__poster:focus-visible .vy__play {
        transform: scale(1.08);
      }
      @media (prefers-reduced-motion: reduce) {
        .vy__play {
          transition: none;
        }
        .vy__poster:hover .vy__play,
        .vy__poster:focus-visible .vy__play {
          transform: none;
        }
      }
    `,
  ],
})
export class VideoYoutubeComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly video = input.required<{
    videoId: string;
    titolo: string;
    miniaturaUrl: string | null;
  }>();

  /** Diventa `true` solo per un clic dell'utente. Non c'è altra via. */
  protected readonly riproduci = signal(false);

  /**
   * ⚠️ **L'URL si costruisce dal solo `videoId`, validato**, e non si prende
   * intero dall'API. `bypassSecurityTrustResourceUrl` spegne il sanitizer di
   * Angular: concatenare una stringa del server dentro un URL poi *fidato* è
   * l'unico punto in cui una risposta corrotta diventerebbe un'iniezione.
   * (`app-bunny-player` prende l'URL intero: è un contratto più lasco
   * preesistente, **non va copiato qui**.)
   *
   * ⚠️ **`youtube-nocookie.com` e mai `youtube.com/embed`**: misurato il
   * 19/09/2026, il secondo pianta sei cookie — `VISITOR_INFO1_LIVE`,
   * `__Secure-YNID` e altri, in scadenza a marzo 2027 — **prima di qualunque
   * riproduzione**. Il primo, zero.
   *
   * `autoplay=1` è corretto e necessario: l'utente ha già cliccato una volta,
   * e senza gliene servirebbero due. ⚠️ `rel=0` **non toglie** i video
   * correlati (dal 2018 li limita allo stesso canale): non prometterlo nei
   * testi legali.
   */
  protected readonly urlEmbed = computed<SafeResourceUrl | null>(() => {
    const id = this.video().videoId ?? '';
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`,
    );
  });

  protected avvia(): void {
    this.riproduci.set(true);
  }
}
