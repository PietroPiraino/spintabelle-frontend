/**
 * Link social ufficiali di Best Fish Forever — unica fonte di verità.
 * Modifica un URL qui e si aggiorna ovunque (footer, landing, lezioni…).
 */
export const SOCIAL_LINKS = {
  youtube: 'https://www.youtube.com/@Best_Fish_Forever',
  /**
   * ⚠️ Campo a sé e non una concatenazione `${youtube}?sub_confirmation=1` nel
   * template: questo file si dichiara unica fonte di verità, e una
   * concatenazione è la cosa che deriva da un'altra.
   *
   * `sub_confirmation=1` è un **parametro di URL**, non uno script: apre
   * YouTube con la finestra di iscrizione già aperta, senza che nulla di
   * Google giri sulla nostra pagina. ⚠️ Il widget ufficiale «Iscriviti»
   * (`apis.google.com/js/platform.js`) **non si usa**: sarebbe uno script di
   * Google caricato senza clic, cioè esattamente ciò che la valutazione §10
   * esclude. ⚠️ Per la **campanella** non esiste alcun parametro, e nessuno
   * lo cerchi: è soltanto copy.
   */
  youtubeIscriviti:
    'https://www.youtube.com/@Best_Fish_Forever?sub_confirmation=1',
  discord: 'https://discord.gg/Cq7VUN6Kgc',
  instagram: 'https://www.instagram.com/bestfishforever/',
} as const;
