// Parser + matcher delle regole Cloudflare `_redirects`.
// Funzione pura, testabile: e' il pezzo che decide "questa URL viene catturata
// da una regola?" — se sbaglia, tutto il controllo passa per il motivo sbagliato.

export function parseRedirects(text) {
  const rules = [];
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const [from, to, status] = line.split(/\s+/);
    if (!from || !to)
      throw new Error(`_redirects riga ${i + 1}: regola malformata: "${line}"`);
    rules.push({ from, to, status: status ?? '', line: i + 1 });
  });
  return rules;
}

// Semantica Cloudflare: match esatto, oppure splat `/*` finale che cattura
// qualsiasi coda (anche con `/`).
export function ruleMatches(from, url) {
  if (from.endsWith('/*')) {
    const prefix = from.slice(0, -2);
    return url === prefix || url.startsWith(prefix + '/');
  }
  return from === url;
}

export function findMatch(rules, url) {
  return rules.find((r) => ruleMatches(r.from, url)) ?? null;
}

// Invarianti su una singola regola: i tre modi in cui questo file ha gia' fatto
// danno. Pure (regola -> problema|null) per essere testabili: sono le uniche
// regole di cui NON possiamo permetterci un falso "va tutto bene".
export function lintRule(rule) {
  if (rule.from === '/*' || rule.from === '/**')
    return (
      `catch-all \`${rule.from}\`: le regole di _redirects sono valutate PRIMA ` +
      `degli asset statici, quindi cattura anche il proprio target e ogni file ` +
      `-> sito giu'. Elenca le rotte una per una.`
    );
  if (/\.html$/.test(rule.to))
    return (
      `target \`${rule.to}\` con \`.html\`: Cloudflare toglie l'estensione e ` +
      `risponde 308 verso \`${rule.to.replace(/\.html$/, '')}\`, che rimatcha la ` +
      `regola -> LOOP di redirect (incidente del 12/07/2026). Togli il \`.html\`.`
    );
  if (rule.status !== '200')
    return (
      `status \`${rule.status || '(assente)'}\`: serve \`200\` (rewrite: stessa ` +
      `URL, contenuto della shell). Qualsiasi altro status manda il browser ` +
      `altrove invece di servire la SPA.`
    );
  return null;
}

export function lintRules(rules) {
  return rules
    .map((r) => ({ rule: r, problema: lintRule(r) }))
    .filter((x) => x.problema !== null);
}

// Una rotta Angular (`live/:id/stanza`) -> URL concreta di esempio, per poter
// chiedere al matcher "Cloudflare cosa servirebbe qui?".
export function sampleUrl(routePattern) {
  const parts = routePattern
    .split('/')
    .map((s) => (s.startsWith(':') ? '__esempio__' : s));
  return '/' + parts.join('/').replace(/^\/+/, '');
}

// La rotta `news/:id` "copre" l'URL prerenderizzata `/news/abc`?
export function routeCoversUrl(routePattern, url) {
  const rx = new RegExp(
    '^/' +
      routePattern
        .split('/')
        .map((s) => (s.startsWith(':') ? '[^/]+' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
        .join('/')
        .replace(/^\/+/, '') +
      '/?$',
  );
  return rx.test(url);
}
