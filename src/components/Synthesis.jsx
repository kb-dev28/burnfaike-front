/* §6 — single column, 72 characters maximum, citations as mono superscripts in
 * the accent, each linking to its evidence board item. */
export default function Synthesis({ parts }) {
  return (
    <section className="section page" aria-labelledby="synthesis-head">
      <h2 className="t-section section__head" id="synthesis-head">
        Synthesis
      </h2>

      <p className="t-body synthesis__body">
        {parts.map((p, i) =>
          p.cite ? (
            <sup className="cite" key={i}>
              <a href={`#ev-${p.cite}`}>
                <span className="sr-only">See evidence item </span>
                {p.cite}
              </a>
            </sup>
          ) : (
            <span key={i}>{p.text}</span>
          ),
        )}
      </p>
    </section>
  );
}
