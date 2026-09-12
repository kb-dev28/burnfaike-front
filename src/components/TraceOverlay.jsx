import { useEffect, useRef } from 'react';
import { paintStatic } from '../lib/dither';

/* Research in flight takes the whole screen: the dither at full saturation,
 * with the rounds and the queries set over it in a solid ink slab.
 *
 * The text is not decoration on top of the effect — §9 says the dither can
 * never carry meaning on its own, and this is the product's first principle
 * anyway: the process is visible, nothing hides behind a single answer.
 */
export default function TraceOverlay({ claim, rounds, visible }) {
  const canvasRef = useRef(null);
  const current = rounds[Math.min(visible, rounds.length - 1)];

  /* The field owns the viewport while it is up. */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let raf;
    let last = 0;
    const start = performance.now();
    const FRAME = 1000 / 12;

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME) return;
      last = now;
      paintStatic(canvas, { time: (now - start) / 1000 });
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="overlay" role="status" aria-live="polite">
      <canvas ref={canvasRef} className="overlay__field" aria-hidden="true" />

      <div className="overlay__inner page">
        <div className="overlay__slab">
          <p className="t-label overlay__state">Tracing</p>
          <p className="t-claim overlay__claim">{claim}</p>

          <div className="overlay__round">
            <p className="overlay__round-id" aria-hidden="true">
              {current.id}
            </p>
            <ul className="overlay__queries">
              {current.queries.map((q) => (
                <li className="t-label overlay__query" key={q}>
                  {q}
                </li>
              ))}
            </ul>
          </div>

          <p className="t-meta overlay__count">
            Round {current.id.slice(1)} of {rounds.length}
          </p>
        </div>
      </div>
    </div>
  );
}
