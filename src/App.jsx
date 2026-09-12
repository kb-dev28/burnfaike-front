import { useEffect, useRef, useState } from 'react';
import Hero from './components/Hero';
import ClaimBar from './components/ClaimBar';
import ResearchTrail from './components/ResearchTrail';
import EvidenceBoard from './components/EvidenceBoard';
import ParanoiaMeter from './components/ParanoiaMeter';
import Synthesis from './components/Synthesis';
import AgentInterface from './components/AgentInterface';
import TraceOverlay from './components/TraceOverlay';
import { TRACE, EXAMPLE_CLAIM } from './data/trace';

/* Rounds land one at a time so the process stays visible — the first of the
 * three things the identity has to communicate. Hard cuts, no transitions. */
const ROUND_AT = [250, 1100, 1950];
const RESULT_AT = 2700;

export default function App() {
  const [phase, setPhase] = useState('idle');
  const [claim, setClaim] = useState(EXAMPLE_CLAIM);
  const [visibleRounds, setVisibleRounds] = useState(0);
  const resultRef = useRef(null);

  const trace = (next) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setClaim(next);

    if (reduced) {
      setVisibleRounds(TRACE.rounds.length);
      setPhase('result');
      return;
    }

    setVisibleRounds(0);
    setPhase('tracing');
  };

  useEffect(() => {
    if (phase !== 'tracing') return undefined;
    const timers = ROUND_AT.map((ms, i) =>
      setTimeout(() => setVisibleRounds(i + 1), ms),
    );
    timers.push(setTimeout(() => setPhase('result'), RESULT_AT));
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  /* Scroll when the overlay lifts, not when the trace starts: during the trace
   * the screen belongs to the loading field, and body scrolling is locked. */
  useEffect(() => {
    if (phase !== 'result' || !resultRef.current) return;
    resultRef.current.scrollIntoView({ block: 'start' });
  }, [phase]);

  const started = phase !== 'idle';
  const substituted = started && claim !== EXAMPLE_CLAIM;

  return (
    <>
      <Hero onTrace={trace} busy={phase === 'tracing'} />

      {phase === 'tracing' && (
        <TraceOverlay claim={claim} rounds={TRACE.rounds} visible={visibleRounds} />
      )}

      {started && (
        <main ref={resultRef}>
          <ClaimBar
            claim={claim}
            domains={TRACE.domains}
            elapsed={phase === 'result' ? TRACE.elapsed : 'running'}
            state={phase === 'result' ? TRACE.state : 'tracing'}
          />

          {substituted && (
            <p className="t-meta notice page">
              The research engine is not wired up in this build. The trail below is the
              sample trace, shown against the claim as submitted.
            </p>
          )}

          <ResearchTrail rounds={TRACE.rounds} visible={visibleRounds} />

          {phase === 'result' && (
            <>
              <EvidenceBoard evidence={TRACE.evidence} pairs={TRACE.pairs} />
              <ParanoiaMeter score={TRACE.score} label={TRACE.scoreLabel} run />
              <Synthesis parts={TRACE.synthesis} />
            </>
          )}
        </main>
      )}

      <AgentInterface />

      <footer className="footer page">
        {/* The result states moved into the agent interface section, where they
            are part of the contract rather than a footnote. */}
        <p className="t-meta">
          Burn fAIke — a rumor-tracing agent. Run a trace above, or call it from your
          own stack.
        </p>
      </footer>
    </>
  );
}
