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
   **PR:** [#67](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/67) (draft, 24 Oct; base
   `claude/festive-maxwell-pb4k5v` jab tak #66 merge na ho, phir `main` par badlo aur [HANDOFF.md](HANDOFF.md) me likho).
2. **Doosra session to nahi chal raha?** §6 ki aakhri row. "Chal raha" ho aur 30 minute ke andar commit ho, to owner
   se poochho.
2b. **Pichhle session ne kya kiya (har baar, chahe wo doosra account ho):** neeche §5 ka "Abhi yahan ho" (sabse upar
   ka bullet), §7 log ki upar ki 3–5 lines, aur `git log --oneline -15 origin/claude/learn-v2` padho. Tumhari pichhli
   §6 row ke baad jo hua, use samjho aur **dobara mat banao**; wahi se aage badho.
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

- **Sabse taaza (24 Oct 2026, session 4, doosra account, `session_01CxKYSJpaMfGb259ZWTqTDB`, ultracode):** **Kadam 0
  ka design wala hissa poora.** (1) **AE6** `#code-read` (`src/screens/coderead.tsx`, `.cr-*` in `ai.css`, switch
  `pk43-v-read`): 219 line ka asli Python, galti line 73 (chala kar saabit). (2) **AE9** `#company` ka tab "Interview ka
  format" (`src/screens/format.tsx`, `.fmt-*` in `career.css`, switch `pk43-v-cotab`) + companies list par AI ki line.
  (3) **44-0 test script** [learn/USER-TEST-44-0.md](learn/USER-TEST-44-0.md). Saath me tablet par sidebar ke naam theek.
  77 screens. **Draft PR [#67](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/67)** khuli.
  **Owner ke faisle (24 Oct, session 4 me poochhe):** F1 haan, F2 brand sab jagah, F5 har PR owner merge karega, GitHub
  billing theek (CI ab #67 par chal raha), Supabase Mumbai chalu karne ki haan. **Supabase ka connector is account me
  nahi:** owner https://claude.ai/customize/connectors par Supabase jode, phir naya session; tab `parikshaa-mumbai`
  restore (ya owner khud Supabase dashboard se Restore).
  **25 Oct 2026:** connector ab is account me hai; `parikshaa-mumbai` (status INACTIVE tha) ka restore connector se maanga
  gaya (restore requested). Agla session `get_project` se status dekhe (ACTIVE_HEALTHY hone par Kadam 2 ka DB kaam).
  **Naya preview:** https://claude.ai/artifact/PsBMjWL2TwJSDLT5QVmvJG (Version 1).
  **Agla: Kadam 1** (tracker plan row 139), tukde ek-ek PR me:
  - [x] K1-0 plan (row 139) + `packages/web` / `packages/console` ki `package.json` me dohri keys hatai (lockfile wahi;
    check, build:clients, budget hare; `1fca51a`). Saath me CI ka `security` job (npm audit, high) theek: lockfile me sirf zod
    4.6.7, fastify 5.12.7, fast-uri patch (`a46f171`). **Baaki:** nodemailer ka moderate advisory (10.1.4 chahiye) alag badlav
    me; ye #66 (`claude/festive-maxwell-pb4k5v`) par bhi wahi failure hai, #67 merge hone par theek.
  - [x] K1-1 (25 Oct: `debdb54` CI visual fix, `3992e6a` brand, `81af3de` 134 baselines, `9f17273` e2e F1 Sunday fix):
    exam app, console aur Learn naye brand me; tokens.css ke purane naam naye maan, mock ke naam
    `packages/brand/src/learn.css` me (web CSS budget ke liye alag), IBM Plex, logo A; check/build:clients/budget/lint:css/
    visual, e2e chromium 44/44 aur Lighthouse hare (Firefox/WebKit sirf CI me). Mock se ek maan alag: dark `--primary`
    `#5a7dff` (gehra text). Baaki: achievement card SVG, `docs/screenshots/`. **Baselines CI jaise banana (zaroori):** is container ka
    fontconfig grayscale hai (`/etc/fonts/conf.d/12-unhinted-grayscale.conf`, `56-prefer-inter.conf`) aur
    `/opt/pw-browsers/chromium_headless_shell-1243/.../chrome-headless-shell` wrapper `--disable-lcd-text
    --font-render-hinting=none` lagata hai; CI (ubuntu) subpixel RGB banata hai, isliye bina iske har image 1–2% alag. Tareeka:
    `/etc/fonts` ki copy jisme ye do file na hon, `FONTCONFIG_FILE` se; Playwright 1.64 ko `chromium_headless_shell-1248` chahiye:
    wahan ek wrapper jo `...-1243/.../chrome-headless-shell.real "$@"` bina flags chalaye (repo me kuch nahi). Postgres data dir
    `/tmp/claude-0` ke neeche mat rakho (uski permission 700 ho jaati hai, Postgres mar jaata hai): `/var/lib/postgresql/k1-e2e`.
    Purana plan (session 4): contrast test;
    e2e visual baselines dobara. **Session 4 ka mapping (shuru yahin se):** sach `docs/learn/mock-v3/app/src/styles/tokens.css`.
    `packages/brand/src/tokens.css` ke naam rakho, maan badlo: `--gray-50/0/25/100/200/300` = mock `--page/--panel/--panel-2/
    --sunk/--line/--line-2`; `--gray-900/600/500` = `--ink/--ink-2/--ink-3`; `--brand-600/700/50/200` = `--pen/--pen-hover/
    --pen-soft/--pen-line` (baaki brand scale isi pen #2349e6 se); accent (saffron) = marker `#ffd84d` (solid, dark text) +
    `--coin` (accent-text); success = tick; danger = red; review = ai; info = teal; warning = coin. Chrome (exam bar, console
    sidebar) = Syaahi (`#101013`/`#16161a`, text `#c4c4cc`). Dark blocks = mock ke dark maan (dono block same; console ka
    `tokens.test.ts` contrast + "dono dark block barabar" jaanchta). Mock ke naam (`--page`, `--panel`, `--ink`, `--pen`,
    `--ai`, `--coin`, `--marker`, `--code-*`, `--card-line` …) alias/maan ke saath isi file me. Fonts: `--font-sans` me
    "IBM Plex Sans", "IBM Plex Sans Devanagari" pehle, baaki 9 Noto rahe; Inter hatao; `@fontsource/ibm-plex-sans`,
    `-devanagari`, `ibm-plex-serif`, `kalam` brand ki dependency (lockfile `npm install`). Logo: `packages/brand/src/react.tsx`
    ka `Wordmark` (प) → mock `src/ui/kit.tsx` ka `LogoMark` A SVG; web/console ke favicon bhi. Radius/space abhi mat badlo
    (layout churn). Baselines: Postgres 16 container me hai (`/usr/lib/postgresql/16`); `npm run visual:update -w
    @parikshaa/e2e`, diff dekh kar commit. Har shell/console screen naya dikhega; owner ko pehle/baad dikhana.
  - [ ] K1-2 kit (`Panes`, `FocusBar`, `Seg`, `Ring`, `Meter`, haalatein) `packages/brand/src/ui.tsx` me, render + axe tests.
  - [ ] K1-3 Learn shell `packages/web` me flag `learn_v2` ke peeche (sidebar, rail, phone tabs, Ctrl+K, ⋯ menu, en/hi).
  - [ ] K1-4 CI me Learn shell ka visual + axe, budget.
- **Pichhla (24 Oct 2026, account 2, `session_018vRviyFgDfdAVh2GzLcBn3`):** mock **v4.4** chal raha (tracker row
  136, aur AI ke daur ka plan row 137). Ho chuka: **44-1** roop final (Aaj A, Profile B); **44-4 ka pehla hissa**: owner
  ke chune **AE2 ticket lab** (`#ticket-lab`), **AE3 Galat AI pakdo** (`#ai-drill`), **AE5 interview ke do roop**
  (`#interview`), phir **AE1 track** (`#ai-track`), **AE4 AI istemal report** (`#ai-report`), **AE7 readiness ke do
  hisse**, **AE8 kaagaz ki line**; code `src/screens/ailab.tsx`, `aitrack.tsx`, `interview.tsx`, CSS `src/styles/ai.css`;
  76 screens, QA/axe 0; wahi link Version 13. Owner ne AI ke daur ke **saare sujhaav maane** (tracker "Faisle"; LEARN-V2 §4c me AE1–AE9).
  **Agla (kram tay, 24 Oct; [learn/CODE-READINESS.md](learn/CODE-READINESS.md) §4b, tracker row 138):** contract-first
  frontend, Kadam 0–5. **Kadam 0 (abhi, bina faisle ke):** mock me **AE6** code padhna + **AE9** interview format guide,
  phir **44-0** user-test ka script (5–8 students + 2 HR/TPO, 30 min, ticket lab aur drill ke task bhi). **Kadam 1**
  (frontend ki neev, `packages/brand` + kit + Learn shell) tabhi jab owner F1 "shuru karo", F2 (brand kahan), F5 (merge)
  de aur GitHub billing theek ho; **Kadam 2** se pehle Supabase Mumbai chalu karne ki haan (§0 me aaj ki haalat).
  44-2/44-3/44-5/44-6 test ki raay aane par. Code F1 ke baad hi. Sample content (2 ticket labs, 20 drills, 5 code-padhna sets) owner manzoor
  kare tab bulk.

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
  `screens/v43/`, wahi link par publish. Roop 24 Oct ko chune gaye (Aaj A, Profile B): `today43.tsx`, `profile43.tsx`
  aur roop ka switch ab nahi hain (neeche v4.4, 44-1).
- **Ab chal raha: mock v4.4 "raay se final" (plan pakka, owner 23 Oct; tracker row 136).** Kadam: **44-0** plan (ye entry + tracker row) +
  user-test script (30 min, 5–8 students + 2 HR/TPO; tasks: aaj ka kaam, problem + Sahayak hint, teeno Aaj roop; HR: shared profile,
  "kaise jaancha", teeno Profile roop; har task par kamyaabi, kahan atke, roop ki pasand) → **44-1** roop final (Aaj ka ek roop:
  A/B/C/v4.2; Profile ka ek: A/B/C/v4.2; baaki roop, `VariantBar`, `lib/variant.tsx` switch aur `pk43-v-*` hatao; chuna roop
  `today.tsx`/`profile.tsx` me; DESIGN-SYSTEM me chuna roop likho) → **44-2** test ki dikkato ke fix (sirf wahi, naya design nahi,
  pehle/baad screenshot) → **44-3** screen reader + keyboard safar (learner: Aaj → problem → submit → editorial; admin: dashboard →
  review queue → approve) → **44-4** owner ke chune feature screens (sujhaav L1, L7, L9, A2, A8; koi na chune to kadam chhutega) →
  **44-5** sirf-mock safai (`StateFab` jaisi cheezein) + 12 screens ki 5 haalatein final roop par → **44-6** QA (`qa.mjs`, `a11y.mjs`
  axe 0, touch 0) + screenshots `screens/v44/` + README v4.4 + DESIGN-SYSTEM note + publish (naya link). **Gates:** G1 test ke log/
  samay owner dega (test bina 44-1 nahi), G2 roop sirf owner, G3 features owner. Status: **44-0 ✅**: plan ✅ (23 Oct), test script ✅ (24 Oct, [learn/USER-TEST-44-0.md](learn/USER-TEST-44-0.md)); test khud G1 par.
  **44-1 ✅ (24 Oct):** owner ne test se pehle hi chun liya ("Aaj ka A aur profile ka B final karo"), isliye G1 ab 44-1 ko
  nahi rokta; test ab **chune roop par** hoga (44-0 ke script se "teeno roop" wale task hatao, roop ki pasand ki jagah
  "kya samjha, kahan atka"). Kya hua: Aaj = A "Ek kaam" `src/screens/today.tsx` (`AajBody`, `AajRail`); Profile = B
  "Saboot ka kaagaz" `src/screens/profile.tsx` (`ProfileBody`: upar share/Resume PDF/HR ki nazar/Edit, tabs Saboot ka
  kaagaz · Coding sites · Projects · Profile card; `ProofSheet` me internship line + 26 hafte ka heatmap; HR ki nazar me
  phone, buttons aur card tab chhupe). `today43.tsx`, `profile43.tsx`, `VariantBar`, `pk43-v-aaj/profile`, `main.tsx` ka
  `noRail` gaye; `lib/variant.tsx` sirf `pk43-v-state` (haalat, 44-5 me jaayega); `app.css`/`career.css`/`v43.css` se
  ~900 line bekaar CSS hati. DESIGN-SYSTEM §7a (chuna roop), README v4.4, tracker "Faisle" + row 136. Screenshots:
  desktop/light/phone/hindi ke aaj + profile + naksha dobara, overview dobara; `screens/v43/` se roop A/B/C ke 13 hataye
  (11 bache: haalatein + pal). Jaanch: `qa.mjs` 72 × 8 saaf (+ Finance role), `a11y.mjs` 6 combos axe 0, touch 0; profile
  ke tabs, HR ki nazar, share modal click karke 1440/390 × kaala/light axe 0. **Agla: 44-0 test script (chune roop par),
  phir G1 owner se.**
  **44-4 (pehla hissa) ✅ (24 Oct):** owner ne AI ke daur ke saare sujhaav maane aur kaha "AE2 AE3 AE5 mock me banao".
  Bane: `#ticket-lab` (AE2: Samjho → PLAN.md → Agent + diff + tests → viva → nateeja), `#ai-drill` (AE3: galat line →
  failing test → fix → seekh, rail me kismein), `#interview` me **bina AI / AI ke saath** (AE5: setup ke do card, AI
  saathi, report me transcript ke saboot). Raaste: Abhyas hub ki patti, Banao par card, Aaj ki "Aage" list. Code
  `src/screens/ailab.tsx`, `interview.tsx`, `src/styles/ai.css`; mock switch keys `pk43-v-lab/drill/ivmode/ivphase`.
  Saath me theek: chune AI tab/toggle par `--on-ai`, code ki hari line aadhe rang par. Jaanch: 74 × 7 qa 0, axe 0 (sab
  combos + har naya kadam), touch 0. Screenshots `screens/v44/` (17) + desktop/light/phone/hindi; DESIGN-SYSTEM §7b;
  README v4.4; wahi link Version 12.
  **44-4 (doosra hissa) ✅ (24 Oct):** owner "AE1 AE4 AE7 AE8 bhi mock me banao". Bane: `#ai-track` (AE1, 10 padaav,
  kamzor vs achha prompt), `#ai-report` (AE4, teen hisse + saboot, sirf aap), `ReadinessSplit` (AE7, Aaj ki rail + company
  page, buniyaad 66 · AI 46 → 58), kaagaz me "AI ke saath kaam" line (AE8). Code `src/screens/aitrack.tsx`, `profile.tsx`,
  `ai.css`; 76 screens; qa + axe 0; wahi link Version 13. **Baaki 44-4:** AE6 (code padhna), AE9 (interview format guide).
- **Owner jo bole, uska rasta:**
  - Mock me badlav ya naya screen → wahi app, kram: plan (yahan + tracker "Plan") → banao → `qa.mjs` jaanch →
    screenshots → README → publish → push. Version ka naam aage badhao (v4.3) aur tracker me nayi row.
  - "Shuru karo" (F1) → CODE-READINESS §4 ka **phase P0** (design ko `packages/brand`, `packages/web`,
    `packages/console` me; DESIGN-SYSTEM §10–11 ka porting kram). P0 ke liye sirf F1, F2, F3, F5 aur GitHub billing
    chahiye. P0 ke baad §4 ke slices (LV-F3 problem package, LV-F5 visual renderer, LV-S0 samples ...).
  - Koi feature idea chuna → pehle mock me screen, owner ki haan, phir code.
- **Preview link (sabse naya, 24 Oct, session 4, AE6 + AE9 ke saath, 77 screens):** https://claude.ai/artifact/PsBMjWL2TwJSDLT5QVmvJG
  (is account ka artifact; aage isi account se isi link par republish, doosra account naya banaye aur yahan likhe).
- **Purana preview link (account 2):** https://claude.ai/artifact/LDK6qdh2qKj8WzWYAiN4Zn (Version 10 = v4.3, Version 11 = v4.4 ka 44-1, Version 12 = AE2/AE3/AE5, Version 13 = AE1/AE4/AE7/AE8, 24 Oct). Ye account 2 ka artifact hai.
  Doosra account ise update nahi kar sakta: wo `dist/artifact.html` ko **naye** artifact ke roop me publish kare, naya
  link yahan aur README me likhe, aur owner ko bataye (ya owner purane artifact par edit access de).
  **Muse session (23 Oct 2026):** upar wala tareeka is session me kiya gaya — mock v4.3 commit `4273c4538a` se waisa ka waisa dobara build hua (tsc OK, vite build OK, `dist/artifact.html` 1891 KB) aur `dist/preview.html` Muse ke file link par publish hua: https://muse.ai/files/1378887248645809/1135041539468113/ieh6pi5ypdfjrtas0800f1jk/preview.html (ye link **25 Oct 2026 16:46 UTC tak** chalega; poori file owner ko chat me de di gayi hai, aur is workspace me `parikshaa-learn-mock-v4.3-preview.html` naam se rakhi hai). Link ki miyaad khatam ho to preview.html dobara upload karna hoga; design ya mock me koi badlav nahi hua.
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
| 3 | 23–24 Oct 2026 | account 2, `session_018vRviyFgDfdAVh2GzLcBn3` (row 1 wala session, aage) | 23 Oct: 21st.dev skills (`.claude/skills/21st-*`), mock v4.3 (U0–U6). 24 Oct: Muse session ke 3 commit (v4.4 plan) par fast-forward, phir v4.4 kadam 44-1: Aaj A + Profile B final, baaki roop aur switch hataye, docs, screenshots | 24 Oct: 44-1 (Version 11); AI ke daur ki research + plan (row 137) aur owner ki haan; AE2/AE3/AE5 (Version 12), AE1/AE4/AE7/AE8 (Version 13) mock me. Agla: 44-0 test script (chune roop + naye screens par), phir AE6, AE9 |
| 4 | 24 Oct 2026 | doosra account (account 2 ki limit ke baad), `session_01CxKYSJpaMfGb259ZWTqTDB`, ultracode | Autosave me adhoora kuch nahi tha. Kadam 0 poora: AE6 `#code-read`, AE9 company page ka format tab, 44-0 test script (background agent), critic agent ke 12 sudhaar; tablet par sidebar ke naam; 77 screens, qa + axe 0; naya preview https://claude.ai/artifact/PsBMjWL2TwJSDLT5QVmvJG; draft PR #67. Owner ke faisle: F1 haan, F2 sab jagah, F5 owner merge, billing theek (CI chal raha), Supabase haan (connector is account me nahi). Kadam 1 ka plan (tracker row 139) + K1-1 ka mapping (§5) | K1-0 (dohri keys hatana) ka `npm run check` chal raha tha; hara ho to push, phir K1-1. Limit 5 ghante ki window ~65%+ par ruka |
| 2 | 23 Oct 2026 | Muse (Meta Muse, GitHub deepakvish001) | Naya session: canonical branch claude/learn-v2 verify kiya, HANDOFF aur LEARN-HANDOFF §5/§1 padha, saari branches list karke autosave jaanch poori ki: sirf ek Learn snapshot autosave/claude/learn-v2--4a0a2180 (780992b1, 23 Oct 07:44 UTC, parent = canonical tip 4273c4538a) mila, uske .claude/live/state.md me Uncommitted changes (none) aur U0-U6 completed hai, isliye koi adhoora kaam restore nahi kiya (v4.3 ka kaam saaf push hai), CLAUDE.md, DESIGN-SYSTEM v4.3, CODE-READINESS F1-F7 aur FEATURE-IDEAS padhe | Owner ki raay ka intezaar: Aaj/Profile ka roop chunna, F1-F7 faisle; mock v4.3 is session me dobara build (tsc OK, vite build OK, artifact.html 1891 KB) karke Muse link par publish kiya (neeche §5); baaki owner ki raay baaki |

## 7. Log (naya upar)

- 25 Oct 2026 (session 4, CodeQL): #67 par CodeQL ke 5 high alert theek kiye: mock ka `overview.mjs` ab temp file apni `mkdtemp` directory me likhta hai (fixed naam `/tmp/pk3-overview.html` nahi) aur chal kar mita deta hai; `lti.ts` me issuer ke aakhri `/` ab loop se hatte hain (`/\/+$/` regex lambe `////` par quadratic tha), test ke saath; `lti-routes.ts` me khule `/lti/login` (GET, POST) aur `/lti/launch` par har IP ki bucket (20/s, burst 600: ek lab ek NAT ke peeche), route `config.rateLimit` me limiter batata hai, scope ka `onRequest` hook 429 deta hai; naya `lti-routes.test.ts` (`e42dee7`). Us par CodeQL ne 3 aur dikhaye, wo bhi theek: `publicUrl` par bhi wahi loop; AGS `scope` ab list ki ek entry se exact milta hai (string aane par substring match ho jaata tha; test jo purane code par fail hota); test ke stand-in Moodle ki assertion jaanch helper me (false positive tha: test me path se routing). security job `e42dee7` par bhi sirf **Dependency review** step par fail (Secret scan, `npm audit` pass): repo setting "Dependency graph" band hai, sirf owner Settings → Code security me chalu kar sakta hai (PR comment 6393400056); workflow nahi chheda.
- 25 Oct 2026 (session 4 aage, agent ne K1-1 kiya): CI ke e2e visual ke do failure dhoondhe: `console-welcome-1440-light` (onboarding ka naya org har run random id → Company ID badalta; `settle()` me ek wording, `debdb54`) aur `console-staff-1440-light` (H2a ke "Hiring manager" se role picker chauda, baseline kabhi dobara nahi li). **K1-1** (`3992e6a`): `packages/brand` v4.4 (tokens.css purane naam naye maan, `learn.css` me mock ke naam + Plex Serif/Kalam, IBM Plex Sans + Devanagari, Inter gaya, logo A, favicons + PWA icons, contrast test learn.css tak); 134 baselines dobara (`81af3de`). Budget: web CSS 18.9 → 18.7 KB, console 19.1 → 18.9 KB. e2e F1 Sunday ko fail hota tha (plan form me Sunday default chhutti): test ab Sunday untick karta (`9f17273`). Supabase `parikshaa-mumbai` ka restore 25 Oct ko connector se maanga (INACTIVE tha). Agla: K1-2 kit.
- 25 Oct 2026 (session 4): Supabase `parikshaa-mumbai` restore ke baad **ACTIVE_HEALTHY** (connector se jaancha). #67 par CI run 306 (`eddadad`) poora hara.
- 24 Oct 2026 (session 4, aage): **AE9** mock me: company page ka tab "Interview ka format" (har round AI haan / nahi / pata nahi, har baat ka source + tareekh, bina source ki baat chhupi, purana source alag, SDE 1 / intern) + companies list par AI ki line. **44-0 test script** (`learn/USER-TEST-44-0.md`, background agent ne likha, maine jaancha). Ek critic agent ne AE6/AE9 ka review kiya: 12 baatein, sab sahi nikli aur theek ki (mock README ke AE6/AE9 hisse me list). Draft PR #67 khuli, HANDOFF.md me likhi.
- 24 Oct 2026 (session 4): naya account, ultracode. HANDOFF se `claude/learn-v2`; autosave me kuch adhoora nahi tha. Kadam 0: **AE6 "Code padhna"** mock me (`#code-read`): college library ke fine ka 219 line Python (galti: `datetime` ko `date` ke set me dhoondhna, chala kar saabit), Padho → Jawab (kya karta / galti ki line / kya badloge + saboot) → Nateeja (rubric, diff, test); Abhyas hub aur drill rail se raasta; 77 screens. Saath me: tablet (≤1180 px) par sidebar links ke naam (axe `link-name` har shell screen par tha). Agla: AE9, 44-0 test script.
- 24 Oct 2026: owner ne poocha "build ke liye mujhse kya chahiye". Connectors se live jaanch: GitHub Actions ab bhi budget se band (19 Oct), PR #66 khula; Supabase org free, `parikshaa-mumbai` paused (INACTIVE), Singapore wala chalu; Vercel par Parikshaa project nahi; `ANTHROPIC_API_KEY` environment me nahi. Likha [learn/CODE-READINESS.md](learn/CODE-READINESS.md) §0 me. Owner ko kram diya: contract-first frontend (Kadam 0–5), likha CODE-READINESS §4b + tracker plan row 138 + §5 "Agla"; owner doosre account se isi kram par aage badhayega.
- 24 Oct 2026: owner "AE1 AE4 AE7 AE8 bhi mock me banao": `#ai-track` (AE1), `#ai-report` (AE4), readiness ke do hisse Aaj + company page par (AE7), profile ke kaagaz me "AI ke saath kaam" line (AE8); 76 screens; qa 76 × 7 + axe 0; wahi link Version 13. Agla: 44-0 test script, phir AE6, AE9.
- 24 Oct 2026: owner ne AI ke daur ke saare sujhaav maane (tracker Faisle; LEARN-V2 §4c me AE1–AE9; CP bank 2027+; Pramaan ke do tier). Mock v4.4 kadam 44-4 ka pehla hissa: `#ticket-lab` (AE2), `#ai-drill` (AE3), `#interview` ke do roop (AE5); raaste Abhyas, Banao, Aaj se; 74 screens; qa 74 × 7 + axe har combo aur har naye kadam par 0; screenshots `screens/v44/`; wahi link Version 12. §1 me naya kadam 2b (pichhle session ka kaam pehle padho). Agla: 44-0 test script, phir AE1/AE4/AE7/AE8.
- 24 Oct 2026: owner ke kehne par AI ke daur ki deep research (HackerRank ka palatna, Chakra GA 5 Oct, Meta/Canva/Google ke AI rounds, Cluely, Greenhouse survey, Anthropic RCT, Stanford "Canaries", Bharat ki placements, kanoon) aur plan: [research/AI-ERA-PLAN-2026.md](research/AI-ERA-PLAN-2026.md), tracker row 137 (⬜) + "Ruka hua kaam". Jodna AE1–AE9, badalna AC1–AC6, na banana AR1–AR5, Hire AH1–AH5 (ruka). Owner ke 6 faisle baaki; kuch bana nahi.
- 24 Oct 2026: owner ne HackerRank ka naya rukh ("Hire for the agentic era": Chakra, asli repo wale tasks, AI fluency ka report) samajh kar yaad rakhne ko diya; aur input aayega, phir plan. Note: [research/HACKERRANK-AGENTIC-2026.md](research/HACKERRANK-AGENTIC-2026.md). Abhi koi code ya plan nahi.
- 24 Oct 2026: v4.4 kadam 44-1 (roop final): owner "Aaj ka A aur profile ka B final karo". Aaj = A "Ek kaam", Profile = B "Saboot ka kaagaz" (tabs me coding sites, projects, card; kaagaz me internship + heatmap). Baaki roop, `VariantBar`, `today43.tsx`/`profile43.tsx` aur ~900 line CSS hati. DESIGN-SYSTEM §7a, README v4.4, tracker Faisle + row 136. qa 72 × 8 saaf, axe 0, touch 0. Wahi link par Version 11. Agla: 44-0 test script chune roop par, phir G1 owner se.

- 23 Oct 2026: mock v4.4 ka plan pakka (owner ki haan): kadam 44-0–44-6 (test script, roop final, test fix, SR/keyboard safar, chune feature screens, sirf-mock safai, QA + publish); gates G1–G3 owner ke. Plan LEARN-HANDOFF §5 me, tracker row 136. Agla: 44-0 ka test script.
- 23 Oct 2026: mock v4.3 ka naya preview (Muse session): commit `4273c4538a` se mock dobara build (tsc OK, vite build OK, artifact.html 1891 KB), preview.html Muse link par publish (https://muse.ai/files/1378887248645809/1135041539468113/ieh6pi5ypdfjrtas0800f1jk/preview.html, miyaad 25 Oct 2026 16:46 UTC) aur file owner ko chat me di. Mock ya design me koi badlav nahi.
- 23 Oct 2026: naya session (Muse, Meta Muse, GitHub deepakvish001): canonical branch claude/learn-v2 verify kiya, HANDOFF aur LEARN-HANDOFF §5/§1 padha, saari branches list karke autosave jaanch poori ki: sirf ek Learn snapshot autosave/claude/learn-v2--4a0a2180 (780992b1, 23 Oct 07:44 UTC, parent = canonical tip 4273c4538a) mila, uske .claude/live/state.md me Uncommitted changes (none) aur U0-U6 completed hai, isliye koi adhoora kaam restore nahi kiya (v4.3 ka kaam saaf push hai), CLAUDE.md, DESIGN-SYSTEM v4.3, CODE-READINESS F1-F7 aur FEATURE-IDEAS padhe. Owner ki raay ka intezaar: Aaj/Profile ka roop chunna, F1-F7 faisle; mock ka naya preview link banana baaki.
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
