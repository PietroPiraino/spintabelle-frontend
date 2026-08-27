import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Le tre carte che saltellano nella testata — l'ornamento del modello /tabelle,
 * promosso a componente il 28/08/2026 quando l'owner ha deciso che quel modello
 * vale per tutte le sezioni.
 *
 * ⚠️ Le carte sono FISSE: A♣ 7♣ 4♣, la mano del marchio — la stessa del logo,
 * del boot-loader in `index.html` e dell'hero 3D della home. Non è un input di
 * proposito: se ogni pagina scegliesse le sue, i semi finirebbero nei `.ts`
 * delle pagine consumatrici e ognuna dovrebbe entrare nell'elenco `AMMESSI`
 * di `scripts/lib/semi-nudi.test.mjs` — un elenco che cresce è una guardia che
 * si allenta. Così i semi vivono in UN file, con UNA voce in quell'elenco.
 *
 * ⚠️ Qui i semi sono CONTENUTO (una carta da gioco ha un seme, e si scrive come
 * si scrive), non ornamento tipografico: è il caso che la guardia ammette.
 *
 * Gli stili sono GLOBALI (`.hero-cards` in `styles/_utilities.scss`), non del
 * componente: la resa dell'edge di /news emette lo stesso markup come `<span>`
 * nudi (`functions/lib/render-news.mjs`), e l'incapsulamento Angular legherebbe
 * le regole a un attributo che quell'HTML non ha — la lezione di `_prose.scss`
 * e `_news-share.scss`.
 */
@Component({
  selector: 'app-hero-cards',
  host: { 'aria-hidden': 'true', class: 'hero-cards' },
  template: `
    <span class="hero-cards__card hero-cards__card--1">A♣</span>
    <span class="hero-cards__card hero-cards__card--2">7♣</span>
    <span class="hero-cards__card hero-cards__card--3">4♣</span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroCardsComponent {}
