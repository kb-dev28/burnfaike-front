/* Turn real footage into the hero's source frames.
 *
 * design-system.md §4 asks for frames extracted, reduced, and reassembled at a
 * low frame rate. This script does the extraction and reduction only: it emits
 * a GRAYSCALE sprite sheet, not a dithered one. The 1-bit threshold happens at
 * runtime (src/lib/dither.js), because the loading state mixes static into the
 * source field *before* the error diffusion runs — pre-dithered frames would
 * leave nothing to mix into.
 *
 *   node tools/footage-to-strip.mjs source/eye.mp4 [options]
 *
 * Accepts a .gif, a video (.mp4/.mov/.webm/.m4v — needs ffmpeg on PATH or in
 * $FFMPEG), or a directory of numbered .png frames.
 *
 *   --frames N     frames to keep, evenly sampled (default 12)
 *   --fps N        playback rate written into the manifest (default 12)
 *   --width N      output width in px (default 320)
 *   --out PATH     sprite sheet path (default public/hero-strip.png)
 *   --levels lo,hi black/white points in 0-255, stretched to full range
 *   --gamma N      applied after levels; >1 lifts midtones (default 1)
 *   --invert       flip light and dark
 *   --trim N       drop N frames from the end
 *   --pingpong     append the sequence in reverse, for footage that does not
 *                  loop cleanly on its own
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join } from 'node:path';
import { GifReader } from 'omggif';
import { PNG } from 'pngjs';

const argv = process.argv.slice(2);
const input = argv.find((a) => !a.startsWith('--'));
if (!input) {
  console.error('usage: node tools/footage-to-strip.mjs <file.gif|file.mp4|frames/> [--frames 12] [--width 320] ...');
  process.exit(1);
}

const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const has = (name) => argv.includes(`--${name}`);

const FRAMES = Number(flag('frames', 12));
const FPS = Number(flag('fps', 12));
const WIDTH = Number(flag('width', 320));
const OUT = flag('out', 'public/hero-strip.png');
const GAMMA = Number(flag('gamma', 1));
const TRIM = Number(flag('trim', 0));
const INVERT = has('invert');
const PINGPONG = has('pingpong');
const [LO, HI] = String(flag('levels', '0,255')).split(',').map(Number);

const VIDEO = new Set(['.mp4', '.mov', '.webm', '.m4v', '.mkv']);

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try {
    return execFileSync('sh', ['-c', 'command -v ffmpeg']).toString().trim();
  } catch {
    /* imageio-ffmpeg ships a static build; it is the usual way to get one in a
     * container that has python but no system ffmpeg. */
    try {
      return execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'])
        .toString().trim();
    } catch {
      throw new Error('no ffmpeg found — set $FFMPEG, or `pip install imageio-ffmpeg`');
    }
  }
}

/* Every loader returns { width, height, frames: [Float32Array of luminance] } */

function loadGif(file) {
  const reader = new GifReader(readFileSync(file));
  const { width, height } = reader;
  /* One persistent buffer, so disposal methods and partial frames resolve the
   * way a player would show them. */
  const canvas = new Uint8Array(width * height * 4);
  const frames = [];
  for (let i = 0; i < reader.numFrames(); i++) {
    reader.decodeAndBlitFrameRGBA(i, canvas);
    frames.push(luminance(canvas, width * height));
  }
  return { width, height, frames };
}

function loadPngDir(dir) {
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png')).sort();
  if (!files.length) throw new Error(`no .png frames in ${dir}`);
  let width = 0;
  let height = 0;
  const frames = files.map((f) => {
    const png = PNG.sync.read(readFileSync(join(dir, f)));
    width = png.width;
    height = png.height;
    return luminance(png.data, png.width * png.height);
  });
  return { width, height, frames };
}

