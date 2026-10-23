# Learn v2: kaam kahan tak pahuncha (handoff)

**Ye file kyun hai:** owner (19 Oct 2026): "Learn pehle karo." Learn v2 kai sessions aur accounts me banega. Har
account ka Claude **isi file se** shuru karta hai aur isi ko update karta hai. Owner hamesha ek hi prompt paste karta hai
([RESUME-PROMPT.md](RESUME-PROMPT.md)), jo [HANDOFF.md](HANDOFF.md) ke raaste yahan laata hai. Design:
[LEARN-V2.md](LEARN-V2.md). Kharch, judge aur AI model: [LEARN-LAUNCH-PLAN.md](LEARN-LAUNCH-PLAN.md).

## 1. Naya session (kisi bhi account se): isi kram me

1. **Branch:** Learn ka kaam `claude/learn-v2` par. Ye `claude/festive-maxwell-pb4k5v` (Hire, PR #66) se nikli hai.
   ```bash
   git fetch origin claude/learn-v2 && git checkout -B claude/learn-v2 origin/claude/learn-v2
   ```
   Force-push kabhi nahi. `main` par push kabhi nahi. Push se pehle `git pull --rebase origin claude/learn-v2`.
   **PR:** abhi nahi khuli. Pehla code slice push karne wala session PR khole (base `claude/festive-maxwell-pb4k5v`
   jab tak #66 merge na ho, phir `main`), aur [HANDOFF.md](HANDOFF.md) ki table me likhe.
2. **Doosra session to nahi chal raha?** §6 ki aakhri row. "Chal raha" ho aur 30 minute ke andar commit ho, to owner
   se poochho.
3. **Adhoora kaam:** autosave restore, [HIRE-HANDOFF.md](HIRE-HANDOFF.md) §7 wala tareeka (`autosave/claude/learn-v2`).
4. **Apni row** §6 me jodo, commit + push.
5. **Padho:** `CLAUDE.md`, ye file, [LEARN-V2.md](LEARN-V2.md) (poora), aur build spec `docs/learn/`:
   [USER-FLOWS.md](learn/USER-FLOWS.md), [ARCHITECTURE.md](learn/ARCHITECTURE.md) (database, AI, judge),
   [ADMIN-PANEL.md](learn/ADMIN-PANEL.md), [VISUAL-STYLE.md](learn/VISUAL-STYLE.md),
   [EDITORIAL-STYLE.md](learn/EDITORIAL-STYLE.md). Kharch/judge: [LEARN-LAUNCH-PLAN.md](LEARN-LAUNCH-PLAN.md).
   **Design ka ek hi sach:** [learn/DESIGN-SYSTEM.md](learn/DESIGN-SYSTEM.md) (logo A, tokens, layout, niyam) aur uska
   chalta namoona `docs/learn/mock-v3/app`; code ki taiyari aur owner se kya chahiye:
   [learn/CODE-READINESS.md](learn/CODE-READINESS.md); naye features: [learn/FEATURE-IDEAS.md](learn/FEATURE-IDEAS.md).
6. **Task list:** §3 se.
7. `npm ci`, phir §5 ka pehla `[ ]` kadam.
8. **Har kadam ke baad:** tests → `WIP(LV-…): …` commit → push → §3/§4/§5 me status → push. Limit 90% se upar ho to sab
   save karke owner ko batao.
9. **Niyam:** `npm run check` EXIT 0 se pehle push nahi (web/console par `build:clients` + `budget`; API/schema par
   `npm run openapi`). Tracker (`PREP-TRACKER.md`) har slice me update. Content me LeetCode/Codeforces/TUF ka koi text
   ya test nahi.

## 2. Owner ne kya maanga (19 Oct 2026)

Learn ka poora platform aur content: 5,000 coding problems (LeetCode/Codeforces level, apne), lambe editorials (owner
ki PDF wali style, visuals, insaan jaise), 5,000 aptitude, DBMS/CN/OS/OOPs/LLD/HLD/design patterns, har language, CP
math, SQL; compiler, saare features, poora UI, poora admin panel, security, scalable architecture, contests; LeetCode
aur TUF se behtar features. Pehle text-only launch; video phase 2 me DRM ke saath. Poora: [LEARN-V2.md](LEARN-V2.md).

## 3. Tasks

| # | Task | Status | Note |
|---|---|---|---|
| T1 | Design: LEARN-V2.md, launch plan, handoff | ✅ | 19 Oct 2026 |
| T2 | Owner se: editorial style, OWNER-SETUP list, reviewers | 🟡 | Style ✅ (owner ki file, 19 Oct → [learn/EDITORIAL-STYLE.md](learn/EDITORIAL-STYLE.md)); baaki Ruka hua kaam |
| T3 | Phase 1: neev (factory, judge, design v2) | ⬜ | §4 F-slices |
| T4 | Sample-first: 10 + 10 + 2 samples, owner ki manzoori | ⬜ | LEARN-V2 §3g; isse pehle bulk generation nahi |
| T5 | Phase 2: MVP features + launch content | ⬜ | §4 E, B1–B4, A1–A4 |
| T6 | Readiness + private beta + public launch | ⬜ | §4 S-slices |
| T7 | Phase 3: poora content + baaki features + Android app | ⬜ | |
| T8 | Phase 4: video + DRM | ⬜ | §4 V-slices |

## 4. Slices (har ek: migration → store → service → routes → UI → tests → docs)

`[ ]` baaki · `[~]` chal raha · `[x]` poora (commit ke saath)

**F: Neev**
- [ ] LV-F1 Design tokens v2 (glow, glass, motion) + Learn shell v2 (top bar, left nav, Ctrl+K, phone tab bar)
- [ ] LV-F2 Landing, pricing, legal pages (Terms, Privacy, Refund, Contact), help; prerender
- [ ] LV-F3 Problem package format ([learn/PROBLEM-STANDARD.md](learn/PROBLEM-STANDARD.md) §3, v1 JSON ka import): schema + migration (validator, generators, tests S3 par, checker, interactor, solutions, galat solutions, TL), import/export
- [ ] LV-F4 Content CMS v2 + review workflow (draft → machine checks → review → publish, diff, versions, rollback)
- [ ] LV-F5 Visual renderer v1: spec (JSON) → sketch SVG (rough style, Kalam font); array, pointers, window, LL, stack/queue, tree, graph, DP table, recursion tree; step slider; trace se frames
- [ ] LV-F6 Visual renderer v2: aptitude (Venn, DI, clock, dice, seating, family tree), OS/CN (Gantt, handshake, OSI), Mermaid/D2 theme (UML, ER, architecture)
- [ ] LV-F7 Factory: DSA pipeline (draft → package → runner jaanch → doosra model → duplicate → editorial + visual → style critic → review queue); 10 machine gates + mutation score (PROBLEM-STANDARD §5)
- [ ] LV-F8 Factory: aptitude pipeline (sawaal + Python solver + galat options ki wajah)
- [ ] LV-F9 Factory: lessons + Q&A + MCQ pipeline
- [ ] LV-F10 Judge queue API se bahar (`judge_jobs`, SKIP LOCKED) + alag worker service
- [ ] LV-F11 Judge: package se tests (S3, cache), `testlib.h`, PyPy, Go/Kotlin/Rust, compile cache, C++ PCH
- [ ] LV-F12 Interactive judge
- [ ] LV-F13 Autoscale + contest se pehle scheduled scaling + staging load test (p95 < 5 s)

**S0: Samples (gate)**
- [ ] LV-S0 10 coding (E3, M4, H2, CP1) + 10 aptitude + 2 lessons, poore editorial aur visuals ke saath → owner review

**E: Learner experience**
- [ ] LV-E1 Onboarding → roadmap v2 ("roadmap ready" card, adjust/break)
- [ ] LV-E2 Home v2 (aaj ka plan, revision due, streak, contest)
- [ ] LV-E3 Subjects, sheets, problems bank (filters: topic, pattern, mushkil, rating)
- [ ] LV-E4 Problem workspace v2 (tabs, test cases, submissions, Sahayak panel)
- [ ] LV-E5 Editorial v2 (template ke sections, approach tabs, 4 bhasha, visual player, revision card, Hinglish)
- [ ] LV-E6 Aptitude: topic lesson + practice set palette
- [ ] LV-E7 Aptitude: timed mocks, analysis, company-pattern mocks
- [ ] LV-E8 Lesson reader v2 (CS core, design, languages, CP math) + quizzes
- [ ] LV-E9 SQL v2 (schema viewer, result diff)
- [ ] LV-E10 Workspace page (code, lists, notes, mistake notebook, PDF downloads watermark ke saath)
- [ ] LV-E11 Profile/portfolio v2 + certificate verify
- [ ] LV-E12 Contests v2 (virtual, upsolve plan, rating graph, fresh problem pool)
- [ ] LV-E13 Search (Ctrl+K, FTS + pgvector)
- [ ] LV-E14 Hinglish/Hindi content toggle

**B: LeetCode/TUF se behtar** (LEARN-V2 §4)
- [ ] LV-B1 Chhota galat test (counterexample finder)
- [ ] LV-B2 Complexity jaanch (scaled inputs)
- [ ] LV-B3 Mistake notebook + drills
- [ ] LV-B4 Pattern pehchaan drills
- [ ] LV-B5 Micro-viva / Pramaan (verify hone wala)
- [ ] LV-B6 Dry run "agla kadam batao"
- [ ] LV-B7 Readiness score v2
- [ ] LV-B8 Teach-back
- [ ] LV-B9 AI mock interviewer (Learn)
- [ ] LV-B10 College groups aur leaderboard

**M: Roadmaps aur AI** (LEARN-V2 §4b; roadmap.sh ka content nahi, sirf features)
- [ ] LV-M1 Roadmap graph: schema (nodes, edges, node ↔ lesson/problem/quiz/lab), interactive SVG view + phone par list view, progress (done/seekh raha/skip)
- [ ] LV-M2 Apne roadmaps: 15 role + 20 skill (content factory se, insaan review)
- [ ] LV-M3 Custom roadmap editor (drag-drop, share link; Campus/Hire me assign); free 3, Plus 100
- [ ] LV-M4 AI roadmap (goal + samay + level → roadmap, hamare content se juda)
- [ ] LV-M5 AI courses aur guides (outline → lesson maangne par; dedupe; "AI ka banaya" / "Expert ne jaancha"; review queue)
- [ ] LV-M6 Unlimited quizzes (bank + AI, do model se jaanch)
- [ ] LV-M7 Plus v2: fair-use metering (Sahayak, AI course, quiz), chat history ki marzi (export/delete), "Plus beta" feature flags, pricing page
- [ ] LV-M8 Node ka Pramaan (quiz/viva se), profile par

**A: Admin**
- [ ] LV-A1 Roles v2 + admin 2FA zaroori + IP allowlist
- [ ] LV-A2 Users, support, "galti batao" reports, DPDP export/delete
- [ ] LV-A3 Content analytics (acceptance, "kaam aaya?", drop-off, khaali search)
- [ ] LV-A4 Factory control room (batches, kharch, failures, dobara chalao)
- [ ] LV-A5 Notifications/campaigns
- [ ] LV-A6 System health + feature flags

**R: Readiness aur launch**
- [ ] LV-R1 Rate limits, Turnstile, anti-scraping
- [ ] LV-R2 CSP/headers, WAF
- [ ] LV-R3 SEO prerender (problem, lesson pages), sitemap, OG images
- [ ] LV-R4 Perf budgets + 20k DAU load test
- [ ] LV-R5 Pen test fixes + readiness report
- [ ] LV-R6 DPDP: age gate/consent, privacy flows

**K: Code Studio aur graders** ([learn/CODE-STUDIO.md](learn/CODE-STUDIO.md) §9)
- [ ] LV-K1 Studio core (E0): CodeMirror editor, files/tabs, E0 shell (xterm.js), tests panel, checkpoints, autosave, command palette
- [ ] LV-K2 Web preview: esbuild-wasm, npm mirror (Verdaccio), alag-domain sandboxed iframe; graders `dom` (Playwright), `a11y`, `visual`
- [ ] LV-K3 Python/DS notebook (Pyodide) + graders `dataframe`, `notebook`
- [ ] LV-K4 SQL in Studio (sql.js + PGlite) + `sql` grader v2 (kai datasets)
- [ ] LV-K5 Guided lab engine (package, steps, checks, hints, explain, solution patch) + author mode ("starter fail, solution pass")
- [ ] LV-K6 `http` grader (Node/Java/Go servers) + FerretDB
- [ ] LV-K7 Arenas UI (har arena ki list, contests ✅ reuse)
- [ ] LV-K8 ML `metric` grader + datasets manager (licence field)
- [ ] LV-K9 LLD graders (change request, code metrics) + AI review (sirf salah)
- [ ] LV-K10 HLD: estimation drills, component katas, design canvas + simulator, AI interviewer
- [ ] LV-K11 microVM (E2) + `script` grader (DevOps, Spring, MERN)
- [ ] LV-K12 GenAI labs (mock LLM)

**X: Arenas ka content** ([learn/CODE-STUDIO.md](learn/CODE-STUDIO.md) §3)
- [ ] LV-X1 JavaScript 300 + output-predict 300 · [ ] LV-X2 Frontend/React 250 · [ ] LV-X3 Backend/Node 200
- [ ] LV-X4 Python 300 · [ ] LV-X5 Data Science 250 · [ ] LV-X6 ML 200 · [ ] LV-X7 DL/GenAI 150
- [ ] LV-X8 Java 200 + Spring 30 labs · [ ] LV-X9 Go 150 · [ ] LV-X10 DevOps 150 labs
- [ ] LV-X11 LLD 120 · [ ] LV-X12 HLD 150 + estimation 300 + concept 500

**W: Courses, articles** ([learn/CONTENT-CATALOG.md](learn/CONTENT-CATALOG.md))
- [ ] LV-W1 Course page + syllabus + lesson template v2 (owner ki kitaab ki soch)
- [ ] LV-W2 Launch ke ~20 courses (§6 "Launch")
- [ ] LV-W3 Articles/blog engine (SEO: schema, sitemap, prerender) + pehle 30 articles
- [ ] LV-W4 Cheat sheets (PDF, watermark)
- [ ] LV-W5 Phase 3 aur 4 ke courses

**V: Video + DRM (phase 2)**
- [ ] LV-V1 Video upload + transcode (admin), `VideoProvider` adapter
- [ ] LV-V2 DRM player (Shaka + FairPlay) + license token + device/stream limit
- [ ] LV-V3 Chalta watermark + leak trace
- [ ] LV-V4 Android app (Capacitor + native player, `FLAG_SECURE`)
- [ ] LV-V5 iPhone: recording pakad kar blur
- [ ] LV-V6 Text ki suraksha (watermark overlay, scraping rok)

**C: Content batches** (factory se, raat ko; review ke saath)
- [ ] LV-C1 A2Z 520 · [ ] LV-C2 bank 980 · [ ] LV-C3 bank 2,480 tak · [ ] LV-C4 CP 2,000
- [ ] LV-C5 aptitude 2,000 · [ ] LV-C6 aptitude 5,000 + 50 mocks
- [ ] LV-C7 DBMS/OS/CN/OOPs · [ ] LV-C8 SQL 300 · [ ] LV-C9 LLD + patterns · [ ] LV-C10 HLD
- [ ] LV-C11 Languages (C, C++, Java, Python, JS/TS, Go) · [ ] LV-C12 CP math · [ ] LV-C13 Hinglish editions
- [ ] LV-C14 Purane 1,260 problems: import + jaanch + originality (plan 91)
- [ ] LV-C16 Basics 500: owner ke series batches v1 → v2 upgrade (PROBLEM-STANDARD §6), phir naye
- [ ] LV-C15 "Kaise padhein" free course + kitaab ke 7 problems (owner ki kitaab, [learn/EDITORIAL-STYLE.md](learn/EDITORIAL-STYLE.md) §8)

**N: All-in-one ki nayi cheezein** ([learn/ALL-IN-ONE.md](learn/ALL-IN-ONE.md) §3, UX: [learn/UX-BLUEPRINT.md](learn/UX-BLUEPRINT.md))
- Phase A (launch ke saath): [ ] LV-N1 phone-first (Parsons, output predict, code keyboard, offline packs) ·
  [ ] LV-N6 proctored certificates · [ ] LV-N7a resume builder · [ ] LV-N7b portfolio site · [ ] LV-N10 gamification v2
  (XP, quests, weekly league) · [ ] LV-N11 skill graph (basic) · [ ] LV-N12 AI ke do mode · [ ] LV-N18 college lab mode ·
  [ ] LV-N20 Daily 10 · [ ] LV-N23 wellbeing · [ ] LV-N24 AI ka khula hisaab
- Phase B (3 mahine): [ ] LV-N2 code-casts · [ ] LV-N3 project briefs + Ship it · [ ] LV-N5 mentors · [ ] LV-N8 peer mocks ·
  [ ] LV-N9 cohorts · [ ] LV-N15 doubt forum · [ ] LV-N16 college chapters · [ ] LV-N19 GitHub jod
- Phase C (baad me): [ ] LV-N4 hackathons · [ ] LV-N13 open source season · [ ] LV-N14 data challenges ·
  [ ] LV-N17 live events · [ ] LV-N21 sponsor-a-learner · [ ] LV-N22 perks · [ ] LV-N25 parent view

## 5. Abhi chal raha / agla kadam

### Abhi yahan ho (21 Oct 2026, naya session pehle ye padhe)

- **Bana aur push hua:** Learn ka clickable mock **v4.2** (`docs/learn/mock-v3/app`, 72 screens: 45 learner + 27 admin).
  Ye sirf mock hai: asli data, judge, AI, Colab ka aana-jaana aur doosri sites ka sync nahi; iske automated tests nahi.
  Kya-kya hai: [learn/mock-v3/README.md](learn/mock-v3/README.md). Screenshots `learn/mock-v3/screens/`.
- **Design ka ek hi sach:** [learn/DESIGN-SYSTEM.md](learn/DESIGN-SYSTEM.md) (logo A ka SVG, tokens, font, layout, motion,
  components, niyam). Har naya screen ya code isi se. Purane design docs (DESIGN-V3/V4, LEARN-V2 §9) sirf itihaas.
- **Owner ke saamne (jawab baaki):** [learn/CODE-READINESS.md](learn/CODE-READINESS.md) §1 ke faisle F1 "shuru karo",
  F2 brand sab jagah ya sirf Learn, F3 pehle launch ke screens, F4 LeetCode/CodeChef niyam, F5 merge kaun kare, F6 content
  samples, F7 daam (testing ke baad). Aur [learn/FEATURE-IDEAS.md](learn/FEATURE-IDEAS.md) se kaunse features agle
  (sujhaav: L1, L7, L9, A2, A8). Owner ko ye sab 21 Oct ko chat me bataya ja chuka hai; dobara lamba mat samjhao.
- **Ab chal raha: mock v4.3** (owner, 23 Oct: "v4.3 shuru karo"; tracker row 135). Kram: U0 plan + jaanch (axe,
  touch size) → U4 dark me 3 parat + focus bar menu → U1 Aaj ke 3 roop → U3 profile ke 3 roop → U2 brand ke 6 pal →
  U5 12 screens × 5 haalat → U6 jaanch, screenshots, docs, publish. Har U ke baad push + yahan status. Aaj aur profile
  ke roop switch se dikhte hain; owner ek chunega, baaki hatenge. Status: **U0–U6 ✅ (23 Oct)**: Aaj A/B/C
  (`today43.tsx`), profile A/B/C (`profile43.tsx`), roop ka switch `lib/variant.tsx` (`pk43-v-<screen>`), dark parat
  (`tokens.css`), focus bar ⋯ (`focus.tsx`), `Moment` (kit), `ui/states.tsx` + neeche-baayein "Haalat" switch, sab CSS
  `v43.css`; axe 0 har combination me, phone touch 0; 72 × 7 saaf; README v4.3, DESIGN-SYSTEM v4.3, screenshots +
  `screens/v43/`, wahi link par publish. **Agla: owner ki raay** (roop chunna, users par test, F1–F7). Roop chune jaane
  par: baaki roop aur `VariantBar` hatao, DESIGN-SYSTEM me chuna roop likho.
- **Owner jo bole, uska rasta:**
  - Mock me badlav ya naya screen → wahi app, kram: plan (yahan + tracker "Plan") → banao → `qa.mjs` jaanch →
    screenshots → README → publish → push. Version ka naam aage badhao (v4.3) aur tracker me nayi row.
  - "Shuru karo" (F1) → CODE-READINESS §4 ka **phase P0** (design ko `packages/brand`, `packages/web`,
    `packages/console` me; DESIGN-SYSTEM §10–11 ka porting kram). P0 ke liye sirf F1, F2, F3, F5 aur GitHub billing
    chahiye. P0 ke baad §4 ke slices (LV-F3 problem package, LV-F5 visual renderer, LV-S0 samples ...).
  - Koi feature idea chuna → pehle mock me screen, owner ki haan, phir code.
- **Preview link:** https://claude.ai/artifact/LDK6qdh2qKj8WzWYAiN4Zn (Version 9 = v4.2). Ye account 2 ka artifact hai.
  Doosra account ise update nahi kar sakta: wo `dist/artifact.html` ko **naye** artifact ke roop me publish kare, naya
  link yahan aur README me likhe, aur owner ko bataye (ya owner purane artifact par edit access de).
- **Mock build:** repo root par `npm ci`, phir `docs/learn/mock-v3/app` me `npm install` (sirf fonts), phir
  `npx tsc -p tsconfig.json && npx vite build && node build-artifact.mjs` → `dist/artifact.html`. Jaanch:
  `node qa.mjs 1440 dark en` (overflow + console error), admin roles ke liye `ROLE=finance node qa.mjs ...`; screenshots
  `node shots.mjs <out> <routes> <w> <theme> <lang> view|full` (`SEL=` ek element). `playwright install` kabhi nahi.

### Purana vistaar (itihaas)

**UI mock:** v1 ([learn/mock/README.md](learn/mock/README.md)) owner ko pasand nahi aaya (20 Oct). Kyun aur v2 kaise: [learn/DESIGN-STUDY.md](learn/DESIGN-STUDY.md). Poora design plan (3 clips se har feature, 47 components, tokens, mascot, IA, screens ka kram D0–D5): [learn/DESIGN-PLAN-V2.md](learn/DESIGN-PLAN-V2.md). **Mock v3 bana (20 Oct), owner ki raay baaki:** owner ne v2 bhi nakaara ("TUF jaisa"); naya design [learn/DESIGN-V3.md](learn/DESIGN-V3.md), app `learn/mock-v3/app`, kram V0–V7 (DESIGN-V3 §14), tracker row 131. Har V ke baad push + yahan status. **Status:** V0 ✅, V1 ✅ (tokens, fonts, logo, kit, learner/focus/admin shells, Sahayak pane, map, brand page; `npx vite build && node build-artifact.mjs`, `node shots.mjs <out> <routes> 1440 light en full`). V2 ✅ (landing, login, onboarding, aaj, plan). V3 ✅ (problem 3-pane Statement|Code|Sahayak, SQL 3-pane, editorial + dry run, sheet, practice hub, revision, Daily 10). Preview link (har V ke baad isi par redeploy): https://claude.ai/artifact/LDK6qdh2qKj8WzWYAiN4Zn. V4 ✅ (courses notebook covers, roadmap + drawer, course, lesson, aptitude hub/set/mock/result, POTD, contests list/rules/live 4-pane/result). V5 ✅ (Build naya: project gallery CSS previews, milestone project page, Studio IDE 4-pane; companies ×3, Pramaan, certificate, profile, jobs + resume red-pen check, lists, notes, Sahayak page, community, Plus, settings). V6 ✅ (admin 25 screens `src/admin/*`: staff sign-in + 2FA, dashboard, review queue (checklist poora hone tak approve band), 4-eyes approvals, problems + editor (8 tabs), aptitude, lessons block editor, roadmap graph editor, companies (source ke bina fact chhupa), factory, learners + learner (masked data, reveal log), support inbox, community, payments (₹5,000+ refund 4-eyes), contests (live, copy check), Sahayak AI (kharch, limits, prompts, evals, kill switch), analytics, messages, roles matrix (cell dabao, 4-eyes), staff, audit log (hash chain, before/after), security (SSO, IP list, sessions, 4-eyes niyam, API keys, DPDP), system (health, flags, maintenance); "Viewing as" se role badlo to lock dikhte hain). V7 ✅ (68 × 7 jaanch: overflow 0, console error 0; admin 4 roles me; screenshots `learn/mock-v3/screens/` + overview; README [learn/mock-v3/README.md](learn/mock-v3/README.md); tracker row 131 🟡, "Ruka hua kaam" me v3 ki raay). Owner ki raay (20 Oct): "sab achha, font AI wala; kaala default, sab saaf; Studio VS Code jaisa; admin har pehlu se". **Mock v4 chal raha** ([learn/DESIGN-V4.md](learn/DESIGN-V4.md), tracker row 132, wahi app aur link): kram R0 (doc) → R1 font/rang/kit → R2 learner pages → R3 Studio → R4 admin → R5 QA + publish. Status: R0–R5 ✅ (IBM Plex + JetBrains Mono, kaala default `pk4-theme`, kit refine, Studio `src/screens/studio.tsx` VS Code jaisa, admin gehra, 68 × 7 jaanch saaf, screenshots + README v4). Owner (20 Oct): font + kaala ✅, roles + 4-eyes ✅, daam baad me, asli code abhi ruko. **Ab mock v4.1** (tracker row 133): S1 2→3 pane animate, S2 P logo (3 option), S3 Studio refine, S4 motion + polish + naye features, S5 QA + publish. Status: S0 ✅, S1 ✅ (problem/SQL default 2 pane; Sahayak `useAi` se teesra pane flex-grow animate se khulta/band hota; `src/ui/focus.tsx`), S2 ✅ (P logo ke 3 option `LogoMark variant` A pass / B prompt / C progress, `src/ui/kit.tsx`; brand page par "Poore app me lagao" se poore app me aazmao, `pk4-logo`; default A; certificate aur course cover ab `LogoMark`), S3 ✅ (Studio: gutter me badlav ke nishaan HEAD ke against, squiggle par hover card, Ctrl+. quick fix pehle badlav dikhata hai aur "madad li" note karta hai, Ctrl+I inline Sahayak sirf hint deta hai, Source control se diff tab, tests ek-ek karke chalte hain, fix + dobara jaanch par 8/12 → 10/12), S4 ✅ (`usePresence` se modal/drawer/menu/toast ka bahar jaana bhi animate; Tabs ki line khisakti hai; Meter bharta hai; Sahayak pane apna column badha kar khulta aur sikud kar band hota; bell se notifications drawer (Sab / Aapke liye, sab padh liya, shaant samay); `?` se shortcut sheet, `G` phir akshar se jump; mock ka "Saare screens" button computer par daayein). S5 ✅ (68 × 7 aur 25 admin × 4 role saaf; screenshots + overview dobara; README v4.1; tracker row 133 🟡; wahi link par publish). Owner (21 Oct): logo A final; aur maanga (tracker row 134). **Ab mock v4.2:** T0 plan ✅ → T1 logo A final + favicon → T2 SQL = problem workspace → T3 profile v2 (HR share, platforms, card) → T4 landing gehra → T5 `#notebook` (ML, Colab) → T6 naye features (learner: AI mock interview; admin: integrations, recruiters) → T7 docs (`learn/DESIGN-SYSTEM.md`, `learn/CODE-READINESS.md`, naye features) → T8 QA + screenshots + publish. Har T ke baad push + yahan status. Status: T0 ✅, T1 ✅ (`LogoMark` ab sirf A; B/C aur `pk4-logo` switch hataaye; brand page par final logo: hero, kaagaz, sizes, app icon, banawat ka grid + khaali jagah, don'ts; favicon `index.html` + `build-artifact.mjs`), T2 ✅ (`src/screens/problem.tsx` me ek `Workspace`: DSA aur SQL dono; SQL me Problem/Editorial/Submissions tabs, schema cards, example ki tables, hints, query.sql + dialect, Tests/WA/Error/AC, 6 datasets; Sahayak ka `sql` context alag baat karta hai), T3 ✅ (`src/screens/profile.tsx`: hero + mazbooti meter, 6 KPI, tabs Saar / Coding sites / Projects / Profile card; skills saboot ke saath; 6 platforms ka saar + donut, har number ke saath "kaise jaancha" (judge, official API, OAuth, bio code); "HR ko share karo" modal: ek company ka link (expiry), public link, kya dikhe toggles, WhatsApp/LinkedIn/Email/QR/PDF; "HR ki nazar se" view; share card 3 size; rail me "Kisne dekha" + 100% checklist), T5 ✅ (`src/screens/notebook.tsx` + `styles/notebook.css`, route `#notebook`: Jupyter jaise cells (markdown, code, DataFrame, chart, print), leakage ki chetavani parikshaa-check se, CPU job chalta hua, Milestone checks 2/3; runtime: Browser Python (Pyodide) / Parikshaa CPU job / Colab GPU (Drive se, grade yahin, chhupa test bahar nahi); side me Files/Data/Variables + RAM; Sahayak `notebook` context; Build gallery me "Mandi Price Forecast" card), T4 ✅ (landing ke naye hisse: 8 tracks, "Kuch install nahi" (Studio / Notebook / SQL switch), 12 hafte ka raasta, "HR ke liye" (asli `ProfileCard`), "Dekhna practice nahi" tulna + Sahayak ke niyam, 4 naye FAQ, nav me "HR ke liye"; koi nakli number ya testimonial nahi), T6 ✅ (learner `#interview` (`src/screens/interview.tsx`): AI mock interview setup / live (awaaz + code, Sahayak band) / report (5 rubric, "hiring score nahi"); admin `adm-runtime` (browser / CPU / Colab / GPU labs, plan-war seema, linked sites ka sync + toggle, keys ki sirf haalat) aur `adm-recruiters` (share links, recruiter domain verify, scam reports, suspend = 4-eyes) `src/admin/a-platform.tsx`; MATRIX me `runtime`, `recruiters`), T7 ✅ (`learn/DESIGN-SYSTEM.md` design ka ek sach; `learn/CODE-READINESS.md` faisle F1–F7, accounts/keys, connectors, phases P0–P5; `learn/FEATURE-IDEAS.md`; LEARN-V2 §9 par "purana" note; §1 me pointer). T8 ✅ (72 × 7 aur 27 admin × 5 role saaf; screenshots 72/16/17/5 + overview; README v4.2; tracker row 134 🟡; wahi link par publish). **Agla: owner ki raay** ([learn/CODE-READINESS.md](learn/CODE-READINESS.md) §1 ke faisle F1–F7; "shuru karo" par phase P0).

**Mock v2 bana (20 Oct, owner ne nakaara):** 41 screens + naksha, dark-first, React app (`learn/mock-v2/app`), 3 bhasha, dark/light, phone layout; link https://claude.ai/artifact/NsPXqTVifNbLEQB4rsYYmg; screens aur kaise dekhein: [learn/mock-v2/README.md](learn/mock-v2/README.md). **Owner ki raay ka intezaar** (kya pasand, kya badle) aur DESIGN-PLAN-V2 §10 ke jawab; haan milne par tokens + kit product me (D0–D1).

**Code ka kram (owner ke "shuru karo" ke baad):** pehle phase P0 (upar), phir LV-F3 (problem package format), phir LV-F5
(visual renderer v1), phir LV-S0 (samples, [learn/EDITORIAL-STYLE.md](learn/EDITORIAL-STYLE.md) ki style me). Bulk content
(C-slices) LV-S0 ki manzoori aur API key ke baad hi. Roadmaps + AI (M-slices) LV-E5 ke baad.

## 6. Sessions (har session shuru me row jode, jaate waqt "kahan ruka" bhare)

| # | Tareekh | Account / session | Kya kiya | Kahan ruka |
|---|---|---|---|---|
| 1 | 19 Oct 2026 | account 2, `session_018vRviyFgDfdAVh2GzLcBn3` | Owner ka faisla "Learn pehle"; LEARN-V2.md, LEARN-LAUNCH-PLAN.md, ye handoff; branch `claude/learn-v2`. Phir owner ki editorial file se style guide (`learn/EDITORIAL-STYLE.md`) aur roadmap.sh jaise features (LEARN-V2 §4b, LV-M1–M8). 20 Oct: design study, DESIGN-PLAN-V2, mock v2 (41 screens, `learn/mock-v2/`); mock v2 nakaara gaya, phir DESIGN-V3 aur mock v3 (68 screens incl. 25 admin, `learn/mock-v3/`); v3 par raay ke baad mock v4 (font, kaala default, VS Code Studio, admin gehra); 20–21 Oct: mock v4.1 (2↔3 pane, Studio, motion) aur v4.2 | 21 Oct: mock v4.2 poora (72 screens, logo A final, SQL = DSA workspace, profile v2 + HR share, notebook + Colab, AI interview, admin runtimes + recruiters) aur docs DESIGN-SYSTEM / CODE-READINESS / FEATURE-IDEAS; sab push, wahi link. Owner ke faisle F1–F7 ka intezaar (§5 "Abhi yahan ho") |

## 7. Log (naya upar)

- 23 Oct 2026: mock v4.3 (U0–U6): Aaj aur profile ke 3-3 roop (switch), dark me 3 parat, focus bar ⋯, 6 brand pal, 12 screens × 5 haalat, accessibility saaf (axe 0, phone touch 0); `a11y.mjs`; ALL-IN-ONE §8a me kharch ka naya naap aur model/effort ka sujhaav. Owner ki raay baaki.
- 23 Oct 2026: owner ke kehne par 21st.dev ki 7 skills project me (`.claude/skills/21st-*`, Apache-2.0, README wahin); istemaal ke niyam `CLAUDE.md` me (DESIGN-SYSTEM.md jeetta hai, `packages/*` me `21st add` nahi, publish aur paid AI sirf owner ki haan se). Chalane ke liye owner kare: environment me `21st.dev` allow + `TWENTYFIRST_TOKEN`.
- 21 Oct 2026: mock v4.2 (T0–T8): logo A final + favicon; SQL = DSA workspace; profile v2 (HR share link, card, coding sites ka saar); landing gehra; ML notebook (Colab GPU); AI mock interview; admin runtimes + recruiters; docs DESIGN-SYSTEM, CODE-READINESS, FEATURE-IDEAS. 72 screens, wahi link. Owner ki raay baaki.
- 20 Oct 2026: mock v4.1 (S0–S5): problem/SQL default 2 pane, Sahayak se 3 aur wapas 2 (animate); P se logo ke 3 option (brand page se poore app me aazmao, default A); Studio me quick fix, diff, inline Sahayak, hover card, test ek-ek karke; modal/drawer/menu/toast exit motion, tab line, notifications drawer, `?` shortcuts. Screenshots + README v4.1, wahi link. Owner ki raay baaki (logo).
- 20 Oct 2026: mock v4 (R0–R5): IBM Plex Sans + Devanagari + JetBrains Mono, kaala default, kit refine, VS Code jaisa Studio, admin pages gehre; screenshots aur README v4; wahi link. Owner ki raay baaki.
- 20 Oct 2026: mock v3 poora (V0–V7): 68 screens (43 learner + naksha/brand, 25 admin), README + screenshots `learn/mock-v3/`, link https://claude.ai/artifact/LDK6qdh2qKj8WzWYAiN4Zn. Admin: 8 roles ka matrix, "Viewing as" role switch, 4-eyes, audit (hash chain), security, AI kill switch. Owner ki raay baaki.
- 20 Oct 2026: owner ne mock v2 nakaara; v3 ka design faisla `learn/DESIGN-V3.md` (kaagaz/blackboard, stationery rang, naya logo, Sahayak 3rd pane, Build naya, 24 admin screens 8 roles ke saath). V0 hua.
- 20 Oct 2026: mock v2 bana: 41 screens + naksha (landing → onboarding → aaj → plan → problem/editorial (dry-run) → aptitude mock → contest → company → build → Pramaan → profile → Sahayak ...), Vite + React + lucide, ek HTML file; 63 screenshots `learn/mock-v2/screens/`; link https://claude.ai/artifact/NsPXqTVifNbLEQB4rsYYmg. Owner ki raay baaki.
- 20 Oct 2026: owner ne mock v1 nakaara; TUF ke screenshots + Planly video ka design study (`learn/DESIGN-STUDY.md`): unki design DNA, v1 ki kamiyan, v2 ka tareeka, owner se kya chahiye.
- 20 Oct 2026: TUF platform-features ke 3 clips (231 frames, 60 zoom, 40 rang naape) se `learn/DESIGN-PLAN-V2.md`: landing ka dhaancha, 9 feature ke flow (planner, curriculum, editorial, AI, company, aptitude, practice/POTD/contest, workspace, profile/certificate), 47 components ki haalatein, TUF ki kamiyan, hamare tokens/font/mascot/naam, IA, mock v2 ke 4 batch, kram D0–D5. Plugins abhi enable nahi (owner kare).
- 19 Oct 2026: poore Learn ka clickable UI mock, 46 screens (learner, phone, admin), design canvas par; files `docs/learn/mock/` (README me link aur screen list). Code ke UI slices isi se match karenge.
- 19 Oct 2026: all-in-one platform ka plan (research, 7 stambh, 25 nayi cheezein N1–N25, owner ki list, launch kharch, $200 plan par samay) aur har page ka UX (`learn/ALL-IN-ONE.md`, `learn/UX-BLUEPRINT.md`); slices LV-N.
- 19 Oct 2026: Code Studio (browser IDE), guided labs, 13 arenas (JS se HLD tak), ~65 courses ka catalog, articles ka plan, aur "baaki planning" ki list (`learn/CODE-STUDIO.md`, `learn/CONTENT-CATALOG.md`, `learn/OPEN-PLANNING.md`).
- 19 Oct 2026: owner ke problem JSON (SQL + series 25/26/28/29) ka audit aur problem standard v2 (`learn/PROBLEM-STANDARD.md`); Basics track 500.
- 19 Oct 2026: owner ke faisle: kitaab unki apni (text bhi use hoga), Plus chat history jab tak account, fair use 200/din. Reference images se sketch visual style; poora build spec `docs/learn/` (USER-FLOWS, ARCHITECTURE, ADMIN-PANEL, VISUAL-STYLE).
- 19 Oct 2026: owner ki editorial file ("Decode Your Coding Interview") se style guide; roadmap.sh ke features (apne content se; unka licence content ki ijaazat nahi deta).
- 19 Oct 2026: Learn v2 shuru. Design docs aur handoff. Hire ruka (agla H2d kadam 2, [HIRE-HANDOFF.md](HIRE-HANDOFF.md)).
