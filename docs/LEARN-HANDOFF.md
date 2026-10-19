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

## 5. Abhi chal raha / agla kadam

**AB AGLA:** LV-F3 (problem package format), phir LV-F5 (visual renderer v1), phir LV-S0 (samples,
[learn/EDITORIAL-STYLE.md](learn/EDITORIAL-STYLE.md) ki style me). Bulk content (C-slices) LV-S0 ki manzoori aur API key ke
baad hi. Roadmaps + AI (M-slices) LV-E5 ke baad.

## 6. Sessions (har session shuru me row jode, jaate waqt "kahan ruka" bhare)

| # | Tareekh | Account / session | Kya kiya | Kahan ruka |
|---|---|---|---|---|
| 1 | 19 Oct 2026 | account 2, `session_018vRviyFgDfdAVh2GzLcBn3` | Owner ka faisla "Learn pehle"; LEARN-V2.md, LEARN-LAUNCH-PLAN.md, ye handoff; branch `claude/learn-v2`. Phir owner ki editorial file se style guide (`learn/EDITORIAL-STYLE.md`) aur roadmap.sh jaise features (LEARN-V2 §4b, LV-M1–M8) | Design poora; agla LV-F3 |

## 7. Log (naya upar)

- 19 Oct 2026: Code Studio (browser IDE), guided labs, 13 arenas (JS se HLD tak), ~65 courses ka catalog, articles ka plan, aur "baaki planning" ki list (`learn/CODE-STUDIO.md`, `learn/CONTENT-CATALOG.md`, `learn/OPEN-PLANNING.md`).
- 19 Oct 2026: owner ke problem JSON (SQL + series 25/26/28/29) ka audit aur problem standard v2 (`learn/PROBLEM-STANDARD.md`); Basics track 500.
- 19 Oct 2026: owner ke faisle: kitaab unki apni (text bhi use hoga), Plus chat history jab tak account, fair use 200/din. Reference images se sketch visual style; poora build spec `docs/learn/` (USER-FLOWS, ARCHITECTURE, ADMIN-PANEL, VISUAL-STYLE).
- 19 Oct 2026: owner ki editorial file ("Decode Your Coding Interview") se style guide; roadmap.sh ke features (apne content se; unka licence content ki ijaazat nahi deta).
- 19 Oct 2026: Learn v2 shuru. Design docs aur handoff. Hire ruka (agla H2d kadam 2, [HIRE-HANDOFF.md](HIRE-HANDOFF.md)).
