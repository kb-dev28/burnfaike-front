import { TRACE } from '../data/trace';

/* "Agent-compatible" is a claim, and this product does not deal in claims — so
 * the section shows the actual call and the actual payload instead of asserting
 * anything. The response example is derived from the sample trail rather than
 * written by hand, so the documented shape cannot drift from the data. */

const TOOL = {
  name: 'trace_rumor',
  description: 'Trace a claim to its origin. Returns a provenance trail, not a verdict.',
  input_schema: {
    type: 'object',
    properties: {
      claim: { type: 'string', description: 'One claim, stated plainly.' },
      max_rounds: { type: 'integer', default: 3 },
      since: { type: 'string', description: 'ISO date. Ignore earlier sources.' },
    },
    required: ['claim'],
  },
};

const segment = (s) => (s.mark ? { text: s.text, mark: s.mark } : { text: s.text });

/* The example is an excerpt, not a truncation of meaning: the shape of every
 * field is shown in full, and only the repetition is elided. */
const ELLIPSIS = '…';
const firstSentence = (text) => `${text.split('. ')[0]}. ${ELLIPSIS}`;

const response = {
  claim: TRACE.claim,
  state: TRACE.state,
  score: TRACE.score,
  domains_read: TRACE.domains,
  rounds: [
    {
      id: TRACE.rounds[0].id,
      queries: [...TRACE.rounds[0].queries.slice(0, 2), ELLIPSIS],
      gap: firstSentence(TRACE.rounds[0].gap),
    },
    ELLIPSIS,
  ],
  evidence: [
    {
      id: TRACE.evidence[0].id,
      domain: TRACE.evidence[0].domain,
      date: TRACE.evidence[0].date,
      segments: [...TRACE.evidence[0].segments.slice(0, 2).map(segment), ELLIPSIS],
    },
    ELLIPSIS,
  ],
  synthesis: `The claim traces to a single post made at 03:14 on 4 March. ${ELLIPSIS}`,
};

const STATES = ['traced to a source', 'mutated', 'contradicted', 'no source found'];

function Block({ label, children }) {
  return (
    <div className="agent__block">
      <p className="t-label agent__block-head">{label}</p>
      <pre className="agent__code">
        <code>{children}</code>
      </pre>
    </div>
  );
}

export default function AgentInterface() {
  return (
    <section className="section page" aria-labelledby="agent-head">
      <h2 className="t-section section__head" id="agent-head">
        Agent interface
      </h2>

      <p className="t-body agent__lede">
        Burn fAIke runs as a tool your own agents call. A trading desk gets the same
        trail this page renders, as JSON, over the same rounds — the research is the
        product, and it is not summarised away at the boundary.
      </p>

      <div className="agent__grid">
        <Block label="Tool definition">{JSON.stringify(TOOL, null, 2)}</Block>
        <Block label="Response">
          {JSON.stringify(response, null, 2).replace(/"…"/g, ELLIPSIS)}
        </Block>
      </div>

      <div className="agent__states">
        <p className="t-label agent__block-head">Result states</p>
        <ul className="agent__state-list">
          {STATES.map((s) => (
            <li className="t-body agent__state" key={s}>
              {s}
            </li>
          ))}
        </ul>
        <p className="t-body agent__note">
          Four states, and no fifth. <code>state</code> is never a boolean and never
          carries a truth value, so nothing downstream can read this as a signal to buy
          or sell. A caller that needs a decision makes it from the trail, on its own
          authority.
        </p>
      </div>
    </section>
  );
}
