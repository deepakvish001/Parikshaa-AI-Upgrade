import { useEffect, useState, type ReactNode } from "react";
import { useT } from "./core";

/* Mock v4.3: some screens come in a few directions so the owner can compare them and pick one.
   The choice is kept per screen in localStorage (pk43-v-<screen>) and shared by the page body and its rail. */

const key = (id: string) => `pk43-v-${id}`;

function read(id: string, def: string) {
  try {
    return localStorage.getItem(key(id)) || def;
  } catch {
    return def;
  }
}

export function useVariant(id: string, def = "a"): [string, (v: string) => void] {
  const [v, setV] = useState(() => read(id, def));
  useEffect(() => {
    const h = () => setV(read(id, def));
    window.addEventListener("pk-variant", h);
    return () => window.removeEventListener("pk-variant", h);
  }, [id, def]);
  const set = (x: string) => {
    try {
      localStorage.setItem(key(id), x);
    } catch {
      /* storage blocked: the choice lasts until reload */
    }
    setV(x);
    window.dispatchEvent(new Event("pk-variant"));
  };
  return [v, set];
}

/** The switch shown above a screen that has directions. It is mock chrome, not product UI. */
export function VariantBar({ id, items, note }: { id: string; items: { id: string; label: string; hint: string }[]; note?: ReactNode }) {
  const t = useT();
  const [v, set] = useVariant(id);
  const cur = items.find((x) => x.id === v) ?? items[0];
  return (
    <div className="variant-bar" role="group" aria-label={t("Compare directions (mock)", "Roop chuno (mock)", "रूप चुनें (मॉक)")}>
      <span className="vb-tag">{t("Mock · pick a direction", "Mock · roop chuno", "मॉक · रूप चुनें")}</span>
      <div className="vb-opts">
        {items.map((x) => (
          <button key={x.id} className="vb-opt" aria-pressed={v === x.id} onClick={() => set(x.id)}>
            <b>{x.id.toUpperCase()}</b>
            <span>{x.label}</span>
          </button>
        ))}
      </div>
      <span className="vb-hint tiny">{note ?? cur.hint}</span>
    </div>
  );
}
