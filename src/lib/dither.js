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

/* Paint an already-thresholded 1-bit field, nearest-neighbour, to the visible
 * canvas. Nothing downstream of here can reintroduce a midtone. */
function blitBits(canvas, bits, w, h, palette) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { off, on } = PALETTES[palette] || PALETTES.signal;
  const s = getScratch(canvas, w, h);
  const img = s.ctx.createImageData(w, h);
  const px = img.data;

  for (let p = 0; p < w * h; p++) {
    const c = bits[p] ? on : off;
    const i = p * 4;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  }

  s.ctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(s.el, 0, 0, w, h, 0, 0, canvas.width, canvas.height);
}

/* Ordered dither: the Bayer matrix is the right tool where the density itself
 * is the message, because coverage tracks the input value exactly. */
function blit(canvas, lum, w, h, palette) {
  const bits = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = BAYER_8[y & 7];
    for (let x = 0; x < w; x++) {
      bits[y * w + x] = lum[y * w + x] > (row[x & 7] + 0.5) / 64 ? 1 : 0;
    }
  }
  blitBits(canvas, bits, w, h, palette);
}

/* Floyd-Steinberg error diffusion, serpentine. This is what §4 specifies for
 * imagery: the quantisation error of each pixel is pushed into its unvisited
 * neighbours, so a photographic source keeps its tonal structure at one bit.
 * Destructive — `lum` is consumed. */
function diffuse(lum, w, h) {
  const bits = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const ltr = (y & 1) === 0;
    const step = ltr ? 1 : -1;
    for (let i = 0; i < w; i++) {
      const x = ltr ? i : w - 1 - i;
      const idx = y * w + x;
      const old = lum[idx];
      const next = old > 0.5 ? 1 : 0;
      bits[idx] = next;
      const err = old - next;
      const ahead = x + step;
      const behind = x - step;
      if (ahead >= 0 && ahead < w) lum[idx + step] += err * 0.4375;
      if (y + 1 < h) {
        const below = (y + 1) * w;
        if (behind >= 0 && behind < w) lum[below + behind] += err * 0.1875;
        lum[below + x] += err * 0.3125;
        if (ahead >= 0 && ahead < w) lum[below + ahead] += err * 0.0625;
      }
    }
  }
  return bits;
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

export function paintFootage(canvas, options = {}) {
  const {
    image,
    frameWidth,
    frameHeight,
    frames,
    frame = 0,
    time = 0,
    noise = 0,
    pixelSize = 3,
    fade = true,
    palette = 'signal',
    seed = 3,
    cells,
    zoom = 1,
    /* Where the subject's centre sits in the band, 0 = top, 1 = bottom. The
     * band runs past the fold, so centring on 0.5 would bury the part of the
     * frame that carries the motion. */
    anchorY = 0.5,
    /* Photographic highlights would dither out as a flat lime field, which is
     * the one thing §10 says kills the system. The curve pulls the top end
     * down so the brightest area still reads as a screen, and it is a curve
     * rather than a clamp so the shading inside it survives. */
    gamma = 1.4,
    gain = 0.88,
    ceiling = 0.86,
  } = options;

  const grid = fitCanvas(canvas, pixelSize);
  if (!grid) return;
  const { w, h } = grid;
  const s = getScratch(canvas, w, h);
  const ctx = s.ctx;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  /* Chronophotography: the band is divided into cells, and each cell holds the
   * same subject at a different moment of the loop, evenly spaced around it.
   * The whole row advances together, so the strip reads as one motion
   * decomposed rather than a row of copies. Cell count follows the source's
   * aspect ratio, so cells stay roughly as square as the footage. */
  const aspect = frameWidth / frameHeight;
  const count = Math.max(1, Math.min(9, cells || Math.round(w / (h * aspect))));
  const cellW = w / count;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  for (let i = 0; i < count; i++) {
    const index = (((frame + Math.round((i * frames) / count)) % frames) + frames) % frames;
    /* Cover-fit inside the cell: the overflow is cropped, never letterboxed. */
    const cover = Math.max(cellW / frameWidth, h / frameHeight) * zoom;
    const dw = frameWidth * cover;
    const dh = frameHeight * cover;

    ctx.save();
    ctx.beginPath();
    ctx.rect(i * cellW, 0, cellW, h);
    ctx.clip();
    ctx.drawImage(
      image,
      0, index * frameHeight, frameWidth, frameHeight,
      i * cellW + (cellW - dw) / 2, anchorY * h - dh / 2, dw, dh,
    );
    ctx.restore();
  }

  const src = ctx.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  const n = clamp01(noise);
  const staticSeed = Math.floor(time * 12) + seed;

  for (let y = 0; y < h; y++) {
    /* A short fade at the top edge only: the band is cropped by the fold at the
     * bottom, so it already continues off-screen there. */
    const falloff = fade ? clamp01((y / h) / 0.12) : 1;
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const value = Math.pow(src[p * 4] / 255, gamma) * gain * falloff;
      /* Static is mixed into the source field *before* the diffusion, which is
       * why the frames ship grayscale rather than pre-dithered. */
      lum[p] = Math.min(ceiling, value * (1 - n) + hash2(x, y, staticSeed) * n);
    }
  }

  blitBits(canvas, diffuse(lum, w, h), w, h, palette);
}

/* Pure static, full field. The loading state (§7): research in flight is shown
 * as the dither at full saturation rather than as a spinner.
 *
 * No error diffusion here — the source is already random, so diffusing it would
 * only cost time to produce the same distribution. The threshold is the whole
 * device.
 */
export function paintStatic(canvas, options = {}) {
  const { time = 0, density = 0.5, pixelSize = 3, palette = 'signal', seed = 5 } = options;

  const grid = fitCanvas(canvas, pixelSize);
  if (!grid) return;
  const { w, h } = grid;
  const bits = new Uint8Array(w * h);
  const frame = Math.floor(time * 12) + seed;
  const cut = 1 - clamp01(density);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      bits[y * w + x] = hash2(x, y, frame) > cut ? 1 : 0;
    }
  }

  blitBits(canvas, bits, w, h, palette);
}
