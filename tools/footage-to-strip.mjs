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
 *   --name NAME    output basename under public/ (default hero-strip)
 *   --crop x,y,w,h source-pixel region to keep, applied before the resize
 *
 * Display grade, written into the manifest and applied at render time — so it
 * can be retuned without re-encoding the sheet. Each source needs its own: a
 * curve that tames a bright subject filling the frame will crush a small one
 * sitting on black.
 *
 *   --out-gamma N  <1 lifts, >1 darkens (default 1.4)
 *   --out-gain N   overall multiplier (default 0.88)
 *   --out-ceiling N  hard cap, keeps the accent a screen not a fill (default 0.86)
 *   --out-zoom N   framing: >1 crops in on the subject (default 1)
 *
 *   --shots        sample one frame per detected shot instead of evenly. For
 *                  footage that cuts between subjects, even sampling drifts
 *                  across the cuts and lands on transitions.
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
const NAME = flag('name', 'hero-strip');
const CROP = flag('crop', null);
const SHOTS = has('shots');
const OUT_GAMMA = Number(flag('out-gamma', 1.4));
const OUT_GAIN = Number(flag('out-gain', 0.88));
const OUT_CEILING = Number(flag('out-ceiling', 0.86));
const OUT_ZOOM = Number(flag('out-zoom', 1));
const WIDTH = Number(flag('width', 320));
const OUT = flag('out', null);
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

let { width: srcW, height: srcH } = source;

/* Crop before anything else: these subjects sit in the middle of a tall frame,
 * and without a crop most of the sheet would be the black around them. */
if (CROP) {
  const [cx, cy, cw, ch] = CROP.split(',').map(Number);
  if ([cx, cy, cw, ch].some((v) => !Number.isFinite(v))) throw new Error('--crop wants x,y,w,h');
  if (cx < 0 || cy < 0 || cx + cw > srcW || cy + ch > srcH) throw new Error('--crop falls outside the frame');
  source.frames = source.frames.map((f) => {
    const out = new Float32Array(cw * ch);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) out[y * cw + x] = f[(cy + y) * srcW + cx + x];
    }
    return out;
  });
  srcW = cw;
  srcH = ch;
}
let pool = source.frames.slice(0, source.frames.length - TRIM);
if (!pool.length) throw new Error('no frames left after --trim');
if (PINGPONG && pool.length > 2) pool = pool.concat(pool.slice(1, -1).reverse());

/* Mean absolute difference between consecutive frames, sampled sparsely. A cut
 * shows up as a spike far above the run of ordinary motion. */
function shotStarts(frames) {
  const step = 16;
  const deltas = frames.slice(1).map((f, i) => {
    const prev = frames[i];
    let sum = 0;
    let n = 0;
    for (let p = 0; p < f.length; p += step) {
      sum += Math.abs(f[p] - prev[p]);
      n++;
    }
    return sum / n;
  });
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const sd = Math.sqrt(deltas.reduce((a, b) => a + (b - mean) ** 2, 0) / deltas.length);
  const threshold = mean + 2 * sd;
  const starts = [0];
  deltas.forEach((d, i) => {
    /* i is the boundary between frame i and i+1. Ignore a cut that lands within
     * two frames of the last one: that is a dissolve, not a new shot. */
    if (d > threshold && i + 1 - starts[starts.length - 1] > 2) starts.push(i + 1);
  });
  return starts;
}

let picked;
if (SHOTS) {
  const starts = shotStarts(pool);
  /* The middle frame of each shot, so a dissolve at either end is never the
   * frame that represents it. */
  picked = starts.map((start, i) => {
    const end = i + 1 < starts.length ? starts[i + 1] : pool.length;
    return pool[Math.floor((start + end - 1) / 2)];
  });
  if (picked.length > FRAMES) {
    picked = Array.from({ length: FRAMES }, (_, i) =>
      picked[Math.round((i * (picked.length - 1)) / (FRAMES - 1))]);
  }
  console.log(`  detected ${starts.length} shots, kept ${picked.length}`);
} else {
  /* Evenly sample down to the frame count we actually loop. Low frame rates are
   * correct here; smoothness is wrong. */
  const keep = Math.min(FRAMES, pool.length);
  picked = Array.from({ length: keep }, (_, i) =>
    pool[Math.round((i * (pool.length - 1)) / Math.max(1, keep - 1))]);
}

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

const outPath = OUT || `public/${NAME}.png`;
const encoded = PNG.sync.write(sheet, { colorType: 0 });
writeFileSync(outPath, encoded);
writeFileSync(
  join(dirname(outPath), `${NAME}.json`),
  JSON.stringify(
    {
      source: basename(input),
      width: WIDTH,
      frameHeight: outH,
      frames: picked.length,
      fps: FPS,
      gamma: OUT_GAMMA,
      gain: OUT_GAIN,
      ceiling: OUT_CEILING,
      zoom: OUT_ZOOM,
    },
    null,
    2,
  ) + '\n',
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
  `  -> ${outPath}  ${WIDTH}x${outH} x ${picked.length} frames, ${(encoded.length / 1024).toFixed(0)} kB\n` +
  `     luminance min ${min} / mean ${(sum / (check.width * check.height)).toFixed(1)} / max ${max}`,
);
