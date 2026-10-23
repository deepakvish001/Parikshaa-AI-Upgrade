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
import { STATE_SCREENS, useMockState, StateBody, OfflineBanner, FirstCard, FocusState, StateFab } from "./ui/states";
import { Skel } from "./ui/kit";
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

/** Side column while a core screen loads. */
function RailSkel() {
  return (
    <>
      {[0, 1].map((i) => (
        <div key={i} className="card pad col g10" aria-hidden="true">
          <Skel w="45%" h={14} />
          <Skel w="70%" h={26} />
          <Skel h={12} />
          <Skel w="60%" h={12} />
        </div>
      ))}
    </>
  );
}

function App() {
  const route = useRoute();
  const tri = useTri();
  const { can } = useRole();
  const def = byId(route) ?? byId("map")!;
  const impl = SCREEN_MAP[def.id];
  const Body = impl?.Body ?? (() => <Soon id={def.id} />);
  const Rail = impl?.Rail;
  // Today's timeline direction (mock v4.3) uses the full width, so it has no side column.
  const [aajV] = useVariant("aaj");
  const noRail = def.id === "aaj" && aajV === "c";
  // Mock v4.3: the twelve core screens can be seen empty, loading, failing, offline or on a first visit.
  const [mstate] = useMockState();
  const core = STATE_SCREENS.includes(def.id);
  const st = core ? mstate : "ok";
  const replaced = st === "empty" || st === "loading" || st === "error";
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
        {replaced ? (
          <FocusState id={def.id} title={tri(def.title)} state={st} />
        ) : (
          <>
            <Body />
            {st === "offline" && (
              <div className="st-float">
                <OfflineBanner />
              </div>
            )}
            {st === "first" && <FirstCard id={def.id} floating />}
          </>
        )}
        {core && <StateFab />}
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
      <Shell route={def.id} rail={st === "loading" ? <RailSkel /> : replaced ? undefined : Rail && !noRail ? <Rail /> : undefined}>
        {replaced ? (
          <StateBody id={def.id} state={st} />
        ) : (
          <>
            {st === "offline" && <OfflineBanner />}
            {st === "first" && <FirstCard id={def.id} />}
            <Body />
          </>
        )}
      </Shell>
      <MockFab />
      {core && <StateFab />}
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
