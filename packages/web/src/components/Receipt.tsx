import { useState } from "react";
import { checkChainAsync, webcryptoSha256 } from "@parikshaa/core/browser";
import type { CandidateData, CandidateLedger } from "../api.ts";

interface Props {
  readonly ledger: CandidateLedger;
  /** Everything held about the candidate, readable (DPDP Act, s.11). Offered once the attempt has closed. */
  readonly myData?: () => Promise<CandidateData>;
}

/**
 * What the candidate takes away.
 *
 * The head hash is the point of this screen. Keeping it is what lets a
 * candidate later prove that the record they are shown is the record that
 * existed when they finished — which is the guarantee the ledger exists to
 * provide, and the one an appeal turns on (SPEC §5).
 */
type CheckState =
  | { readonly status: "idle" }
  | { readonly status: "checking" }
  | { readonly status: "verified"; readonly count: number }
  | { readonly status: "failed"; readonly seq: number; readonly reason: string };

/** Offer `value` as a JSON file to save. */
function save(value: unknown, name: string): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function Receipt({ ledger, myData }: Props) {
  const [check, setCheck] = useState<CheckState>({ status: "idle" });
  const [fetching, setFetching] = useState<"idle" | "busy" | "failed">("idle");

  const downloadMyData = async () => {
    if (myData === undefined) return;
    setFetching("busy");
    try {
      save(await myData(), "parikshaa-my-data.json");
      setFetching("idle");
    } catch {
      setFetching("failed");
    }
  };

  /**
   * Verify the record here, in the candidate's own browser.
   *
   * The hash is computed with WebCrypto rather than trusting anything the
   * server says about it — the point of the receipt is to be checkable by
   * someone who does not trust the party that issued it, and a "verified" badge
   * rendered from a server response would check nothing. A conformance test in
   * `@parikshaa/core` pins this digest to the one the server used, so an honest
   * record cannot fail here.
   */
  const verify = async () => {
    if (ledger.entries === null) return;
    setCheck({ status: "checking" });
    const result = await checkChainAsync(ledger.entries, webcryptoSha256);
    setCheck(
      result.ok
        ? { status: "verified", count: ledger.entries.length }
        : { status: "failed", seq: result.seq, reason: result.reason.replace(/_/g, " ") },
    );
  };

  const download = () => save(ledger, `parikshaa-receipt-${ledger.head?.slice(0, 12) ?? "attempt"}.json`);

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
        {ledger.entries === null ? null : (
          <button
            type="button"
            className="secondary"
            onClick={verify}
            disabled={check.status === "checking"}
          >
            {check.status === "checking" ? "Checking…" : "Check this record"}
          </button>
        )}
        {myData !== undefined && ledger.entries !== null ? (
          <button type="button" className="secondary" onClick={() => void downloadMyData()} disabled={fetching === "busy"}>
            Download my data
          </button>
        ) : null}
        <span className="notice">{ledger.length} entries</span>
      </div>
      {ledger.entries !== null ? (
        <p className="notice">
          What you wrote is sealed in this record, so that it can be erased without breaking it. &ldquo;Download my
          data&rdquo; gives you a readable copy of everything held about you.
        </p>
      ) : null}
      {fetching === "failed" ? (
        <p className="error" role="status">
          Could not fetch your data just now. Try again in a moment.
        </p>
      ) : null}

      {check.status === "verified" ? (
        <p className="saved" role="status">
          Checked in this browser: {check.count} entries, unbroken. Every entry still
          matches what was written.
        </p>
      ) : null}
      {check.status === "failed" ? (
        <p className="error" role="status">
          This record does not check out: entry {check.seq} shows {check.reason}. Keep this
          file and raise it with your institution.
        </p>
      ) : null}

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
