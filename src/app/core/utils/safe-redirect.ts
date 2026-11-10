/**
 * Ripulisce la destinazione dopo l'accesso (login, registrazione, guard).
 *
 * ⚠️ `redirect` arriva dalla query string, cioè da un link che chiunque può
 * confezionare e mandare a un iscritto: portarlo dritto in `navigateByUrl` è un
 * **open redirect** — si atterra su un dominio altrui subito dopo aver messo la
 * password su una pagina nostra, che è il modo più economico per farsi credere.
 * Si accetta SOLO un percorso interno: **una** barra iniziale, e in ogni altro
 * caso si torna in home.
 *
 * I casi che sembrano percorsi e non lo sono:
 * - `//host` e `/\host`: URL protocol-relative — il secondo i browser lo
 *   normalizzano nel primo, quindi vanno rifiutati entrambi;
 * - `https://host`, `javascript:…`: schemi assoluti, non iniziano con `/`;
 * - un percorso con caratteri di controllo (tab, a capo): i browser li tolgono
 *   dall'URL, e ciò che resta può essere di nuovo `//host`.
 */
export function safeRedirect(raw: string | null | undefined): string {
  const target = (raw ?? '').trim();
  if (!target.startsWith('/')) return '/';
  if (/^\/[/\\]/.test(target)) return '/';
  if (target.includes('\\')) return '/';
  if (/[\u0000-\u001f\u007f]/.test(target)) return '/';
  return target;
}
