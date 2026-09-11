import { DitherBand } from './DitherCanvas';

/* §6 — a dither band, the score overlapping its left edge, one line of label
 * beneath. No gauge, no needle, no arc, no colored bar. The density is never
 * the sole carrier of the score: the number and the label sit beside it. */
export default function ParanoiaMeter({ score, label, run }) {
  const density = score / 100;

  return (
    <section className="meter" aria-labelledby="meter-head">
      <div className="page">
        <h2 className="t-label meter__head" id="meter-head">
          Paranoia meter
        </h2>
      </div>

      <div className="meter__band-wrap">
        <DitherBand
          className="meter__band"
          density={density}
          run={run}
          label={`Dither band at ${score} percent density, representing the paranoia score of ${score} out of 100.`}
        />
        <p className="meter__score" aria-hidden="true">
          {score}
        </p>
      </div>

      <div className="page">
        <p className="t-label meter__label">{label}</p>
      </div>
    </section>
  );
}
