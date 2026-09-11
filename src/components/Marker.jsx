import { useId, useState } from 'react';

/* The marker system — §5. Three states, mutually exclusive per run of text.
 * Highlight = supported, strike = contradicted, redaction = no source found. */

function Redaction({ text, note }) {
  const [open, setOpen] = useState(false);
  const noteId = useId();

  return (
    <span className="redaction" data-open={open ? '' : undefined}>
      <button
        type="button"
        className="redaction__btn"
        aria-expanded={open}
        aria-describedby={noteId}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {text}
      </button>
      {/* Always in the accessibility tree; only painted when the block lifts. */}
      <span className="redaction__note" id={noteId} role="note">
        <span className="t-label redaction__note-head">No source found</span>
        {note}
      </span>
    </span>
  );
}

export default function Marker({ segments }) {
  return segments.map((s, i) => {
    if (s.mark === 'highlight') {
      return (
        <mark className="mark-highlight" key={i}>
          {s.text}
        </mark>
      );
    }
    if (s.mark === 'strike') {
      return (
        <span className="mark-strike" key={i}>
          <span className="sr-only">Contradicted: </span>
          {s.text}
        </span>
      );
    }
    if (s.mark === 'redaction') {
      return <Redaction key={i} text={s.text} note={s.note} />;
    }
    return <span key={i}>{s.text}</span>;
  });
}
