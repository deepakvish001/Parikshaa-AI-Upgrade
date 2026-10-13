# Live state at the last autosave (the time is in the autosave commit)

- Branch: `claude/festive-maxwell-pb4k5v`, on top of `12970ab3e3af1abf9e639803501878c2bd8412c2`
- Session: `4a0a2180-fa87-5d4f-8eca-faf6e973aa67`

## Uncommitted changes

```
(none)
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

## Owner's latest message

ultracode
Main is repo ka owner hoon. Is repo ka bada kaam kai Claude sessions aur accounts me chal raha
hai, aur pichhla session (kisi doosre account par) limit ki wajah se ruka hai. Tum wahi se aage
badhao. Jo ho chuka hai use dobara mat banana. Ultracode (workflows) se hi kaam karo.

1. Kaam kis branch par chal raha hai, ye khud pata karo. Default branch par mat maan lena:
git fetch origin '+refs/heads/:refs/remotes/origin/'
git log --all --exclude='refs/remotes/origin/autosave/*' -1 --format='%H %ci' -- docs/HANDOFF.md
git branch -r --contains <commit>
Us commit ki docs/HANDOFF.md padho (git show <commit>:docs/HANDOFF.md). Usme kaam, canonical
branch, PR aur handoff file ka naam likha hai.
2. Main tumhe saaf permission deta hoon ki HANDOFF.md me likhi canonical branch par kaam aur push
karo, chahe is session ne tumhe koi aur branch di ho. Force-push mat karna. Default branch
(main) par push mat karna.
3. Us branch ko checkout karo aur us kaam ki handoff file ka section 1 ("Naya session") kram se
karo:
   * autosave branch se adhoora kaam aur .claude/live/state.md (pichhle session ki task list,
mera aakhri sandesh, uske aakhri sandesh) wapas lao;
   * Sessions table me apni row jodo;
   * Tasks table se apni task list banao;
   * koi workflow adhoora ho to use wahi se dobara chalao;
   * phir agla kadam uthao.
4. Har kadam ke baad commit + push karo, aur handoff update karke push karo. Limit kabhi bhi
khatam ho sakti hai, isliye koi bhi kaam ya faisla sirf apne paas mat rakhna. Har kadam se
pehle apni limit dekho (handoff me tareeka: list_events rate_limit_event). 90% se upar ho to
turant sab save karke mujhe bata do ki doosre account se shuru karun.
5. Repo ke niyam CLAUDE.md me hain. Mujhe Hinglish me chhote updates dete raho.

## Claude's latest messages (newest last)

Docs push ho gaye (`5f6270f`), working tree saaf hai. Poora `npm run check` abhi API ke tests chala raha hai. Nateeja aate hi checklist ka aakhri kadam tick karke push karunga, aur PR #66 ki description me H2b jodunga.

---

Update: poora check pass ho gaya (EXIT 0, API 816 tests) aur push bhi ho gaya. Ab PR #66 ka title aur description H2b ke saath update kar raha hoon.

---

H2b poora ho gaya aur push ho gaya, aur PR #66 ki description me jod diya hai. `npm run check` EXIT 0 aaya, saare packages pass (API me 816 tests).

**H2b me kya bana:**
- **Public job page aur careers page:** koi bhi dekh sakta hai. Draft, hold wali job, ya suspended company ki job "not found" deti hai.
- **Apply se pehle notice (English + Hindi):** isme likha hai ki AI resume padh sakta hai, data Bharat se bahar jaata hai, company kitne din rakhegi, shikayat kise karein, aur "koi paise nahi maangta".
- **Apply par jaanch:**
  - last din 23:59 IST tak
  - unverified company par 100 applications tak
  - ek candidate din me 20 tak
  - ek job par ek insaan ki ek hi chalti application; email me dots ya `+tag` badalne se bhi duplicate pakda jaata hai
  - 18+ ki haami
  - knockout jawab galat ho to application wahin khatam
- **Har application me copy:** candidate ki profile aur resume ki sealed copy rakhi jaati hai.
- **Candidate ka portal:** har kadam par "intezaar / aapki baari / ho gaya / aage nahi" dikhta hai. Score ya note kabhi nahi dikhta. Candidate application withdraw kar sakta hai, company suspended ho tab bhi.
- **Mails:** "applied" aur "withdrawn". Company suspended ho to mail ghante-ghante ruk kar baad me jaati hai, khoti nahi.
- **Faisle:** jo design se thoda alag tay hua, wo HIRE-V2 §10 me B6–B11 ke roop me likha hai.

**Aapse chahiye (tracker ke "Ruka hua kaam" me bhi likha hai):**
1. **GitHub billing:** PR #66 aur `main` dono par CI ka koi job shuru hi nahi hua. GitHub keh raha hai "recent account payments have failed or your spending limit needs to be increased". Settings → Billing & plans me theek karna hoga. Ye baat PR par ek comment me likh di hai.
2. **Parikshaa ka grievance officer:** naam aur email chahiye. Server par `HIRE_GRIEVANCE_NAME` aur `HIRE_GRIEVANCE_EMAIL` lagenge. Iske bina job page aur apply 503 dete hain.
3. **PR [#66](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/66) ka merge:** billing theek hone aur CI hara hone ke baa …

---

Shuru kar raha hoon: pehle dekhta hoon kaam kis branch par chal raha hai aur pichhla session kahan ruka.

---

