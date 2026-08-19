import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * `/policy-editoriale` — i quattro impegni pubblici della redazione: fonti,
 * uso dell'intelligenza artificiale (testo E immagini), procedura di
 * correzione, canale di rettifica/rimozione per chi e' nominato in un articolo.
 *
 * ⚠️ Regola di casa applicata a tutta la pagina: si promettono CONDOTTE, non
 * capacita'. Il testo descrive che cosa facciamo quando ricorre un caso — non
 * dichiara come gia' avvenuto cio' che ancora non e' avvenuto (es. la prima
 * illustrazione generata con IA). Cosi' la pagina non va riscritta il giorno in
 * cui quel caso si presenta, e nel frattempo non afferma nulla di falso.
 *
 * ⚠️ La procedura di correzione qui pubblicata e' il contrappeso della firma in
 * chiaro su `/redazione`: se smette di essere pubblicata, quella scelta va
 * ripresa da capo, non ereditata.
 *
 * ⚠️ PREREQUISITO DI P4, NATO QUI: il punto 1 promette che un articolo derivato
 * da fonti esterne ne pubblichi l'ELENCO IN FONDO. Oggi quell'elenco **non lo
 * rende nessuno dei due renderer** — ne' `news-detail.component.html` ne'
 * `functions/lib/render-news.mjs` — e i tre articoli storici non hanno
 * `sourceUrls` in banca dati (verificato sull'API pubblica il 19/08/2026). Per
 * questo la frase e' scritta «da questa policy in avanti» e il paragrafo
 * successivo dichiara apertamente che i pezzi piu' vecchi non lo portano: una
 * pagina legale non puo' descrivere un sito diverso da quello che il lettore ha
 * davanti. ⚠️ La resa dell'elenco (in ENTRAMBI i renderer, come byline e note di
 * rettifica) va fatta **prima** che la pipeline pubblichi il primo articolo
 * derivato, non dopo: da quel momento questa frase sarebbe falsa.
 */
@Component({
  selector: 'app-policy-editoriale',
  imports: [RouterLink],
  templateUrl: './policy-editoriale.component.html',
  styleUrl: './policy-editoriale.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolicyEditorialeComponent {
  // ⚠️ Da bumpare a ogni modifica del testo (idioma di PrivacyComponent).
  protected readonly aggiornata = '19 agosto 2026';
}
