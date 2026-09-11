import { useEffect, useRef } from 'react';
import { paintBand, paintStrip } from '../lib/dither';

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

/* The hero strip. Runs at 12fps — low frame rates are correct here. `noise`
 * mixes the field toward static, which is the loading state (§7). */
export function DitherStrip({ noise = 0, className = '', pixelSize = 3, label }) {
  const canvasRef = useRef(null);
  const noiseRef = useRef(noise);
  const reduced = useReducedMotion();

  noiseRef.current = noise;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    if (reduced) {
      paintStrip(canvas, { pixelSize, time: 0, noise: 0 });
      return undefined;
    }

    let raf;
    let last = 0;
    const start = performance.now();
    const FRAME = 1000 / 12;

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME) return;
      last = now;
      paintStrip(canvas, {
        pixelSize,
        time: (now - start) / 1000,
        noise: noiseRef.current,
      });
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, pixelSize]);

  useResize(
    canvasRef,
    () =>
      canvasRef.current &&
      paintStrip(canvasRef.current, { pixelSize, time: 0, noise: noiseRef.current }),
  );

  return <canvas ref={canvasRef} className={className} aria-hidden="true" data-label={label} />;
}
