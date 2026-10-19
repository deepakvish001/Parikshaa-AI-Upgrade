# Live state at the last autosave (the time is in the autosave commit)

- Branch: `claude/festive-maxwell-pb4k5v`, on top of `d4cf21a30e9ec2811c8ad5ceb7692f3afaaffa47`
- Session: `4a0a2180-fa87-5d4f-8eca-faf6e973aa67`

## Uncommitted changes

```
A	docs/LEARN-HANDOFF.md
A	docs/LEARN-V2.md
```

## Task list (this session)

- [completed] §1 Staff password reset, TOTP 2FA, OIDC sign-in
- [completed] §11 CI secret + dependency scanning
- [completed] §15 Learner email verification, Google sign-in, practice plagiarism
- [completed] §7 Lever, Zoho Recruit, Darwinbox connectors + LTI 1.3
- [completed] §12 Credit notes/refunds, TDS, e-invoice payload
- [completed] §9 More interface languages; §0 cost-run script
- [completed] Candidate exam: CBT layout (one question at a time, NTA palette, Save & Next footer, submit summary)
- [completed] Update web unit tests and e2e specs for the new exam flow
- [completed] Console polish: exams overview (HackerRank-for-Work style) and shared visual refinements
- [completed] Run e2e with Postgres, regenerate screenshots, commit and push
- [completed] P1.1 Instructions + system check before the clock starts
- [completed] P1.2 In-test tools: shortcuts, calculator, scratchpad, text size, theme, save status
- [completed] P1.3 Time warnings, time-up screen, phone sheet + swipe
- [completed] P1.4 Tests, i18n, screenshots, docs, commit & push
- [completed] Phase 2: submitted screen + PDF, question paper view, coding rail + auto full screen
- [completed] P3.1 Cut-off policy (core+API+console editor) and Qualified/Failed in results
- [completed] P3.2 Exam page tabs + counts sidebar, question list editor with library drawer & reorder
- [completed] P3.3 Try test preview, scorecard (sections, time per question, percentile), Ctrl+K search
- [completed] P3.4 Tests, screenshots, DESIGN.md, commit & push
- [completed] P4.1 Dashboard home: upcoming calendar, recent activity, setup checklist
- [completed] P4.2 Shared UI kit (toast, drawer, dialog, tabs, tooltip) + design gallery
- [completed] P4.3 Visual regression in CI; P4.4 bundle budget, Lighthouse, Firefox/WebKit
- [completed] P4.5 Tests, screenshots, docs, commit & push
- [completed] A1 Tokens v2 (solid/on-solid, text-secondary, disabled, review, info, accent-text, charts, chrome) + single dark palette
- [completed] A2 Fonts: 8 Noto scripts, Devanagari 500/700, JetBrains Mono; :lang rules
- [completed] A3 Replace literal colours/sizes in web+console CSS; type roles; icon stroke; focus outline; disabled; skeleton
- [completed] A4 Stylelint in CI; console dark toggle; axe in dark; tests, baselines, screenshots, docs, commit
- [completed] B1 Gate: stepper, access code field, notice→camera→instructions order, not-open-yet countdown, copy fixes
- [completed] B2 Exam on a computer: Display menu, timer pill, card header chips, 56px options, sticky footer, legend fold
- [completed] B3 Exam on a phone: 52px bar, tools sheet, 64px footer with ⋯, 6-col palette sheet
- [completed] B4 Tools window, calculator, submit summary table, time up, receipt, offline copy, coding verdict
- [completed] B5 i18n all 11 languages, tests, visual baselines (1440/390 × light/dark × en/hi/ta), screenshots, docs, commit & push
- [completed] C1 Console kit: page header, figure strip, ⋯ menu, badges, empty/skeleton/banner, drop zone, stat bar, glossary words
- [completed] C2 Exams (K3), Home (K2), Exam overview (K4), Questions (K5)
- [completed] C3 Live stat bar (K8), Results (K9), Scorecard print (K10), Review (K11), Proctoring lightbox (K12)
- [completed] C4 Editor (K6), Candidates (K7), Bank (K13)
- [completed] C5 Settings template (K14), Sign-in (K1), Search/toasts/empty/loading (K15)
- [completed] C6 Tests, console visual baselines, a11y both themes, screenshots, docs, commit & push
- [completed] M0 Merge main (Prep feature) into branch, resolve conflicts, renumber migration, all green
- [completed] D Practice: one width for bar and page, shared workspace with exam, tokens for scoreboard/heatmap
- [completed] E Words and last pass: glossary everywhere incl exports, events/audit in words, keyboard+SR pass, DESIGN.md, screenshots
- [completed] F1 Prep screenshot flow: seed tracks, lessons, plan, POTD, companies, experiences, store, Plus; capture every page at 1440 and 390
- [completed] F2 Learner Prep pages on the design system: headers, words, empty/loading, phone layout, dark
- [completed] F3 Console Prep/Community admin on the kit (settings template, row menus, empty/loading)
- [completed] F4 Visual baselines, axe both themes, e2e, screenshots, DESIGN.md, commit & push
- [completed] G1 API: self-serve institution signup + sample exam (load/remove) + dashboard state
- [completed] G2 Console: signup page, welcome card, guided tour
- [completed] G3 e2e onboarding spec, visual baselines, screenshots, docs, commit & push
- [completed] H1 Owner email verification at sign-up
- [completed] H2 Operator alert on new sign-up; low-credit warning
- [completed] H3 Tests, e2e, visuals, screenshots, docs, commit & push
- [completed] R1 Candidate reminders: day-before + hour-before, honest email, Candidates tab delivery
- [completed] R2 npm run pilot-report: per-organisation pilot status
- [completed] S1 Rescheduling reaches candidates: moved invitations, fresh reminders, a new-time message
- [completed] S2 College guide in Hindi
- [completed] T1 Smoke test: npm run smoke against a live server
- [completed] T2 Daily pilot report by email
- [completed] T3 Candidate feedback after submitting
- [completed] U1 One-command server setup (scripts/setup-server.sh)
- [completed] U2 Release results to candidates by email
- [completed] W1 WhatsApp channel for invites, reminders, new time and results
- [completed] L1 Lab mode: allowed networks and start-together
- [completed] 6 Re-evaluation requests
- [completed] 7 Scorecard / certificate PDF with verify QR
- [completed] 8 Bulk grading queue
- [completed] 9 Placement dashboard across exams
- [completed] 10 Question quality report
- [completed] 11 Razorpay self-serve credit purchase check and polish
- [completed] 12 ATS connectors: test-connection check
- [completed] SM: student master (migration, store, CSV import, routes, console)
- [completed] DR: drive manager (drives, eligibility, applications, stages, send test)
- [completed] JD: JD to test draft + role library
- [completed] Finish: tests, openapi, budget, visuals, screenshots, tracker, commit, PR update
- [completed] T3 Admit card + seat allocation (+ attendance)
- [completed] T4 Hiring manager shortlist link
- [completed] T5 PO/NEFT payment (quotation, record payment)
- [completed] T6 Readiness heatmap
- [completed] T7 Open link apply
- [completed] T8 NIRF/NAAC + CO-PO reports
- [completed] T9 Multi-lab dashboard + invigilator phone
- [completed] T10 Spoken answers
- [completed] T11 Interview room
- [completed] T12 Handwritten checking
- [completed] X1 Second examiner (moderation)
- [completed] X2 Console in Hindi
- [completed] X3 Multi-college drive
- [completed] X4 Offer tracking (company side)
- [completed] X5 Proxy detection
- [completed] X6 DPA and SLA for enterprise
- [completed] Wrap-up: tracker, e2e/visual, PR 34 body
- [completed] N1 T1 seal new data + retention
- [completed] N2 CL63 handwritten marks into results/CO
- [completed] N3 CO42 offer by email/WhatsApp + N4 CL67 drive alerts
- [completed] N5 CO38 funnel + N12 CO39 candidate status page
- [completed] N6 CL26 demo test
- [completed] N7 CL60 paper review and lock
- [completed] N8 CL4 staff CSV + CL6 departments
- [completed] N9 CO27 calendar invite + CO41 panel
- [completed] N10 CL65 CIA marks + N11 CL62 PwD
- [completed] N13 wrap-up: tracker, e2e, visual, PR
- [completed] Inventory everything built (code, docs, tests)
- [completed] Write docs/MASTER-PLAN.md (students, college, company, UI/UX, platform)
- [completed] Link plan from tracker, commit, PR, merge to main
- [completed] M-F1a Terraform: bootstrap state + pilot VM (AWS Mumbai)
- [completed] M-F1b Terraform: managed stack module + staging/production envs
- [completed] M-F1c Scripts + runbook docs/DEPLOY-AWS.md + validate + tracker + PR
- [completed] F0a Remove handwritten checking, CIA marks, CO-PO/NAAC/NIRF, spoken answers
- [completed] F1a 60 role templates (families, search in console, tests)
- [pending] Legacy import: Singapore Supabase problems → our practice site (tested importer + CLI)
- [completed] F1b Proctoring v2: screen share, second screen, voice signal
- [pending] F1c AI interviewer (chat + code): migration, store, service, routes, web chat, console page, tests
- [completed] G0a Proctor photos in Supabase Storage
- [completed] G0b Vercel output + deploy workflows + VM on Supabase
- [completed] G1 Company ID + operator panel
- [completed] G0/G1 finish: checks, tracker, screenshots, push, PR
- [completed] G2 Parikshaa Library
- [completed] G4a Survey candidate coding flow (CodeAnswer, run routes, attempts)
- [completed] G4a-1 Submission history in attempt (API + web tab)
- [completed] G4a-2 Code playback + big paste signal
- [completed] G4a-3 Author reference run (fill expected outputs)
- [completed] G4a-4 Checks, openapi, budget, visuals, tracker, commit, PR
- [completed] T2a Design ka "fit" critique (W3)
- [in_progress] T3 Build Hire slices with tests (now H1a accounts)
- [pending] T4 Review, e2e, tracker, PR
- [completed] §5 step 0: merge main, renumber migrations (0070+) and tracker rows (110+)
- [completed] H2b-1 Migration 0072 + outbox {later}/defer
- [completed] H2b-2 Store: applications in hire-store
- [completed] H2b-3 Service: hire-apply.ts + hire-messages.ts
- [completed] H2b-4 Routes + wiring + openapi
- [completed] H2b-5 Full check, tracker, handoff, push
- [completed] H2c step 6: full check, openapi, build+budget, docs

