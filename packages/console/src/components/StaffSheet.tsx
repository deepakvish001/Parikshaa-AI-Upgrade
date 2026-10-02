import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, FileSpreadsheet } from "lucide-react";
import { useToast } from "@parikshaa/brand/ui";
import { ConsoleError, type ConsoleClient, type StaffImport } from "../api.ts";

/**
 * Staff from a sheet, and departments (docs/PREP-TRACKER.md, CL4 and CL6).
 * The sheet is checked first; each new member gets a link to set their own
 * password. A member's department limits the exams they see to that
 * department's (owners see everything).
 */

const failure = (error: unknown) => (error instanceof ConsoleError && error.detail !== undefined ? error.detail : "That did not go through. Try again.");

export function StaffSheet({ client }: { client: ConsoleClient }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<StaffImport | null>(null);
  const check = useMutation({ mutationFn: (text: string) => client.importStaff(text, true), onSuccess: setPreview });
  const save = useMutation({
    mutationFn: () => client.importStaff(csv, false),
    onSuccess: (done) => {
      toast(`${done.added} added and sent a link to set a password${done.skipped > 0 ? ` · ${done.skipped} already on staff` : ""}`, "success");
      setCsv("");
      setPreview(null);
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
      void queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
  });
  const error = check.error ?? save.error;
  return (
    <section className="card" aria-label="Add staff from a sheet">
      <div className="bar">
        <FileSpreadsheet aria-hidden="true" />
        <strong>Add staff from a sheet</strong>
        <span className="notice">Columns email, name, role (author, invigilator, reviewer or viewer) and department. Each new member gets a link to set their own password.</span>
      </div>
      <label className="field">
        Paste the sheet (CSV)
        <textarea rows={5} value={csv} onChange={(e) => (setCsv(e.target.value), setPreview(null))} placeholder={"email,name,role,department\nhod.cse@college.edu,Dr Rao,reviewer,CSE"} />
      </label>
      <input
        aria-label="Or choose a CSV file"
        type="file"
        accept=".csv,text/csv"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file === undefined) return;
          const text = await file.text();
          setCsv(text);
          check.mutate(text);
        }}
      />
      <div className="row">
        <button type="button" className="secondary" disabled={csv.trim() === "" || check.isPending} onClick={() => check.mutate(csv)}>
          Check the sheet
        </button>
        {preview !== null && preview.problems.length === 0 && preview.added > 0 ? (
          <button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
            Add {preview.added} and send their links
          </button>
        ) : null}
      </div>
      {preview === null ? null : preview.problems.length > 0 ? (
        <ul className="problems" aria-label="Rows to fix">
          {preview.problems.map((p) => (
            <li key={`${p.row}${p.message}`}>
              <span className="mono">row {p.row}</span> — {p.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="notice" role="status">
          {preview.added} new{preview.skipped > 0 ? `, ${preview.skipped} already on staff (left as they are)` : ""}.
        </p>
      )}
      {error === null ? null : (
        <p className="error" role="alert">
          {failure(error)}
        </p>
      )}
    </section>
  );
}

/** Each member's department, set by an owner or staff manager. */
export function StaffDepartments({ client, users }: { client: ConsoleClient; users: readonly { readonly id: string; readonly name: string }[] }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const departments = useQuery({ queryKey: ["departments"], queryFn: () => client.departments() });
  const set = useMutation({
    mutationFn: ({ id, department }: { id: string; department: string | null }) => client.setStaffDepartment(id, department),
    onSuccess: () => {
      toast("Department saved", "success");
      void queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
  });
  if (departments.data === undefined) return null;
  const of = new Map(departments.data.staff.map((s) => [s.userId, s.department]));
  return (
    <section className="card" aria-label="Departments">
      <div className="bar">
        <Building2 aria-hidden="true" />
        <strong>Departments</strong>
        <span className="notice">A member with a department, other than an owner, sees only that department's exams and those with none.</span>
      </div>
      <datalist id="department-names">
        {departments.data.departments.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
      <div className="scroll">
        <table>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <th scope="row">{u.name}</th>
                <td>
                  <input
                    aria-label={`Department for ${u.name}`}
                    list="department-names"
                    defaultValue={of.get(u.id) ?? ""}
                    placeholder="None"
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next !== (of.get(u.id) ?? "")) set.mutate({ id: u.id, department: next === "" ? null : next });
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {set.error === null ? null : (
        <p className="error" role="alert">
          {failure(set.error)}
        </p>
      )}
    </section>
  );
}
