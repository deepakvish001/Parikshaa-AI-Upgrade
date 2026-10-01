import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScanFace } from "lucide-react";
import { useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type ConsoleClient } from "../api.ts";

/**
 * Signs of a proxy (docs/PREP-TRACKER.md, V2-12 CO30): candidates who opened
 * the test from one network and browser, an identity photo used twice, and
 * what the model saw comparing each candidate's photos. Each is a reason to
 * look at the photos, never a finding.
 */

const time = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", timeStyle: "short" }).format(new Date(iso));

export function ProxyCheck({ client, examId, onReview }: { client: ConsoleClient; examId: string; onReview: (attemptId: string) => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const report = useQuery({ queryKey: ["proxy", examId], queryFn: () => client.proxyReport(examId) });
  const compare = useMutation({
    mutationFn: () => client.compareIdentities(examId),
    onSuccess: ({ checked, flagged }) => {
      toast(`${checked} compared, ${flagged} to look at`, flagged > 0 ? "error" : "success");
      void queryClient.invalidateQueries({ queryKey: ["proxy", examId] });
    },
    onError: (error) => toast(error instanceof ConsoleError && error.detail !== undefined ? error.detail : "The photos could not be compared.", "error"),
  });
  const data = report.data;
  if (data === undefined) return null;
  const flagged = data.checks.filter((c) => c.flagged);
  const nothing = data.sharedOrigins.length === 0 && data.reusedPhotos.length === 0 && flagged.length === 0;
  // Nothing to say about an exam with no camera and no shared origins.
  if (nothing && data.unchecked === 0 && data.checks.length === 0) return null;

  return (
    <section className="card" aria-label="Signs of a proxy">
      <div className="bar">
        <ScanFace aria-hidden="true" />
        <strong>Signs of a proxy</strong>
        <span className="notice">Reasons to look at a candidate's photos, never findings. A person decides.</span>
        <span className="spacer" />
        {data.unchecked > 0 ? (
          <button type="button" className="secondary" disabled={compare.isPending} onClick={() => compare.mutate()}>
            {compare.isPending ? "Comparing…" : `Compare photos of ${data.unchecked}`}
          </button>
        ) : null}
      </div>
      {nothing ? <p className="notice">Nothing found{data.checks.length > 0 ? `: ${data.checks.length} compared, the same person throughout` : ""}.</p> : null}
      <ul className="proxy-signs">
        {data.reusedPhotos.map((r) => (
          <li key={r.candidates.join()}>
            <strong>The same identity photo</strong> for {r.candidates.join(", ")}
          </li>
        ))}
        {data.sharedOrigins.map((o) => (
          <li key={o.candidates.join()}>
            <strong>One network and browser</strong> for {o.candidates.join(", ")}, <span className="proxy-time">{time(o.from)}–{time(o.to)}</span>
          </li>
        ))}
        {flagged.map((c) => (
          <li key={c.attemptId}>
            <strong>{c.ref}</strong>: {c.flags.join("; ")}.{" "}
            <button type="button" className="link" onClick={() => onReview(c.attemptId)}>
              Open
            </button>
          </li>
        ))}
      </ul>
      {data.lab ? <p className="notice">Held in a lab: one network for everyone is expected, so it is not counted.</p> : null}
    </section>
  );
}
