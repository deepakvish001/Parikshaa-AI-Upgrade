import type { ComponentType } from "react";
import { READY } from "./ready";
import { MapBody } from "./map";
import { BrandBody } from "./brand";
import { LandingBody } from "./landing";
import { LoginBody, OnboardingBody } from "./entry";
import { AajBody, AajRail, PlanBody } from "./today";
import { ProblemScreen, SqlScreen } from "./problem";
import { EditorialBody, EditorialRail } from "./editorial";
import { PracticeBody, SheetBody, SheetRail } from "./practice";
import { RevisionBody, RevisionRail, DailyBody } from "./revise";

export type ScreenImpl = { Body: ComponentType; Rail?: ComponentType };

export const SCREEN_MAP: Record<string, ScreenImpl> = {
  map: { Body: MapBody },
  brand: { Body: BrandBody },
  landing: { Body: LandingBody },
  login: { Body: LoginBody },
  onboarding: { Body: OnboardingBody },
  aaj: { Body: AajBody, Rail: AajRail },
  plan: { Body: PlanBody },
  problem: { Body: ProblemScreen },
  sql: { Body: SqlScreen },
  editorial: { Body: EditorialBody, Rail: EditorialRail },
  practice: { Body: PracticeBody },
  sheet: { Body: SheetBody, Rail: SheetRail },
  revision: { Body: RevisionBody, Rail: RevisionRail },
  daily: { Body: DailyBody },
};

for (const k of Object.keys(SCREEN_MAP)) READY.add(k);
