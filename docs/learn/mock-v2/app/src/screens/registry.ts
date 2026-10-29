import {
  LayoutDashboard,
  CalendarDays,
  RotateCcw,
  Zap,
  Compass,
  Route,
  BookOpen,
  GraduationCap,
  Dumbbell,
  ListChecks,
  CodeXml,
  Database,
  Brain,
  CalendarCheck,
  Trophy,
  Building2,
  MessageSquareText,
  Hammer,
  SquareTerminal,
  FolderKanban,
  Award,
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
  FileText,
  Timer,
  ChartColumn,
  Flag,
  type LucideIcon,
} from "lucide-react";

export type Tri = [string, string, string];
export type ScreenDef = {
  id: string;
  section: string;
  layout: "shell" | "focus" | "bare";
  title: Tri;
  desc: Tri;
  icon: LucideIcon;
  nav?: boolean;
  hidden?: boolean;
  parent?: string;
  badge?: string;
};

export const SECTIONS: { id: string; name: Tri; home: string }[] = [
  { id: "aaj", name: ["Today", "Aaj", "आज"], home: "aaj" },
  { id: "seekho", name: ["Learn", "Seekho", "सीखो"], home: "seekho" },
  { id: "abhyas", name: ["Practice", "Abhyas", "अभ्यास"], home: "abhyas" },
  { id: "companies", name: ["Companies", "Companies", "कंपनियाँ"], home: "companies" },
  { id: "banao", name: ["Build", "Banao", "बनाओ"], home: "build" },
  { id: "career", name: ["Career", "Career", "करियर"], home: "pramaan" },
];

const s = (d: ScreenDef) => d;

