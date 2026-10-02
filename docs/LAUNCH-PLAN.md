# Launch plan: sab kuch bana kar, test karke, live (v1, 2 Oct 2026)

Owner ka kram (2 Oct 2026):

> "Pehle saare section build kar do. Students ka LeetCode wala hissa last me karenge. Uske baad sabka rehearsal, phir `ANTHROPIC_API_KEY` dunga uska test, phir final fix, deploy, test aur final version deploy."

Ye file usi kram ko kaam ke tukdon me todti hai: kaunsa epic ([MASTER-PLAN.md](MASTER-PLAN.md)), kis kram me, "done" kab, aur kis kadam par owner se kya chahiye. Har tukda apna PR, apne tests, aur tracker ki apni row ([PREP-TRACKER.md](PREP-TRACKER.md), Plan rows 76–85).

## Ek nazar me

| Kadam | Kya | Epics | Owner se chahiye | Andaza (PR) |
|---|---|---|---|---|
| **L0** | Platform ki neev | M-F2, M-F3, M-T5, M-T7, M-F8, legal pages ka dhaancha | GitHub me staging deploy ke liye AWS access (OIDC role) — L7 tak chal jaayega | 5–7 |
| **L1** | Exam engine poora | M-T4, M-U5 (code wala hissa), M-F4 ka pehla hissa (5,000 burst), M-T8 | — | 4–6 |
| **L2** | College poora | M-C12, M-C2, M-C3, M-C4, M-C5, M-C7, M-C6, M-C1, M-C10, M-C11 | Ek university ka asli format (marksheet, CIA scheme) dekhne ko | 12–16 |
| **L3** | Company poora | M-B14, M-B12, M-B3, M-B4 (pehle 3 types), M-B9, M-B2, M-B1, M-B6 (code wala hissa) | Prices (self-serve) | 10–14 |
| **L4** | UI/UX poora | M-U1, M-U2, M-U4, M-U6, M-U8 | Naam/brand pakka, logo | 6–8 |
| **L5** | Student (LeetCode wala) **— aakhir me, owner ke kehne par** | M-S1, M-S19, M-S2, M-S3, M-S5, M-S6, M-S8, M-S9, M-S11, M-S15, M-S16, M-S17, M-K1 + content | Content ki haan: kitne problems Claude likhe, kaun review kare | 14–20 + content |
| **L6** | Rehearsal: sab kuch, production jaisa | — | — | 2–4 (jo mile uske fix) |
| **L7** | Asli model ka test | M-A3, M-A1, M-A2, M-A6, Batch F (plan row 70) | **`ANTHROPIC_API_KEY`** aur AI ka budget | 3–5 |
| **L8** | Final fix → staging → production → pilot | M-F1 ka baaki (apply), M-G7 (3 pilot colleges) | AWS account, domain, SES, providers ki keys, 3 pilot colleges | 2–4 |

Kul: lagbhag **60–85 PR**. Har PR `npm run check`, e2e aur visual ke saath; har kadam ke ant me tracker aur screenshots update.

## Kya "poora" maana jaayega

"100%" ka matlab har sapna nahi hai; har hisse ka **launch wala paimaana** ye hai:

| Hissa | Abhi | Launch par | Iske baad (launch ke baad ke phases me) |
|---|---|---|---|
| Exam engine | 80% | 95%: leak-proof paper, 5,000 ek saath ka saboot, exam UX ka audit, leaderboard ki safai | 50,000 burst (M-F4 baaki), certifications (M-T6) |
| College | 65% | 90%: academic exam cell, paper setting v2, checking v2, poora TPO OS, NAAC/NBA suite, multi-campus, console Hindi | ERP sync ke asli connectors (har university alag), student success (M-C8), faculty workspace (M-C9) |
| Company | 50% | 85%: self-serve kharid, 60 role templates, naye question types (frontend, SQL/data, take-home), decision tools, challenges, talent pool | Native video interview room (M-B7), AI pehla round (M-B8), enterprise SCIM/SOC 2 (M-B11), ATS v2 (M-B10) |
| Student | 35% | 80%: ek Parikshaa ID, flagship site, SEO, editor v2, sheets, aptitude, mock OA, discuss, habit loop, skill graph, PWA, **500 problems** | 2,000 problems, videos (M-S7), Sahayak v3, AI mock interview, resume (M-S12–14), govt exams |
| UI/UX | 60% | 90%: design system v3, teeno ka ek shell, console v3, marketing site + help center, performance | Research program chalta rahega (M-U9), accessibility certificate (M-U10) |
| Platform | 45% | 90%: CI/CD + staging, observability + SLO, consent (DPDP), passkeys, cost, **live** | DR multi-region (M-F7), search (M-F5), analytics warehouse (M-F6) |

