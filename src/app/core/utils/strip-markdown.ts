/**
 * Riduce testo Markdown a un paragrafo in chiaro, per l'anteprima delle card.
 *
 * Regex pure, NESSUNA dipendenza da `marked`: così la util resta nel bundle
 * main/landing e non trascina il chunk lazy del renderer (le card compaiono
 * anche in home, dove `marked` non deve mai arrivare).
 *
 * Il testo semplice (paragrafi con singoli a-capo) passa quasi invariato:
 * viene solo collassato il whitespace in spazi singoli, ideale per la card
 * che poi taglia a 3 righe via CSS.
 */
export function stripMarkdown(md: string): string {
  if (!md) return '';

  return (
    md
      // immagini ![alt](url) -> '' (prima dei link: sintassi simile)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      // link [testo](url) -> testo
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // blocchi di codice ``` ... ``` -> contenuto senza i backtick
      .replace(/```[^\n]*\n?([\s\S]*?)```/g, '$1')
      // codice inline `x` -> x
      .replace(/`([^`]+)`/g, '$1')
      // heading ATX a inizio riga: ## Titolo -> Titolo
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      // citazioni > a inizio riga
      .replace(/^\s{0,3}>\s?/gm, '')
      // regole orizzontali --- *** ___ su riga propria (prima dei bullet)
      .replace(/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/gm, '')
      // bullet di lista - * + a inizio riga
      .replace(/^\s{0,3}[-*+]\s+/gm, '')
      // liste numerate 1. 2) a inizio riga
      .replace(/^\s{0,3}\d+[.)]\s+/gm, '')
      // grassetto/corsivo: rimuovi i delimitatori tenendo il testo
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      // collassa ogni whitespace (inclusi a-capo) in spazi singoli
      .replace(/\s+/g, ' ')
      .trim()
  );
}
