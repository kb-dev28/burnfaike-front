import { useState } from 'react';
import { DitherPanel } from './DitherCanvas';
import { HERO_FOOTAGE } from '../data/hero';
import { EXAMPLE_CLAIM } from '../data/trace';

export default function Hero({ onTrace, busy }) {
  const [value, setValue] = useState('');

  const submit = (e) => {
    e.preventDefault();
    onTrace(value.trim() || EXAMPLE_CLAIM);
  };

  return (
    <header className="hero">
      <div className="hero__inner page">
        <p className="t-label hero__wordmark">
          Burn fAIke
          <span className="hero__wordmark-sep" aria-hidden="true">/</span>
          Rumor-tracing agent
        </p>

        <div className="hero__lead">
          <div className="hero__headline-block">
            {/* Three lines at every width. The grouping changes under 520px so
                the headline never needs a fourth. */}
            <h1 className="t-hero hero__headline">
              Trace a rumor
              <br />
              before it
              <br className="hero__br--narrow" />
              <span className="hero__sp--wide">{' '}</span>
              moves
              <br className="hero__br--wide" />
              <span className="hero__sp--narrow">{' '}</span>
              a price
            </h1>

            {/* Explicit spans, so each phrase is its own flex item and the gap
                between them is reliable once the separators drop away. */}
            <p className="t-label hero__qualifier">
              <span>AI agent</span>
              <span className="hero__sep" aria-hidden="true">/</span>
              <span>For trading desks</span>
              <span className="hero__sep" aria-hidden="true">/</span>
              <span>Callable from your own stack</span>
            </p>

            <p className="t-body hero__support">
              Where the story started, how it mutated, and what still holds. Not a verdict.
            </p>
          </div>

          <DitherPanel className="hero__panel" name={HERO_FOOTAGE} noise={busy ? 1 : 0} />
        </div>

        <form className="trace-form" onSubmit={submit}>
          <label className="t-label trace-form__label" htmlFor="claim">
            Claim to trace
          </label>
          <div className="trace-form__line">
            <input
              id="claim"
              className="trace-form__input"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={EXAMPLE_CLAIM}
              autoComplete="off"
              spellCheck="false"
              disabled={busy}
            />
            <button className="trace-form__btn t-label" type="submit" disabled={busy}>
              {busy ? 'Tracing' : 'Trace'}
            </button>
          </div>
          <p className="t-meta trace-form__hint">
            One claim, stated plainly. Press trace with the field empty to run the example.
          </p>
        </form>
      </div>
    </header>
  );
}