Imaandari: launch ke baad wale kaam (dahini column) jaan-boojh kar is plan me nahi hain. Woh bade hain (har ek mahino ka), aur asli users ke feedback ke bina banaye to galat banenge.

## L0. Platform ki neev (pehle, kyunki rehearsal aur deploy isi par chalenge)

1. **M-F2 CI/CD:** GitHub Actions se image build + ECR push; `main` par merge → staging apne aap (OIDC role, koi long-lived key nahi); production manual approval ke saath; one-click rollback (`release.sh --tag`). Migration safety: CLAUDE.md me expand/contract ka niyam + CI check jo `DROP`/`RENAME` wali migration ko pakde. Feature flags (Postgres table + console toggle).
   *Done:* staging deploy ek click; rollback < 5 min; flag se ek naya feature band/chalu.
2. **M-F3 Observability:** OpenTelemetry traces (API + runner), CloudWatch dashboard, SLOs (API p95 < 200 ms, judge p95 < 2 s, exam start success ≥ 99.5%, outbox lag < 1 min), status page, incident runbook (CERT-In 6 ghante).
   *Done:* SLO dashboard; ek fire-drill (DB failover) staging par.
3. **M-T5 Consent manager (DPDP):** har purpose ki sahmati, wapas lena, data export, grievance officer page, 18 se kam umar ke liye guardian.
   *Done:* consent ka ledger; export ZIP; tests.
4. **M-T7 Passkeys** staff aur learners ke liye.
5. **M-F8 Cost:** har org ka AI aur infra kharcha console me; budget alarm (pehle se) se juda.
6. **Legal pages ka dhaancha:** privacy, terms, refund, grievance — page aur version history; text vakeel dega.

## L1. Exam engine poora

1. **M-T4 Leak-proof paper:** variants (sawaal aur options ka kram, number badle hue sawaal), har candidate ka invisible watermark, leaked photo se candidate dhoondhne ka tool. *Done:* photo se 30 s me candidate.
2. **M-F4 (pehla hissa):** 5,000 candidates ek saath ka load test (asli Postgres, 2 API process), connection pool aur PgBouncer ka faisla data se. *Done:* report, 0 error, p95 andar.
3. **M-U5 Exam UX audit (code wala hissa):** 2G throttling par poora exam, screen reader (NVDA/VoiceOver flow ke e2e), phone par 360px, PwD suvidha ka end-to-end. Asli 10 candidates ke saath test L6/L8 me.
4. **M-T8 Leaderboard ki safai:** copy/plagiarism wale results alag, appeal ka rasta.

## L2. College poora

Kram (pehle jo pilot me kaam aaye):
1. **M-C12** Batch A/B pending (plan rows 65–66).
2. **M-C2** Students ka data ek baar (CSV/ERP export se, duplicate pakadna, APAAR ka field).
3. **M-C3** Academic exam cell (semester exam: hall plan, invigilator duty, answer-book tracking, result processing, grace marks ke niyam).
4. **M-C4** Paper setting v2 (syllabus/CO se draft, blueprint check, Bloom level, variants).
5. **M-C5** Checking v2 (bulk scan upload, doosra examiner, revaluation workflow, examiner ka hisaab).
6. **M-C7** TPO OS poora (drive se offer tak; Batch D ke bache features).
7. **M-C6** Accreditation suite (NAAC criteria ke reports, NBA CO-PO attainment ka poora set).
8. **M-C1** University aur multi-campus (affiliated colleges, central question bank, roll-up reports).
9. **M-C10** Console poora Hindi + 2 regional bhasha.
10. **M-C11** College pricing (plans, invoice, credits; Batch H ka hissa).

*Done:* har epic ka "done kab" (MASTER-PLAN §6) + e2e: ek semester exam shuru se result tak.

## L3. Company poora

1. **M-B14** Batch C/E pending (plan rows 67, 69).
2. **M-B12** Self-serve kharid (startup khud plan le, Razorpay, GST invoice — pehle se bana billing).
3. **M-B3** Assessment library v2 (60 role templates, 3 difficulty, skills taxonomy).
4. **M-B4** Naye question types, pehle teen: frontend (React/HTML preview ke saath), SQL/data, take-home (repo + review).
5. **M-B9** Decision tools (side-by-side compare, calibration, bias check).
6. **M-B2** Hiring challenges (public challenge → shortlist).
7. **M-B1** Verified talent pool (sirf sahmati wale candidates, Pramaan ke saath).
8. **M-B6** Integrity v2 ka code wala hissa (phone se second camera, collusion graph).

