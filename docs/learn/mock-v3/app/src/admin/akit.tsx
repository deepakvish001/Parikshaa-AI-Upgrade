import { useEffect, useState, type ReactNode } from "react";
import { Lock, MoreHorizontal, Search, ChevronLeft, ChevronRight, ShieldAlert, Filter, X } from "lucide-react";
import { useT, useToast } from "../lib/core";
import { useRole, ROLES, MATRIX, type Access } from "../lib/state";
import { Menu, Modal, Check, Skel } from "../ui/kit";
import { useTri } from "../ui/shell";

export function AdmHead({ title, sub, actions, children }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="adm-head">
      <div className="grow" style={{ minWidth: 0 }}>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
        {children}
      </div>
      {actions && <div className="row wrap g8">{actions}</div>}
    </header>
  );
}

/** Roles that have at least `need` on a module, for the "needs …" tooltip. */
function whoCan(mod: string, need: "view" | "edit" | "full") {
  const rank: Record<Access, number> = { none: 0, view: 1, own: 2, edit: 3, full: 4 };
  const r = { view: 1, edit: 3, full: 4 }[need];
  return ROLES.filter((x) => rank[MATRIX[mod]?.[x.id] ?? "none"] >= r);
}

/** A button that only works for roles with enough access; otherwise shows a lock and who can. */
export function Gate({
  mod,
  need = "edit",
  children,
  className = "btn",
  onClick,
  label,
}: {
  mod: string;
  need?: "view" | "edit" | "full";
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  /** Accessible name; required when the button shows only an icon. */
  label?: string;
}) {
  const { can } = useRole();
  const tri = useTri();
  const t = useT();
  if (can(mod, need)) {
    return (
      <button className={className} onClick={onClick} aria-label={label} data-tip={label}>
        {children}
      </button>
    );
  }
  const who = whoCan(mod, need)
    .slice(0, 2)
    .map((r) => tri(r.name))
    .join(" / ");
  return (
    <button className={`${className} gated`} disabled aria-label={`${label ? `${label}. ` : ""}${t("Needs", "Chahiye", "चाहिए")}: ${who}`} data-tip={`${t("Needs", "Chahiye", "चाहिए")}: ${who}`}>
      <Lock />
      {children}
    </button>
  );
}

/** Risky actions ask for a reason and go to a second person (4-eyes). */
export function FourEyes({
  open,
  onClose,
  title,
  what,
  needs = "Super admin",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  what: string;
  needs?: string;
}) {
  const t = useT();
  const toast = useToast();
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={
        <span className="opt-ic red">
          <ShieldAlert />
        </span>
      }
      title={title}
      sub={t(`This needs a second person (${needs}). Nothing changes until they approve.`, `Iske liye doosra insaan (${needs}) chahiye. Manzoori tak kuch nahi badlega.`, `इसके लिए दूसरी मंज़ूरी (${needs}) चाहिए।`)}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            {t("Cancel", "Raho", "रद्द")}
          </button>
          <button
            className="btn pri"
            onClick={() => {
              onClose();
              toast(t("Sent for approval · logged", "Approval ke liye gaya · log hua", "मंज़ूरी के लिए भेजा"));
            }}
          >
            {t("Send for approval", "Approval ke liye bhejo", "मंज़ूरी हेतु भेजें")}
          </button>
        </>
      }
    >
      <div className="col g12">
        <div className="well small">{what}</div>
        <div className="field">
          <label>{t("Reason (required, goes in the audit log)", "Wajah (zaroori, audit log me)", "कारण (ज़रूरी)")}</label>
          <textarea aria-label={t("Reason (required, goes in the audit log)", "Wajah (zaroori, audit log me)", "कारण (ज़रूरी)")} className="textarea" placeholder={t("Why is this needed?", "Kyun zaroori hai?", "क्यों ज़रूरी?")} />
        </div>
      </div>
    </Modal>
  );
}

