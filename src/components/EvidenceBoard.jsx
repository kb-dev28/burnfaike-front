import Marker from './Marker';

function Item({ item }) {
  return (
    <article className="evidence__item" id={`ev-${item.id}`}>
      <p className="evidence__head">
        <span className="t-label evidence__domain">{item.domain}</span>
        {item.tag && <span className="t-meta evidence__tag">{item.tag}</span>}
      </p>
      <p className="t-body evidence__claim">
        <Marker segments={item.segments} />
      </p>
      {item.footnote && <p className="t-meta evidence__footnote">{item.footnote}</p>}
      <p className="t-meta evidence__date">{item.date}</p>
    </article>
  );
}

/* Consecutive items sharing a `pair` key are bracketed together with a 2px
 * left rule spanning both (§6). Everything else is separated by hairlines. */
function group(evidence) {
  const out = [];
  for (const item of evidence) {
    const last = out[out.length - 1];
    if (item.pair && last && last.pair === item.pair) {
      last.items.push(item);
    } else {
      out.push({ pair: item.pair, items: [item] });
    }
  }
  return out;
}

export default function EvidenceBoard({ evidence, pairs }) {
  const groups = group(evidence);

  return (
    <section className="section page" aria-labelledby="evidence-head">
      <h2 className="t-section section__head" id="evidence-head">
        Evidence board
      </h2>

      <div className="evidence">
        {groups.map((g, i) =>
          g.pair ? (
            <div className="evidence__pair" key={`pair-${g.pair}-${i}`}>
              <p className="t-meta evidence__pair-note">Contradiction — {pairs[g.pair]}</p>
              {g.items.map((item) => (
                <Item item={item} key={item.id} />
              ))}
            </div>
          ) : (
            <Item item={g.items[0]} key={g.items[0].id} />
          ),
        )}
      </div>
    </section>
  );
}