*Done:* har epic ka "done kab" + e2e: startup signup → test → shortlist → offer.

## L4. UI/UX poora

1. **M-U1** Design system v3 ("Parikshaa UI"): tokens v3, components ka ek package, docs site.
2. **M-U2** Teen product, ek shell: Learn / Campus / Hire ka ek header, switcher, ek jaisa navigation.
3. **M-U4** Console v3 (college aur company dono ke naye pages L2/L3 ke saath).
4. **M-U6** Marketing site + help center (har product ka page, pricing, docs, FAQ, Hindi).
5. **M-U8** Performance (LCP < 2 s phone par, har page ka budget CI me pehle se).

*Done:* visual baselines sab pages ke, axe dono theme, Lighthouse floors upar.

## L5. Student: LeetCode wala hissa (aakhir me)

1. **M-S1 Parikshaa ID** (sabse bada: ek account teeno darwazon par; MASTER-PLAN §3) — isi se shuru, kyunki baaki sab ispar khade hain.
2. **M-S19** purane Prep pending (plan rows 44–49).
3. **M-S2** Flagship site, **M-S3** SEO aur public problem pages.
4. **M-S5** Editor v2, **M-S6** sheets/paths, **M-S15** habit loop v2, **M-S16** skill graph, **M-S17** mobile (PWA poora).
5. **M-S8** Aptitude/reasoning/CS, **M-S9** Mock OA simulator, **M-S11** discuss aur solutions.
6. **M-K1** Problem studio + **content**: 500 problems tak (abhi 40). Claude apne likhe problems, asli tests aur editorial ke saath bana sakta hai; har 50 ka batch owner/content team review kare. *Ye sabse lamba hissa hai.*

*Done:* MASTER-PLAN Phase 1 ka gate (500 problems, LCP < 2 s) aur e2e: signup → plan → solve → contest → Pramaan.

## L6. Rehearsal: sab kuch, production jaisa

Is machine par production jaisa setup (asli Postgres, production build, runner, sab workers), aur:
1. Har flow ka end-to-end, teeno darwaze: college semester exam, campus drive, company hiring, student prep + contest.
2. Load: 5,000 exam + 2,000 contest ek saath.
3. Chaos: exam ke beech server/DB kill; har chain verify; har candidate wapas wahin.
4. Data: backup → restore drill, pilot → RDS import, data key rotation ka drill.
5. Security review (permissions, org ke beech data, secrets, logs, rate limits) + dependency audit.
6. `smoke.mjs` aur `pilot-report` production config se.
7. **Readiness report** (`docs/READINESS.md`): kya pass, kya risk, kya fix hua.

## L7. Asli model ka test (owner `ANTHROPIC_API_KEY` dega)

1. **M-A3** Sahayak evals ka paid run (plan 1a), grading, follow-up viva, JD → test, handwritten OCR, proxy photo-check: asli samples par.
2. **M-A1** Model router + caching (kharcha ghatana), **M-A2** eval harness sabke liye, **M-A6** AI governance (kya bheja, kya rakha).
3. Batch F (plan row 70) ke AI wale features.
4. `npm run cost-run`: ek attempt ka asli kharcha → pricing pakka.

*Done:* har AI feature ka eval report + kharcha per attempt.

## L8. Final fix → deploy → pilot

1. L6/L7 me mile har issue ka fix (apne tests ke saath).
2. Owner: AWS account → `docs/DEPLOY-AWS.md` kadam 0–2 (staging). Claude: staging par `release.sh` (L0 ke baad GitHub se), smoke, demo exam.
3. Production apply, data key ki offline copy, `smoke`, restore drill production par.
4. **Pilot:** 3 colleges ka ek-ek asli exam (M-G7), har exam ke baad `pilot-report` aur fix.
5. Final version tag (`v1.0`), release notes, tracker me sab ✅/🟡 sach ke saath.

## Kis kadam par owner se kya (jaldi shuru karein, taaki rukna na pade)

| Kab tak | Kya |
|---|---|
| L0 ke beech | AWS account + admin (MFA); GitHub ke liye OIDC role (runbook dega) |
| L2 se pehle | Ek university/college ka asli semester exam ka format (blank marksheet, CIA scheme, hall plan) |
| L3 se pehle | Company self-serve ki prices |
| L4 se pehle | Naam/brand pakka, logo, domain |
| L5 se pehle | Content ki haan (Claude kitne problems likhe, review kaun kare) |
| L7 | `ANTHROPIC_API_KEY` aur mahine ka AI budget |
| L8 se pehle | SES/SMTP, MSG91 (DLT templates), WhatsApp templates, Razorpay live, VAPID, bank details, legal text (vakeel), 3 pilot colleges |
