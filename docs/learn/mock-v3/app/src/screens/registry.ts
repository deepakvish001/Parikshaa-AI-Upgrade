import {
  House,
  CalendarRange,
  RotateCcw,
  Zap,
  Library,
  Route,
  GraduationCap,
  BookOpen,
  Target,
  ListChecks,
  CodeXml,
  FileText,
  Database,
  Brain,
  ClipboardList,
  Timer,
  ChartColumn,
  CalendarCheck,
  Trophy,
  Flag,
  Building2,
  MessagesSquare,
  Hammer,
  SquareTerminal,
  FolderKanban,
  BadgeCheck,
  ScrollText,
  UserRound,
  BriefcaseBusiness,
  Bookmark,
  NotebookPen,
  Sparkles,
  Users,
  Crown,
  Settings,
  Map,
  Globe,
  LogIn,
  WandSparkles,
  Palette,
  ShieldCheck,
  LayoutDashboard,
  FileCode2,
  ListTodo,
  Factory,
  UsersRound,
  UserCog,
  LifeBuoy,
  IndianRupee,
  MessageSquareWarning,
  Medal,
  Bot,
  ChartLine,
  Megaphone,
  KeyRound,
  ContactRound,
  Stamp,
  ScrollText as Audit,
  Server,
  Network,
  Calculator,
  Layers,
  type LucideIcon,
} from "lucide-react";

export type Tri = [string, string, string];
export type Layout = "shell" | "focus" | "bare" | "admin" | "admin-bare";
export type ScreenDef = {
  id: string;
  group: string;
  layout: Layout;
  title: Tri;
  desc: Tri;
  icon: LucideIcon;
  /** shown in the learner sidebar or the admin sidebar */
  nav?: boolean;
  parent?: string;
  badge?: string;
  /** admin module key used by the permission matrix */
  mod?: string;
};

const s = (d: ScreenDef) => d;

/* Learner sidebar groups, in order. */
export const LEARN_GROUPS: { id: string; name: Tri }[] = [
  { id: "today", name: ["", "", ""] },
  { id: "learn", name: ["Learn", "Seekho", "सीखो"] },
  { id: "practice", name: ["Practice", "Abhyas", "अभ्यास"] },
  { id: "career", name: ["Career", "Career", "करियर"] },
  { id: "mine", name: ["Mine", "Mera", "मेरा"] },
];

/* Admin sidebar groups, in order. */
export const ADMIN_GROUPS: { id: string; name: Tri }[] = [
  { id: "a-home", name: ["", "", ""] },
  { id: "a-content", name: ["Content", "Content", "सामग्री"] },
  { id: "a-people", name: ["People", "Log", "लोग"] },
  { id: "a-business", name: ["Business", "Business", "व्यापार"] },
  { id: "a-ops", name: ["Platform", "Platform", "प्लेटफ़ॉर्म"] },
  { id: "a-security", name: ["Security", "Suraksha", "सुरक्षा"] },
];

