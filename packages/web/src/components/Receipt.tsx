import type { CandidateLedger } from "../api.ts";

interface Props {
  readonly ledger: CandidateLedger;
}

/**
 * What the candidate takes away.
 *
 * The head hash is the point of this screen. Keeping it is what lets a
 * candidate later prove that the record they are shown is the record that
 * existed when they finished — which is the guarantee the ledger exists to
 * provide, and the one an appeal turns on (SPEC §5).
 */
export function Receipt({ ledger }: Props) {
  const download = () => {
    const blob = new Blob([JSON.stringify(ledger, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `parikshaa-receipt-${ledger.head?.slice(0, 12) ?? "attempt"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card receipt" aria-label="Your record">
      <h2>Your record</h2>
      <p className="notice">
        This is the fingerprint of everything recorded during your attempt. Keep
        it. If the record is ever questioned, it proves which version you were
        shown.
      </p>

      <p className="hash" data-testid="head-hash">
        {ledger.head ?? "—"}
      </p>

      <div className="row">
        <button type="button" onClick={download} disabled={ledger.head === null}>
          Download receipt
        </button>
        <span className="notice">{ledger.length} entries</span>
      </div>

      {ledger.entries === null ? (
        <p className="notice" style={{ marginTop: "1.5rem" }}>
          The full record opens once your attempt is closed.
        </p>
      ) : (
        <table className="ledger" style={{ marginTop: "1.5rem" }}>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Event</th>
              <th scope="col">Entry hash</th>
            </tr>
          </thead>
          <tbody>
            {ledger.entries.map((entry) => (
              <tr key={entry.hash}>
                <td>{entry.seq}</td>
                <td>{entry.event.type.replace(/_/g, " ")}</td>
                <td className="mono">{entry.hash.slice(0, 16)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
