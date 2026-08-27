// Costruisce un overlay HTML AUTONOMO (font + logo + CSS inline in base64).
// Uso: node build-overlay.mjs [inputHtml] [logoFile] [outName]
//   default: overlay.html logo-fish.png bff-live-overlay.html
// Se l'input contiene .stage/.mock (es. design-1.html), li rimuove per la consegna.
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = 'C:/Projects/poker-ranges';
const DIR = `${ROOT}/presentation/live-overlay`;
const IN = process.argv[2] ?? 'overlay.html';
const LOGO = process.argv[3] ?? 'logo-fish.png';
const OUT = process.argv[4] ?? 'bff-live-overlay.html';

const b64 = (p) => readFileSync(p).toString('base64');
const fontURI = (f) => `data:font/woff2;base64,${b64(`${ROOT}/frontend/public/fonts/${f}`)}`;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// --- brand.css: rimuovi commento di testata + inlina i font + togli le regole .mock ---
let brand = readFileSync(`${DIR}/brand.css`, 'utf8');
brand = brand.replace(/^﻿?\s*\/\*[\s\S]*?\*\//, '').trimStart();
for (const f of ['bricolage-grotesque-latin.woff2', 'instrument-sans-latin.woff2', 'spline-sans-mono-latin.woff2']) {
  brand = brand.replace(new RegExp(`url\\('file:[^']*${esc(f)}'\\)`, 'g'), `url('${fontURI(f)}')`);
}
brand = brand.replace(/\/\* =+[\s\S]*?\.mock__chat \.m\.e b\{color:var\(--orange\)\}/, '/* (regole mock rimosse: overlay autonomo) */');

// --- overlay html ---
let html = readFileSync(`${DIR}/${IN}`, 'utf8');
const hadStage = /<div class="stage"/.test(html);

html = html.replace(/<link rel="stylesheet" href="file:[^"]*brand\.css">/, `<style>\n${brand}\n</style>`);
const logoURI = `data:image/png;base64,${b64(`${ROOT}/frontend/public/${LOGO}`)}`;
html = html.replace(new RegExp(`src="file:[^"]*${esc(LOGO)}"`, 'g'), `src="${logoURI}"`);

// rimuovi il blocco MOCK e scarta il wrapper .stage (solo se presenti)
if (hadStage) {
  html = html.replace(/<!--[^\n]*MOCK[\s\S]*?(<div class="overlay">)/, '$1');
  html = html.replace(/<div class="stage"[^>]*>\s*/, '');
  html = html.replace(/<\/div>\s*<\/body>/, '</body>');
}

writeFileSync(`${DIR}/${OUT}`, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`OK ${OUT} (${kb} KB) da ${IN} — logo ${LOGO}${hadStage ? ', mock/stage rimossi' : ''}`);
