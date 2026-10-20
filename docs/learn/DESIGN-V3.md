# Learn: design v3, "Kaagaz aur Blackboard" (20 Oct 2026)

Owner (20 Oct, mock v2 dekh kar): "bilkul ye same design nahi chahiye, TUF se better aur alag lagna chahiye; har page ke
har feature aur component ko soch samajh kar design karo; Build ke 3 screens bilkul pasand nahi; modern admin panel, saare
features, saara data admin se manage ho, saare roles, secure; Sahayak khole to usi screen me teesra pane (statement, code,
Sahayak) jise hata sakein; landing/home hamari website ke hisaab se; logo behtar, branded; professional, end to end."

Ye file v3 ka design faisla hai. Mock: [mock-v3/README.md](mock-v3/README.md) (68 screens, link, screenshots). Purane: v1 [mock/](mock/README.md),
v2 [mock-v2/](mock-v2/README.md), plan [DESIGN-PLAN-V2.md](DESIGN-PLAN-V2.md) (features aur flows abhi bhi wahi; sirf look
aur dhaancha badla).

## 1. v2 me kya galat tha

| Kami | v3 me |
|---|---|
| Kaala page + upar section tabs + baayein list + daayein rail: TUF jaisa hi dikhta tha | Light "kaagaz" default, dark "blackboard"; ek hi sidebar (Linear/Notion jaisa), rail sirf jahan kaam ka ho |
| Ek hi accent (indigo) har jagah | Stationery ka set: neela pen = kaam, laal pen = galti, hara tick = pass, highlighter = zaroori, jamuni = Sahayak (AI) |
| Headings aam sans me, sab ek jaisa | Serif display (Instrument Serif) bade title par, Geist UI, Geist Mono number/code |
| Sahayak drawer (upar se dhakta tha) | Sahayak **teesra pane**: page ko dhakta nahi, side me khulta hai; har pane band / chhota / bada ho sakta hai |
| Build ke screens: aam cards | Project gallery asli preview ke saath, milestone wala spec, poora IDE (files, editor, live preview, tests, terminal) |
| Admin tha hi nahi | 25 admin screens, 8 roles, "role badal kar dekho", 2FA, 4-eyes, audit |
| Logo: sirf प ka akshar | प jiska andar ka hissa **tick (✓)** hai: "pariksha" + "pass"; wordmark aur favicon |

## 2. Concept

**Pariksha ka apna sansaar.** Har Indian student ne exam ki copy par neele pen se likha, teacher ne laal pen se galti
ghera, aur sahi par hara tick lagaya; class me blackboard aur chalk. Koi coding platform ye bhasha nahi bolta; TUF aur
LeetCode kaale aur naranga hain. Isliye:

- **Light = "Kaagaz"** (default jab system light ho): garam safed kaagaz, syahi jaisa text, neela pen action.
- **Dark = "Blackboard"**: hari-kaali patti, chalk jaisa text, chalk ke rang (neela, peela, gulaabi, hara).
- **Motif (kam, sahi jagah):** graph paper ki jaali (hero, login, khaali haalat), copy ki laal margin line (lesson aur
  editorial me "teacher ke note" margin me), highlighter ka nishaan (zaroori shabd), laal pen ka gola + haath ka likha
  note (galti dikhane me, Kalam font), Pramaan par mohar (stamp).
- **Professional pehle:** motif sirf saja nahi, kaam batata hai (laal = galat, hara = pass). Baaki sab saaf, ghana,
  tez: Linear/Vercel jaisi nazakat.

## 3. Rang (tokens)

| Token | Kaagaz (light) | Blackboard (dark) | Kahan |
|---|---|---|---|
| `--page` | `#F5F3EE` | `#0F1512` | Page |
| `--panel` | `#FFFFFF` | `#151D19` | Card, sidebar |
| `--sunk` | `#EEEBE4` | `#0B100E` | Input, code, track |
| `--line` / `--line-2` | `#E3DFD6` / `#CFCABD` | `#25312C` / `#34433C` | Border |
| `--ink` / `--ink-2` / `--ink-3` | `#15161A` / `#4B4D57` / `#7D7F88` | `#E9EEEA` / `#A9B6AF` / `#74827B` | Text |
| `--pen` (neela) | `#2346E8` | `#8EA6FF` | Primary button, link, focus |
| `--red` (laal pen) | `#D93A2B` | `#FF8A7A` | Galat, WA, danger |
| `--tick` (hara) | `#15803D` | `#6EE7A0` | Pass, AC, done |
| `--marker` (highlighter) | `#FFE45C` | `#F5DD6B` | Zaroori shabd, aaj |
| `--ai` (jamuni) | `#6D4AFF` | `#B7A5FF` | Sahayak, AI ki har cheez |
| `--coin` (kesar) | `#D97706` | `#FFB547` | Coins, streak |

