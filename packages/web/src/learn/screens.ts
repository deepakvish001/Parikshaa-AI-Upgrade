import {
  BadgeCheck,
  Bot,
  Brain,
  Bug,
  CalendarCheck,
  CalendarRange,
  Database,
  Hammer,
  House,
  Library,
  Mic,
  NotebookPen,
  RotateCcw,
  Route,
  Trophy,
  UserRound,
  Zap,
} from "lucide-react";
import { Bookmark, BookOpen, BriefcaseBusiness, Building2, ListChecks, MessagesSquare, Target, Users, type LearnIcon } from "./icons.tsx";

/**
 * Learn v2's screens in the learner's side bar: the mock's registry
 * (docs/learn/mock-v3/app/src/screens/registry.ts, the screens with
 * `nav: true` in the learner groups), in its order and with its words.
 * Each has a route of its own, /practice/<site>/<id>.
 */

/** English, Hinglish, Hindi: every Learn text has all three (DESIGN-SYSTEM §9). */
export type Tri = readonly [en: string, hg: string, hi: string];

export type GroupId = "today" | "learn" | "practice" | "career" | "mine";

export interface LearnGroup {
  readonly id: GroupId;
  readonly name: Tri;
}

export interface LearnScreen {
  readonly id: string;
  readonly group: GroupId;
  readonly icon: LearnIcon;
  readonly title: Tri;
  readonly desc: Tri;
}

/** The side bar's groups, in order. Aaj's group has no heading of its own. */
export const LEARN_GROUPS: readonly LearnGroup[] = [
  { id: "today", name: ["Today", "Aaj", "आज"] },
  { id: "learn", name: ["Learn", "Seekho", "सीखो"] },
  { id: "practice", name: ["Practice", "Abhyas", "अभ्यास"] },
  { id: "career", name: ["Career", "Career", "करियर"] },
  { id: "mine", name: ["Mine", "Mera", "मेरा"] },
];

const s = (screen: LearnScreen) => screen;

