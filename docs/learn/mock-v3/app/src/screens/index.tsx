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
import { BuildBody, ProjectBody, ProjectRail } from "./build";
import { StudioScreen } from "./studio";
import { CompaniesBody, CompanyBody, ExperiencesBody, PramaanBody, CertificateBody, JobsBody } from "./career";
import { ProfileBody, ProfileRail } from "./profile";
import { NotebookScreen } from "./notebook";
import { ListsBody, NotesBody, SahayakPageBody, CommunityBody, PlusBody, SettingsBody } from "./mine";
import { AdminLogin, AdminDashboard, ReviewQueue, Approvals } from "../admin/a-core";
import { AdmProblems, AdmProblemEditor, AdmAptitude, AdmLessons, AdmRoadmaps, AdmCompanies, AdmFactory } from "../admin/a-content";
import { AdmLearners, AdmLearner, AdmSupport, AdmCommunity } from "../admin/a-people";
import { AdmCommerce, AdmContests, AdmAI, AdmAnalytics, AdmNotify } from "../admin/a-business";
import { AdmRoles, AdmStaff, AdmAudit, AdmSecurity, AdmSystem } from "../admin/a-security";

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
  build: { Body: BuildBody },
  project: { Body: ProjectBody, Rail: ProjectRail },
  studio: { Body: StudioScreen },
  notebook: { Body: NotebookScreen },
  companies: { Body: CompaniesBody },
  company: { Body: CompanyBody },
  experiences: { Body: ExperiencesBody },
  pramaan: { Body: PramaanBody },
  certificate: { Body: CertificateBody },
  profile: { Body: ProfileBody, Rail: ProfileRail },
  jobs: { Body: JobsBody },
  lists: { Body: ListsBody },
  notes: { Body: NotesBody },
  sahayak: { Body: SahayakPageBody },
  community: { Body: CommunityBody },
  plus: { Body: PlusBody },
  settings: { Body: SettingsBody },
  // admin
  "admin-login": { Body: AdminLogin },
  admin: { Body: AdminDashboard },
  "adm-review": { Body: ReviewQueue },
  "adm-approvals": { Body: Approvals },
  "adm-problems": { Body: AdmProblems },
  "adm-problem": { Body: AdmProblemEditor },
  "adm-aptitude": { Body: AdmAptitude },
  "adm-lessons": { Body: AdmLessons },
  "adm-roadmaps": { Body: AdmRoadmaps },
  "adm-companies": { Body: AdmCompanies },
  "adm-factory": { Body: AdmFactory },
  "adm-learners": { Body: AdmLearners },
  "adm-learner": { Body: AdmLearner },
  "adm-support": { Body: AdmSupport },
  "adm-community": { Body: AdmCommunity },
  "adm-commerce": { Body: AdmCommerce },
  "adm-contests": { Body: AdmContests },
  "adm-ai": { Body: AdmAI },
  "adm-analytics": { Body: AdmAnalytics },
  "adm-notify": { Body: AdmNotify },
  "adm-roles": { Body: AdmRoles },
  "adm-staff": { Body: AdmStaff },
  "adm-audit": { Body: AdmAudit },
  "adm-security": { Body: AdmSecurity },
  "adm-system": { Body: AdmSystem },
};

for (const k of Object.keys(SCREEN_MAP)) READY.add(k);