function loadVideo(file) {
  const ff = ffmpegPath();
  const dir = mkdtempSync(join(tmpdir(), 'footage-'));
  try {
    execFileSync(ff, ['-hide_banner', '-loglevel', 'error', '-i', file, join(dir, 'f%04d.png')]);
    return loadPngDir(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function luminance(rgba, pixels) {
  const g = new Float32Array(pixels);
  for (let p = 0; p < pixels; p++) {
    const o = p * 4;
    g[p] = 0.2126 * rgba[o] + 0.7152 * rgba[o + 1] + 0.0722 * rgba[o + 2];
  }
  return g;
}

const ext = extname(input).toLowerCase();
const source = statSync(input).isDirectory()
  ? loadPngDir(input)
  : ext === '.gif'
    ? loadGif(input)
    : VIDEO.has(ext)
      ? loadVideo(input)
      : (() => { throw new Error(`unsupported input: ${ext || input}`); })();

const { width: srcW, height: srcH } = source;
let pool = source.frames.slice(0, source.frames.length - TRIM);
if (!pool.length) throw new Error('no frames left after --trim');
if (PINGPONG && pool.length > 2) pool = pool.concat(pool.slice(1, -1).reverse());

/* Evenly sample down to the frame count we actually loop. Low frame rates are
 * correct here; smoothness is wrong. */
const keep = Math.min(FRAMES, pool.length);
const picked = Array.from({ length: keep }, (_, i) =>
  pool[Math.round((i * (pool.length - 1)) / Math.max(1, keep - 1))]);

const outH = Math.max(1, Math.round(srcH * (WIDTH / srcW)));

/* Box filter: every source pixel contributes, so fine detail survives the
 * reduction instead of dropping out between samples. */
function resize(src) {
  const dst = new Float32Array(WIDTH * outH);
  for (let y = 0; y < outH; y++) {
    const y0 = Math.floor((y * srcH) / outH);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * srcH) / outH));
    for (let x = 0; x < WIDTH; x++) {
      const x0 = Math.floor((x * srcW) / WIDTH);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * srcW) / WIDTH));
      let sum = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          sum += src[sy * srcW + sx];
          n++;
        }
      }
      dst[y * WIDTH + x] = sum / n;
    }
  }
  return dst;
}

const span = Math.max(1, HI - LO);
const grade = (v) => {
  let t = Math.min(1, Math.max(0, (v - LO) / span));
  if (GAMMA !== 1) t = Math.pow(t, 1 / GAMMA);
  return INVERT ? 1 - t : t;
};

/* pngjs always holds its pixels as RGBA internally, whatever the file's colour
 * type ends up being — so fill all four channels and let the encoder reduce to
 * grayscale on write. */
const sheet = new PNG({ width: WIDTH, height: outH * picked.length });

picked.forEach((frame, i) => {
  const resized = resize(frame);
  const base = i * outH * WIDTH;
  for (let p = 0; p < resized.length; p++) {
    const v = Math.round(grade(resized[p]) * 255);
    const o = (base + p) * 4;
    sheet.data[o] = v;
    sheet.data[o + 1] = v;
    sheet.data[o + 2] = v;
    sheet.data[o + 3] = 255;
  }
});

const encoded = PNG.sync.write(sheet, { colorType: 0 });
writeFileSync(OUT, encoded);
writeFileSync(
  join(dirname(OUT), 'hero-strip.json'),
  JSON.stringify({ source: basename(input), width: WIDTH, frameHeight: outH, frames: picked.length, fps: FPS }, null, 2) + '\n',
);

/* Decode what was just written and report its actual tonal range — a sheet that
 * comes back flat or crushed means the grade needs adjusting, and it is cheaper
 * to see that here than in the browser. */
const check = PNG.sync.read(encoded);
let sum = 0;
let min = 255;
let max = 0;
for (let p = 0; p < check.width * check.height; p++) {
  const v = check.data[p * 4];
  sum += v;
  if (v < min) min = v;
  if (v > max) max = v;
}

console.log(
  `${basename(input)}: ${srcW}x${srcH}, ${source.frames.length} frames\n` +
  `  -> ${OUT}  ${WIDTH}x${outH} x ${picked.length} frames, ${(encoded.length / 1024).toFixed(0)} kB\n` +
  `     luminance min ${min} / mean ${(sum / (check.width * check.height)).toFixed(1)} / max ${max}`,
);
