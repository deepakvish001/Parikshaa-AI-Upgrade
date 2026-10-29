import { useEffect, useState } from "react";

/* Mock-only switches kept in localStorage (pk43-v-<id>) and shared by every component that reads them, so the mock
   and its screenshots (VAR="id=value") can open any step: pk43-v-state (screen states), pk43-v-lab (ticket lab step),
   pk43-v-drill (drill step), pk43-v-read (code-reading step), pk43-v-cotab (company page tab), pk43-v-ivmode and pk43-v-ivphase (mock
   interview). The
   Today and Profile directions were settled on 24 Oct 2026, so their switch is gone; these go in the mock clean-up step
   (44-5). */

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
