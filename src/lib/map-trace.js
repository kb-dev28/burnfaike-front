/* Maps a backend TraceJob ({ job } from POST /api/intake) into the TRACE
 * shape consumed by ClaimBar, ResearchTrail, EvidenceBoard, ParanoiaMeter
 * and Synthesis. Pure: no fetch, no env, no DOM. */

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url || 'unknown';
  }
}

function formatElapsed(job) {
  const ms = job?.synthesis?.latency_ms;
  if (typeof ms === 'number' && Number.isFinite(ms)) {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds}s`;
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  return '—';
}

function stateFromJob(job) {
  if (job.mode === 'easter_egg') return 'traced to a source';
  const findings = Array.isArray(job.findings) ? job.findings : [];
  if (findings.length === 0) return 'no source found';
  const stances = findings.map((item) => item.stance);
  if (stances.includes('contradicts') && stances.includes('supports')) {
    return 'contradicted';
  }
  if (findings.some((item) => item.layer === 'mutation' || item.layer === 'social')) {
    return 'mutated';
  }
  if (findings.some((item) => item.layer === 'origin' || item.layer === 'official')) {
    return 'traced to a source';
  }
  return 'no source found';
}

function markFromStance(stance) {
  if (stance === 'supports') return 'highlight';
  if (stance === 'contradicts') return 'strike';
  if (stance === 'unknown') return 'redaction';
  return undefined;
}

function tagFromLayer(layer) {
  if (layer === 'origin') return 'Origin';
  if (layer === 'mutation') return 'Mutation';
  if (layer === 'official') return 'Official / check';
  if (layer === 'social') return 'Social';
  if (layer === 'alt') return 'Alt';
  return undefined;
}

function roundsFromJob(job) {
  const trail = Array.isArray(job?.memory?.trail) ? job.memory.trail : [];
  const byRound = new Map();

  for (const step of trail) {
    const id = `V${step.round}`;
    if (!byRound.has(id)) {
      byRound.set(id, { id, queries: [], gapParts: [] });
    }
    const round = byRound.get(id);
    if (typeof step.query === 'string' && step.query.trim()) {
      round.queries.push(step.query);
    }
    if (step.triggered_by_why) {
      round.gapParts.push(step.triggered_by_why);
    }
    if (typeof step.new_result_count === 'number') {
      round.gapParts.push(
        step.new_result_count === 0
          ? 'No new sources in this round.'
          : `${step.new_result_count} new sources.`,
      );
    }
  }

  const rounds = Array.from(byRound.values()).map((round) => ({
    id: round.id,
    queries: round.queries.length > 0 ? round.queries : ['(empty query)'],
    gap: round.gapParts.join(' '),
  }));

  const stop = job?.memory?.stop_reason;
  const openGaps = Array.isArray(job?.memory?.open_gaps) ? job.memory.open_gaps : [];
  if (rounds.length > 0 && (stop || openGaps.length > 0)) {
    const extra = [];
    if (stop) extra.push(`Stop: ${stop}.`);
    if (openGaps.length > 0) extra.push(`Open gaps: ${openGaps.join(', ')}.`);
    const last = rounds[rounds.length - 1];
    last.gap = [last.gap, ...extra].filter(Boolean).join(' ');
  }

  return rounds;
}

function evidenceFromJob(job) {
  const findings = Array.isArray(job.findings) ? job.findings : [];
  return findings.map((finding, index) => {
    const mark = markFromStance(finding.stance);
    const snippet =
      typeof finding.snippet === 'string' && finding.snippet.trim()
        ? finding.snippet.trim()
        : 'No snippet returned.';
    const segment = { text: snippet };
    if (mark === 'highlight' || mark === 'strike') {
      segment.mark = mark;
    }
    if (mark === 'redaction') {
      segment.mark = 'redaction';
      segment.note = `Layer ${finding.layer ?? 'unknown'}. Stance unknown. Source: ${finding.source_url ?? 'none'}.`;
    }
    const item = {
      id: index + 1,
      domain: hostOf(finding.source_url),
      date: finding.published_at || finding.retrieved_at || '',
      source_url: finding.source_url,
      segments: [segment],
    };
    const tag = tagFromLayer(finding.layer);
    if (tag) item.tag = tag;
    return item;
  });
}

function attachContradictionPairs(evidence, contradictions) {
  const pairs = {};
  if (!Array.isArray(contradictions) || contradictions.length === 0) {
    return { evidence, pairs };
  }

  const supports = evidence.filter((item) =>
    item.segments.some((segment) => segment.mark === 'highlight'),
  );
  const contradicts = evidence.filter((item) =>
    item.segments.some((segment) => segment.mark === 'strike'),
  );

  contradictions.forEach((text, index) => {
    const key = String.fromCharCode(97 + index);
    pairs[key] = text;
    if (supports[index]) supports[index].pair = key;
    if (contradicts[index]) contradicts[index].pair = key;
  });

  return { evidence, pairs };
}

function synthesisFromJob(job, evidence) {
  const synthesis = job.synthesis;
  if (!synthesis) {
    return [{ text: 'Not enough grounded evidence to summarize.' }];
  }

  const parts = [];
  const summary =
    typeof synthesis.trace_summary === 'string' && synthesis.trace_summary.trim()
      ? synthesis.trace_summary.trim()
      : 'Not enough grounded evidence to summarize.';
  parts.push({ text: summary });

  const citations = Array.isArray(synthesis.citations) ? synthesis.citations : [];
  for (const citation of citations) {
    const match = evidence.find((item) => item.source_url === citation.url);
    if (match) {
      parts.push({ cite: match.id });
    }
  }

  const uncertainty = Array.isArray(synthesis.uncertainty)
    ? synthesis.uncertainty.filter((item) => typeof item === 'string' && item.trim())
    : [];
  if (uncertainty.length > 0) {
    parts.push({ text: ` Uncertainty: ${uncertainty.join(' ')}` });
  }

  return parts;
}

export const PENDING_ROUNDS = [
  {
    id: 'V1',
    queries: ['origin / first mention'],
    gap: '',
  },
  {
    id: 'V2',
    queries: ['mutation / recirculation'],
    gap: '',
  },
  {
    id: 'V3',
    queries: ['official / scientific check'],
    gap: '',
  },
];

export function mapTraceJob(job) {
  if (!job || typeof job !== 'object') {
    throw new Error('mapTraceJob expected a TraceJob object.');
  }

  if (job.mode === 'easter_egg') {
    return {
      claim: job.claim,
      domains: 0,
      elapsed: '0s',
      state: 'traced to a source',
      score: 100,
      scoreLabel: 'YES! 100% FACTUALLY VERIFIED',
      rounds: [
        {
          id: 'V1',
          queries: ['local override — no web search'],
          gap: 'Easter egg. Linkup and Nebius were not called.',
        },
      ],
      evidence: [],
      pairs: {},
      synthesis: [
        {
          text: 'Subjective local override. No web verification required for this claim.',
        },
      ],
    };
  }

  const rawEvidence = evidenceFromJob(job);
  const contradictions = job.synthesis?.contradictions ?? [];
  const { evidence, pairs } = attachContradictionPairs(rawEvidence, contradictions);
  const rounds = roundsFromJob(job);
  const domains = new Set(
    evidence.map((item) => item.domain).filter((domain) => domain && domain !== 'unknown'),
  );

  return {
    claim: job.claim,
    domains: domains.size,
    elapsed: formatElapsed(job),
    state: stateFromJob(job),
    score:
      typeof job.synthesis?.paranoia_score === 'number'
        ? job.synthesis.paranoia_score
        : 0,
    scoreLabel:
      typeof job.synthesis?.paranoia_label === 'string' && job.synthesis.paranoia_label
        ? job.synthesis.paranoia_label
        : 'Unverified Internet Gossip',
    rounds: rounds.length > 0 ? rounds : PENDING_ROUNDS,
    evidence,
    pairs,
    synthesis: synthesisFromJob(job, evidence),
  };
}
