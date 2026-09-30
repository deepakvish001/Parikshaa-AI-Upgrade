import { useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { checkChainAsync, webcryptoSha256 } from "@parikshaa/core/browser";
import type { CandidateData, CandidateLedger } from "../api.ts";
import { usePreferences, type MessageKey } from "../i18n.tsx";

interface Props {
  readonly ledger: CandidateLedger;
  /** Everything held about the candidate, readable (DPDP Act, s.11). Offered once the attempt has closed. */
  readonly myData?: () => Promise<CandidateData>;
  /** A question's number on the paper, to name it in the record. */
  readonly numberOf?: (questionId: string) => number | null;
}

type Entry = NonNullable<CandidateLedger["entries"]>[number];

/** What each kind of entry is, in words; one about a question says which. */
const EVENT: Record<string, MessageKey> = {
  attempt_started: "event.attempt_started",
  consent_given: "event.consent_given",
  identity_captured: "event.identity_captured",
  identity_reviewed: "event.identity_reviewed",
  section_started: "event.section_started",
  section_closed: "event.section_closed",
  answer_submitted: "event.answer_submitted",
  code_tested: "event.code_tested",
  viva_probed: "event.viva_probed",
  viva_replied: "event.viva_replied",
  viva_assessed: "event.viva_assessed",
  question_scored: "event.question_scored",
  attempt_graded: "event.attempt_graded",
  score_revised: "event.score_revised",
  attempt_voided: "event.attempt_voided",
  time_extended: "event.time_extended",
  attempt_reopened: "event.attempt_reopened",
  attempt_submitted: "event.attempt_submitted",
  data_erased: "event.data_erased",
};

function questionOf(event: Entry["event"]): string | null {
  const e = event as { questionId?: unknown; response?: { questionId?: unknown } };
  const id = e.questionId ?? e.response?.questionId;
  return typeof id === "string" ? id : null;
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

export function Receipt({ ledger, myData, numberOf = () => null }: Props) {
  const { t } = usePreferences();
  const [check, setCheck] = useState<CheckState>({ status: "idle" });
  const [showAll, setShowAll] = useState(false);
  const described = (entry: Entry) => {
    const key = EVENT[entry.event.type];
    const name = key === undefined ? entry.event.type.replace(/_/g, " ") : t(key);
    const id = questionOf(entry.event);
    const n = id === null ? null : numberOf(id);
    return n === null ? name : `${name} · ${t("event.question", { n })}`;
  };
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
    <section className="card receipt" aria-label={t("receipt.region")}>
      <div className="receipt-head">
        <span className="seal" aria-hidden="true">
          <ShieldCheck />
        </span>
        <h2>{t("receipt.region")}</h2>
      </div>
      <p className="notice">{t("receipt.fingerprint")}</p>

      <p className="hash" data-testid="head-hash">
        {ledger.head ?? "—"}
      </p>

      <div className="receipt-actions">
        <button type="button" onClick={download} disabled={ledger.head === null}>
          {t("receipt.download")}
        </button>
        {ledger.entries === null ? null : (
          <button type="button" className="secondary" onClick={verify} disabled={check.status === "checking"}>
            {check.status === "checking" ? t("receipt.checking") : t("receipt.check")}
          </button>
        )}
        {myData !== undefined && ledger.entries !== null ? (
          <button type="button" className="secondary" onClick={() => void downloadMyData()} disabled={fetching === "busy"}>
            {t("receipt.myData")}
          </button>
        ) : null}
      </div>
      {ledger.entries !== null ? <p className="notice receipt-help">{t("receipt.sealedNote")}</p> : null}
      {fetching === "failed" ? (
        <p className="error" role="status">
          {t("receipt.myDataFailed")}
        </p>
      ) : null}

      {check.status === "verified" ? (
        <p className="saved" role="status">
          {t("receipt.verified", { n: check.count })}
        </p>
      ) : null}
      {check.status === "failed" ? (
        <p className="error" role="status">
          {t("receipt.failed", { seq: check.seq, reason: check.reason })}
        </p>
      ) : null}

      {ledger.entries === null ? (
        <p className="notice receipt-later">{t("receipt.opensLater")}</p>
      ) : (
        <>
          <button type="button" className="link entries-toggle" aria-expanded={showAll} aria-controls="receipt-entries" onClick={() => setShowAll(!showAll)}>
            <ChevronDown aria-hidden="true" />
            {showAll ? t("receipt.hideEntries") : t("receipt.showEntries", { n: ledger.length })}
          </button>
          {showAll ? (
            <table className="ledger" id="receipt-entries">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">{t("receipt.event")}</th>
                  <th scope="col">{t("receipt.entryHash")}</th>
                </tr>
              </thead>
              <tbody>
                {ledger.entries.map((entry) => (
                  <tr key={entry.hash}>
                    <td>{entry.seq}</td>
                    <td>{described(entry)}</td>
                    <td className="mono">{entry.hash.slice(0, 16)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </>
      )}
    </section>
  );
}
