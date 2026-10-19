# Learn v2: learner ki taraf se poora flow, design aur icons (19 Oct 2026)

Har screen, har kadam, har haalat. Kya banega: [../LEARN-V2.md](../LEARN-V2.md). Technical: [ARCHITECTURE.md](ARCHITECTURE.md).
Admin: [ADMIN-PANEL.md](ADMIN-PANEL.md). Visuals: [VISUAL-STYLE.md](VISUAL-STYLE.md). Editorial: [EDITORIAL-STYLE.md](EDITORIAL-STYLE.md).

**Haalat ke niyam (har screen par):** loading = skeleton (spinner nahi); khaali = ek line kyun khaali + ek kaam ka
button; error = saaf wajah + "dobara koshish"; offline = upar halki amber patti. Har button par text (sirf icon nahi,
phone ke tab bar ko chhod kar). Har number ke saath shabd ("12 solved", na ki sirf "12").

---

## 1. Design system (Learn v2)

### 1a. Tokens aur look

[DESIGN.md](../DESIGN.md) ke tokens par, Learn v2 ke liye jod:

| Token | Light | Dark | Kahan |
|---|---|---|---|
| `--bg` / `--surface` | `#f6f7fb` / `#ffffff` | `#0c1020` / `#141a2c` | ✅ pehle se |
| `--glass` | `rgb(255 255 255 / 0.7)` + blur 12 px | `rgb(20 26 44 / 0.6)` + blur 12 px | Top bar, landing cards |
| `--glow-primary` | `0 0 0 1px #3346c433, 0 8px 32px #3346c41f` | `0 0 0 1px #8b98fa40, 0 8px 32px #8b98fa26` | Active card, hover |
| `--radius-sm/md/lg/xl` | 8 / 12 / 16 / 24 px | same | Chips / cards / panels / hero |
| `--motion-fast/base` | 150 / 250 ms, ease-out | same | Hover, panel; `prefers-reduced-motion` par 0 |
| `--sketch-*` | [VISUAL-STYLE.md](VISUAL-STYLE.md) §1 | | Content visuals |

**Fonts:** Noto Sans (UI, 8 lipiyan ✅), Kalam (sketch labels), JetBrains Mono (code ✅). **Ek saffron action har
screen par** (✅ niyam): Learn me "Submit".

### 1b. Shell

```
Desktop (≥ 1024 px)
┌──────────────────────────────────────────────────────────────────────────────┐
│ प Parikshaa   [🔍 Search… Ctrl K]            🔥 12   🪙 340   ✨Sahayak   🔔   (A) │  ← top bar (glass)
├──────────────┬───────────────────────────────────────────────────────────────┤
│ 🏠 Home       │                                                               │
│ 🗺 Roadmaps   │                 page                                          │
│ { } DSA A2Z  │                                                               │
│ ☑ Problems   │                                                               │
│ 🏆 CP         │                                                               │
│ 🧮 Aptitude   │                                                               │
│ 💻 CS Core    │                                                               │
│ ▦ Design     │                                                               │
│ 文 Languages  │                                                               │
│ 🛢 SQL         │                                                               │
│ ⚔ Contests   │                                                               │
│ 🎙 Mock intvw │                                                               │
│ 📁 Workspace  │                                                               │
│ ✦ Plus       │                                                               │
└──────────────┴───────────────────────────────────────────────────────────────┘
Phone (< 768 px): top bar (logo, search, 🔔, avatar) + neeche 5 tab: Home · Learn · Practice · Sahayak · Me
```

### 1c. Icons (Lucide, pehle se app me)

| Jagah | Icon | Jagah | Icon |
|---|---|---|---|
| Home | `house` | Contests | `trophy` |
| Roadmaps | `map` / `route` | Mock interview | `mic` |
| DSA A2Z | `braces` | Workspace | `folder-open` |
| Problems | `list-checks` | Profile | `user-round` |
| CP | `swords` | Plus | `sparkles` |
| Aptitude | `calculator` | Sahayak | apna mascot (chhota), warna `bot` |
| CS Core | `cpu` | Streak | `flame` |
| Design (LLD/HLD) | `layout-dashboard` | Coins | `coins` |
| Languages | `languages` | Revision | `rotate-ccw` |
| SQL | `database` | Notes | `notebook-pen` |
| Run | `play` | Submit | `send` |
| Hint | `lightbulb` | Editorial | `book-open` |
| Dry run | `footprints` | Bookmark/list | `bookmark` |
| Settings | `settings` | Notifications | `bell` |

