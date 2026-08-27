// Costruisce la guida-artifact HTML con font + immagini + logo inline in base64.
import { readFileSync, writeFileSync } from 'node:fs';
const ROOT = 'C:/Projects/poker-ranges';
const DIR = `${ROOT}/presentation/live-overlay`;
const b64 = (p) => readFileSync(p).toString('base64');
const font = (f) => `data:font/woff2;base64,${b64(`${ROOT}/frontend/public/fonts/${f}`)}`;
const png = (p) => `data:image/png;base64,${b64(p)}`;

const A = {
  DISP: font('bricolage-grotesque-latin.woff2'),
  BODY: font('instrument-sans-latin.woff2'),
  MONO: font('spline-sans-mono-latin.woff2'),
  LOGO: png(`${ROOT}/frontend/public/logo-fish.png`),
  PREVIEW: png(`${DIR}/out/preview-1.png`),
  FRAME: png(`${DIR}/out/overlay-1.png`),
  NOCHAT: png(`${DIR}/out/preview-nochat.png`),
  BRB: png(`${DIR}/out/brb.png`),
  STARTING: png(`${DIR}/out/starting-countdown.png`),
  NAGATO: png(`${DIR}/out/preview-nagato.png`),
  STINGER: png(`${DIR}/out/stinger/stinger-strip.png`),
  FACECAM: png(`${DIR}/out/facecam-preview-1.png`),
};

let tpl = readFileSync(`${ROOT}/frontend/_guide-template.html`, 'utf8');
// A prova di encoding: converti ogni carattere non-ASCII in entità numerica HTML
// (il template è tutto testo/markup; nessun unicode grezzo dentro <style>).
tpl = [...tpl].map((ch) => (ch.codePointAt(0) > 127 ? `&#${ch.codePointAt(0)};` : ch)).join('');
let html = tpl;
for (const [k, v] of Object.entries(A)) html = html.replaceAll(`__${k}__`, v);
writeFileSync(`${DIR}/guida-artifact.html`, html);
console.log(`OK guida-artifact.html (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`);
