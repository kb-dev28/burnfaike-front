import { useEffect, useRef, useState } from 'react';
import { paintBand, paintFootage } from '../lib/dither';

function useReducedMotion() {
  const ref = useRef(false);
  if (typeof window !== 'undefined') {
    ref.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return ref.current;
}

function useResize(canvasRef, onResize) {
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => onResize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [canvasRef, onResize]);
}

/* The Paranoia Meter band, and nothing else. The one orchestrated moment in
 * the product (§7): on a trace, it resolves from saturated noise down to its
 * final density over 900ms. Reduced motion renders the final state directly. */
export function DitherBand({ density, run, label, className = '', pixelSize = 3 }) {
  const canvasRef = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    if (reduced || !run) {
      paintBand(canvas, density, { pixelSize });
      return undefined;
    }

    let raf;
    const start = performance.now();
    const DURATION = 900;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / DURATION);
      // ease-out: fast collapse, slow settle
      const eased = 1 - Math.pow(1 - t, 3);
      paintBand(canvas, 1 - (1 - density) * eased, { pixelSize });
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [density, run, reduced, pixelSize]);

  useResize(
    canvasRef,
    // Repaint at the settled density; a resize mid-animation is not worth
    // re-running the reveal for.
    () => canvasRef.current && paintBand(canvasRef.current, density, { pixelSize }),
  );

  return <canvas ref={canvasRef} className={className} role="img" aria-label={label} />;
}

/* The hero's footage, converted by tools/footage-to-strip.mjs. */
function useFootage() {
  const [footage, setFootage] = useState(null);

  useEffect(() => {
    let live = true;
    const base = import.meta.env.BASE_URL;

    fetch(`${base}hero-strip.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no manifest'))))
      .then(
        (m) =>
          new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve({ ...m, image });
            image.onerror = () => reject(new Error('no sheet'));
            image.src = `${base}hero-strip.png`;
          }),
      )
      .then((f) => live && setFootage(f))
      /* No footage is a valid state, not an error to report. */
      .catch(() => {});

    return () => {
      live = false;
    };
  }, []);

  return footage;
}

/* The hero strip. Runs at 12fps — low frame rates are correct here. `noise`
 * mixes the field toward static, which is the loading state (§7). */
export function DitherStrip({ noise = 0, className = '', pixelSize = 3 }) {
  const canvasRef = useRef(null);
  const noiseRef = useRef(noise);
  const reduced = useReducedMotion();
  const footage = useFootage();

  noiseRef.current = noise;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    if (!footage) return undefined;

    const fps = footage.fps || 12;

    const paint = (time, n) =>
      paintFootage(canvas, {
        ...footage,
        frameWidth: footage.width,
        frame: Math.floor(time * fps),
        time,
        noise: n,
        pixelSize,
        anchorY: 0.41,
      });

    /* Reduced motion holds a single frame rather than running the loop. */
    if (reduced) {
      paint(0, 0);
      return undefined;
    }

    let raf;
    let last = 0;
    const start = performance.now();
    const FRAME = 1000 / fps;

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME) return;
      last = now;
      paint((now - start) / 1000, noiseRef.current);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, pixelSize, footage]);

  useResize(canvasRef, () => {
    const canvas = canvasRef.current;
    if (!canvas || !footage) return;
    paintFootage(canvas, {
      ...footage,
      frameWidth: footage.width,
      frame: 0,
      noise: noiseRef.current,
      pixelSize,
      anchorY: 0.41,
    });
  });

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
