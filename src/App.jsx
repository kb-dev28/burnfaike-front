import { useEffect, useRef, useState } from 'react';
import Hero from './components/Hero';
import ClaimBar from './components/ClaimBar';
import ResearchTrail from './components/ResearchTrail';
import EvidenceBoard from './components/EvidenceBoard';
import ParanoiaMeter from './components/ParanoiaMeter';
import Synthesis from './components/Synthesis';
import AgentInterface from './components/AgentInterface';
import TraceOverlay from './components/TraceOverlay';
import { EXAMPLE_CLAIM } from './data/trace';
import { postIntake } from './lib/intake';
import { mapTraceJob, PENDING_ROUNDS } from './lib/map-trace';

const ROUND_AT = [250, 1100, 1950];

export default function App() {
  const [phase, setPhase] = useState('idle');
  const [claim, setClaim] = useState(EXAMPLE_CLAIM);
  const [visibleRounds, setVisibleRounds] = useState(0);
  const [traceData, setTraceData] = useState(null);
  const [error, setError] = useState(null);
  const resultRef = useRef(null);

  const trace = (next) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setClaim(next);
    setError(null);
    setTraceData(null);
    setVisibleRounds(0);
    setPhase('tracing');

    postIntake(next)
      .then((job) => {
        const mapped = mapTraceJob(job);
        setTraceData(mapped);
        if (reduced) {
          setVisibleRounds(mapped.rounds.length);
        }
        setPhase('result');
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : 'Trace failed.');
        if (caught && caught.job) {
          try {
            setTraceData(mapTraceJob(caught.job));
          } catch {
            setTraceData(null);
          }
        }
        setPhase('error');
      });
  };

  useEffect(() => {
    if (phase !== 'tracing') return undefined;
    const timers = ROUND_AT.map((ms, i) =>
      setTimeout(() => setVisibleRounds(i + 1), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'result' || !traceData) return undefined;
    setVisibleRounds(traceData.rounds.length);
    return undefined;
  }, [phase, traceData]);

  useEffect(() => {
    if ((phase !== 'result' && phase !== 'error') || !resultRef.current) return;
    resultRef.current.scrollIntoView({ block: 'start' });
  }, [phase]);

  const started = phase !== 'idle';
  const overlayRounds = PENDING_ROUNDS;
  const result = traceData;

  return (
    <>
      <Hero onTrace={trace} busy={phase === 'tracing'} />

      {phase === 'tracing' && (
        <TraceOverlay
          claim={claim}
          rounds={overlayRounds}
          visible={Math.max(visibleRounds, 1)}
        />
      )}

      {started && phase !== 'tracing' && (
        <main ref={resultRef}>
          <ClaimBar
            claim={claim}
            domains={result ? result.domains : 0}
            elapsed={result ? result.elapsed : 'failed'}
            state={result ? result.state : 'no source found'}
          />

          {error && (
            <p className="t-meta notice page">
              {error}
            </p>
          )}

          {result && (
            <>
              <ResearchTrail
                rounds={result.rounds}
                visible={visibleRounds || result.rounds.length}
              />

              {phase === 'result' && (
                <>
                  <EvidenceBoard evidence={result.evidence} pairs={result.pairs} />
                  <ParanoiaMeter score={result.score} label={result.scoreLabel} run />
                  <Synthesis parts={result.synthesis} />
                </>
              )}
            </>
          )}
        </main>
      )}

      <AgentInterface />

      <footer className="footer page">
        <p className="t-meta">
          Burn fAIke — a rumor-tracing agent. Run a trace above, or call it from your
          own stack.
        </p>
      </footer>
    </>
  );
}