export function RowMenu({ items }: { items: { label: string; icon?: ReactNode; danger?: boolean; onClick?: () => void }[] }) {
  return (
    <Menu
      width={210}
      trigger={(_, toggle) => (
        <button className="icon-btn sm" onClick={toggle} aria-label="More actions">
          <MoreHorizontal />
        </button>
      )}
    >
      {(close) =>
        items.map((it) => (
          <button
            key={it.label}
            className={`menu-item ${it.danger ? "dang" : ""}`}
            onClick={() => {
              close();
              it.onClick?.();
            }}
          >
            {it.icon}
            {it.label}
          </button>
        ))
      }
    </Menu>
  );
}

export function Toolbar({ placeholder, filters, right }: { placeholder: string; filters?: { label: string; on?: boolean }[]; right?: ReactNode }) {
  const [on, setOn] = useState<Record<string, boolean>>(Object.fromEntries((filters ?? []).map((f) => [f.label, !!f.on])));
  return (
    <div className="toolbar">
      <div className="input-ic" style={{ width: 280, maxWidth: "100%" }}>
        <Search />
        <input className="input sm" placeholder={placeholder} />
      </div>
      {filters?.map((f) => (
        <button key={f.label} className={`filter-chip ${on[f.label] ? "on" : ""}`} onClick={() => setOn((o) => ({ ...o, [f.label]: !o[f.label] }))}>
          {on[f.label] ? <X /> : <Filter />}
          {f.label}
        </button>
      ))}
      <span className="grow" />
      {right}
    </div>
  );
}

export function Pager({ total, shown }: { total: string; shown: string }) {
  return (
    <div className="pager">
      <span className="tiny faint">
        {shown} / {total}
      </span>
      <span className="grow" />
      <button className="icon-btn sm" aria-label="Previous page">
        <ChevronLeft />
      </button>
      <span className="tiny num">1</span>
      <button className="icon-btn sm" aria-label="Next page">
        <ChevronRight />
      </button>
    </div>
  );
}

/** Selectable table rows with a bulk action bar. */
export function useSelection(ids: string[]) {
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const count = ids.filter((i) => sel[i]).length;
  const all = count === ids.length && ids.length > 0;
  return {
    sel,
    count,
    all,
    toggle: (id: string) => setSel((s) => ({ ...s, [id]: !s[id] })),
    toggleAll: () => setSel(all ? {} : Object.fromEntries(ids.map((i) => [i, true]))),
    clear: () => setSel({}),
    box: (id: string) => <Check on={!!sel[id]} onChange={() => setSel((s) => ({ ...s, [id]: !s[id] }))} label="Select row" />,
  };
}

export function Status({ s, children }: { s: "live" | "review" | "draft" | "bad" | "info" | "ai"; children: ReactNode }) {
  return <span className={`status ${s}`}>{children}</span>;
}

export function Masked({ value, masked }: { value: string; masked: string }) {
  const [show, setShow] = useState(false);
  const toast = useToast();
  const t = useT();
  return (
    <span className="masked">
      <span className="mono">{show ? value : masked}</span>
      <button
        className="link tiny"
        onClick={() => {
          setShow(!show);
          if (!show) toast(t("Revealed · logged with your name", "Dikhaya · aapke naam se log", "दिखाया · लॉग"));
        }}
      >
        {show ? t("Hide", "Chhupao", "छिपाएँ") : t("Reveal", "Dikhao", "दिखाएँ")}
      </button>
    </span>
  );
}

/** Lists show a short skeleton on first open, the way the real panel waits for data (skipped for screenshots). */
export function useFirstLoad(ms = 650) {
  const [loading, setLoading] = useState(() => !document.documentElement.classList.contains("shots"));
  useEffect(() => {
    if (!loading) return;
    const id = window.setTimeout(() => setLoading(false), ms);
    return () => window.clearTimeout(id);
  }, [loading, ms]);
  return loading;
}

export function SkelRows({ rows = 6, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} aria-hidden="true">
          {Array.from({ length: cols }, (_, c) => (
            <td key={c}>
              <Skel w={c === 0 ? "70%" : `${40 + ((r * 7 + c * 13) % 40)}%`} h={12} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
