// Estrae la lista piatta delle rotte da app.routes.ts leggendo l'AST TypeScript
// (non una regex). Non esegue nulla: legge solo i letterali `path` e la
// nidificazione `children`.
//
// REGOLA D'ORO: se incontra qualcosa che non capisce (un `path` che non e' un
// letterale stringa, uno spread, un array non letterale) NON tira a indovinare
// e NON salta: LANCIA. Un parser che salta in silenzio e' il modo in cui questo
// controllo passerebbe per il motivo sbagliato.

import { readFileSync } from 'node:fs';
import ts from 'typescript';

export function readRoutes(file) {
  const src = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );

  // Trova `export const routes: Routes = [...]`
  let arr = null;
  for (const stmt of src.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const d of stmt.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.name.text === 'routes') arr = d.initializer;
    }
  }
  if (!arr || !ts.isArrayLiteralExpression(arr))
    throw new Error('app.routes.ts: non trovo `export const routes = [...]`');

  const out = [];
  walk(arr, '', out, file);
  return out;
}

function walk(arrayLit, prefix, out, file) {
  for (const el of arrayLit.elements) {
    if (!ts.isObjectLiteralExpression(el))
      throw new Error(
        `${file}: elemento di rotta non riconosciuto (spread? variabile?) a riga ` +
          `${line(el)} — il controllo rotte si rifiuta di indovinare.`,
      );

    let path = null;
    let children = null;
    for (const p of el.properties) {
      if (!ts.isPropertyAssignment(p) || !ts.isIdentifier(p.name)) continue;
      if (p.name.text === 'path') {
        if (!ts.isStringLiteral(p.initializer))
          throw new Error(
            `${file}: \`path\` non e' un letterale stringa a riga ${line(p)} — ` +
              `il controllo rotte si rifiuta di indovinare.`,
          );
        path = p.initializer.text;
      }
      if (p.name.text === 'children') {
        if (!ts.isArrayLiteralExpression(p.initializer))
          throw new Error(`${file}: \`children\` non e' un array letterale a riga ${line(p)}`);
        children = p.initializer;
      }
    }
    if (path === null)
      throw new Error(`${file}: oggetto rotta senza \`path\` a riga ${line(el)}`);

    const full = join(prefix, path);
    if (children) walk(children, full, out, file);
    else out.push(full);
  }

  function line(n) {
    return n.getSourceFile().getLineAndCharacterOfPosition(n.getStart()).line + 1;
  }
}

function join(prefix, path) {
  if (!prefix) return path;
  if (!path) return prefix;
  return `${prefix}/${path}`;
}
