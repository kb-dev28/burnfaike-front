/* §6 — rounds as rows separated by hairlines, not cards. The sequence is real,
 * so numbering it is correct here. */
export default function ResearchTrail({ rounds, visible }) {
  return (
    <section className="section page" aria-labelledby="trail-head">
      <h2 className="t-section section__head" id="trail-head">
        Research trail
      </h2>

      <ol className="trail">
        {rounds.slice(0, visible).map((round) => (
          <li className="trail__row" key={round.id}>
            <p className="trail__id" aria-hidden="true">
              {round.id}
            </p>
            <div className="trail__body">
              <h3 className="sr-only">Round {round.id.slice(1)}</h3>
              <ul className="trail__queries">
                {round.queries.map((q) => (
                  <li className="t-label trail__query" key={q}>
                    {q}
                  </li>
                ))}
              </ul>
              <p className="t-body trail__gap">{round.gap}</p>
            </div>
          </li>
        ))}
      </ol>

      {visible < rounds.length && (
        <p className="t-label trail__pending" role="status">
          Round {rounds[visible].id.slice(1)} in flight
        </p>
      )}
    </section>
  );
}
