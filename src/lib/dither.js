/* The dither system — design-system.md §4.
 *
 * Everything drawn here is 1-bit. A grayscale field is built off-screen, then
 * hard-thresholded through a repeating 8x8 Bayer matrix into exactly two
 * colors. There is no anti-aliasing and no third value: midtones exist only in
 * the source buffer, never on screen. Upscaling is nearest-neighbour, so the
 * dither reads as a coarse print screen rather than a soft grain.
 */

export const BAYER_8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

const INK = [0x0d, 0x0d, 0x0d];
const SIGNAL = [0xc6, 0xf0, 0x31];
const PAPER = [0xed, 0xed, 0xe5];

const PALETTES = {
  signal: { off: INK, on: SIGNAL },
  paper: { off: INK, on: PAPER },
  inverted: { off: PAPER, on: INK },
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* Deterministic per-pixel hash in 0..1. Used both as white noise and as the
 * lattice for the value noise below. */
function hash2(x, y, seed) {
  const v = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

const smooth = (t) => t * t * (3 - 2 * t);

/* Smooth value noise, so a band of one density breaks up like a photograph
 * instead of tiling like wallpaper. Mean stays at 0.5, so average coverage
 * still equals the density it modulates. */
function valueNoise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

/* One scratch canvas per visible canvas, kept at low resolution. */
const scratch = new WeakMap();

function getScratch(canvas, w, h) {
  let s = scratch.get(canvas);
  if (!s) {
    s = { el: document.createElement('canvas'), ctx: null };
    s.ctx = s.el.getContext('2d', { willReadFrequently: true });
    scratch.set(canvas, s);
  }
  if (s.el.width !== w || s.el.height !== h) {
    s.el.width = w;
    s.el.height = h;
  }
  return s;
}

/* Size the visible canvas to its CSS box at device resolution. Returns the
 * low-resolution grid the dither is computed on. */
export function fitCanvas(canvas, pixelSize) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const deviceW = Math.round(rect.width * dpr);
  const deviceH = Math.round(rect.height * dpr);
  if (canvas.width !== deviceW || canvas.height !== deviceH) {
    canvas.width = deviceW;
    canvas.height = deviceH;
  }
  return {
    w: Math.max(1, Math.ceil(rect.width / pixelSize)),
    h: Math.max(1, Math.ceil(rect.height / pixelSize)),
  };
}

/* Threshold a Float grayscale buffer and blit it, nearest-neighbour, to the
 * visible canvas. */
function blit(canvas, lum, w, h, palette) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { off, on } = PALETTES[palette] || PALETTES.signal;
  const s = getScratch(canvas, w, h);
  const img = s.ctx.createImageData(w, h);
  const px = img.data;

  for (let y = 0; y < h; y++) {
    const row = BAYER_8[y & 7];
    for (let x = 0; x < w; x++) {
      const threshold = (row[x & 7] + 0.5) / 64;
      const c = lum[y * w + x] > threshold ? on : off;
      const i = (y * w + x) * 4;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = 255;
    }
  }

  s.ctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(s.el, 0, 0, w, h, 0, 0, canvas.width, canvas.height);
}

/* A flat band at one density — the Paranoia Meter, and nothing else. */
export function paintBand(canvas, density, options = {}) {
  const { pixelSize = 3, seed = 7, palette = 'signal' } = options;
  const grid = fitCanvas(canvas, pixelSize);
  if (!grid) return;
  const { w, h } = grid;
  const lum = new Float32Array(w * h);
  const d = clamp01(density);
  /* Modulation collapses at both extremes: a nearly-clear band stays clear and
   * a saturated one stays saturated. */
  const amp = 0.3 * 4 * d * (1 - d);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = valueNoise(x / 9, y / 9, seed) - 0.5;
      const n2 = valueNoise(x / 3.5, y / 3.5, seed + 11) - 0.5;
      lum[y * w + x] = clamp01(d + (n * 0.7 + n2 * 0.3) * amp * 2);
    }
  }

  blit(canvas, lum, w, h, palette);
}

/* The hero: a chronophotographic strip. Each cell holds the same figure one
 * beat further into its stride, the way Muybridge laid frames side by side.
 * `noise` mixes the whole field toward static — that is the loading state.
 */
export function paintStrip(canvas, options = {}) {
  const {
    pixelSize = 3,
    time = 0,
    noise = 0,
    seed = 3,
    palette = 'signal',
    fade = true,
  } = options;

  const grid = fitCanvas(canvas, pixelSize);
  if (!grid) return;
  const { w, h } = grid;
  const s = getScratch(canvas, w, h);
  const ctx = s.ctx;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  /* Frame count follows the aspect ratio, so the strip stays a strip: a wide
   * band gets more frames rather than bigger figures. */
  const cells = Math.max(3, Math.min(9, Math.round(w / (h * 0.55))));
  const cellW = w / cells;
  const scale = Math.min(h * 0.88, cellW * 1.4);
  const baseY = h * 0.99;

  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, scale * 0.075);

  for (let i = 0; i < cells; i++) {
    const phase = (time * 0.55 + i / cells) % 1;
    const a = phase * Math.PI * 2;
    const cx = cellW * (i + 0.5);
    const bob = Math.sin(a * 2) * scale * 0.04;
    const hip = baseY - scale * 0.46 + bob;
    const shoulder = hip - scale * 0.34;
    const headR = scale * 0.09;

    ctx.globalAlpha = 0.5 + 0.5 * (i / Math.max(1, cells - 1));

    // head
    ctx.beginPath();
    ctx.arc(cx + scale * 0.05, shoulder - headR * 1.5, headR, 0, Math.PI * 2);
    ctx.fill();

    // spine
    ctx.beginPath();
    ctx.moveTo(cx + scale * 0.05, shoulder);
    ctx.lineTo(cx, hip);
    ctx.stroke();

    // legs, counter-swinging
    for (const dir of [1, -1]) {
      const swing = Math.sin(a) * dir;
      const knee = [cx + swing * scale * 0.26, hip + scale * 0.26];
      ctx.beginPath();
      ctx.moveTo(cx, hip);
      ctx.lineTo(knee[0], knee[1]);
      ctx.lineTo(knee[0] + swing * scale * 0.12, baseY);
      ctx.stroke();
    }

    // arms, opposite the legs
    for (const dir of [1, -1]) {
      const swing = -Math.sin(a) * dir;
      const elbow = [cx + scale * 0.05 + swing * scale * 0.2, shoulder + scale * 0.18];
      ctx.beginPath();
      ctx.moveTo(cx + scale * 0.05, shoulder);
      ctx.lineTo(elbow[0], elbow[1]);
      ctx.lineTo(elbow[0] + swing * scale * 0.14, elbow[1] + scale * 0.16);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;

  const src = ctx.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  const n = clamp01(noise);
  const frame = Math.floor(time * 12);

  for (let y = 0; y < h; y++) {
    /* Cropped by the fold: the strip thins out at the top so it reads as
     * continuing off-screen rather than sitting in a box. */
    const falloff = fade ? clamp01((y / h - 0.06) / 0.38) : 1;
    for (let x = 0; x < w; x++) {
      /* Capped below 1: the accent stays a screen, never a solid fill. */
      const figure = Math.min(0.8, (src[(y * w + x) * 4] / 255) * falloff);
      const static_ = hash2(x, y, frame + seed);
      lum[y * w + x] = figure * (1 - n) + static_ * n;
    }
  }

  blit(canvas, lum, w, h, palette);
}
