import type { ComponentType } from "react";
import { Hammer } from "lucide-react";
import { useT, Link } from "../lib/core";
import { SCREENS } from "./registry";
import { MapScreen } from "./map";
import { AajBody, AajRail } from "./aaj";
import { LandingScreen } from "./landing";
import { LoginScreen } from "./login";
import { OnboardingScreen } from "./onboarding";
import { PlanBody } from "./plan";
import { ProblemScreen } from "./problem";
import { SheetBody, SheetRail } from "./sheet";
import { EditorialBody } from "./editorial";
import { AbhyasBody } from "./abhyas";
import { SqlScreen } from "./sql";
import { AptitudeBody, AptSetBody, AptMockScreen, AptResultBody } from "./aptitude";
import { PotdBody } from "./potd";
import { ContestsBody, ContestBriefBody, ContestLiveScreen, ContestResultBody } from "./contests";

type View = { Body: ComponentType; Rail?: ComponentType };

function Soon() {
  const t = useT();
  const id = window.location.hash.replace("#", "");
  const s = SCREENS.find((x) => x.id === id);
  return (
    <div className="page narrow" style={{ paddingTop: 40 }}>
      <div className="panel pad-lg stack" style={{ alignItems: "flex-start" }}>
        <Hammer size={22} className="faint" />
        <h1 style={{ fontSize: "var(--fs-22)" }}>{s ? t(...s.title) : id}</h1>
        <p className="muted">{t("This screen is being built in the next batch.", "Ye screen agle batch me ban rahi hai.", "यह स्क्रीन अगले बैच में बन रही है।")}</p>
        <Link to="map" className="btn secondary sm">{t("All screens", "Saari screens", "सभी स्क्रीन")}</Link>
      </div>
    </div>
  );
}

const views: Record<string, View> = {
  map: { Body: MapScreen },
  aaj: { Body: AajBody, Rail: AajRail },
  landing: { Body: LandingScreen },
  login: { Body: LoginScreen },
  onboarding: { Body: OnboardingScreen },
  plan: { Body: PlanBody },
  problem: { Body: ProblemScreen },
  sheet: { Body: SheetBody, Rail: SheetRail },
  editorial: { Body: EditorialBody },
  abhyas: { Body: AbhyasBody },
  sql: { Body: SqlScreen },
  aptitude: { Body: AptitudeBody },
  "apt-set": { Body: AptSetBody },
  "apt-mock": { Body: AptMockScreen },
  "apt-result": { Body: AptResultBody },
  potd: { Body: PotdBody },
  contests: { Body: ContestsBody },
  "contest-brief": { Body: ContestBriefBody },
  "contest-live": { Body: ContestLiveScreen },
  "contest-result": { Body: ContestResultBody },
};

export const SCREEN_VIEWS: Record<string, View> = Object.fromEntries(
  SCREENS.map((s) => [s.id, views[s.id] ?? { Body: Soon }]),
);
