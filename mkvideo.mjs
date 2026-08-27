// Monta un video verticale (9:16) MUTO da N frame PNG con crossfade. Tooling locale.
// Uso: node mkvideo.mjs <out.mp4> <T_crossfade_s> <img1> <dur1_s> <img2> <dur2_s> ...
// (per spot/quiz: l'owner aggiunge voce/audio dopo)
import { execFileSync } from 'node:child_process';
const ff = 'C:/Projects/poker-ranges/frontend/node_modules/ffmpeg-static/ffmpeg.exe';

const out = process.argv[2];
const T = Number(process.argv[3]);          // durata transizione (s)
const rest = process.argv.slice(4);
const imgs = [], durs = [];
for (let i = 0; i < rest.length; i += 2) { imgs.push(rest[i]); durs.push(Number(rest[i + 1])); }
const n = imgs.length;

const args = [];
for (let i = 0; i < n; i++) args.push('-loop', '1', '-framerate', '30', '-t', String(durs[i]), '-i', imgs[i]);

// catena xfade
let filt = '';
let prev = '[0:v]';
let acc = durs[0];
for (let i = 1; i < n; i++) {
  const off = (acc - T).toFixed(3);
  const lbl = (i === n - 1) ? '[vx]' : `[v${i}]`;
  filt += `${prev}[${i}:v]xfade=transition=fade:duration=${T}:offset=${off}${lbl};`;
  prev = lbl;
  acc += durs[i] - T;
}
filt += `[vx]fps=30,format=yuv420p,scale=1080:1920[v]`;

args.push('-filter_complex', filt, '-map', '[v]', '-r', '30', '-movflags', '+faststart', '-y', out);
execFileSync(ff, args, { stdio: ['ignore', 'ignore', 'inherit'] });
console.log('OK', out, '·', n, 'frame ·', acc.toFixed(1) + 's');
