/* Sample trace. Every company, account and publication named here is invented,
 * so nothing in this file asserts anything about a real organisation. It stands
 * in for the research engine until that is wired up.
 *
 * Marker vocabulary (§5), mutually exclusive per run of text:
 *   highlight  — the research supports this
 *   strike     — the research contradicts this
 *   redaction  — no retrievable source; `note` says what was looked for
 */

export const EXAMPLE_CLAIM =
  'Halden Robotics paused its Series C after a failed safety audit.';

export const TRACE = {
  claim: EXAMPLE_CLAIM,
  domains: 14,
  elapsed: '2m 41s',
  /* traced to a source | mutated | contradicted | no source found */
  state: 'mutated',
  score: 68,
  scoreLabel: 'Mutated in transit — two load-bearing details were added downstream of the only source found',

  rounds: [
    {
      id: 'V1',
      queries: [
        'halden robotics series c paused',
        'halden robotics safety audit outcome',
        '"halden robotics" funding march 2026',
      ],
      gap: 'Eleven of fourteen domains restate the same two sentences. No primary document, no named auditor, no dated filing. The wording is close enough between hits that they share an ancestor.',
    },
    {
      id: 'V2',
      queries: [
        'site:haldenrobotics.com newsroom',
        'halden robotics investor letter q1',
        'eu machinery registry halden HR-4 certification',
      ],
      gap: 'The company newsroom has published nothing since 12 February. One registry entry records an audit as scheduled; none records an outcome, and none mentions a funding round at all.',
    },
    {
      id: 'V3',
      queries: [
        'archive snapshot haldenrobotics.com/newsroom march 2026',
        '"on hold" halden series c -ledgerfront',
        'earliest post halden audit 4 march',
      ],
      gap: 'Origin located: one post at 03:14 on 4 March, nine hours ahead of every other hit. The figure and the word "failed" appear first in the restatement, not in the origin.',
    },
  ],

  evidence: [
    {
      id: 1,
      domain: 'tobinmarr.social',
      date: '4 Mar 2026 · 03:14',
      tag: 'Origin',
      segments: [
        { text: 'Hearing that ' },
        { text: "Halden's Series C is on hold", mark: 'highlight' },
        { text: '. Audit last week did not go their way.' },
      ],
    },
    {
      id: 2,
      domain: 'ledgerfront.io',
      date: '4 Mar 2026 · 12:40',
      pair: 'a',
      segments: [
        { text: 'Halden Robotics has paused its ' },
        {
          text: '$240M',
          mark: 'redaction',
          note: 'No figure appears in the origin post, in any registry entry, or in any company document retrieved. First occurrence is this article.',
        },
        { text: ' Series C after ' },
        { text: 'failing a safety audit', mark: 'strike' },
        { text: '.' },
      ],
    },
    {
      id: 3,
      domain: 'quantbrief.substack.com',
      date: '21 Jan 2026',
      pair: 'a',
      segments: [
        { text: 'The round was ' },
        { text: 'oversubscribed and closing early', mark: 'highlight' },
        { text: ', per two people who saw the term sheet.' },
      ],
    },
    {
      id: 4,
      domain: 'eu-machinery-registry.europa.example',
      date: '2 Mar 2026',
      segments: [
        { text: 'Type-certification audit for unit HR-4 ' },
        { text: 'scheduled 2 March 2026', mark: 'highlight' },
        { text: '. Outcome not yet filed.' },
      ],
    },
    {
      id: 5,
      domain: 'haldenrobotics.com',
      date: '12 Feb 2026',
      segments: [
        { text: 'Last newsroom entry predates the claim by three weeks and concerns a hiring round. ' },
        {
          text: 'No statement on funding or audit status',
          mark: 'redaction',
          note: 'Newsroom, investor-relations page and press contact all checked, plus two archive snapshots taken after 4 March. Silence is not a denial and is not counted as one.',
        },
        { text: '.' },
      ],
    },
    {
      id: 6,
      domain: 'marketpulse.daily',
      date: '4 Mar 2026 · 18:02',
      segments: [
        { text: 'Halden ' },
        { text: 'failed its audit, sources say', mark: 'strike' },
        { text: '. Restates ledgerfront.io without adding a source of its own.' },
      ],
    },
    {
      id: 7,
      domain: 'web-archive snapshot',
      date: '4 Mar 2026 · 07:02',
      segments: [
        { text: 'Snapshot shows the origin post ' },
        { text: 'already reworded from "on hold" to "pulled"', mark: 'highlight' },
        { text: ' three hours after posting.' },
      ],
    },
    {
      id: 8,
      domain: 'aggregate-ai.digest',
      date: '5 Mar 2026',
      tag: 'Over-confident restatement',
      segments: [
        { text: 'Summary states the round is ' },
        { text: 'confirmed dead', mark: 'strike' },
        {
          text: '. Cites three articles, all of which are this trail.',
        },
      ],
      footnote:
        'Surfaced rather than dropped: this is the point where a summariser turned a single unverified post into a settled outcome. The evidence it cited was three restatements of one source.',
    },
  ],

  /* Contradictory pairs are bracketed together in the evidence board. */
  pairs: {
    a: 'A round described as oversubscribed in January and paused in March, with nothing in between.',
  },

  synthesis: [
    { text: 'The claim traces to a single post made at 03:14 on 4 March' },
    { cite: 1 },
    {
      text: '. Everything published afterwards restates it. Nine hours later a figure of $240M appeared for the first time',
    },
    { cite: 2 },
    {
      text: ', attached to no document the trace could retrieve, and the word "failed" replaced "did not go their way" in the same restatement.',
    },
    {
      text: ' A registry entry confirms an audit was scheduled for 2 March',
    },
    { cite: 4 },
    {
      text: ' but records no outcome, and the company has published nothing on either subject',
    },
    { cite: 5 },
    {
      text: '. A January report describing the same round as oversubscribed',
    },
    { cite: 3 },
    {
      text: ' is not reconciled anywhere in the trail. The origin post was itself edited within three hours',
    },
    { cite: 7 },
    {
      text: '. What holds: an audit was scheduled. What does not: the amount, the outcome, and the word "failed".',
    },
  ],
};
