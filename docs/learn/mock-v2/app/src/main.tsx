import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { LayoutGrid } from "lucide-react";
import "./fonts.css";
import "./tokens.css";
import "./app.css";
import "./parts.css";
import "./screens.css";
import { LangProvider, ThemeProvider, ToastProvider, navigate, useRoute, useT } from "./lib/core";
import { SCREENS } from "./screens/registry";
import { SCREEN_VIEWS } from "./screens";
import { Shell } from "./ui/shell";

function MockButton() {
  const t = useT();
  return (
    <button type="button" className="mock-fab" onClick={() => navigate("map")}>
      <LayoutGrid size={15} />
      {t("All screens", "Saari screens", "सभी स्क्रीन")}
    </button>
  );
}

function App() {
  const route = useRoute();
  const screen = SCREENS.find((s) => s.id === route) ?? SCREENS[0];
  const view = SCREEN_VIEWS[screen.id];
  useEffect(() => {
    document.title = `${screen.title[0]} · Parikshaa Learn Mock`;
  }, [screen]);
  if (!view) return null;
  const Body = view.Body;
  const Rail = view.Rail;
  if (screen.layout === "bare" || screen.layout === "focus") {
    return (
      <>
        <div className="screen-enter" key={screen.id}>
          <Body />
        </div>
        {screen.id !== "map" && <MockButton />}
      </>
    );
  }
  return (
    <>
      <Shell screen={screen} rail={Rail ? <Rail /> : undefined}>
        <Body />
      </Shell>
      <MockButton />
    </>
  );
}

try {
  if (localStorage.getItem("pk-mock-shots") === "1") document.documentElement.classList.add("shots");
} catch {
  /* storage blocked */
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <LangProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </LangProvider>
    </ThemeProvider>
  </StrictMode>,
);