export const SCREENS: ScreenDef[] = [
  // entry
  s({ id: "map", section: "mock", layout: "bare", icon: Map, hidden: true, title: ["Mock map", "Mock ka naksha", "मॉक का नक्शा"], desc: ["Every screen and flow", "Har screen aur flow", "हर स्क्रीन और फ़्लो"] }),
  s({ id: "landing", section: "entry", layout: "bare", icon: Globe, title: ["Landing page", "Landing page", "मुख्य पेज"], desc: ["What Parikshaa is, with live demos", "Parikshaa kya hai, chalte demo ke saath", "परीक्षा क्या है, चलते डेमो के साथ"] }),
  s({ id: "login", section: "entry", layout: "bare", icon: LogIn, title: ["Sign up / log in", "Sign up / log in", "साइन अप / लॉग इन"], desc: ["Phone OTP, Google, email", "Phone OTP, Google, email", "फ़ोन OTP, गूगल, ईमेल"] }),
  s({ id: "onboarding", section: "entry", layout: "bare", icon: WandSparkles, title: ["Onboarding", "Onboarding", "शुरुआत"], desc: ["6 questions → plan built → plan ready", "6 sawaal → plan banta → plan taiyaar", "6 सवाल → योजना बनती → तैयार"] }),

  // aaj
  s({ id: "aaj", section: "aaj", layout: "shell", nav: true, icon: LayoutDashboard, title: ["Today", "Aaj", "आज"], desc: ["Plan progress, today's tasks, one button to continue", "Plan, aaj ke kaam, ek button se jaari", "योजना, आज के काम, एक बटन से जारी"] }),
  s({ id: "plan", section: "aaj", layout: "shell", nav: true, icon: CalendarDays, title: ["My plan", "Mera plan", "मेरी योजना"], desc: ["Sprints → days → tasks; missed a day", "Sprints → din → kaam; din chhoota", "स्प्रिंट → दिन → काम; दिन छूटा"] }),
  s({ id: "revision", section: "aaj", layout: "shell", nav: true, icon: RotateCcw, badge: "6", title: ["Revision", "Revision", "दोहराई"], desc: ["Spaced repetition cards and mistake notebook", "Revision cards aur galtiyon ki copy", "दोहराई कार्ड और गलतियों की कॉपी"] }),
  s({ id: "daily", section: "aaj", layout: "shell", nav: true, icon: Zap, title: ["Daily 10", "Daily 10", "रोज़ 10"], desc: ["Ten 1-minute questions (phone first)", "10 chhote sawaal (phone pehle)", "10 छोटे सवाल (फ़ोन पहले)"] }),

  // seekho
  s({ id: "seekho", section: "seekho", layout: "shell", nav: true, icon: Compass, title: ["Explore", "Sab courses", "सभी कोर्स"], desc: ["Curriculum by goal and subject", "Goal aur subject se curriculum", "लक्ष्य और विषय से पाठ्यक्रम"] }),
  s({ id: "roadmap", section: "seekho", layout: "shell", nav: true, icon: Route, title: ["Roadmaps", "Roadmaps", "रोडमैप"], desc: ["Role roadmap with node drawer", "Role ka roadmap, node drawer", "भूमिका का रोडमैप"] }),
  s({ id: "course", section: "seekho", layout: "shell", nav: true, icon: GraduationCap, title: ["Course", "Course", "कोर्स"], desc: ["Syllabus, where you stopped, project", "Syllabus, kahan ruke, project", "पाठ्यक्रम, कहाँ रुके, प्रोजेक्ट"] }),
  s({ id: "lesson", section: "seekho", layout: "shell", hidden: true, parent: "course", icon: BookOpen, title: ["Lesson", "Lesson", "पाठ"], desc: ["Article with formulas, cheat sheet, quiz", "Lesson: formula, cheat sheet, quiz", "पाठ: सूत्र, चीट शीट, क्विज़"] }),

  // abhyas
  s({ id: "abhyas", section: "abhyas", layout: "shell", nav: true, icon: Dumbbell, title: ["Overview", "Overview", "सारांश"], desc: ["Tracks, sheets, POTD, next contest", "Tracks, sheets, POTD, agla contest", "ट्रैक, शीट, आज का प्रश्न, प्रतियोगिता"] }),
  s({ id: "sheet", section: "abhyas", layout: "shell", nav: true, icon: ListChecks, title: ["DSA sheet", "DSA sheet", "DSA शीट"], desc: ["400+ problems in collapsible sections", "400+ problems, khulne wale sections", "400+ प्रश्न, खुलने वाले हिस्से"] }),
  s({ id: "problem", section: "abhyas", layout: "focus", hidden: true, parent: "sheet", icon: CodeXml, title: ["Problem workspace", "Problem workspace", "प्रश्न कार्यक्षेत्र"], desc: ["Statement, editor, run, verdict, smallest failing test, Sahayak", "Statement, editor, verdict, sabse chhota galat test", "प्रश्न, एडिटर, नतीजा, सबसे छोटा गलत टेस्ट"] }),
  s({ id: "editorial", section: "abhyas", layout: "shell", hidden: true, parent: "sheet", icon: FileText, title: ["Editorial", "Editorial", "हल"], desc: ["Approach tabs, dry-run slider, code in 4 languages", "Approach tabs, dry-run slider, 4 bhasha me code", "तरीके, ड्राई-रन स्लाइडर, 4 भाषाओं में कोड"] }),
  s({ id: "sql", section: "abhyas", layout: "focus", nav: true, icon: Database, title: ["SQL", "SQL", "SQL"], desc: ["Schema, query editor, result grid", "Schema, query editor, result table", "स्कीमा, क्वेरी, नतीजा"] }),
  s({ id: "aptitude", section: "abhyas", layout: "shell", nav: true, icon: Brain, title: ["Aptitude", "Aptitude", "एप्टीट्यूड"], desc: ["Quant, logical, verbal; sets and mocks", "Quant, logical, verbal; sets aur mocks", "गणित, तर्क, भाषा; सेट और मॉक"] }),
  s({ id: "apt-set", section: "abhyas", layout: "shell", hidden: true, parent: "aptitude", icon: ListChecks, title: ["Aptitude practice set", "Aptitude practice set", "एप्टीट्यूड अभ्यास सेट"], desc: ["Palette, solution: intuition → approach → why", "Palette, hal: samjho → tareeka → kyun", "पैलेट, हल: समझ → तरीका → क्यों"] }),
  s({ id: "apt-mock", section: "abhyas", layout: "focus", hidden: true, parent: "aptitude", icon: Timer, title: ["Aptitude mock test", "Aptitude mock test", "एप्टीट्यूड मॉक टेस्ट"], desc: ["Timed, placement style", "Samay ke saath, placement jaisa", "समयबद्ध, प्लेसमेंट जैसा"] }),
  s({ id: "apt-result", section: "abhyas", layout: "shell", hidden: true, parent: "aptitude", icon: ChartColumn, title: ["Mock result", "Mock ka nateeja", "मॉक का नतीजा"], desc: ["Score, time per question, weak topics", "Score, har sawaal ka samay, kamzor topic", "अंक, हर सवाल का समय, कमज़ोर विषय"] }),
  s({ id: "potd", section: "abhyas", layout: "shell", nav: true, icon: CalendarCheck, title: ["Problem of the day", "Aaj ka problem", "आज का प्रश्न"], desc: ["Countdown, coins, streak calendar", "Countdown, coins, streak calendar", "उलटी गिनती, सिक्के, कैलेंडर"] }),
  s({ id: "contests", section: "abhyas", layout: "shell", nav: true, icon: Trophy, title: ["Contests", "Contests", "प्रतियोगिताएँ"], desc: ["Upcoming, past, rating", "Aane wale, pichhle, rating", "आने वाली, पिछली, रेटिंग"] }),
  s({ id: "contest-brief", section: "abhyas", layout: "shell", hidden: true, parent: "contests", icon: Flag, title: ["Contest brief", "Contest ke niyam", "प्रतियोगिता के नियम"], desc: ["Rules first, then the clock", "Pehle niyam, phir ghadi", "पहले नियम, फिर घड़ी"] }),
  s({ id: "contest-live", section: "abhyas", layout: "focus", hidden: true, parent: "contests", icon: Timer, title: ["Contest (live)", "Contest (live)", "प्रतियोगिता (लाइव)"], desc: ["Live timer turns red under 10 minutes", "10 min se kam par timer laal", "10 मिनट से कम पर टाइमर लाल"] }),
  s({ id: "contest-result", section: "abhyas", layout: "shell", hidden: true, parent: "contests", icon: ChartColumn, title: ["Contest result", "Contest ka nateeja", "प्रतियोगिता का नतीजा"], desc: ["Score, rank, rating change, what to fix", "Score, rank, rating, kya sudhaarein", "अंक, रैंक, रेटिंग"] }),

  // companies
  s({ id: "companies", section: "companies", layout: "shell", nav: true, icon: Building2, title: ["All companies", "Sab companies", "सभी कंपनियाँ"], desc: ["Product and service companies, with sources", "Product aur service companies, source ke saath", "कंपनियाँ, स्रोत के साथ"] }),
  s({ id: "company", section: "companies", layout: "shell", hidden: true, parent: "companies", icon: Building2, title: ["Company page", "Company page", "कंपनी पेज"], desc: ["Rounds, topics asked, problems, readiness", "Rounds, topics, problems, taiyaari", "राउंड, विषय, प्रश्न, तैयारी"] }),
  s({ id: "experiences", section: "companies", layout: "shell", nav: true, icon: MessageSquareText, title: ["Interview experiences", "Interview experiences", "इंटरव्यू अनुभव"], desc: ["Round by round, moderated", "Round-wise, moderated", "राउंड-वार, जाँचे हुए"] }),

  // banao
  s({ id: "build", section: "banao", layout: "shell", nav: true, icon: FolderKanban, title: ["Projects & labs", "Projects aur labs", "प्रोजेक्ट और लैब"], desc: ["Guided labs and real projects", "Guided labs aur asli projects", "गाइडेड लैब और असली प्रोजेक्ट"] }),
  s({ id: "studio", section: "banao", layout: "focus", nav: true, icon: SquareTerminal, title: ["Code Studio", "Code Studio", "कोड स्टूडियो"], desc: ["Lab steps, files, tests, terminal", "Lab steps, files, tests, terminal", "लैब, फ़ाइलें, टेस्ट, टर्मिनल"] }),
  s({ id: "project", section: "banao", layout: "shell", hidden: true, parent: "build", icon: Hammer, title: ["Project brief", "Project brief", "प्रोजेक्ट"], desc: ["Design, requirements, tests, ship it", "Design, zarooratein, tests, ship it", "डिज़ाइन, ज़रूरतें, टेस्ट"] }),

  // career
  s({ id: "pramaan", section: "career", layout: "shell", nav: true, icon: Award, title: ["Pramaan", "Pramaan", "प्रमाण"], desc: ["Proctored skill certificates", "Proctored skill certificate", "निगरानी वाले प्रमाणपत्र"] }),
  s({ id: "certificate", section: "career", layout: "shell", hidden: true, parent: "pramaan", icon: ScrollText, title: ["Certificate", "Certificate", "प्रमाणपत्र"], desc: ["Verify by QR, add to LinkedIn", "QR se verify, LinkedIn par jodo", "QR से जाँच"] }),
  s({ id: "profile", section: "career", layout: "shell", nav: true, icon: UserRound, title: ["Profile", "Profile", "प्रोफ़ाइल"], desc: ["One portfolio: verified vs self-declared", "Ek portfolio: verified aur khud bataya", "एक पोर्टफ़ोलियो"] }),
  s({ id: "jobs", section: "career", layout: "shell", nav: true, icon: BriefcaseBusiness, title: ["Jobs & resume", "Jobs aur resume", "नौकरी और बायोडाटा"], desc: ["Resume checker and one-click apply", "Resume check aur ek click apply", "बायोडाटा जाँच, आवेदन"] }),

  // mera
  s({ id: "lists", section: "mera", layout: "shell", icon: Bookmark, title: ["My lists", "Meri lists", "मेरी सूचियाँ"], desc: ["Public and private problem lists", "Public aur private lists", "सूचियाँ"] }),
  s({ id: "notes", section: "mera", layout: "shell", icon: NotebookPen, title: ["Notes", "Notes", "नोट्स"], desc: ["AI notes from your own mistakes", "Aapki galtiyon se AI notes", "आपकी गलतियों से नोट्स"] }),
  s({ id: "sahayak", section: "mera", layout: "shell", icon: Sparkles, title: ["Sahayak", "Sahayak", "सहायक"], desc: ["AI tutor with learn and build modes", "AI tutor: seekho aur banao mode", "एआई शिक्षक"] }),
  s({ id: "community", section: "mera", layout: "shell", icon: Users, title: ["Community", "Community", "समुदाय"], desc: ["Discussions and study cohorts", "Charcha aur cohorts", "चर्चा और समूह"] }),
  s({ id: "plus", section: "mera", layout: "shell", icon: Crown, title: ["Plus", "Plus", "प्लस"], desc: ["Plans and what you get", "Plans aur kya milta hai", "योजनाएँ"] }),
  s({ id: "settings", section: "mera", layout: "shell", icon: Settings, title: ["Settings", "Settings", "सेटिंग्स"], desc: ["Language, theme, privacy, notifications", "Bhasha, theme, privacy, notifications", "भाषा, थीम, निजता"] }),
];

