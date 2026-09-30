import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Play } from "lucide-react";
import { useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type ConsoleClient } from "../api.ts";

const time = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", timeStyle: "short" }).format(new Date(iso));

/**
 * Lab mode, on the Live sitting page (docs/PILOT.md, "A sitting in a lab"):
 * where the exam may be taken from, and — when candidates wait for the
 * invigilator — the button that starts everyone.
 */
export function LabCard({ client, examId, canStart, canConfigure }: { client: ConsoleClient; examId: string; canStart: boolean; canConfigure: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const lab = useQuery({ queryKey: ["lab", examId], queryFn: () => client.lab(examId) });
  const [editing, setEditing] = useState(false);
  const [networks, setNetworks] = useState("");
  const [together, setTogether] = useState(false);
  useEffect(() => {
    if (lab.data === undefined || editing) return;
    setNetworks(lab.data.networks.join("\n"));
    setTogether(lab.data.startTogether);
  }, [lab.data, editing]);

  const save = useMutation({
    mutationFn: () =>
      client.setLab(examId, {
        networks: networks
          .split(/[\s,]+/)
          .map((n) => n.trim())
          .filter((n) => n !== ""),
        startTogether: together,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["lab", examId], saved);
      setEditing(false);
      toast("Lab mode saved", "success");
    },
  });
  const start = useMutation({
    mutationFn: () => client.startSitting(examId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab", examId] });
      toast("Started: candidates waiting are beginning now", "success");
    },
  });

  if (lab.data === undefined) return null;
  const { startTogether, startedAt, yourAddress } = lab.data;
  const limited = lab.data.networks.length > 0;
  const waiting = startTogether && startedAt === null;
  const summary = [
    limited ? `Only from ${lab.data.networks.join(", ")}` : "From anywhere",
    startTogether ? (startedAt === null ? "candidates wait for the invigilator" : `started for everyone at ${time(startedAt)}`) : "each candidate begins when they open their link",
  ].join(" · ");

  return (
    <section className={`card lab${waiting ? " lab-waiting" : ""}`} aria-label="Lab mode">
      <div className="bar">
        <Building2 aria-hidden="true" />
        <strong>Lab mode</strong>
        <span className="notice lab-summary">{summary}</span>
        <span className="spacer" />
        {waiting && canStart ? (
          <button type="button" onClick={() => start.mutate()} disabled={start.isPending}>
            <Play aria-hidden="true" />
            Start the test for everyone
          </button>
        ) : null}
        {canConfigure && !editing ? (
          <button type="button" className="quiet" onClick={() => setEditing(true)}>
            Change
          </button>
        ) : null}
      </div>
      {waiting ? <p className="notice">Candidates who open their link see “Waiting for the invigilator” until you start; each one’s time begins when they begin.</p> : null}
      {start.error === null ? null : (
        <p className="error" role="alert">
          {start.error instanceof ConsoleError && start.error.detail !== undefined ? start.error.detail : "That did not start. Try again."}
        </p>
      )}
      {editing ? (
        <form
          className="lab-form"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <label>
            Networks candidates may take it from
            <textarea
              rows={3}
              value={networks}
              onChange={(e) => setNetworks(e.target.value)}
              placeholder="One per line: an address like 203.0.113.7, or a range like 203.0.113.0/24. Empty: anywhere."
              spellCheck={false}
            />
          </label>
          <p className="notice">
            This computer’s address is <span className="mono">{yourAddress}</span>.{" "}
            <button
              type="button"
              className="link"
              onClick={() => setNetworks((current) => (current.split(/\s+/).includes(yourAddress) ? current : `${current.trim()}\n${yourAddress}`.trim()))}
            >
              Add it
            </button>{" "}
            if you are in the exam room: the lab’s computers usually share it. Ask the college’s IT team for the full range.
          </p>
          <label className="inline">
            <input type="checkbox" checked={together} onChange={(e) => setTogether(e.target.checked)} /> Candidates wait for the invigilator to start
          </label>
          {save.error === null ? null : (
            <p className="error" role="alert">
              {save.error instanceof ConsoleError && save.error.detail !== undefined ? save.error.detail : "That did not save. Try again."}
            </p>
          )}
          <div className="row">
            <button type="submit" disabled={save.isPending}>
              Save
            </button>
            <button type="button" className="quiet" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