### 1d. Components (naye; console kit ✅ ke saath)

Roadmap graph, node drawer, dry-run slider ([VISUAL-STYLE.md](VISUAL-STYLE.md) §4), editorial stepper (4 kadam + tabs),
code tabs (4 bhasha), verdict card, question palette (aptitude ✅ exam wala), timer pill ✅, Sahayak panel, quota meter,
revision card, mistake chip, pattern chip, readiness ring, heatmap ✅, rating graph, Pramaan badge, plan card,
empty-state illustration (sketch style), toast ✅, drawer ✅, dialog ✅, tabs ✅, tooltip ✅.

---

## 2. Flows

Har flow: kadam → kya dikhta → data/API → chhoti baatein. API naam `practice/:site/...` ki maujooda shakal me
(site = Parikshaa ka Learn site).

### F1. Visitor → signup

| # | Screen | Kya | Data / API | Chhoti baatein |
|---|---|---|---|---|
| 1 | Landing | Hero, product tour tabs (asli components demo mode me), pricing ki jhalak, FAQ | Static, prerender | LCP < 2 s; "Start free" + "Plus dekho" |
| 2 | Signup | Email + OTP, ya Google ✅ | `POST /auth/signup`, OTP mail | Turnstile bot check; kamzor email domains block nahi |
| 3 | Umar | "Main 18+ hoon" ya parent ka email (consent link) | `learners.age_band`, consent record | DPDP |
| 4 | Verify | OTP | ✅ email verification | 3 galat par 10 min ruko |
| 5 | Pehli bhasha | English / हिंदी / Hinglish | `settings.ui_lang` | Kabhi bhi badlo |

### F2. Onboarding → roadmap

| # | Sawaal | Options |
|---|---|---|
| 1 | Aap abhi kya hain | 1st–4th year, graduate, working (0–3 saal) |
| 2 | Goal | Product company SDE, service company (TCS/Infosys jaisi), data, frontend/backend, abhi tay nahi |
| 3 | Kab tak | Taareekh ya "3/6/12 mahine" |
| 4 | Roz kitna samay | 30 min / 1 / 2 / 3+ ghante; hafte me kaun se din |
| 5 | Coding bhasha | C++ / Java / Python / JS |
| 6 | Abhi ka level | Har topic par 1–5 (ya 10 min ka diagnostic test) |

→ **"Aapka roadmap taiyaar"** card: goal, shuru/aakhir taareekh, sprints, roz ka samay → "Home par chalo". Data:
`prep_plans` ✅ + `roadmap_progress`. Plan rules se banta hai (AI sirf naam aur kram sujhata hai); 10 sawaal ka
diagnostic chunne par shuru ke topics skip.

### F3. Home (roz ka loop)

| Card | Kya | Kaam |
|---|---|---|
| Aaj ka plan | 3–6 kaam (problem, lesson, revision, aptitude set) samay ke saath | Ek click me shuru; poora hone par tick |
| Revision due | SM-2 ✅ se aaj ke | "Revise karo" |
| Problem of the Day ✅ | Ek problem | Streak |
| Streak 🔥 + coins 🪙 | ✅ | Freeze ✅ |
| Jahan chhoda | Pichhli problem/lesson | Seedha wahin |
| Contest | Agla contest, countdown | Register |
| Readiness | Goal ke hisaab se ring (%) + "agla kya" | Detail |
| Mistake notebook | Is hafte ki top 3 galtiyan | Drill |
| Din chhoota | "Plan badlein ya break lein?" | Adjust / Break ✅ |

### F4. Roadmaps (roadmap.sh jaisa, apna)

