import { useEffect, useState } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

/**
 * Light, dark, or whatever the computer says. An invigilator in a darkened
 * hall often wants dark while their machine is set to light. Remembered on
 * this device; the tokens do the rest (`data-theme` on the page).
 */

export type Theme = "system" | "light" | "dark";
const KEY = "parikshaa.console.theme";

const stored = (): Theme => {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
};

/** Puts the chosen theme on the page. Call once, as the console starts. */
export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(stored);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      if (theme === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {
      // Remembered for this page only.
    }
  }, [theme]);
  return [theme, setTheme];
}

const CHOICES: readonly (readonly [Theme, string, LucideIcon])[] = [
  ["system", "Match the computer", Monitor],
  ["light", "Light", Sun],
  ["dark", "Dark", Moon],
];

export function ThemeSwitch({ theme, onChange }: { theme: Theme; onChange: (next: Theme) => void }) {
  return (
    <div className="theme-switch" role="group" aria-label="Theme">
      {CHOICES.map(([id, label, Icon]) => (
        <button key={id} type="button" aria-pressed={theme === id} aria-label={label} title={label} onClick={() => onChange(id)}>
          <Icon aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