## Owner's latest message

Learn pehle karo but mujhe plan pura plan detail chahiye learn ke liye best 5000 question leetcode codeforces level unke editorial like jaisa given hai pdf me same for long detail solutions like tuf but style hamare pdf me jaisa diya gya hai vaisa plus images visual info sab kuch like human made lgna chahiye a2z sab kuch plus 5000 aptitude question, verbal and quant questions and dbms cn os oops lld hld design patterns har programming lang ka sab kuch manth for Cp sql sab kuch content compiler aur sare features ui and admin complete panel with all security proper scalavle design architecture sab kuch build karo plan do mujhe bhi samjho isko launch karte hai test karke  complete ui design sab kuch ke liye proper fast optimize platform sab kuch build contest and all aur ye bhi plan karo ki leetcode and tuf se behtar kya add karenge actual me meaningful helpuful impactful preprarion rahega students ko vo sare features a bhi pura platform complete text based rahega video ke sare secure not downloadable aur screenshot bhi na le paye ye sab drm features build karna hai but video seconda phale me record and edit karke upload hoti jayengi to is tarike se plan karke long detail me batao ?

## Claude's latest messages (newest last)

Research ka data mil gaya (model, GPU, server, video ke daam). Ab apne design system ke tokens dekh kar plan doc likhna shuru karta hoon.

