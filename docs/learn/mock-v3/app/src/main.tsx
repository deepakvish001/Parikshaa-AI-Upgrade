import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LayoutGrid, Hammer } from "lucide-react";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/kit.css";
import "./styles/shell.css";
import "./styles/focus.css";
import "./styles/admin.css";
import "./styles/admin-pages.css";
import "./styles/mock.css";
import "./styles/landing.css";
import "./styles/app.css";
import "./styles/work.css";
import "./styles/practice.css";
import "./styles/learn.css";
import "./styles/build.css";
import "./styles/career.css";
import "./styles/studio.css";
import "./styles/notebook.css";
import "./styles/interview.css";
import "./styles/v43.css";
import { LangProvider, ThemeProvider, ToastProvider, Link, useRoute, useT } from "./lib/core";
import { AiProvider, SideProvider, RoleProvider, useRole } from "./lib/state";
import { byId } from "./screens/registry";
import { SCREEN_MAP } from "./screens/index";
import { useVariant } from "./lib/variant";
import { Shell, useTri, KeySheet } from "./ui/shell";
import { AdminShell, NoAccess } from "./ui/admin-shell";
import { Diya } from "./ui/kit";

function Soon({ id }: { id: string }) {
  const t = useT();
  const tri = useTri();
  const s = byId(id);
  return (
    <div className="soon-page paper-grid">
      <Diya size={72} mood="think" />
      <h1 className="h1">{s ? tri(s.title) : id}</h1>
      <p className="muted">{t("This screen is being drawn in the next slice.", "Ye screen agle slice me ban rahi hai.", "यह स्क्रीन अगले चरण में बन रही है।")}</p>
      <Link to="map" className="btn pri">
        <Hammer />
        {t("See what is ready", "Kya taiyaar hai, dekho", "क्या तैयार है")}
      </Link>
    </div>
  );
}

function MockFab() {
  const t = useT();
  return (
    <Link to="map" className="mock-fab">
      <LayoutGrid />
      {t("All screens", "Saare screens", "सभी स्क्रीन")}
    </Link>
  );
}

function App() {
  const route = useRoute();
  const { can } = useRole();
  const def = byId(route) ?? byId("map")!;
  const impl = SCREEN_MAP[def.id];
  const Body = impl?.Body ?? (() => <Soon id={def.id} />);
  const Rail = impl?.Rail;
  // Today's timeline direction (mock v4.3) uses the full width, so it has no side column.
  const [aajV] = useVariant("aaj");
  const noRail = def.id === "aaj" && aajV === "c";
  if (def.layout === "bare" || def.layout === "admin-bare") {
    return (
      <>
        <Body />
        {def.id !== "map" && <MockFab />}
      </>
    );
  }
  if (def.layout === "focus") {
    return (
      <div className="focus-app" key={def.id}>
        <Body />
      </div>
    );
  }
  if (def.layout === "admin") {
    return (
      <>
        <AdminShell route={def.id}>{!def.mod || can(def.mod) ? <Body /> : <NoAccess mod={def.mod} />}</AdminShell>
        <MockFab />
      </>
    );
  }
  return (
    <>
      <Shell route={def.id} rail={Rail && !noRail ? <Rail /> : undefined}>
        <Body />
      </Shell>
      <MockFab />
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
          <RoleProvider>
            <SideProvider>
              <AiProvider>
                <App />
                <KeySheet />
              </AiProvider>
            </SideProvider>
          </RoleProvider>
        </ToastProvider>
      </LangProvider>
    </ThemeProvider>
  </StrictMode>,
);