export const FLOWS: { name: Tri; ids: string[] }[] = [
  { name: ["First time", "Pehli baar", "पहली बार"], ids: ["landing", "login", "onboarding", "aaj"] },
  { name: ["Daily loop", "Roz ka loop", "रोज़ का चक्र"], ids: ["aaj", "plan", "problem", "editorial", "revision", "daily"] },
  { name: ["Learn", "Seekho", "सीखो"], ids: ["seekho", "roadmap", "course", "lesson"] },
  { name: ["Practice", "Abhyas", "अभ्यास"], ids: ["abhyas", "sheet", "problem", "sql", "potd"] },
  { name: ["Aptitude", "Aptitude", "एप्टीट्यूड"], ids: ["aptitude", "apt-set", "apt-mock", "apt-result"] },
  { name: ["Contests", "Contests", "प्रतियोगिता"], ids: ["contests", "contest-brief", "contest-live", "contest-result"] },
  { name: ["Companies", "Companies", "कंपनियाँ"], ids: ["companies", "company", "experiences"] },
  { name: ["Build", "Banao", "बनाओ"], ids: ["build", "studio", "project"] },
  { name: ["Career", "Career", "करियर"], ids: ["pramaan", "certificate", "profile", "jobs"] },
  { name: ["Mine", "Mera", "मेरा"], ids: ["lists", "notes", "sahayak", "community", "plus", "settings"] },
];