export const SCREENS: ScreenDef[] = [
  // mock pages
  s({ id: "map", group: "mock", layout: "bare", icon: Map, title: ["All screens", "Saare screens", "सभी स्क्रीन"], desc: ["Every screen and flow of mock v3", "Mock v3 ke saare screens aur flow", "मॉक v3 की हर स्क्रीन"] }),
  s({ id: "brand", group: "mock", layout: "bare", icon: Palette, title: ["Brand & design system", "Brand aur design system", "ब्रांड और डिज़ाइन"], desc: ["Logo, colours, type, components, motion", "Logo, rang, font, components, motion", "लोगो, रंग, फ़ॉन्ट, घटक"] }),

  // entry
  s({ id: "landing", group: "entry", layout: "bare", icon: Globe, title: ["Home (landing)", "Home (landing)", "होम"], desc: ["What Parikshaa is, for learners and colleges", "Parikshaa kya hai", "परीक्षा क्या है"] }),
  s({ id: "login", group: "entry", layout: "bare", icon: LogIn, title: ["Sign in", "Sign in", "साइन इन"], desc: ["Google, phone OTP, email", "Google, phone OTP, email", "गूगल, फ़ोन OTP, ईमेल"] }),
  s({ id: "onboarding", group: "entry", layout: "bare", icon: WandSparkles, title: ["Onboarding", "Onboarding", "शुरुआत"], desc: ["Six questions, then your plan", "6 sawaal, phir aapka plan", "6 सवाल, फिर योजना"] }),

  // today
  s({ id: "aaj", group: "today", layout: "shell", nav: true, icon: House, title: ["Today", "Aaj", "आज"], desc: ["What to do now", "Abhi kya karna hai", "अभी क्या करना है"] }),
  s({ id: "plan", group: "today", layout: "shell", nav: true, icon: CalendarRange, title: ["My plan", "Mera plan", "मेरी योजना"], desc: ["Sprints, days, missed days", "Sprints, din, chhoote din", "स्प्रिंट, दिन"] }),
  s({ id: "revision", group: "today", layout: "shell", nav: true, icon: RotateCcw, badge: "6", title: ["Revision", "Revision", "दोहराई"], desc: ["Cards due today and mistake notebook", "Aaj ke cards, galtiyon ki copy", "आज के कार्ड"] }),
  s({ id: "daily", group: "today", layout: "shell", nav: true, icon: Zap, title: ["Daily 10", "Daily 10", "रोज़ 10"], desc: ["Ten one-minute questions on the phone", "10 chhote sawaal, phone par", "10 छोटे सवाल"] }),

  // learn
  s({ id: "courses", group: "learn", layout: "shell", nav: true, icon: Library, title: ["Courses", "Courses", "कोर्स"], desc: ["Every course by goal and subject", "Goal aur subject se courses", "लक्ष्य से कोर्स"] }),
  s({ id: "roadmap", group: "learn", layout: "shell", nav: true, icon: Route, title: ["Roadmaps", "Roadmaps", "रोडमैप"], desc: ["Role roadmap you can follow", "Role ka roadmap", "भूमिका का रोडमैप"] }),
  s({ id: "course", group: "learn", layout: "shell", parent: "courses", icon: GraduationCap, title: ["Course", "Course", "कोर्स"], desc: ["Syllabus, progress, project", "Syllabus, pragati, project", "पाठ्यक्रम"] }),
  s({ id: "lesson", group: "learn", layout: "shell", parent: "course", icon: BookOpen, title: ["Lesson", "Lesson", "पाठ"], desc: ["Read, try, quiz, notes in the margin", "Padho, chalao, quiz", "पढ़ो, चलाओ, क्विज़"] }),

  // practice
  s({ id: "practice", group: "practice", layout: "shell", nav: true, icon: Target, title: ["Practice", "Abhyas", "अभ्यास"], desc: ["Tracks, sheets, today's problem", "Tracks, sheets, aaj ka problem", "ट्रैक, शीट"] }),
  s({ id: "sheet", group: "practice", layout: "shell", nav: true, icon: ListChecks, title: ["DSA sheet", "DSA sheet", "DSA शीट"], desc: ["Step-by-step problem sheet", "Kadam-dar-kadam sheet", "क्रमवार शीट"] }),
  s({ id: "problem", group: "practice", layout: "focus", parent: "sheet", icon: CodeXml, title: ["Problem workspace", "Problem workspace", "प्रश्न कार्यक्षेत्र"], desc: ["Problem and code; Sahayak opens a third pane", "Problem aur code; Sahayak se teesra pane", "प्रश्न और कोड; सहायक तीसरा पैन"] }),
  s({ id: "editorial", group: "practice", layout: "shell", parent: "sheet", icon: FileText, title: ["Editorial", "Editorial", "हल"], desc: ["Brute, better, best with a dry run", "Brute, better, best, dry run", "ड्राई रन के साथ"] }),
  s({ id: "sql", group: "practice", layout: "focus", nav: true, icon: Database, title: ["SQL", "SQL", "SQL"], desc: ["Same workspace as DSA: question, query, Sahayak", "DSA jaisa: sawaal, query, Sahayak", "DSA जैसा: प्रश्न, क्वेरी, सहायक"] }),
  s({ id: "aptitude", group: "practice", layout: "shell", nav: true, icon: Brain, title: ["Aptitude", "Aptitude", "एप्टीट्यूड"], desc: ["Quant, logical, verbal, mocks", "Quant, logical, verbal, mocks", "मात्रात्मक, तार्किक"] }),
  s({ id: "apt-set", group: "practice", layout: "shell", parent: "aptitude", icon: ClipboardList, title: ["Practice set", "Practice set", "अभ्यास सेट"], desc: ["Questions with method and shortcut", "Tareeka aur shortcut", "तरीका और शॉर्टकट"] }),
  s({ id: "apt-mock", group: "practice", layout: "focus", parent: "aptitude", icon: Timer, title: ["Mock test", "Mock test", "मॉक टेस्ट"], desc: ["Timed test like the real one", "Asli jaisa timed test", "समयबद्ध टेस्ट"] }),
  s({ id: "apt-result", group: "practice", layout: "shell", parent: "aptitude", icon: ChartColumn, title: ["Mock result", "Mock ka nateeja", "मॉक परिणाम"], desc: ["Score, time per question, weak topics", "Score, har sawaal ka samay", "स्कोर, समय"] }),
  s({ id: "potd", group: "practice", layout: "shell", nav: true, icon: CalendarCheck, title: ["Problem of the day", "Aaj ka problem", "आज का प्रश्न"], desc: ["One problem a day, streak calendar", "Roz ek problem, streak", "रोज़ एक प्रश्न"] }),
  s({ id: "contests", group: "practice", layout: "shell", nav: true, icon: Trophy, title: ["Contests", "Contests", "प्रतियोगिताएँ"], desc: ["Upcoming, past, rating", "Aane wale, pichhle, rating", "आगामी, पिछली"] }),
  s({ id: "contest-brief", group: "practice", layout: "shell", parent: "contests", icon: Flag, title: ["Contest rules", "Contest ke niyam", "नियम"], desc: ["Rules and start", "Niyam aur shuru", "नियम और शुरू"] }),
  s({ id: "contest-live", group: "practice", layout: "focus", parent: "contests", icon: Timer, title: ["Contest (live)", "Contest (live)", "प्रतियोगिता (लाइव)"], desc: ["Timer, problems, editor", "Timer, problems, editor", "टाइमर, प्रश्न"] }),
  s({ id: "contest-result", group: "practice", layout: "shell", parent: "contests", icon: ChartColumn, title: ["Contest result", "Contest ka nateeja", "परिणाम"], desc: ["Rank, rating change, what to learn", "Rank, rating, kya seekhna", "रैंक, रेटिंग"] }),

  // career
  s({ id: "companies", group: "career", layout: "shell", nav: true, icon: Building2, title: ["Companies", "Companies", "कंपनियाँ"], desc: ["Prep by company, with sources", "Company ke hisaab se taiyari", "कंपनी के हिसाब से"] }),
  s({ id: "company", group: "career", layout: "shell", parent: "companies", icon: Building2, title: ["Company page", "Company page", "कंपनी पेज"], desc: ["Rounds, topics, problems, readiness", "Rounds, topics, readiness", "राउंड, विषय"] }),
  s({ id: "experiences", group: "career", layout: "shell", nav: true, icon: MessagesSquare, title: ["Interview experiences", "Interview experiences", "इंटरव्यू अनुभव"], desc: ["Round-by-round, checked", "Round-dar-round", "राउंड दर राउंड"] }),
  s({ id: "build", group: "career", layout: "shell", nav: true, icon: Hammer, title: ["Build", "Banao", "बनाओ"], desc: ["Projects and labs you ship", "Projects aur labs, ship karo", "प्रोजेक्ट और लैब"] }),
  s({ id: "project", group: "career", layout: "shell", parent: "build", icon: FolderKanban, title: ["Project", "Project", "प्रोजेक्ट"], desc: ["Spec, milestones, rubric", "Spec, milestones, rubric", "स्पेक, माइलस्टोन"] }),
  s({ id: "studio", group: "career", layout: "focus", parent: "build", icon: SquareTerminal, title: ["Code Studio", "Code Studio", "कोड स्टूडियो"], desc: ["Files, editor, live preview, tests", "Files, editor, preview, tests", "फ़ाइलें, प्रीव्यू"] }),
  s({ id: "pramaan", group: "career", layout: "shell", nav: true, icon: BadgeCheck, title: ["Pramaan", "Pramaan", "प्रमाण"], desc: ["Proctored skill certificates", "Proctored certificate", "प्रमाणपत्र"] }),
  s({ id: "certificate", group: "career", layout: "shell", parent: "pramaan", icon: ScrollText, title: ["Certificate", "Certificate", "प्रमाणपत्र"], desc: ["Verify by QR, share", "QR se verify, share", "QR से सत्यापन"] }),
  s({ id: "profile", group: "career", layout: "shell", nav: true, icon: UserRound, title: ["Profile", "Profile", "प्रोफ़ाइल"], desc: ["Verified vs self-declared", "Verified vs khud bataya", "सत्यापित बनाम स्व-घोषित"] }),
  s({ id: "jobs", group: "career", layout: "shell", nav: true, icon: BriefcaseBusiness, title: ["Jobs & resume", "Jobs aur resume", "नौकरी और बायोडाटा"], desc: ["Jobs, applications, resume check", "Jobs, applications, resume", "नौकरी, आवेदन"] }),

  // mine
  s({ id: "lists", group: "mine", layout: "shell", nav: true, icon: Bookmark, title: ["My lists", "Meri lists", "मेरी सूचियाँ"], desc: ["Problem lists", "Problem lists", "सूचियाँ"] }),
  s({ id: "notes", group: "mine", layout: "shell", nav: true, icon: NotebookPen, title: ["Notes", "Notes", "नोट्स"], desc: ["Notes from your own mistakes", "Apni galtiyon se notes", "अपनी गलतियों से"] }),
  s({ id: "community", group: "mine", layout: "shell", nav: true, icon: Users, title: ["Community", "Community", "समुदाय"], desc: ["Discussions and study groups", "Charcha aur groups", "चर्चा और समूह"] }),
  s({ id: "sahayak", group: "mine", layout: "shell", icon: Sparkles, title: ["Sahayak", "Sahayak", "सहायक"], desc: ["AI tutor, full page", "AI tutor, poora page", "एआई शिक्षक"] }),
  s({ id: "plus", group: "mine", layout: "shell", icon: Crown, title: ["Plus", "Plus", "प्लस"], desc: ["Free vs Plus", "Free vs Plus", "फ़्री बनाम प्लस"] }),
  s({ id: "settings", group: "mine", layout: "shell", icon: Settings, title: ["Settings", "Settings", "सेटिंग्स"], desc: ["Language, theme, privacy, alerts", "Bhasha, theme, privacy", "भाषा, थीम"] }),

  // admin
  s({ id: "admin-login", group: "a-entry", layout: "admin-bare", icon: ShieldCheck, title: ["Staff sign-in", "Staff sign-in", "स्टाफ़ साइन इन"], desc: ["SSO or email, then 2FA", "SSO ya email, phir 2FA", "SSO, फिर 2FA"] }),
  s({ id: "admin", group: "a-home", layout: "admin", nav: true, mod: "dashboard", icon: LayoutDashboard, title: ["Dashboard", "Dashboard", "डैशबोर्ड"], desc: ["Today's numbers and what needs you", "Aaj ke number, kya dekhna hai", "आज के आँकड़े"] }),
  s({ id: "adm-review", group: "a-home", layout: "admin", nav: true, mod: "review", badge: "14", icon: ListTodo, title: ["Review queue", "Review queue", "समीक्षा"], desc: ["Approve, send back, reject", "Approve, wapas, reject", "स्वीकृति"] }),
  s({ id: "adm-problems", group: "a-content", layout: "admin", nav: true, mod: "content", icon: FileCode2, title: ["Problems", "Problems", "प्रश्न"], desc: ["Every coding problem", "Saare coding problems", "सभी प्रश्न"] }),
  s({ id: "adm-problem", group: "a-content", layout: "admin", parent: "adm-problems", mod: "content", icon: FileCode2, title: ["Problem editor", "Problem editor", "प्रश्न संपादक"], desc: ["Statement, tests, solutions, checks", "Statement, tests, checks", "कथन, टेस्ट"] }),
  s({ id: "adm-aptitude", group: "a-content", layout: "admin", nav: true, mod: "content", icon: Calculator, title: ["Aptitude & quiz", "Aptitude aur quiz", "एप्टीट्यूड"], desc: ["Items, sets, mock builder", "Items, sets, mock builder", "आइटम, मॉक"] }),
  s({ id: "adm-lessons", group: "a-content", layout: "admin", nav: true, mod: "content", icon: BookOpen, title: ["Courses & lessons", "Courses aur lessons", "कोर्स और पाठ"], desc: ["Course tree and block editor", "Course tree, block editor", "ब्लॉक संपादक"] }),
  s({ id: "adm-roadmaps", group: "a-content", layout: "admin", nav: true, mod: "content", icon: Network, title: ["Roadmaps & sheets", "Roadmaps aur sheets", "रोडमैप"], desc: ["Graph editor, sheet order", "Graph editor, sheet kram", "ग्राफ़ संपादक"] }),
  s({ id: "adm-companies", group: "a-content", layout: "admin", nav: true, mod: "content", icon: Building2, title: ["Companies data", "Companies data", "कंपनी डेटा"], desc: ["Rounds and patterns, each with a source", "Har data source ke saath", "स्रोत के साथ"] }),
  s({ id: "adm-factory", group: "a-content", layout: "admin", nav: true, mod: "factory", icon: Factory, title: ["Content factory", "Content factory", "कंटेंट फ़ैक्टरी"], desc: ["Batches, stages, spend", "Batches, stages, kharch", "बैच, खर्च"] }),
  s({ id: "adm-learners", group: "a-people", layout: "admin", nav: true, mod: "learners", icon: UsersRound, title: ["Learners", "Learners", "शिक्षार्थी"], desc: ["Search, filter, act", "Khojo, filter, kaam", "खोजें"] }),
  s({ id: "adm-learner", group: "a-people", layout: "admin", parent: "adm-learners", mod: "learners", icon: ContactRound, title: ["Learner", "Learner", "शिक्षार्थी"], desc: ["Profile, plan, activity, actions", "Profile, plan, activity", "प्रोफ़ाइल, गतिविधि"] }),
  s({ id: "adm-support", group: "a-people", layout: "admin", nav: true, mod: "support", badge: "9", icon: LifeBuoy, title: ["Support & reports", "Support aur reports", "सहायता"], desc: ["Tickets and 'report a mistake'", "Tickets aur reports", "टिकट"] }),
  s({ id: "adm-community", group: "a-people", layout: "admin", nav: true, mod: "community", icon: MessageSquareWarning, title: ["Community", "Community", "समुदाय"], desc: ["Flags, experiences, bans", "Flags, experiences, ban", "फ़्लैग"] }),
  s({ id: "adm-commerce", group: "a-business", layout: "admin", nav: true, mod: "commerce", icon: IndianRupee, title: ["Plans & payments", "Plans aur payments", "योजनाएँ, भुगतान"], desc: ["Plans, coupons, orders, refunds", "Plans, coupons, refunds", "कूपन, रिफ़ंड"] }),
  s({ id: "adm-contests", group: "a-business", layout: "admin", nav: true, mod: "contests", icon: Medal, title: ["Contests", "Contests", "प्रतियोगिताएँ"], desc: ["Create, monitor live, plagiarism", "Banao, live, plagiarism", "बनाएँ, निगरानी"] }),
  s({ id: "adm-ai", group: "a-business", layout: "admin", nav: true, mod: "ai", icon: Bot, title: ["Sahayak AI", "Sahayak AI", "सहायक एआई"], desc: ["Usage, limits, prompts, evals, kill switch", "Usage, limits, evals", "उपयोग, सीमा"] }),
  s({ id: "adm-analytics", group: "a-business", layout: "admin", nav: true, mod: "analytics", icon: ChartLine, title: ["Analytics", "Analytics", "विश्लेषण"], desc: ["Funnel, retention, content", "Funnel, retention, content", "फ़नल"] }),
  s({ id: "adm-notify", group: "a-business", layout: "admin", nav: true, mod: "notify", icon: Megaphone, title: ["Messages", "Messages", "संदेश"], desc: ["Templates and campaigns", "Templates aur campaigns", "टेम्पलेट"] }),
  s({ id: "adm-system", group: "a-ops", layout: "admin", nav: true, mod: "system", icon: Server, title: ["System", "System", "सिस्टम"], desc: ["Health, flags, settings", "Health, flags, settings", "स्वास्थ्य, फ़्लैग"] }),
  s({ id: "adm-roles", group: "a-security", layout: "admin", nav: true, mod: "security", icon: KeyRound, title: ["Roles & permissions", "Roles aur permissions", "भूमिकाएँ"], desc: ["Who can do what", "Kaun kya kar sakta hai", "कौन क्या कर सकता"] }),
  s({ id: "adm-staff", group: "a-security", layout: "admin", nav: true, mod: "security", icon: UserCog, title: ["Staff", "Staff", "स्टाफ़"], desc: ["Invite, 2FA, sessions", "Invite, 2FA, sessions", "आमंत्रण, 2FA"] }),
  s({ id: "adm-approvals", group: "a-security", layout: "admin", nav: true, mod: "approvals", badge: "3", icon: Stamp, title: ["Approvals (4-eyes)", "Approvals (4-eyes)", "दोहरी मंज़ूरी"], desc: ["Risky actions need a second person", "Risky kaam par doosra insaan", "दूसरी मंज़ूरी"] }),
  s({ id: "adm-audit", group: "a-security", layout: "admin", nav: true, mod: "audit", icon: Audit, title: ["Audit log", "Audit log", "ऑडिट लॉग"], desc: ["Who did what, when, before and after", "Kisne kya kab kiya", "किसने क्या किया"] }),
  s({ id: "adm-security", group: "a-security", layout: "admin", nav: true, mod: "security", icon: Layers, title: ["Security settings", "Security settings", "सुरक्षा सेटिंग"], desc: ["2FA, IP list, sessions, keys, DPDP", "2FA, IP, sessions, keys", "2FA, IP, कुंजियाँ"] }),
];