---

Saari jaankari jama ho gayi. Ab poora plan `docs/LEARN-LAUNCH-PLAN.md` me likh raha hoon (video ka feature map, judge, server ka kharch, AI model ke options, brand/UI aur timeline).

---

Video dekh kar poora plan `docs/LEARN-LAUNCH-PLAN.md` me likh diya hai aur push kar diya (commit `d4cf21a`, tracker row 124). Video ki screens dekh paaya, par aapki awaaz nahi sun paaya, kyunki yahan speech model download nahi ho sakta. Agar aapne bolkar koi khaas baat kahi thi, to likh kar bhej dein.

**Video me TUF ke 9 hisse dikhe.** Planly, Curriculum, Resources (brute/better/optimal, video, dry-run tasveerein), TUFY AI, Company prep, Aptitude, Practice/Contest, Workspace aur Profile. Inme se 7 ka engine hamare code me pehle se hai: planner, editorial, Sahayak AI, contests, notes/lists, revision aur Plus. **Kami content aur chamak ki hai.** Aptitude module, CS lessons, LLD, video, company ka asli data, aur dark branded marketing site abhi nahi hain.

**Judge (apna compiler):**
- Ye pehle se bana hai: gVisor runner, Judge0 adapter, aur parity suite jo dono par ek jaisa verdict jaanchta hai.
- Launch ke liye mera sujhav: hamara runner pehla backend, Judge0 doosra. Judge0 1.13 ko purana Linux setting (cgroup v1) aur privileged container chahiye.
- Launch se pehle bacha kaam:
  - queue ko API se bahar nikalna (Postgres)
  - workers ka autoscale; contest pehle se tay hote hain, to 15 minute pehle machines badha dena
  - compile cache aur C++ ka precompiled header
  - staging par asli load test
- **Kharch:** ek submission ~₹0.005–0.01. Machines (AWS Mumbai `c7i.xlarge`, ~$0.18/ghanta): 2,000 roz ke learners par ~₹11–22k/mahina, 1 lakh par ~₹85k–1.9 lakh. Ek 2,000 logon ka contest ~$2 ka.

**Mahine ka poora kharch** (AI ke saath, video YouTube par):

| Roz ke learners | Kharch/mahina | Ek learner par |
|---|---|---|
| 2,000 | ₹31–60k | ₹15–30 |
| 20,000 | ₹1.5–2.5 lakh | ₹8–13 |
| 1 lakh | ₹6.6–12 lakh | ₹7–12 |

**Apna open-source model: abhi mat chalaiye.**
- Claude Haiku 5.5 par ek hint ~₹0.03–0.04 ka padta hai.
- Apna 27B model (Qwen3.8-27B, Apache licence) L40S GPU par 1 crore requests/mahina tak bhi ~$4–6k ka padega. Haiku par wahi ~$3.5–5k ka, aur quality ka jok …

---

Pehle dekh leta hoon ki aapne editorial style wali PDF upload ki hai ya nahi.

---