1. **List:** Role (SDE product, SDE service, Frontend, Backend, Full-stack, Data, ML, AI Engineer, DevOps, Android,
   Security, QA) + Skill (DSA, CP, System design, DBMS/OS/CN, SQL, Git, Linux, Docker, K8s, AWS, har language…);
   "Mere roadmaps" (custom/AI); har card par % aur nodes ki ginti.
2. **Roadmap page:** graph (desktop), list/accordion (phone); node par rang: khaali / seekh raha / done / skip; upar
   progress bar; filter "sirf zaroori".
3. **Node drawer:** kya hai (2 line), hamara lesson, problems, quiz, lab, bahar ke free links, buttons: "Seekh raha" /
   "Ho gaya" / "Skip"; **"Pramaan lo"** (quiz/viva pass → badge).
4. **Custom roadmap editor:** canvas, node jodo (hamari library se ya khud), edges, rang; save, share link (public /
   sirf link / private); free 3, Plus 100. Campus teacher class ko assign; Hire job ke saath "taiyaari roadmap".
5. **AI roadmap:** "Mujhe X seekhna hai, Y hafte, roz Z ghante, abhi level W" → preview (nodes + har node par hamara
   content) → badlo → save. Free 1/mahina, Plus 100 tak.

### F5. Lesson padhna (CS core, design, languages, CP math, aptitude theory)

| Hissa | Kya |
|---|---|
| Upar | Breadcrumb (Subject › Topic), padhne ka samay, progress bar |
| Baayein (desktop) | Table of contents; phone par upar "Is page me" |
| Beech | Text (45rem), sketch visuals, code (Run button: runner par chalta hai), `Note` callouts, inline 1-sawaal checks |
| Text select karne par | "Sahayak se poocho", "Note me daalo", "Highlight" |
| Aakhir | 5 MCQ quiz ✅ → "Ho gaya" → agla lesson; revision card save |
| Hinglish toggle | Upar daayein |

### F6. Problem solve karna (sabse zaroori flow)

```
Problems list ─▶ Problem page ─▶ (Run)* ─▶ Submit ─▶ Verdict
                    │                          ├─ AC  ─▶ complexity check → coins → revision schedule → (viva) → agla
                    │                          ├─ WA  ─▶ "chhota galat test" → mistake category → hint/try again
                    │                          ├─ TLE ─▶ complexity hint ("aapka O(n²)…") → try again
                    │                          └─ CE/RE/MLE ─▶ saaf error, line number
                    └─ Hint (4 kadam) · Editorial · Discuss · Notes · Sahayak
```

| Hissa | Detail |
|---|---|
| Layout (desktop) | Baayein: statement tabs (Problem, Editorial, Submissions, Discuss, Notes); daayein: editor + neeche test panel. Divider khinch sakte hain |
| Layout (phone) | Tabs: Problem · Code · Result; editor full screen |
| Statement | Title, mushkil, (pattern tags chhupe: "dikhao" click se, taaki pattern drill bane), example + sketch frame, constraints aur unka matlab, companies (sirf sach) |
| Editor | CodeMirror ✅, 4+ bhasha, template, autosave (local + server), font size, theme, reset, custom input |
| Run | Sample + custom input; output diff; ~1–3 s |
| Submit | Hidden tests; progress "12/40"; verdict card: status, time, memory, kaunsa test (number), percentile (same bhasha me) |
| WA par | "Chhota galat test dhoondo" (practice me; free 3/din, Plus unlimited): chhota input, expected vs aapka, input ko test me jodo |
| TLE par | Complexity jaanch: input bada karke naap, "lagta hai O(n²), constraints ko O(n log n) chahiye" |
| AC par | Coins ✅, streak, complexity verdict (optimal ya nahi), revision date, **micro-viva** (2 sawaal, optional; pass → Pramaan) |
| Hints | 4 kadam ki seedhi (EDITORIAL-STYLE §1): kadam 1, kadam 2 ka pehla hissa, …; Sahayak hint ✅ alag |
| Editorial kab | Ek koshish ke baad, ya 20 min baad, ya "abhi dekho" (coins aadhe ✅) |
| Contest me | Hint, editorial, Sahayak band ✅ |
| Galti batao | Har problem par (statement, test, editorial) → admin queue |

