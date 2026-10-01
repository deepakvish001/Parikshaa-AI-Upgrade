import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Send } from "lucide-react";
import { useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type ConsoleClient } from "../api.ts";
import { RowMenu } from "./kit.tsx";

/**
 * Shortlists for hiring managers (docs/PREP-TRACKER.md, V2-12 CO23): a link
 * that expires, opened without an account, showing marks only, where the
 * manager says shortlist, hold or reject. Their decisions come back here.
 */

const DECIDED = { shortlist: "Shortlisted", hold: "On hold", reject: "Rejected" } as const;

export function Shortlists({ client, examId, qualified }: { client: ConsoleClient; examId: string; qualified: number }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const lists = useQuery({ queryKey: ["shortlists", examId], queryFn: () => client.shortlists(examId), refetchInterval: 30_000 });
  const [title, setTitle] = useState("");
  const [refs, setRefs] = useState("");
  const [days, setDays] = useState("7");
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["shortlists", examId] });
  const copy = async (link: string) => {
    await navigator.clipboard?.writeText(link).catch(() => undefined);
    toast("Link copied", "success");
  };
  const make = useMutation({
    mutationFn: () => {
      const chosen = refs.split(/[\s,]+/).filter((r) => r !== "");
      return client.createShortlist(examId, { title, refs: chosen.length === 0 ? null : chosen, days: Number(days) || 7 });
    },
    onSuccess: async (made) => {
      setTitle("");
      setRefs("");
      refresh();
      await copy(made.link);
    },
  });
  const withdraw = useMutation({ mutationFn: (id: string) => client.withdrawShortlist(id), onSuccess: refresh });
  const rows = lists.data ?? [];

  return (
    <section className="card" aria-label="Shortlists for hiring managers">
      <div className="bar">
        <Link2 aria-hidden="true" />
        <strong>Shortlists for hiring managers</strong>
        <span className="notice">A link that expires, with marks only. The manager decides without an account.</span>
      </div>
      <form
        className="row"
        aria-label="New shortlist"
        onSubmit={(e) => {
          e.preventDefault();
          make.mutate();
        }}
      >
        <input aria-label="Shortlist title" placeholder="Title, e.g. Round 2 — Java" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input aria-label="Roll numbers" placeholder={`Roll numbers, or blank for the ${qualified} who qualified`} value={refs} onChange={(e) => setRefs(e.target.value)} />
        <label className="inline">
          Open for{" "}
          <input aria-label="Days the link works" type="number" min={1} max={30} className="minutes-input" value={days} onChange={(e) => setDays(e.target.value)} /> days
        </label>
        <button type="submit" disabled={make.isPending}>
          <Send aria-hidden="true" />
          Make the link
        </button>
      </form>
      {make.error === null ? null : (
        <p className="error" role="alert">
          {make.error instanceof ConsoleError && make.error.detail !== undefined ? make.error.detail : "That did not work."}
        </p>
      )}
      {rows.length === 0 ? null : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Shortlist</th>
                <th scope="col" className="num">
                  Candidates
                </th>
                <th scope="col">Manager's decisions</th>
                <th scope="col">Link</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const gone = s.revoked ? "Withdrawn" : Date.parse(s.expiresAt) <= Date.now() ? "Expired" : null;
                return (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.title}</strong>
                      <div className="notice">by {s.createdBy}</div>
                    </td>
                    <td className="num">{s.candidates}</td>
                    <td>
                      {(Object.keys(DECIDED) as (keyof typeof DECIDED)[]).map((d) => `${s.decided[d]} ${DECIDED[d].toLowerCase()}`).join(" · ")}
                      {(s.decisions ?? []).length === 0 ? null : (
                        <div className="notice">
                          {(s.decisions ?? [])
                            .slice(0, 3)
                            .map((d) => `${d.ref}: ${DECIDED[d.decision]}${d.comment === "" ? "" : ` (“${d.comment}”)`}`)
                            .join(" · ")}
                        </div>
                      )}
                    </td>
                    <td>
                      {gone === null ? (
                        <button type="button" className="quiet" onClick={() => void copy(s.link)}>
                          <Copy aria-hidden="true" />
                          Copy · until {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(s.expiresAt))}
                        </button>
                      ) : (
                        <span className="pill">{gone}</span>
                      )}
                    </td>
                    <td className="row-end">
                      <RowMenu of={s.title} items={[gone === null && { label: "Withdraw the link", danger: true, onSelect: () => withdraw.mutate(s.id) }]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