Har rang ka `-soft` (halka bg) bhi. L1–L5 mushkil: tick → pen → kesar → laal → jamuni. Charts: pen, tick, kesar, ai,
laal ka kram. Dark me shadow nahi, sirf line; light me halki do-parat shadow.

## 4. Type

| Role | Font | Size |
|---|---|---|
| Display (landing hero, page title, bade number) | Instrument Serif (italic bhi) | 64 / 48 / 36 / 30 |
| UI | Geist (variable) | 15 body, 14, 13, 12 |
| Code, number, timer | Geist Mono | 13 / 12 |
| हिंदी | Noto Sans Devanagari (UI), Noto Serif Devanagari (display) | UI jaisa |
| Haath ka likha (laal pen ke note) | Kalam | 15–18 |

Number hamesha tabular. Uppercase label sirf 11px + 0.06em letter-spacing.

## 5. Logo

- **Mark:** neela squircle; andar safed प: upar shirorekha, daayein seedha danda, aur beech ka mod **tick ✓** ban kar
  dande se milta hai. Matlab: "pariksha" aur "pass" ek saath. 16px favicon tak saaf.
- **Wordmark:** "parikshaa" Geist 650, tight; footer me "परीक्षा" Noto Serif Devanagari.
- **Lockups:** mark + wordmark (nav), sirf mark (app icon), mark + "Learn" / "Admin" tag.
- Brand page (`#brand`) par: mark ke size, galat istemaal, rang, type, icons, motion.

## 6. Dhaancha (layout)

- **Learner shell:** baayein ek sidebar (248px, ⌘\ se 64px rail): logo, search ⌘K, Aaj, Mera plan, Revision; Seekho;
  Abhyas; Career; Mera; neeche Sahayak, Plus card, settings, user. Upar patli bar: breadcrumb, page ke kaam, streak,
  coins, bhasha, theme, ghanti, "Sahayak se poochho" (⌘J). Content max 1200px, grid 12 col.
- **Focus (workspace):** problem, editorial ka code, SQL, contest, aptitude mock, Studio: sidebar nahi; upar bar me
  wapas, title, timer, **pane toggles** (Problem · Code · Sahayak), Run/Submit.
- **Admin shell:** apna sidebar (modules), upar: environment badge (Production), role badge + "role badal kar dekho",
  search, "aapka har kaam log hota hai" chip, session timer (30 min idle).
- **Phone (390):** sidebar → neeche 5 tab (Aaj, Seekho, Abhyas, Sahayak, Profile) + "More" sheet; workspace me panes →
  tabs.

## 7. Sahayak: teesra pane

- Kahin bhi ⌘J ya "Sahayak" dabao: page **daayein pane** me Sahayak (380px, khinch kar 300–560), page sikudta hai, dhakta
  nahi. Pane ke upar: context chip ("Pair with target sum · line 4"), mode (Seekho / Banao), band (×), chhota (rail).
- Problem workspace: **Statement | Code | Sahayak** teen pane. Har pane: khinch kar size, × se band (patli rail me badal
  jaata hai, label ke saath; click se wapas), upar bar me teeno ke toggle. Kam se kam ek pane khula.
- Contest aur mock test me Sahayak band (toggle par taala + wajah).
- Jawab: "kya theek, kya chhoota", Socratic sawaal, diff (Banao mode), AI label, din ka hisaab (38/200).

## 8. Components (kit)

Button (primary pen / secondary / ghost / danger / ai), IconButton, Badge, Chip, Kbd, Avatar, Tabs (underline), Seg
(pill), Toggle, Checkbox, Radio, Input, Select, Search, Textarea, Field + help/error, Card, Stat, Meter, Ring, Donut,
Sparkline, Bar/Line chart, Heatmap, Table (sort, select, bulk bar, row menu, sticky header, empty), Pagination,
Dropdown menu, Popover, Tooltip, Drawer, Modal, Toast, Banner, Empty state (graph paper + Diya), Skeleton, Stepper,
Timeline, Tree, Split panes, Code view (tokens, line marks), Diff view, Terminal, Browser frame (preview), Stamp,
Highlighter, Red-pen note, Logo, Diya (5 mood). Har ek ki haalat: default, hover, focus (2px pen ring), active,
disabled, loading, error, empty.

## 9. Motion

Tez aur kaam ki (120–240ms, ease-out). Page aane par patti dar patti fade+uthna (40ms ka antar); highlighter shabd ke
peeche khinchta hai; tick ✓ khud banta hai (stroke draw) jab kaam poora; laal pen ka gola galat line ke gird banta hai;
number ginti se badhte hain; Sahayak ka jawab type hota hai; pane khulte-band hote samay size smoothly; Pramaan ki mohar
"thappa" lagti hai. `prefers-reduced-motion` par sab band.

## 10. Har page: kaam aur design