### F7. Editorial padhna

Upar tabs **Brute · Better · Optimal** (us hisse par scroll) + stepper **1 Samjho · 2 Hal · 3 Code · 4 Jaancho**. Har
kadam ek-ek karke khol sakte hain (hint mode) ya poora padho. Dry-run slider kadam 4 me. Code tabs C++ · Java · Python ·
JS (copy; premium editorial me copy Plus). Aakhir me: revision card "save", "Kaam aaya? 👍/👎", related problems, follow-ups.

### F8. Mistake notebook aur drills

Har WA/TLE/RE ki category apne aap (off-by-one, overflow, galat pattern, edge case chhoota, galat data structure,
input padhne ki galti) + learner badal sakta hai. Page: category ke hisaab se ginti, har galti ka link, **"Drill
shuru"** (usi category ke 5 chhote problems/MCQ). Home par top 3.

### F9. Pattern pehchaan drills

Statement dikhta hai (60 s), 4 option me pattern chuno (sliding window, two pointers, BFS, DP…), turant jawab + 2 line
kyun. 10 ka set; accuracy aur samay ka graph.

### F10. Aptitude

| # | Screen | Detail |
|---|---|---|
| 1 | Aptitude home | Quant · Reasoning · Verbal; har topic ka % aur kamzor topics |
| 2 | Topic | Lesson (concept, formula, shortcut, visual), practice sets (aasan/medium/mushkil) |
| 3 | Practice set | Ek sawaal ek baar; palette (correct/incorrect/current/unanswered ✅ exam wala); har sawaal ke baad hal (ya aakhir me — setting); timer optional |
| 4 | Hal | Concept, kadam, **shortcut**, time target, "aapne B kyun chuna: ye galti" (trap map) |
| 5 | Mock | Sections, section timer, negative marking, auto-submit, palette, "mark for review" ✅ |
| 6 | Result | Score, percentile (sab learners me), section-wise, har sawaal par samay ka heatmap, galat ki list, "kamzor topic → set" |
| 7 | Company-pattern mocks | "TCS NQT jaisa", "Infosys jaisa"… (pattern, unke sawaal nahi) |

### F11. CS Core / Design / Languages