export const byId = (id: string) => SCREENS.find((x) => x.id === id);

export const FLOWS: { name: Tri; ids: string[] }[] = [
  { name: ["First visit", "Pehli baar", "पहली बार"], ids: ["landing", "login", "onboarding", "aaj"] },
  { name: ["Daily loop", "Roz ka loop", "रोज़ का चक्र"], ids: ["aaj", "plan", "problem", "editorial", "revision", "daily"] },
  { name: ["Learn", "Seekho", "सीखो"], ids: ["courses", "roadmap", "course", "lesson"] },
  { name: ["Practice", "Abhyas", "अभ्यास"], ids: ["practice", "sheet", "problem", "sql", "potd"] },
  { name: ["Aptitude", "Aptitude", "एप्टीट्यूड"], ids: ["aptitude", "apt-set", "apt-mock", "apt-result"] },
  { name: ["Contests", "Contests", "प्रतियोगिता"], ids: ["contests", "contest-brief", "contest-live", "contest-result"] },
  { name: ["Companies", "Companies", "कंपनियाँ"], ids: ["companies", "company", "experiences"] },
  { name: ["Build", "Banao", "बनाओ"], ids: ["build", "project", "studio"] },
  { name: ["Career", "Career", "करियर"], ids: ["pramaan", "certificate", "profile", "jobs"] },
  { name: ["Mine", "Mera", "मेरा"], ids: ["lists", "notes", "sahayak", "community", "plus", "settings"] },
];