export const LEARN_SCREENS: readonly LearnScreen[] = [
  // today
  s({ id: "aaj", group: "today", icon: House, title: ["Today", "Aaj", "आज"], desc: ["What to do now", "Abhi kya karna hai", "अभी क्या करना है"] }),
  s({ id: "plan", group: "today", icon: CalendarRange, title: ["My plan", "Mera plan", "मेरी योजना"], desc: ["Sprints, days, missed days", "Sprints, din, chhoote din", "स्प्रिंट, दिन"] }),
  s({ id: "revision", group: "today", icon: RotateCcw, title: ["Revision", "Revision", "दोहराई"], desc: ["Cards due today and mistake notebook", "Aaj ke cards, galtiyon ki copy", "आज के कार्ड"] }),
  s({ id: "daily", group: "today", icon: Zap, title: ["Daily 10", "Daily 10", "रोज़ 10"], desc: ["Ten one-minute questions on the phone", "10 chhote sawaal, phone par", "10 छोटे सवाल"] }),
  // learn
  s({ id: "courses", group: "learn", icon: Library, title: ["Courses", "Courses", "कोर्स"], desc: ["Every course by goal and subject", "Goal aur subject se courses", "लक्ष्य से कोर्स"] }),
  s({ id: "roadmap", group: "learn", icon: Route, title: ["Roadmaps", "Roadmaps", "रोडमैप"], desc: ["Role roadmap you can follow", "Role ka roadmap", "भूमिका का रोडमैप"] }),
  s({ id: "ai-track", group: "learn", icon: Bot, title: ["Working with AI", "AI ke saath kaam", "AI के साथ काम"], desc: ["Skill track: context, plan, diff, tests, when not to use AI", "Skill track: context, plan, diff, tests, kab AI na lein", "कौशल ट्रैक"] }),
  // practice
  s({ id: "practice", group: "practice", icon: Target, title: ["Practice", "Abhyas", "अभ्यास"], desc: ["Tracks, sheets, today's problem", "Tracks, sheets, aaj ka problem", "ट्रैक, शीट"] }),
  s({ id: "sheet", group: "practice", icon: ListChecks, title: ["DSA sheet", "DSA sheet", "DSA शीट"], desc: ["Step-by-step problem sheet", "Kadam-dar-kadam sheet", "क्रमवार शीट"] }),
  s({ id: "sql", group: "practice", icon: Database, title: ["SQL", "SQL", "SQL"], desc: ["Same workspace as DSA: question, query, Sahayak", "DSA jaisa: sawaal, query, Sahayak", "DSA जैसा: प्रश्न, क्वेरी, सहायक"] }),
  s({ id: "aptitude", group: "practice", icon: Brain, title: ["Aptitude", "Aptitude", "एप्टीट्यूड"], desc: ["Quant, logical, verbal, mocks", "Quant, logical, verbal, mocks", "मात्रात्मक, तार्किक"] }),
  s({ id: "potd", group: "practice", icon: CalendarCheck, title: ["Problem of the day", "Aaj ka problem", "आज का प्रश्न"], desc: ["One problem a day, streak calendar", "Roz ek problem, streak", "रोज़ एक प्रश्न"] }),
  s({ id: "ai-drill", group: "practice", icon: Bug, title: ["Catch the AI", "Galat AI pakdo", "गलत AI पकड़ो"], desc: ["Five-minute daily drill on AI code that is almost right", "Roz 5 minute: lagbhag sahi AI code me galti pakdo", "रोज़ 5 मिनट का ड्रिल"] }),
  s({ id: "contests", group: "practice", icon: Trophy, title: ["Contests", "Contests", "प्रतियोगिताएँ"], desc: ["Upcoming, past, rating", "Aane wale, pichhle, rating", "आगामी, पिछली"] }),
  // career
  s({ id: "companies", group: "career", icon: Building2, title: ["Companies", "Companies", "कंपनियाँ"], desc: ["Prep by company, with sources", "Company ke hisaab se taiyari", "कंपनी के हिसाब से"] }),
  s({ id: "experiences", group: "career", icon: MessagesSquare, title: ["Interview experiences", "Interview experiences", "इंटरव्यू अनुभव"], desc: ["Round-by-round, checked", "Round-dar-round", "राउंड दर राउंड"] }),
  s({ id: "build", group: "career", icon: Hammer, title: ["Build", "Banao", "बनाओ"], desc: ["Projects and labs you ship", "Projects aur labs, ship karo", "प्रोजेक्ट और लैब"] }),
  s({ id: "interview", group: "career", icon: Mic, title: ["Mock interview", "Mock interview", "मॉक इंटरव्यू"], desc: ["Without AI or with AI; rubric with evidence", "Bina AI ya AI ke saath; saboot ke saath rubric", "बिना AI या AI के साथ"] }),
  s({ id: "pramaan", group: "career", icon: BadgeCheck, title: ["Pramaan", "Pramaan", "प्रमाण"], desc: ["Proctored skill certificates", "Proctored certificate", "प्रमाणपत्र"] }),
  s({ id: "profile", group: "career", icon: UserRound, title: ["Profile", "Profile", "प्रोफ़ाइल"], desc: ["Verified vs self-declared", "Verified vs khud bataya", "सत्यापित बनाम स्व-घोषित"] }),
  s({ id: "jobs", group: "career", icon: BriefcaseBusiness, title: ["Jobs & resume", "Jobs aur resume", "नौकरी और बायोडाटा"], desc: ["Jobs, applications, resume check", "Jobs, applications, resume", "नौकरी, आवेदन"] }),
  // mine
  s({ id: "lists", group: "mine", icon: Bookmark, title: ["My lists", "Meri lists", "मेरी सूचियाँ"], desc: ["Problem lists", "Problem lists", "सूचियाँ"] }),
  s({ id: "notes", group: "mine", icon: NotebookPen, title: ["Notes", "Notes", "नोट्स"], desc: ["Notes from your own mistakes", "Apni galtiyon se notes", "अपनी गलतियों से"] }),
  s({ id: "community", group: "mine", icon: Users, title: ["Community", "Community", "समुदाय"], desc: ["Discussions and study groups", "Charcha aur groups", "चर्चा और समूह"] }),
];

export const screenById = (id: string): LearnScreen | undefined => LEARN_SCREENS.find((screen) => screen.id === id);

/** A lesson (K2-4): not in the side bar, it opens from the sheet, Aaj or a note; it belongs to Seekho. */
export const LESSON_SCREEN: LearnScreen = {
  id: "lessons",
  group: "learn",
  icon: BookOpen,
  title: ["Lesson", "Lesson", "पाठ"],
  desc: ["Read, check yourself, note", "Padho, khud jaancho, note likho", "पढ़ो, जाँचो, नोट"],
};

/** Addresses below a screen (K2-4): `sheet/<track>` and `lessons/<lesson>`. */
export const SUB_ROUTE = /^(sheet|lessons)\/([a-z0-9][a-z0-9-]{0,120})$/;

/** The screen a route belongs to: its own, the sheet's for `sheet/<track>`, a lesson's for `lessons/<slug>`. */
export function screenOfRoute(route: string | null): LearnScreen | undefined {
  if (route === null) return undefined;
  const sub = SUB_ROUTE.exec(route);
  if (sub === null) return screenById(route);
  return sub[1] === "lessons" ? LESSON_SCREEN : screenById(sub[1]!);
}

/** The screen a phone's bottom tab stands for: Aaj, Seekho (its group) and Abhyas (its group). */
export const tabOf = (id: string): "aaj" | "learn" | "practice" | null => {
  const group = screenById(id)?.group;
  return id === "aaj" ? "aaj" : group === "learn" ? "learn" : group === "practice" ? "practice" : null;
};