Subject page → topic list (lessons + Q&A + MCQ ki ginti) → lesson (F5) → **Interview Q&A** (flashcard: sawaal, "jawab
socho", chhota jawab, gehra jawab; "yaad tha / nahi" → SM-2) → MCQ quiz (10). LLD/HLD case study: requirements →
diagram (sketch) → kadam-kadam design → code (LLD) / numbers (HLD) → follow-ups.

### F12. SQL

Schema viewer (tables, columns, sample rows), editor (CodeMirror SQL ✅), Run (SQLite runner ✅), result table, expected
vs aapka diff (rows missing/extra rang se), editorial (wahi 4 kadam).

### F13. Contests

| # | Screen | Detail |
|---|---|---|
| 1 | List | Live / Upcoming / Ended ✅; rated ya nahi; register |
| 2 | Brief | Niyam (fullscreen, tab badalna = warning, ek hi baar), samay, scoring; "Start" |
| 3 | Live | Problems list, timer, scoreboard ✅ (apni row hamesha dikhe), submissions |
| 4 | Khatam | Rank, rating badlaav (Elo ✅), editorial khulta hai, **upsolve plan** (jo nahi bane unke hint + editorial) |
| 5 | Virtual | Purana contest apne samay par, "ghost" scoreboard |

### F14. Mock interview (AI)

Role + level chuno → (mic optional; pehle text) → problem + baat-cheet (AI interviewer clarifying sawaal, hint jaise
asli interviewer) → code → follow-ups → **report**: rubric (samajh, approach, code, communication, testing) 1–4,
quotes ke saath, sudhaar ke 3 kaam → replay. Free 1/mahina, Plus zyada (fair use).

### F15. Sahayak (AI tutor) — har jagah

| Hissa | Detail |
|---|---|
| Kholna | Top bar ✨, problem/lesson par side panel, text select karke |
| Modes | Doubt, hint ✅, code review ✅, "samjhao" (selection), "mujhe quiz karo", teach-back |
| Context chips | Problem, mera code, lesson, roadmap node (hata sakte hain) |
| Niyam | Koshish se pehle poora solution nahi ✅; contest me band ✅; jawab hamare content se, source link |
| Quota meter | Free: roz ki seema; Plus: "Unlimited (fair use)" — 200/din tak poori speed, phir sasta model |
| History | Baaju me baatein; Plus me **jab tak account hai tab tak** (owner, 19 Oct); free 180 din ✅; export/delete |
| Streaming | Jawab aate hi dikhe; "ruko" button |

### F16. AI courses aur guides

"Kuch bhi seekho" box → topic → outline preview (modules, lessons, samay) → "Shuru karo" → lesson (maangne par banta
hai, F5 jaisa) → har module ke baad quiz → progress, revision. Label **"AI ka banaya"** ya **"Expert ne jaancha"**.
"Galti batao" har lesson par. Free 2/mahina, Plus unlimited (fair use). Share link.

### F17. Workspace

Tabs: **Mera code** (har problem ka best + saari submissions, bhasha filter) · **Lists** (folders, custom lists,
"Company X", share) · **Notes** (problem/lesson ke notes ✅, search, PDF export ✅ watermark) · **Mistake notebook** ·
**Downloads** (revision images, notes PDF).

### F18. Profile / portfolio

Public URL (`/u/<handle>`): naam, headline, heatmap ✅ (+ Codeforces/GitHub official API se link), topic-wise solved,
contest rating graph, **Pramaan badges** (verify link), projects (Build Labs), education/experience, certificate verify
page. Privacy: public / sirf link / recruiters (Hire) / private.

### F19. Plus kharidna

Pricing (free vs Plus table, mahina/saal) → coupon/college code ✅ → Razorpay ✅ → success (kya-kya khula) → GST invoice
✅ → Settings me manage (auto-renew band, refund niyam ✅).

### F20. Settings

Account (naam, email, phone, password, Google), bhasha, theme, notifications (email/WhatsApp/push, quiet hours), privacy
(profile, chat history ki marzi, data export, account delete), devices/sessions (logout others), connected accounts.

### F21. Notifications

Revision due, streak khatre me, contest 15 min me, discussion par jawab, plan ka din chhoota, Plus khatam hone wala.
Channels: in-app 🔔, push ✅, email ✅, WhatsApp ✅. Quiet hours; har type band kar sakte hain.

### F22. Community

Har problem par discuss (spoiler tag, code block, upvote ✅), interview experiences ✅ (company, round, sawaal → hamare
similar problems se link), report/flag ✅.

### F23. Offline aur PWA

Install ✅; lessons aur editorials jo khole the wo offline; submission ke liye net chahiye (banner). Low data mode:
visuals ka pehla frame hi, baaki tap par.

### F24. Campus aur Hire se jod

Class code se judo (Campus) → teacher ke assigned roadmaps/contests Home par. Profile "recruiters ko dikhao" → Hire me
apply karte waqt Pramaan aur profile saath.

---

## 3. Speed aur accessibility ki seema (har page)

| Page | LCP (4G, beech ka Android) | JS (gzip) |
|---|---|---|
| Landing, problem/lesson (public, prerender) | < 2.0 s | < 150 KB |
| Home | < 2.5 s | < 250 KB |
| Problem workspace (editor lazy) | < 2.5 s | editor ke baad < 450 KB |

axe 0 errors dono theme; keyboard se sab; focus ring ✅; 390 px phone; visual baselines ✅ (1440/390, light/dark).

## 4. Analytics events (PostHog)

`signup_started/completed`, `onboarding_completed`, `roadmap_created`, `node_done`, `lesson_completed`, `problem_opened`,
`run`, `submit` (verdict, language), `hint_opened` (level), `editorial_opened` (step), `dryrun_viewed` (frames seen),
`counterexample_shown`, `viva_passed`, `apt_set_completed`, `mock_completed`, `contest_registered/finished`,
`sahayak_message` (mode), `ai_course_started`, `plus_checkout_started/succeeded`, `report_error`. Koi code ya chat ka
text analytics me nahi.