| Page | Ek kaam | Khaas design |
|---|---|---|
| Landing | 10 second me samjhe "roz ka plan, har galti ka sabab, aur saboot jo company maane" | Serif hero + highlighter; mez par rakhi copy jaisa product collage (aaj ka plan, laal pen se galti, hara tick, Sahayak); "ek din kaisa" timeline; bento features; Pramaan mohar; 3 bhasha demo; Free/Plus; colleges; FAQ |
| Login | Tez andar | Graph paper, Google / phone OTP / email, OTP 6 dabbe |
| Onboarding | 6 sawaal → plan | Baayein sawaal, daayein plan "copy" par likhta dikhta hai |
| Aaj | Abhi kya karna hai | "Jahan chhoda" bada card, aaj ke kaam checklist (tick draw), sprint ka hafta, POTD, kamzor vishay, streak |
| Mera plan | Plan samjho, badlo | Sprint timeline, din ki list, chhoote din ke 4 raaste |
| Revision | Bhoolne se pehle dohrao | Flashcard (copy ka panna), SM-2 buttons, galtiyon ki notebook (ruled lines) |
| Daily 10 | Phone par 10 minute | Phone frame, output batao, Parsons, keyboard row |
| Courses / roadmap / course / lesson | Kya padhna, kis kram me | Roadmap graph + drawer; lesson me laal margin, teacher note, formula, quiz, cheat sheet |
| Abhyas / sheet | Practice ka ghar | Tracks, sheet steps, filter, status tick |
| Problem | Likho, chalao, samjho | 3 pane; WA par sabse chhota galat test laal pen gole ke saath |
| Editorial | Brute → better → best | Dry-run slider (chalk/pencil sketch), code 4 bhasha |
| SQL, aptitude (4), POTD, contests (4) | Apna-apna | Mock me NTA palette, result me samay per sawaal |
| Companies (3) | Kis company ke liye kya | Rounds timeline, topics bar, source har data ke saath |
| Banao (3) | Bana kar seekho, ship karo | §11 |
| Pramaan, certificate, profile, jobs | Saboot | Mohar, QR verify, verified vs khud-bataya alag |
| Mera (6) | Apni cheezein | Lists, notes (ruled), Sahayak page, community, Plus, settings |

## 11. Banao (Build), naya

- **Hub:** "Banao, ship karo" + aapke number (shipped, labs, deploy). "Jaari rakho": aapke app ka **asli preview**
  (browser frame), milestone progress, agla kadam. Tracks (Web, Backend, Data/AI, Mobile, DevOps). Project gallery: har
  card par chhota preview, stack icons, level, ghante, kya seekhoge. Guided labs (20–45 min) list. "Learners ne banaya"
  (sample, label ke saath).
- **Project:** spec jaisa page: hero me tayyar app ka preview, stack, samay; tabs Brief · Milestones · Rubric ·
  Resources · Submissions; milestones timeline (har ek ki acceptance criteria + tests ginti + haalat); daayein: "Studio me
  kholo", kaunsa Pramaan milega, review (AI + insaan), deploy.
- **Studio:** poora IDE: activity bar (Files, Steps, Tests, Git, Sahayak), file tree, editor tabs, **live preview**
  (browser frame, URL bar), neeche panel (Terminal · Tests · Problems), status bar; step guide + "mera kaam jaancho";
  Sahayak teesra pane.

## 12. Admin panel

Spec: [ADMIN-PANEL.md](ADMIN-PANEL.md). Mock me:

- **Roles (8):** Super admin, Content admin, Editor, Reviewer, Support, Finance, Moderator, Analyst + custom role. Upar
  "role badal kar dekho": nav aur buttons usi role ke hisaab se (band button par taala + "Finance role chahiye").
- **Security:** login par SSO/email + TOTP 2FA (zaroori), naya device ka email, IP allowlist, 30 min idle logout,
  4-eyes (content delete, ₹5,000+ refund, AI kill switch hatana, role badalna), audit log (kaun, kya, kab, pehle/baad),
  learner ka data sirf wajah likh kar, DPDP export/delete requests, API keys.
- **Screens (25):** login, dashboard, problems list, problem editor (8 tabs), aptitude & quiz, lessons, roadmaps,
  companies data, review queue, factory, learners, learner, support/reports, commerce, community, contests, AI, analytics,
  notifications, roles & permissions, staff, approvals (4-eyes), audit log, security settings, system (health, flags,
  settings).

## 13. Imaandari

Sab sample data par "sample" likha; company naam nakli; koi nakli testimonial/number/logo nahi; Plus ka daam owner tay
kare; TUF/LeetCode ka koi naam, copy, logo ya layout nahi (sirf pattern se seekha).

## 14. Kram

V0 ye file + tracker → V1 scaffold (tokens, fonts, logo, kit, shells, map, brand) → V2 landing, login, onboarding, aaj,
plan (pehla preview publish) → V3 practice + 3-pane Sahayak → V4 seekho, aptitude, POTD, contests → V5 companies, Banao,
career, mera → V6 admin → V7 QA, screenshots, README, publish.
