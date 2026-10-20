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
import { CoursesBody, RoadmapBody, CourseBody, CourseRail, LessonBody, LessonRail } from "./learn";
import { AptitudeBody, AptSetBody, AptMockScreen, AptResultBody } from "./aptitude";
import { PotdBody, ContestsBody, ContestBriefBody, ContestLiveScreen, ContestResultBody } from "./compete";

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
  courses: { Body: CoursesBody },
  roadmap: { Body: RoadmapBody },
  course: { Body: CourseBody, Rail: CourseRail },
  lesson: { Body: LessonBody, Rail: LessonRail },
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

for (const k of Object.keys(SCREEN_MAP)) READY.add(k);
