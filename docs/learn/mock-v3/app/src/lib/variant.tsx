import { useEffect, useState } from "react";

/* Mock-only switches kept in localStorage (pk43-v-<id>) and shared by every component that reads them.
   Only the screen-state switch (pk43-v-state) uses it now: the Today and Profile directions were settled on
   24 Oct 2026, so their switch is gone. The state switch goes in the mock clean-up step (44-5). */

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
