export default function ClaimBar({ claim, domains, elapsed, state }) {
  return (
    <div className="claim-bar">
      <div className="claim-bar__inner page">
        <p className="t-claim claim-bar__claim">{claim}</p>
        <div className="claim-bar__meta">
          <span className="t-meta">{domains} domains read</span>
          <span className="t-meta">{elapsed}</span>
          <span className="t-label claim-bar__state">{state}</span>
        </div>
      </div>
    </div>
  );
}
