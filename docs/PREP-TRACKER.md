# Parikshaa Prep — build tracker

**Parikshaa Prep Blueprint** (28 Sep 2026) ka har feature yahan track hota hai: kya ban gaya, kya aadha hai, kya baaki hai, aur aage kya banana hai. Blueprint ka poora plan (design, flows, data model, pricing) yahan hai: <https://claude.ai/artifact/AGkGV3SkmmsszWzL4EVZuh>. Isi ka engineering version [ROADMAP §16](ROADMAP.md#16-prep-a-practice-site-to-prepare-on) me hai. Blueprint ke aage ka bada plan (Pramaan, Parikshaa Score, college aur company ka hissa, dusre exams) [Master plan v2](#master-plan-v2-taiyaari-se-naukri-tak-ek-bharosemand-platform) me hai: abhi prastaav, owner ki haan baaki.

**Hire v2 pehle (owner, 12 Oct 2026):** company ka poora hiring portal, job post se offer tak, pehle banega aur launch hoga; Learn, TPO aur scholarship baad me. Plan rows 110–120, design [HIRE-V2.md](HIRE-V2.md), kahan tak pahuncha [HIRE-HANDOFF.md](HIRE-HANDOFF.md).

**Launch plan v2 (owner, 2 Oct 2026): [LAUNCH-PLAN.md](LAUNCH-PLAN.md)**: sirf tech, teen darwaze (Learn, Hire, Campus). Extra features hatenge; infra Supabase + Vercel + ek VM; kram F0 safai → Hire → Campus → UI/UX → Learn (aakhir me) → rehearsal → asli AI → live. Plan rows 76–83. MASTER-PLAN ke jo epic isme nahi, wo ruke hue hain.

**Poora product plan (students, college, company, UI/UX, platform): [MASTER-PLAN.md](MASTER-PLAN.md)** (v3, 2 Oct 2026). Wahan ~90 epics (`M-S1`, `M-C1`…) phases aur "done kab" ke saath hain. Yahan sirf status rehta hai; koi epic shuru ho to uski row neeche Plan table me banti hai.

Aakhri update: **12 Oct 2026** (Hire v2 shuru: plan rows 110–120, [HIRE-V2.md](HIRE-V2.md), [HIRE-HANDOFF.md](HIRE-HANDOFF.md)) · Prep ka kaam PR [#27](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/27) aur [#30](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/30) me merge hua

## Is file ko kaise update karna hai

Ye file tabhi kaam ki hai jab ye hamesha sach bataye. Isliye:

1. **Build shuru karne se pehle**: neeche [Plan: aage kya banega](#plan-aage-kya-banega) me ek entry jodo. Usme likho kya banega, kyun banega, kaunsa blueprint section hai, aur "done" kab maana jaayega.
2. **Build ke saath, usi PR me**: jis feature par kaam hua uski row ka status badlo, aur "Kahan" column me code ka path likho.
3. **PR banne ke baad**: [Build log](#build-log) me ek line jodo: tareekh, PR, kya bana.
4. Kuch jaan-boojh kar nahi banana ho, to use ❌ karo aur wajah likho. Chupchaap mat hatao.
5. Blueprint se alag faisla ho (jaise base repo), to [Faisle](#faisle-blueprint-section-21) me likho.

Status ka matlab:

| Nishaan | Matlab |
|---|---|
| ✅ | Ban gaya, tests ke saath |
| 🟡 | Aadha: kaam karta hai, lekin blueprint ka kuch hissa baaki hai (note me likha hai kya) |
| ⬜ | Abhi nahi bana |
| ❌ | Nahi banayenge (wajah note me) |

## Ek nazar me

| Hissa | ✅ | 🟡 | ⬜ | ❌ |
|---|---|---|---|---|
| Dashboard aur planner | 15 | 0 | 0 | 0 |
| Learn aur practice | 10 | 0 | 1 | 0 |
| Revision, lists, notes | 7 | 0 | 0 | 0 |
| Sahayak AI | 17 | 1 | 0 | 0 |
| Plus aur payment | 13 | 0 | 0 | 0 |
| Coins, store, gamification | 15 | 0 | 0 | 0 |
| Company prep aur community | 15 | 0 | 0 | 0 |
| Contests | 4 | 1 | 0 | 0 |
| Content | 5 | 3 | 2 | 1 |
| Platform, quality, B2B | 11 | 8 | 0 | 0 |
| **Kul** | **110** | **15** | **3** | **1** |

Ye ginti neeche ki tables se hai. Koi row badle to ye bhi badlo.

**College aur company ([V2-12](#v2-12-college-aur-company-end-to-end-feature-list), 113 features):** ✅ 68 · 🟡 9 · ⬜ 28 · ❌ 8. Baaki 39 ka kram neeche [Plan](#plan-aage-kya-banega) me rows 65–74 (Batch A–J) me hai. Top 12, baad ke 6, aur agle 12 (seal, handwritten marks results me, offer/drive alert, funnel, demo test, paper review, staff CSV + department, calendar + panel, CIA, divyang suvidha, status page) sab code me hain; kaunsa aadha hai, wo row ke note me likha hai.

Seedhi baat: blueprint ka **core loop** (aaj ka plan → kaam → atakne par Sahayak → coins aur streak → company readiness) **chal raha hai**, aur plan 1b–9 ban gaye (PR #35, #37). Aage ka kaam Plan table ki rows 34–41 me hai (contests, payments v2, planner settings, Sahayak v2, profile aur cards, community, learn, PWA). Jo owner par ruka hai wo "Ruka hua kaam" me hai.

---

## Status, blueprint ke hisaab se

### 1. Dashboard aur onboarding (blueprint S1, S2, F1)

| Feature | Status | Kahan | Note |
|---|---|---|---|
| Dashboard: aaj ka plan sabse upar, streak, coins, POTD, due revision, "continue" | ✅ | `web/src/practice/PrepPages.tsx` → `HomePage`; API `GET /practice/:site/home` | Pehli visit par +1 coin check-in |
| Onboarding: track, level, deadline, roz ke minutes, off days, plan preview | ✅ | `PlanSetup`; `POST /practice/:site/plan/preview` | |
| Onboarding: 8 sawaal ka placement quiz | ✅ | `content/placement-quiz.ts`, `GET/POST /placement`, `PlacementPage` | 40 apne likhe sawaal; har baar 3 aasaan, 3 medium, 2 kathin; server jaanchta hai, jawab browser ko nahi jaate, kuch save nahi hota; nateeja level sujhata hai aur plan setup me bhar jaata hai |
| Onboarding: target role aur companies | ✅ | `PlanSetup` → `TargetPicker` aur "The job you are preparing for"; `PUT /companies/:company/target`; `prep_plans.role` (migration 0054), `prep-roles.ts`, `learn-v2.test.ts` | Target companies ke problems plan ke aakhri 30% dino me. Role (SDE, backend, frontend, data): har module me role ke topic wale problems pehle (modules ka kram wahi), aur site ke 8 tak aur problems plan ke beech ke dino me; plan badalne par role rehta hai |
| Weekday aur weekend ke alag minutes | ✅ | `weekendMinutes` (migration 0041), `minutesOn` in `prep-plan.ts`; plan setup aur "Change this plan" | Shanivaar-Ravivaar ke apne minutes; plan banana aur khiskana dono har din ki apni capacity se |

### 2. Planner, "Planly" jaisa (S6, F2, F6, F7)

| Feature | Status | Kahan | Note |
|---|---|---|---|
| Deterministic plan generator, 7 din ke sprints, har sprint ke ant me revision, 20% din khaali | ✅ | `api/src/prep-plan.ts` | Golden tests: `prep-plan.test.ts` |
| Chhoota task apne aap aage, nayi finish date, "on track" | ✅ | `reschedule()`; plan padhte waqt chalta hai | Cron nahi: app kholne par hota hai |
| Time kam pade to 3 raaste (deadline aage, time zyada, chhoti sheet) | ✅ | preview me `dailyMinutesToFit`, `finishOn`, `itemsThatFit`; plan me `upTo` | Teen button: roz itne minute, itni tareekh tak, ya pehle N items ka hi plan |
| Today, Sprints, Completed tabs | ✅ | `PlanView` | |
| Apne custom tasks | ✅ | `POST /plan/tasks` | |
| Study mode / focus timer, hafte ka total | ✅ | `FocusTimer`; `prep_focus` | |
| Plan settings (deadline ya time badalna) | ✅ | `PATCH /plan`, `PrepService.changePlan`, plan page par "Change this plan" | Jo ho gaya wo rehta hai, apne tasks aur quiz ke revise tasks bhi; baaki aaj se naye sprint me dobara bichhta hai |
| Streak freeze ("aaj chhutti") | ✅ | `prep_freezes` (migration 0035), `POST /streak/freeze`, dashboard par "Take today off" | Mahine me 2. Streak na badhta na tootta; aaj ke tasks aage; us din reminder nahi. Coins se aur freeze kharidna nahi |
| Sprint ke revision notes + sprint quiz | ✅ | `prep.ts` `sprintQuiz`/`takeSprintQuiz`/`sprintNotes`, `/sprints/:n/quiz`, `/sprints/:n/notes` | Quiz me sirf MCQ/numeric sawaal (10 tak); code problems quiz me nahi aate. 70% se kam par galat sawaal revise task + aaj due card. Notes page browser se print/PDF |
| Finish date badalne par email | ✅ | `PrepEngage.lateMail`, `prep_plans.late_notified_on` | Jab finish date deadline ke paar khisakti hai: hafte me ek baar, sirf unhe jinhone email reminder chaalu kiya. Khiskaav app kholne par ginta hai (cron nahi) |

### 3. Learn aur practice (S3, S4, F3, F10)

| Feature | Status | Kahan | Note |
|---|---|---|---|
| Tracks (sheets): modules me lessons aur problems | ✅ | `prep_tracks`, console → Practice → Tracks | |
| Lessons: Markdown + video link, "done" | ✅ | `LessonPage` | |
| Har track ke pehle modules free, baaki Plus | ✅ | `PrepService.#locked` | |
| Video hosting, player progress, signed URL, watermark | ⬜ | | Abhi sirf bahar ka link. Host ka faisla baaki |
| Lesson ke andar quiz | ✅ | `prep_lesson_quiz` (migration 0046), `PrepService.takeLessonQuiz`, `POST /practice/:site/lessons/:lesson/quiz`, web `LessonQuiz`, console "Quiz" (Lessons), `learn-v2.test.ts` | Staff 10 tak MCQ/number problems chunte hain; lesson page par jawab ke bina poochhe jaate hain, turant jaanche jaate hain, galat ka sahi jawab aur editorial dikhta hai. Code problem quiz me nahi (turant jaanch nahi hoti) |
| Problem workspace, Run/Submit, drafts device par | ✅ | §15 practice site | |
| Editorial Brute / Better / Optimal tabs | ✅ | `web/src/practice/editorial.ts` | `## Brute force`, `## Better`, `## Optimal` headings se |
| SQL practice | ✅ | runner `sql` language (SQLite); web `SqlTables.tsx`, `sql-view.ts` | Examples me tables (columns, type, pehli rows, SQL alag se); Run/Submit ka output aur expected table ki shakal me. Column ke naam result me nahi aate (grading wahi tab wala text) |
| Problem of the day + calendar, +5 coins | ✅ | `PotdPage`, console → Problem of the day | |
| Online IDE ka share link | ✅ | `prep_code_shares` (migration 0046), `PrepService.shareCode/sharedCode`, `/practice/:site/problems/:problem/share`, `/practice/:site/shares/:id`, web `ShareCode` + `SharedCodePage` | Editor ka code read-only link par; sirf code, koi test nahi. Contest chalte hue us problem ka share band; din me 20. Link par koi bhi padh sakta hai (login nahi). Share hata dene ka button abhi nahi |
| Company, topic aur pattern se problem filter | ✅ | `ProblemListItem.patterns/companies`, `PrepCommunity.problemCompanies`, problems page ke "Pattern" aur "Company" filter, `learn-v2.test.ts` | Company filter wahi dikhata hai jo company page dikhata: Plus ke bina har company ke top 5 (180 din), Plus/Company Pass ke saath sab. Pattern tags se nikalta hai (`patterns.ts`) |

### 4. Revision, lists, notes (S8, F8, F15)

| Feature | Status | Kahan | Note |
|---|---|---|---|
| Spaced revision (SM-2 lite), roz max 15 cards | ✅ | `RevisePage`; `review()` in `prep-plan.ts` | Solve karte hi card banta hai |
| Galat quiz sawaal ya note se bhi card | ✅ | `takeLessonQuiz`, `saveNote` (`prep.ts`), `learn-v2.test.ts` | Lesson quiz ka galat jawab: card aaj due (pehle se card ho to aaj par aa jaata hai). Problem par note: card kal due (ek hi baar). Lesson ke note se card nahi banta, kyunki card sirf problem ka hota hai |
| Lists (bookmarks + apni lists) | ✅ | `SaveMenu`, `ListsPage` | |
| Notes: problem, lesson ya topic par | ✅ | `NoteEditor`, `NotesPage` | |
| Notes ka AI draft | ✅ | `NoteEditor` → "Draft with Sahayak"; `POST /tutor/notes` | Lesson par, ya **solve kiye hue** problem par (learner ke accepted code se). 15 credits. Draft box me aata hai, save learner karta hai |
| Notes ka PDF export | ✅ | `GET /notes/book?track=`, `NoteBookPage` (`/notes/print?track=`) | Ek track ke saare notes module ke kram me, topic notes aakhir me. PDF browser ke "Print → Save as PDF" se; server PDF file nahi banata |
| Account delete par notes hat-te hain | ✅ | `eraseLearner` | |

### 5. Sahayak AI (section 14, F4, F5)

| Feature | Status | Kahan | Note |
|---|---|---|---|
| Hint ladder, 4 rung; poora solution sirf 3 galat submit ke baad | ✅ | `api/src/sahayak.ts` | |
| Code review (aakhri submission) | ✅ | `POST .../tutor/review` | |
| Doubt chat, problem aur lesson par | ✅ | `Tutor.tsx` → `TutorPanel`, `LessonDoubt` | |
| Hindi me jawab | ✅ | `replyIn` | |
| Credits ledger, monthly free credits, credits pack | ✅ | `prep_credits` | |
| Credit pehle kat-ta hai, fail ya refusal par wapas | ✅ | | |
| Contest chalte waqt band, hidden tests kabhi nahi bheje | ✅ | | Tests me pakka kiya |
| Rate limit 30/ghanta | ✅ | `TUTOR_RATE` | |
| Kharcha org ke spend cap me ginta hai | ✅ | `model_usage` route `tutor` | |
| Learner apni baatcheet mita sake | ✅ | `DELETE /tutor` | |
| Pehla hint static (admin ka likha), AI ka kharcha bachane ke liye | ✅ | `practice_problems.hint` (migration 0024), `sahayak.ts`, console Problems → Edit → "First hint" | Hint likha ho to rung 1 wahi: model call nahi, 0 credit. Na likha ho to AI rung 1. Hints ka content (300) abhi likhna baaki, Content table dekho |
| Poora solution dekhne par us problem ke coins aadhe | ✅ | `prep.ts` `afterSubmit`, coin rule `solve_after_solution` | Sirf Sahayak ka rung 4 (worked solution) ginta hai. 3 galat submit ke baad editorial khulna nahi ginta |
| Review ka fixed JSON (logic, complexity, quality, edge cases) | ✅ | `sahayak.ts` `ReviewData`, `reviewMarkdown`; tutor entry `data` (migration 0043) | Model se structured output (JSON schema): verdict, summary, logic (sahi/galat), complexity (time, space, behtar), quality, edge cases. Learner wahi Markdown me padhta hai (Hindi headings bhi), API `data` me JSON deti hai. JSON galat shakl me aaye to credits wapas aur 503. Evals bhi yahi Markdown grade karte hain. Tests: `prep-plus.test.ts`, `sahayak-eval.test.ts` |
| Notes draft mode | ✅ | `Sahayak.notesDraft` (migration 0037: tutor mode `notes`) | Bina solve kiye problem par mana (solution leak na ho). Contest ke dauran band. Plus wala lesson bina Plus ke tutor ko nahi padha jaata (doubt me bhi ye rok ab lagi) |
| Interview follow-up sawaal | ✅ | `Sahayak.followups`, `replyToFollowup`; `POST …/tutor/followups`, `…/followups/:id/reply`; web Sahayak tab | Solve ke baad hi: interviewer ke 2 agle sawaal (15 credit). Har sawaal ka jawab likho, Sahayak interviewer ki tarah bataye: strong / partial / missing, kya chhoota, ek behtar jawab (10 credit). Dusre learner ke sawaal ka jawab nahi de sakte. Awaaz wala mock interview (A8) alag hai, nahi bana. Tests: API, web |
| Chats 180 din baad apne aap delete | ✅ | `PrivacyService.sweepTutor`, `PrepPlusStore.purgeTutor`, `TUTOR_KEEP_DAYS`, retention worker (`main.ts`) | Har ghante wale retention sweep me, har organisation ke 180 din se purane tutor entries mit jaate hain. Learner ko Sahayak tab me ye likha dikhta hai. Tests: `prep-plus.test.ts` (179 din par nahi, 181 par haan) |
| Evals (hint me code leak nahi, review bug pakde, doubt par solution nahi) | 🟡 | `api/src/testing/sahayak-eval/`, `.claude/hillclimb/sahayak-*` | 360 cases (40 problems), grading aur runner tests ke saath ban gaye. **Paid baseline run abhi nahi hua**: API key aur owner ki manzoori chahiye. Scores abhi nahi hain |
| Admin page par AI kharcha aur eval scores | ✅ | console Usage page (kharcha); console Practice → Plus → "Sahayak evals", `GET /practice-admin/tutor/evals`, `content/sahayak-eval-scores.ts`, `testing/sahayak-eval/record-scores.ts` | Har check (leak, bug pakda, complexity, solution nahi diya…) apne target ke saath. Scores eval run ke baad `record-scores.ts` se file me aate hain, haath se kabhi nahi. **Abhi "Not run"**: paid run owner par ruka hai (Ruka hua kaam). Tests: API, console |

### 6. Plus aur payment (section 16, F12, F16)

| Feature | Status | Kahan | Note |
|---|---|---|---|
| Plus on/off per site, free modules, monthly credits | ✅ | console → Practice → Plus | |
| Plans (Plus ke din, ya credits pack), staff set karta hai | ✅ | `prep_products` | |
| Razorpay Checkout + webhook, signature verify, idempotent | ✅ | `api/src/prep-plus.ts` | |
| Plus se lessons, plan, company ki poori list khulti hai | ✅ | | |
| Staff kisi learner ko Plus de (campus licence, scholarship) | ✅ | `POST /practice-admin/learners/:id/plus` | |
| Plan/pricing page | ✅ | `web/src/practice/PlusPages.tsx` | Har plan par GST ka hisaab (base + 18%), coupon field, invoice ki jaankari (naam, state, GSTIN), FAQ |
| Billing page: orders | ✅ | `GET /orders`, `PlusPages.tsx` | Har order ke saath coupon ki chhoot aur invoice ka link |
| Learner ke liye GST invoice (PDF, number series) | ✅ | `prep_invoices` (migration 0033), `gst.ts` `inclusiveInvoice`, `GET /invoices/:number`, `InvoicePage` | Paid hote hi usi transaction me, series `PKP/2627/000001`; state se CGST+SGST ya IGST. PDF browser ke "Print → Save as PDF" se; server PDF file nahi banata. Invoice tabhi banta hai jab server par `PARIKSHAA_SUPPLIER_*` set ho |
| Coupons aur affiliate `?ref=` | ✅ | `prep_coupons`, `POST /plus/quote`, console "Coupons and sales" (`Sales.tsx`) | % ya flat, ek plan ya sab, kitni baar, kab tak, affiliate ka naam; har learner ek baar. `?ref=CODE` link se code apne aap bhar jaata hai. Affiliate ko commission dene ka hisaab nahi, sirf bikri ki report |
| Alag passes (DSA Pass, Company Pass) | ✅ | product kinds `company` (migration 0036) aur `dsa` (migration 0042), `PrepPlus.companyAccess`, `PrepPlus.learnAccess` | **Company Pass** sirf companies ki poori list kholta hai. **DSA Pass** har lesson aur study plan kholta hai, par Plus nahi deta (tutor credits, company list nahi). Invoice par pass ka naam aata hai. Staff ka Plus grant DSA Pass ke baad nahi, aaj se chalta hai. Tests: `prep-plus.test.ts` "sells a DSA Pass" |
| Purane users ko 30 din ka trial | ✅ | `prep_settings.trial_days` (migration 0042), `PrepPlus.startTrial`, `POST /practice/:site/plus/trial`, web `PlusPage`, console Plus settings | Owner trial ke din set kare (0–60); har learner ek baar khud shuru kare, koi paisa nahi, kuch apne-aap renew nahi. Jiske paas Plus hai use nahi milta. Purane users ko bulk me ek saath dena nahi bana: woh khud button dabaate hain. Tests: store, API, web |
| Refund flow | ✅ | `PrepPlusStore.refundOrder`, `prep_credit_notes` (migration 0042), `PrepPlus.refundOrder`, `POST /practice-admin/plus/orders/:id/refund`, console Sales | Staff wajah likh kar poora refund kare: Razorpay refund, us order ka pass band, bache hue credits wapas (jitne kharch nahi hue), invoice ke against GST credit note (`PKC/…`), audit `prep.order_refunded`. Do baar refund = ek baar. Learner ko order par "Refunded" aur credit note dikhta hai. Aadha (partial) refund nahi bana. Tests: store, API, console |
| Campus licence: CSV se bulk Plus, college dashboard | ✅ | `prep_cohorts` (migration 0038), `api/src/prep-campus.ts`, console → Practice → Campus | Cohort (college/batch + Plus ke din); emails ki CSV, pehle dry run; verified account ko turant Plus, baaki ko us email ke verify hone par (link ya Google). Har email ko ek baar. Dashboard: joined, Plus mila, 7 din me active, solved, har student ki line. College ke apne login wala dashboard nahi: staff console hi dikhata hai |

### 7. Coins, store, gamification (section 13.3, S7, F10, F13)

| Feature | Status | Kahan | Note |
|---|---|---|---|
| Coin ledger, idempotent keys, sirf server likhta hai | ✅ | `prep_coins` | |
| Rules: check-in 1, solve 10/15/20, POTD +5, lesson 5 | ✅ | `COINS` in `prep.ts` | |
| Roz ka cap 300, milestones cap se bahar | ✅ | | |
| Milestones: module 100, track 1000, streak 7/30/100/365 | ✅ | | |
| Coin toast | ✅ | `RewardNote` | |
| Coins leaderboard (kamaaye hue coins se) | ✅ | `CoinsPage` | Kharch karne se rank nahi girti |
| Store: items, redeem, orders, 14 din rule, stock | ✅ | `StorePage`; console → Coin store | Aakhri item ek hi baar bikta hai |
| Physical item: address, fulfil/cancel, cancel par refund | ✅ | | |
| Plus ke din coins se | ✅ | | |
| Titles (Newbie → Grandmaster) aur 13 achievements | ✅ | `RatingPage` | Computed, store nahi hote |
| "Mahine me 1" jaisi limit | ✅ | `prep_store_items.per_month` (migration 0042), `PrepCommunityStore.redeem` | Kul limit (`per_learner`) ke saath ab India ke calendar mahine ki limit bhi. Tests: store, API, console |
| Title naam ke saath har jagah | ✅ | `PrepCommunity.people`, `PracticeService.usePeople`, web `Who` (`parts.tsx`) | Rated learner ka title (Newbie → Grandmaster) naam ke saath: contest scoreboard, leaderboard, coin leaderboard, discussion comments aur rating page. Public profile ho to naam us par link hota hai. Experiences me naam nahi (wahan "Anonymous" ka vikalp hai). Tests: API, web |
| Quiz pass par +20, contest rank par coins | ✅ | coin rules `quiz`, `contest_rank`; `CONTEST_RANK_COINS`, `prizeOrder` (`api/src/prep-community.ts`) | Sprint quiz pass par +20 (ek baar). Contest khatam hone par pehle 10 ko 100, 75, 50, 30, 30, 20×5 coins, ek hi baar (rating se pehle diye jaate hain, crash me bhi chhootte nahi). Sirf jisne kuch hal kiya. Tie (same solved, same penalty) me jisne aakhri sawaal pehle hal kiya woh aage, isliye inaam hamesha 10 ko hi. Daily coin cap se bahar. Tests: `prep-community.test.ts` |
| Shareable achievement cards | ✅ | `api/src/achievement-card.ts`, `GET /practice/:site/achievements/:id/card`, rating page par "Share card" | Server par SVG: 9:16 (status/story) aur 1:1, English ya Hindi; sirf kamaayi gayi achievement ka, warna 404. Public profile ho to uska address card par. Phone file share kar sake to wahin se share, warna download. QR code aur Pramaan link nahi (Pramaan bana nahi). Tests: API (escape bhi), web |
| Store me coupons | ✅ | item kind `coupon` (migration 0042), `PrepCommunityStore.redeem`, `prep_coupons.learner_id` | Coins se Plus par N% ka coupon: code `COIN-…`, sirf khareedne wale ke liye, ek baar, 90 din tak; order ke note me code aata hai. Dusra learner use kare to "not valid". Tests: store, API, console |

### 8. Company prep aur community (S5, F9, F14)

| Feature | Status | Kahan | Note |
|---|---|---|---|
| Company page: 30/60/180 din/sab, frequency, "last asked" | ✅ | `CompanyPage` | Reports se ginti, haath se number nahi |
| Topics aur difficulty analysis | ✅ | | |
| Free me top 5, baaki Plus | ✅ | | |
| Staff reports jode (problem + date) | ✅ | console → Companies | |
| Interview experiences: likhna, moderation, publish par 100 coins | ✅ | `ExperiencesPage`; console → Experiences | |
| Experience ke problems company reports ban jaate hain | ✅ | | |
| Helpful votes, ek learner ke max 5 pending | ✅ | | |
| Account delete par write-up bina naam ke | ✅ | | |
| Pattern analysis (sirf topic nahi) | ✅ | `api/src/patterns.ts` (`patternsOf`, `patternCounts`), company page "Patterns" | Author ke tags (kisi bhi tarah likhe: "Sliding Window", "two_pointers", "fenwick tree") 17 patterns me badalte hain (two pointers, sliding window, prefix sums, DP, graphs…). Company page par har pattern: kitne problems aur learner ne kitne solve kiye, yaani kahan kamzor. Alag "pattern" field nahi: tags se hi. Tests: `patterns.test.ts`, API, web |
| "Is company ki list shuru karo" (folder) | ✅ | `POST /companies/:company/start`, `CompanyPage` | Company ke naam ki list me top problems (180 din, 50 tak): Plus/Company Pass ke saath sab, bina 5. Company target bhi ho jaati hai |
| Readiness score (top 50 me kitne solved) | ✅ | `PrepCommunity.#readiness`; company page aur dashboard (`TargetsCard`) | 180 din ke sabse zyada poochhe gaye 50 me se kitne solve. Target companies `prep_targets` me (10 tak) |
| Plan ke aakhri 30% din me target company problems | ✅ | `PrepService.#withCompanies`, `PrepCommunity.targetProblems` | Naya plan banate waqt targets ke 10 tak unsolved problems, har company se baari-baari; bina Plus/Pass sirf free 5 me se |
| Company logos | ✅ | `prep_company_logos` (migration 0045), `PUT /practice-admin/companies/:id/logo`, `GET /practice/:site/companies/:company/logo`, console Companies → Logo | Staff PNG/JPEG/WebP upload kare, 100 KB tak; file ke bytes se jaancha jaata hai (naam/mime se nahi). SVG nahi (script ka khatra). Address me version, isliye browser hamesha cache kar sakta hai. Logos khud nahi bhare: staff upload kare (kisi company ka logo bina ijazat nahi). Tests: store, API, console |
| Experience report/flag karna (learner) | ✅ | `prep_experience_flags` (migration 0045), `POST /practice/:site/experiences/:id/flag`, console Experiences → "Reported write-ups" | Wajah ke saath (fake, rude, galat company, kuch aur); har learner ek baar, apna nahi. 3 flags par write-up "held" (learners ko nahi dikhta) jab tak staff "Keep" ya "Remove" na kare. Audit me faisla. Tests: store, API, web, console |
| Success stories | ✅ | `prep_stories` (migration 0045), `GET/POST /practice/:site/stories`, web `/stories`, console "Success stories" | Learner likhe (company, role, 50–3,000 akshar, naam ya Anonymous); staff padh kar publish kare; ek learner ke 2 tak pending. Coins nahi milte (jhooth ko badhava na mile). Tests: store, API, web, console |

### 9. Contests (F11)

| Feature | Status | Kahan | Note |
|---|---|---|---|
| Weekly contests, ICPC scoreboard | ✅ | §15 | |
| Rating: Elo, contest khatam hone ke baad ek baar | ✅ | `api/src/prep-community.ts` | |
| Contest me Sahayak aur editorial band | ✅ | | |
| Judge ki priority lane, queue, autoscale | 🟡 | `api/src/judge-queue.ts`, `PracticeService`, `GET /practice-admin/judge`, env `JUDGE_CONCURRENCY`, `JUDGE_QUEUE_MAX`, `JUDGE_WAIT_MS` | Queue ban gayi: ek saath utne hi program jitne runner sambhale, chalte contest ke pehle, par har 4 contest ke baad 1 practice (practice kabhi poora nahi rukta). Queue bhari ho ya intezaar lamba ho to 503 `judge_busy` + `Retry-After`, spinner nahi. Contest ka submission us pal ka gina jaata hai jab aaya, judge baad me kare to bhi. **Autoscale nahi**: queue har API process me alag hai, runner machines kitni hon ye deploy ka faisla (Ruka hua kaam). Tests: `judge-queue.test.ts`, `practice.test.ts` |
| Public profile `/u/:username` | ✅ | `prep_profiles` (migration 0044), `GET/PUT /practice/:site/profile`, `GET /practice/:site/u/:username`, web `ProfilePage` | Default **private**: learner username chune aur khud "public" kare. Dikhta hai: naam, bio, title, rating, aakhri 10 contests, easy/medium/hard solve, streak, achievements. Email kabhi nahi. Username har site me alag (unique). SEO wala static page nahi (SPA hai). Tests: API, web |

### 10. Content (section 15)

| Feature | Status | Kahan | Note |
|---|---|---|---|
| Content database me, console se edit | ✅ | tracks, lessons, problems | Deploy ki zaroorat nahi |
| Starter pack: CS fundamentals (80 sawaal, 6 subjects, Parikshaa-New se) | ✅ | `api/src/content/cs-fundamentals.ts` | `scripts/cs-fundamentals-pack.mjs` se dobara banta hai |
| Starter pack: SQL, 8 problems, approaches ke saath | ✅ | `api/src/content/sql-starter.ts` | Reference queries tests me asli runner par chalti hain |
| Starter pack: DSA, 40 problems, hint + approaches ke saath | ✅ | `content/dsa-starter.ts`, `content-dsa.test.ts`, console → Practice → Tracks → Starter packs | Sahayak eval ke apne likhe problems; pattern ke hisaab se 9 modules. Tests: examples + chhote random + edge cases, expected reference program ka; test har baar asli runner par dobara banakar milata hai. **Bade (time-limit) tests nahi** (har problem ~1 MB ho jaata): sirf sahi/galat jaanchte hain |
| Editorial code ka CI quality gate | ✅ | `content.test.ts`, `content-dsa.test.ts`; `editorial-code.ts`, `PracticeService.#checkEditorial`, `editorial-check.test.ts` | Packs ke reference programs CI me asli runner par. Staff ka editorial save karte waqt uska har code block (problem ki bhasha me) saare tests par chalta hai; fail ho to 422. `no-check` wala block (fragment) nahi chalta; runner na ho to jaanch nahi hoti |
| Top 150 problems ke Brute/Better/Optimal editorials | 🟡 | DSA starter pack (`content/dsa-starter.ts`, `DSA_BETTER`) | **40** problems ke Brute force + Optimal (reference Python ke saath); inme se **17** me "Better" tab bhi (jahan sach me beech ka tareeka hai). Baaki 110 ke liye naye problems chahiye |
| 300 static hints | 🟡 | `content/dsa-starter-text.ts` | **40** hints likhe (DSA pack ke har problem ka pehla hint, Sahayak rung 1 free). Baaki 260 ke liye naye problems chahiye. Parikshaa-New ke hints LeetCode slugs par hain, nahi liye |
| 25 companies ka data | ⬜ | | Asli reports chahiye. Parikshaa-New ke company tags hash se bane hain, isliye nahi liye |
| 60 video lessons | ⬜ | | |
| Placement quiz ke 40 sawaal | ✅ | `content/placement-quiz.ts` | Complexity, arrays, hashing, stack/queue, recursion, sorting/searching, trees/graphs, DP, linked lists, integers; har sawaal ke saath "kyun" |
| Parikshaa-New ki baaki sheets | ❌ | | Ye LeetCode ke links hain, yahan chalne wale problems nahi. Apne problems banne par sheet bana sakte hain |

### 11. Platform, quality, B2B (sections 17, 20)

| Feature | Status | Kahan | Note |
|---|---|---|---|
| RLS har naye table par, learner sirf apna data padhe | ✅ | migrations 0019–0021 | Tests `parikshaa_app` role se chalte hain |
| Ledgers (coins, credits) kabhi negative nahi, double event par ek entry | ✅ | | Concurrency tests |
| Payments: webhook replay, galat signature, double webhook | ✅ | `prep-plus.test.ts` | |
| Hindi strings, naye pages ke | ✅ | `prep-text.ts`, `community-text.ts` | |
| Bundle budget, pages lazy-load | ✅ | `bundle-budget.json` | |
| Account delete par sara prep data | ✅ | `eraseLearner`, `prep_erase_study` (migration 0054), `prep.test.ts` | Notes, tutor, votes, address, profile, push ke saath ab plan, tasks, cards, lists, focus, coins, credits, ratings, shares, stories, reports bhi. Orders, invoices, credit notes (GST) rehte hain; college roster me email rehta hai, account se juda nahi |
| Playwright e2e: onboarding → plan, solve, purchase, redeem | ✅ | `e2e/tests/prep-flows.spec.ts`, `e2e/tests/practice.spec.ts` | F1 (signup → plan → dashboard), F3 (Run + Submit code), F12 (Plus kharidna → invoice), F13 (coin store). Is container me Chromium par chale aur pass hue; Firefox/WebKit CI par chalenge |
| Design system par prep pages, screenshots, visual baselines | ✅ | `e2e/visual/prep.visual.ts`, `docs/screenshots/prep-*` | 19 learner + 7 console screenshots, 17 visual baselines |
| Analytics events (signup, task_done, hint_used, purchase…) | ✅ | `prep-engage-store.ts` `analytics`, `GET /practice-admin/analytics`, console Practice → Analytics | Activation (7 din me pehla solve), D1/D7, funnel (signup → plan → solve → tutor → kharid), roz ke active learners, 30 din. Alag events table nahi: maujooda tables se gina jaata hai (Faisle dekho). Page views aur click jaisi cheezein nahi gini jaatin |
| Roz ke reminders (email/push) | ✅ | `prep_reminders` (migration 0034), `prep-engage.ts`, plan page par "Daily reminder", `REMINDER_WORKER` | Email: learner ka chuna ghanta (IST), din me ek, sirf jab kaam baaki ho; ek click se band. Push notification bhi (PWA push wali row), jab learner us browser me chalu kare |
| Contest load test (2,000 ek saath) | ✅ | `e2e/src/contest-load.ts` (`npm run contest-load -w @parikshaa/e2e`), reports `e2e/contest-2000-judge32.txt`, `contest-2000-judge64.txt` | 2,000 contestants + 200 practice, 3 minute, asli Postgres, ek 4-core machine par (server, database aur sab learners ek hi jagah). **0 errors**, har jawab database me, inaam theek 10 ko. Judge 32 (×400 ms): judge hi rukaawat, contest submit p95 22 s, practice 1.3 s, scoreboard 0.6 s. Judge 64: ek API process khud bhar gaya (problem page p95 11 s). Matlab: blueprint ka "contest me verdict < 5 s" ek machine par **nahi** milta; zyada runner workers aur 2+ API processes chahiye. Is test ne 3 kamiyan pakdi aur theek hui: practice bhookha rehta tha (198 × 503), queue me ruka submission contest ke baad gina jaata tha, scoreboard aur rating page bahut mehenge the |
| Runner queue + autoscale | 🟡 | `api/src/judge-queue.ts` | Queue ✅ (upar wali row). Autoscale: AWS par runner machines CPU se khud badhti-ghatti hain (`deploy/aws/modules/stack/compute.tf`, min/max har environment ka apna); asli account par apply baaki |
| Production par chalana (AWS Mumbai, MASTER-PLAN M-F1) | 🟡 | `deploy/aws/`, [DEPLOY-AWS.md](DEPLOY-AWS.md) | Do kadam: pilot machine (setup-server.sh + S3 backup + snapshot + Session Manager) aur managed (RDS, ALB, Auto Scaling, gVisor runners, Secrets Manager, SES, alarms). Terraform `validate` + `test` (13), scripts ke 43 tests, RDS jaisa import CI me. Asli account par apply abhi nahi hua (owner ka account chahiye) |
| Staging: Supabase + Vercel + ek VM (G0, plan 100) | 🟡 | `api/src/storage.ts`, `store/src/blobs.ts`, migration 0066, `api/src/vercel-output.ts`, `api/src/page-headers.ts`, `scripts/setup-server.sh` (`DATABASE_URL`, `APP_DOMAIN`), `deploy/vm/external-db.yml`, `.github/workflows/deploy-web.yml`, `deploy-api.yml`, [STAGING.md](STAGING.md) | Code aur tests poore: proctoring photos Supabase Storage me (sealed, bucket private, erase par bucket se bhi), purane photos ke liye `npm run media-move`; Vercel par web `/` + console `/console/`, `/api` VM tak edge secret ke saath; VM sirf API + runner, Supabase DB ke saath; deploy workflows (migrate → VM → server check); pooler test. Microphone ki Permissions-Policy wali galti bhi theek (awaaz ka signal browser me chalta hi nahi tha). **Baaki:** asli staging tabhi jab owner accounts de ([STAGING.md](STAGING.md) §1); Sentry/uptime; question images aur logos abhi Postgres me |
| Company ID + operator panel (G1, plan 101) | 🟡 | migration 0067, `store/src/identity-store.ts`, `api/src/operator.ts`, `operator-routes.ts`, `console/src/components/Operator.tsx` | Har organisation ka `PKC-XXXXXX` (sidebar me dikhta hai); operator (`PARIKSHAA_OPERATORS` + second factor zaroori) console → Companies se company/college khole (owner ko 7 din ka link), pause/resume (staff sign out, keys band; candidates ke chalu test nahi kat-te), credits de, invite dobara bheje; dono taraf audit. Tests: `operator.test.ts` (7), `Operator.test.tsx` (5). **Baaki:** company profile (logo, default proctoring level, recording retention) aur hiring manager ka sirf-apne-tests scope |
| Parikshaa Library (G2, plan 102) | 🟡 | migration 0068, `store/src/library-store.ts`, `api/src/library.ts`, `library-routes.ts`, `library-content.ts`, `console/src/components/Library.tsx` | Ek global library (kisi org ki nahi), har sawaal ka stable id aur version. Console → **Parikshaa Library**: section (aptitude, CS, programming, DSA, SQL, frontend) aur topic ke counts, difficulty/shabd se filter, preview (jawab + explanation), chune hue sawaal "Add to my bank" (copy, `library:<id>` tag, dobara copy nahi), ya "Pick at random" (jo bank me nahi). Library me naya version aaye to "Newer version" → apni copy update. Operator: built-in sawaal file (API start par khud), ek sawaal file/badle (exam jaisi jaanch, default **hire-only**), retire; kitni organisations ne liya (exposure) sirf operator ko. Abhi **165 sawaal**: 77 CS MCQ, 40 programming concept MCQ, 40 DSA coding, 8 SQL (sab "open": practice packs me bhi hain). Tests: `library-store.test.ts` (5), `library.test.ts` (7, har built-in sawaal exam ki jaanch paas), `Library.test.tsx` (5). **Baaki:** aptitude aur frontend ke sawaal (content team), role sets (SDE-1 OA jaise), purane 1,260 problems ka review queue (row 91), coding sawaal ke variants |
| Judge0 backend (G3, plan 103) | 🟡 | `runner/src/judge0.ts`, `runner/src/backend.ts`, `api/src/parity.ts`, `parity-cli.ts`, `deploy/judge0/`, `.github/workflows/judge0-image.yml` | `RUNNER_BACKEND=judge0` par code Judge0 par chalta hai, maujooda `CodeRunner` ke peeche: har test ek submission, batch (20) me bheja, token se poll (backoff, deadline). Judge0 sirf program chalata hai; sahi/galat, checker, function ka result marker aur har failure ka naam (`time_limit`, `memory_limit`, `runtime_error`, `output_limit`) **hamara** `judge.ts` hi tay karta hai. Bhasha `/languages` me **naam** se (id nahi); SQL Python + hamare SQLite driver se; question ka checker Judge0 me alag Python run. Judge0 na mile, andar fail ho ya der kare to in-house (gVisor) runner par apne aap, 30 s Judge0 ko chhod kar, log ke saath. `deploy/judge0`: hardened `judge0.conf` (network, callbacks, extra files, compiler options sab band; token), apna image (Judge0 1.13.1 + Python 3.12, Node 20, GCC 13, Java 21, checksum ke saath), `setup-judge0.sh` (cgroup v1 GRUB flag, secrets 0600, sirf private IP, har ghante submissions ki safai, `/languages` jaanch). `npm run parity`: 40 DSA + 8 SQL reference, galat programs (wrong, crash, TLE, memory), compile error, har bhasha ka hello: dono runner par same verdict. Tests: `judge0.test.ts` (20, fake Judge0 HTTP server: batch, poll, har status, checker, SQL, down/401/internal error/timeout, fallback, env; SQL program aur checker wrapper asli Python se), `parity.test.ts` (2), `setup-judge0.test.sh` (16, CI me). **Baaki:** image abhi build nahi hua (`PYTHON_SHA256` variable chahiye), Judge0 VM aur staging par asli parity run, 1,000 ka load test (p95 < 5 s), monitoring; Go/Rust/Kotlin/C#/TS G4 ke saath |
| LeetCode jaisa IDE, pehla hissa (G4a, plan 104) | 🟡 | `api/src/service.ts` (`codeSubmissions`, `checkReference`), `proctoring.ts` (`codeTimeline`, `playback`), migration 0069, `store/src/proctor-store.ts`, `core/src/timeline.ts`, `web/src/code-timeline.ts`, `web/src/components/CodeAnswer.tsx`, `console/src/components/Playback.tsx`, `ReferenceRun.tsx` | (1) **Submissions history**: coding workspace me naya "Submissions" tab: is attempt me har sawaal ke saare submit, verdict (accepted / passed x/y, sirf jab exam sab batata hai), bhasha aur samay; purana code dekhna aur ek click se editor me wapas laana. Hidden test ka kuch nahi. (2) **Code playback**: editor ke har badlav ka chhota edit (kahan, kitna hata, kya dala, paste tha ya nahi) har 10 s batch me jaata hai, attempt ki data key se sealed (photos jaisa), attempt band hone ke baad nahi, ek attempt me 4 MB tak, erase par mit jaata hai. Candidate ko editor me likha dikhta hai ki typing record hoti hai. Console → attempt review: "Watch it being written" (play/pause, slider, har paste par jump) aur 200+ characters ke paste par "large paste" sanket (sirf sanket, faisla nahi). (3) **Reference program**: question editor (exam aur bank) me ek sahi program chala kar saare tests (hidden bhi) ka output dekhna aur ek click se expected outputs bharna; function questions me lautaya value. Kuch save nahi hota. Tests: `code.test.ts` (+6, asli runner ke saath), `proctor-store.test.ts` (+2), `timeline.test.ts`, `code-timeline.test.ts` (3), `CodeAnswer.test.tsx` (+3), `Playback.test.tsx` (2), `ReferenceRun.test.tsx` (2). **Baaki (G4b):** test groups (subtask), nayi bhashayein (Go, Kotlin, C#, Rust, TS), editor keymaps (vim/emacs), report/PDF me runtime aur playback link, practice site par bhi history/playback |
| PWA push | ✅ | `push.ts`, `prep_push_subscriptions` (migration 0047), `/practice/:site/push`, `/manifest.webmanifest`, `web/public/sw.js`, plan page par "Also as a notification", `pwa.test.ts`, `sw.test.ts` | Site install hoti hai (manifest, icons); offline me page aur aaj ka plan/dashboard khulta hai (session ke hash par, dusre learner ko nahi dikhta). Reminder push se bhi, sirf browsers ke push services ko (FCM, Mozilla, Apple, Microsoft); 10 browser tak; gone subscription mit jaati hai. **Server par VAPID keys chahiye** (Ruka hua kaam). Abhi nahi: offline me submit queue, lessons/problems ka offline cache, Play Store TWA |

---

## Phases (blueprint section 18)

| Phase | Blueprint me | Status | Kya baaki |
|---|---|---|---|
| P0 · Cleanup aur foundation | Parikshaa-New ke retired model, do plan systems, runner shadow mode | ❌ yahan laagu nahi | Base repo badla (neeche faisle dekho). Parikshaa-New me ye kaam abhi bhi pending hain, agar wahan kaam ho |
| P1 · Plans aur payment | Products, entitlements, Razorpay, pricing, billing | ✅ | Trial, refund + credit note bhi ban gaye (plan 35) |
| P2 · Planner v2 | Onboarding, generator, sprints, reschedule, revision, dashboard | ✅ | |
| P3 · Sahayak AI | Hint, review, doubt, credits, contest lock, evals | 🟡 | Evals ka paid run (180 din delete, fixed JSON review, follow-ups ban gaye) |
| P4 · Coins, store, company v2 | Coins, store, company 30/60/180, titles | ✅ zyaadatar | Contest coins |
| P5 · Lessons aur NoteSpace | Lessons, videos, editorial format, notes, PDF | 🟡 | Video hosting aur videos |
| P6 · Aage | Content, follow-ups, PWA, campus, subscriptions | 🟡 | Campus, interview follow-ups aur PWA (install, offline plan, push) ban gaye. Content aur subscriptions baaki |

## Flows (blueprint section 9)

| Flow | Status | Note |
|---|---|---|
| F1 Sign up → onboarding → pehla plan | ✅ | Placement quiz, target companies, plan preview; e2e bhi |
| F2 Roz ka loop | ✅ | Reminder email ke saath |
| F3 Run aur Submit | ✅ | |
| F4 Sahayak hint ladder | ✅ | Static hint 1 aur coins aadhe ban gaye. Hints ka content likhna baaki |
| F5 Submit ke baad review | ✅ | Fixed JSON format ban gaya (plan 37) |
| F6 Chhoota task reschedule | ✅ | App kholne par; deadline ke paar jaane par email. Cron nahi |
| F7 Sprint notes + quiz | ✅ | MCQ/numeric sawaalon ke saath |
| F8 Spaced revision | ✅ | |
| F9 Company prep | ✅ | Target, readiness, list shuru karo, Company Pass, plan me company problems |
| F10 POTD, streak, coins | ✅ | |
| F11 Contest + rating | ✅ | Rank coins aur judge ki priority lane ban gaye; autoscale baaki |
| F12 Plus kharidna | ✅ | Coupon aur GST invoice ke saath |
| F13 Coins se redeem | ✅ | |
| F14 Interview experience | ✅ | |
| F15 Note se PDF | ✅ | Track ke notes ek printable page par; browser se PDF |
| F16 Campus licence | ✅ | CSV cohort, verify par Plus, console me college dashboard |

## Faisle (blueprint section 21)

| Sawaal | Faisla | Kab |
|---|---|---|
| Learn ka logo | **A "Pass"**: P ka danda hi tick ki lambi line (owner, 21 Oct 2026: "A wala logo final karo"); B aur C hataaye | 21 Oct 2026 |
| Learn ka look (mock v4) | **IBM Plex Sans + Plex Devanagari + JetBrains Mono, kaala default** theek (owner, 20 Oct 2026: "haa bilkul") | 20 Oct 2026 |
| Admin ke roles aur 4-eyes | **8 roles aur doosri manzoori ke niyam** jaise mock v4 me (owner, 20 Oct 2026: "haaaa") | 20 Oct 2026 |
| Plus, campus, Pramaan test ke daam | **Testing ke baad tay** honge (owner, 20 Oct 2026); tab tak `₹[...]` | 20 Oct 2026 |
| Learn ka asli code kab | **Abhi ruko** (owner, 20 Oct 2026: "abhi wait"); pehle mock ka agla refine (row 133) | 20 Oct 2026 |
| Browser IDE ka editor aur preview | **CodeMirror 6** (repo me ✅, phone par chalta, halka), Monaco nahi; React preview **esbuild-wasm** se browser me (WebContainers ka licence nahi chahiye); Python/DS **Pyodide** se browser me; asli grade hamesha server par ([learn/CODE-STUDIO.md](learn/CODE-STUDIO.md)) | 19 Oct 2026 |
| MongoDB wale (MERN) labs | **FerretDB** (Apache-2.0, Postgres par MongoDB jaisa); MongoDB khud chala kar learners ko dena SSPL ka jokhim | 19 Oct 2026 |
| AI se grading | LLD/HLD/explanations me AI **sirf salah** (score ka max 20%), akela pass/fail kabhi nahi; asli grade tests, simulator aur metrics se | 19 Oct 2026 |
| Owner ke purane (series) problems | **Basics track** (L0, 500) banenge, v2 standard par upgrade ke baad: tests 12 se 15+ (min/max/edge/random/anti), validator, C++ reference, galat solutions, mutation score ≥ 95%, 64-bit jahan zaroori, bina source ke company frequency hatai ([learn/PROBLEM-STANDARD.md](learn/PROBLEM-STANDARD.md)) | 19 Oct 2026 |
| Plus me AI chat history kitne din? | **Jab tak account hai** (owner, 19 Oct 2026); free me 180 din ✅ hi. Learner kabhi bhi export/delete kar sake; privacy notice me likhna ([learn/ARCHITECTURE.md](learn/ARCHITECTURE.md) §5) | 19 Oct 2026 |
| "Unlimited" AI ka fair use | **200 message/din poori speed**, uske baad sasta model (owner, 19 Oct 2026) | 19 Oct 2026 |
| Editorial style aur "Decode Your Coding Interview" | Kitaab owner ki apni; uski 4-kadam style sab editorials ka niyam, aur uska text (intro, practice plan, 7 problems) platform par ([learn/EDITORIAL-STYLE.md](learn/EDITORIAL-STYLE.md)) | 19 Oct 2026 |
| Visuals kaise banenge | Owner ke reference images ki sketch style, **code se** (AI image se nahi: number galat, 50k frames me ek jaisa nahi); har DSA problem ka dry-run slider ([learn/VISUAL-STYLE.md](learn/VISUAL-STYLE.md)) | 19 Oct 2026 |
| Learn ya Hire pehle? | **Learn v2 pehle** (owner, 19 Oct 2026: "Learn pehle karo"). Hire v2 H2d kadam 2 par ruka; dono saath sirf do accounts se. Content apna: LeetCode/Codeforces/TUF ka text, tests ya editorial nahi, sirf mushkil ka level. Launch text-only, video + DRM phase 2 ([LEARN-V2.md](LEARN-V2.md)) | 19 Oct 2026 |
| Base repo | **Parikshaa-AI-Upgrade** me banaya (blueprint ne Parikshaa-New kaha tha). Parikshaa-New se content aur ideas liye | 28 Sep 2026 |
| Code judge | Apna runner (is repo ka). Fermion nahi | 28 Sep 2026 |
| "TUF ka clone" (Learn) | Features TUF ke barabar ya behtar, par code aur content apna: TUF ki site ka code reverse engineer nahi, unke articles/videos/A2Z ka kram/chune hue problems copy nahi, scrape nahi; sirf public jaankari se tulna ([LEARN-TUF-GAP.md](LEARN-TUF-GAP.md)) | 18 Oct 2026 |
| Vercel aur API ka jod (G0) | Browser hamesha ek hi domain dekhe: Vercel `/api` ko VM tak proxy karta hai (CORS nahi, purane links waise hi). VM ka Caddy sirf wahi request maanta hai jisme Vercel ka edge secret header ho, isliye `X-Forwarded-For` (jo Vercel khud likhta hai) par bharosa, aur login throttle asli IP par. Seedha VM par 403 | 3 Oct 2026 |
| Proctoring photos kahan (G0) | Supabase Storage, private bucket, attempt ki data key se **sealed** bytes hi: Supabase ya bucket ki key wala bhi photo nahi dekh sakta. Row Postgres me (hash, samay), bytes bucket me. Question images aur logos abhi Postgres me (chhote) | 3 Oct 2026 |
| Library ke sawaal kaise jaate hain (G2) | Library se bank me **copy** (link `library:<id>` ke saath), sawaal ka reference nahi: company apni copy badal sake, aur library ka sudhaar kisi bane exam ko nahi badalta. Naya version aaye to company khud "update" chune. Built-in sawaal API start par file hote hain (stable id, badla to naya version). Pack me 3 CS sawaal do baar the (thode alag shabd): library me pehla hi rakha | 3 Oct 2026 |
| Operator kaun (G1) | Env `PARIKSHAA_OPERATORS` (emails) + second factor zaroori; baaki sabko operator pages 404. Plan me "hamari taraf ka admin" tha; alag login nahi banaya, wahi staff account | 3 Oct 2026 |
| Company pause karna (G1) | Staff sign out aur sign-in band, API keys band; **candidates ke diye link chalte rahte hain** (beech test me kisi ko nahi kaata). Operator ki company khud signup wale se alag: owner ka password koi nahi jaanta, email link (7 din) se set hota hai, isliye email verified maana | 3 Oct 2026 |
| Target role ka asar (plan 46) | Role modules ka kram nahi badalta (pehle wale modules aage walon ki neev hain); sirf har module ke andar role ke problems pehle, aur 8 tak extra problems | 2 Oct 2026 |
| Account delete par coins jaise ledger (plan 47) | App role ko coins/credits/ratings par DELETE nahi diya (ye append-only rehte hain); ek `SECURITY DEFINER` function sirf erase ho chuke account ka data mitata hai | 2 Oct 2026 |
| AI interviewer ka transcript (plan 86) | Blueprint me "ledger me" tha; alag table `ai_interview_turns` me rakha, har turn ka hash pichhle par (ledger jaisi chain), candidate ke shabd sealed. Exam ledger attempt ke liye hai, interview attempt nahi. AI sirf sujhaata hai, faisla aur scorecard insaan ka | 2 Oct 2026 |
| AI-fluency sawaal par AI (plan 87) | AI ka har sawaal-jawab exam ke ledger me (`ai_assisted`, sealed), alag table me nahi: ye attempt ka hissa hai aur candidate ki receipt/verify me aata hai. Spend cap khatam ho to candidate ko mana (503 "carry on without it"), exam nahi rukta aur billing ki baat candidate tak nahi jaati | 2 Oct 2026 |
| Take-home ka grading (plan 88) | Naya question kind nahi, short sawaal par `takeHome`; model kabhi grade nahi karta (link ke peeche ka kaam wo dekh nahi sakta, notes padhkar marks dena galat hota). Grading par 0 aur Marking queue me insaan marks deta hai | 3 Oct 2026 |
| Staff ke editorial ka code (plan 48) | Fail hone par save rukta hai (sirf chetavni nahi). Chhote fragment ke liye `no-check`. Packs import par dobara nahi chalte (unke apne CI tests) | 2 Oct 2026 |
| "Better" tab (plan 49) | Sirf jahan sach me beech ka tareeka hai (17/40); baaki me banaya hua nahi daala | 2 Oct 2026 |
| AI provider | Claude. Model `TUTOR_MODEL` env se badla ja sakta hai | 28 Sep 2026 |
| Naam aur brand | "Parikshaa Prep" kaam chalane ka naam. **Pakka karna baaki** | — |
| Prices | Staff console me khud set karta hai. Blueprint ke numbers (₹3,999/₹6,999…) **pakka karna baaki** | — |
| Videos: kaun, kis bhasha me, hosting kahan | **Baaki** | — |
| Analytics kahan se | Blueprint me alag analytics events the. Ab tak ke numbers **maujooda tables** (signup, submissions, lessons, tasks, tutor, orders, roz ka check-in coin) se gine jaate hain: koi event chhootta nahi aur purana data bhi ginta hai. Page view ya click ginne ho to alag events table chahiye hogi | 1 Oct 2026 |
| Scope: placement prep se aage (college ka TPO OS, company ka talent pool, coaching aur dusre exams) | **Prastaav**, [Master plan v2](#master-plan-v2-taiyaari-se-naukri-tak-ek-bharosemand-platform). Owner ki haan baaki | — |
| Student ke liye core taiyaari, Parikshaa Score aur Pramaan hamesha free; paisa company, college aur coaching se | **Prastaav** (V2-7). Owner ki haan baaki | — |
| Handwritten copy ka doosra examiner | Paper ke kul marks ka **10%** se zyada farq ho to copy "disputed", head examiner (exam:write) final kare; pehla examiner hi moderator nahi ban sakta. Teesra examiner alag se nahi, head examiner hi teesra hai | 1 Oct 2026 |
| Proxy ke sanket | Network address kabhi save nahi hota, sirf keyed hash; lab mode wale exam me "ek network" nahi gina jaata. AI photo-check sirf sanket, faisla insaan | 1 Oct 2026 |
| Interview ka video | Apna video server nahi: recruiter ka apna link (Meet/Zoom/Teams) ya naya Jitsi room. Code editor aur scorecard hamare | 1 Oct 2026 |
| Console Hindi | Pehle navigation, titles aur page ki line; pages ke andar ka text baad me, jab TPO feedback de | 1 Oct 2026 |
| Panel ka scorecard | Har member apna scorecard; interview ka scorecard har criterion ka average, recommendation ka jhukaav (barabar bante to "no", yaani saavdhani); sab score karein tab interview band | 2 Oct 2026 |
| Divyang ka extra time | Paper ke time ka % (niyam 20 min/ghanta = 33%), attempt shuru hote hi ledger me (kisne diya ke naam ke saath); note seal aur audit se bahar, kyunki usme bimari ka naam ho sakta hai | 2 Oct 2026 |
| Internal marks ki rounding | Default "upar" (university aksar adha mark poora ginti hai); scheme save nahi, har baar chuni jaati hai | 2 Oct 2026 |
| Department ka niyam | Owner sab dekhta hai; baaki member ko apne department ke exams aur bina department wale; member sirf apna hi department laga sakta hai | 2 Oct 2026 |
| Migration ke number takraayein to | Do branches ek hi number le lein (jaise #36 aur #37 ne 0033–0038) to **file ka naam nahi badalte**: runner poore naam se, alphabetical kram me chalata hai (0024 pehle se do baar hai), aur naam badalne se deploy hua database wahi migration dobara chalaane lagega. Sirf migration test ki list theek karte hain | 2 Oct 2026 |
| Contest inaam me tie | Blueprint: "top 10 ko coins". ICPC board par tie aam hai (chhote contest me sainkdon). Faisla: tie me jisne aakhri sawaal pehle hal kiya (millisecond tak) woh aage; inaam hamesha 10 ko | 2 Oct 2026 |
| Judge ki queue | Har API process me apni queue; chalte contest ke pehle, par har 4 contest ke baad 1 practice. Exam ke code tests is queue me nahi (woh alag raste se runner jaate hain) | 2 Oct 2026 |
| Sahayak evals ka size | Blueprint me 200 problems the; owner ne **40 problems × 3 galat programs** chune (har flow me 120 cases, kul 360). Problems apne likhe hain, kisi site se copy nahi | 30 Sep 2026 |
| Product ka focus | **Sirf tech, teen darwaze**: Learn (LeetCode/TUF jaisa, free + paid), Hire (AI-proctored hiring), Campus (admission/scholarship test, coding internal test, Classes, TPO). Hataye: handwritten checking, NAAC/NIRF/CO-PO, CIA internal marks, spoken answers; plan se bahar: semester exam cell, multi-campus, ERP, OMR, govt exams, coaching ([LAUNCH-PLAN.md](LAUNCH-PLAN.md) §3) | 2 Oct 2026 |
| Infra | **Supabase (Mumbai) + Vercel + ek VM** (API, workers, gVisor runner), AWS ki poori managed stack ki jagah. Code runner ko VM chahiye (Vercel/Supabase par sandbox nahi chalta). Auth apna hi. `deploy/aws` ka pilot module VM ke kaam aata hai; managed stack ruka hua | 2 Oct 2026 |
| Role library sirf tech (plan 84) | Support/BPO role hataya aur sales template (CO37) nahi banega: Hire sirf tech companies aur tech roles ke liye. 60 roles bank ke sawaalon se bharte hain, model sawaal nahi likhta | 2 Oct 2026 |
| Supabase ka maujooda "Parikshaa" project | Usme likhenge nahi: wo **Singapore (ap-southeast-1)** me hai aur usme ek doosre (pehle wale) app ka data hai. Hamara database **naya project `parikshaa-mumbai` (ap-south-1)**, free plan par (owner ne 2 Oct ko haan kahi). Owner ne kaha purane project ka kaam ka data naye me laao: problems ab importer se aayenge (plan 91), learners baad me (plan 92) | 2 Oct 2026 |
| Purana data kaise aayega | Chat/connector ke zariye data nahi uthaya (4.5 MB, hidden tests aur solutions): ek tested importer (`legacy-import.ts`) seedha DB se DB, GitHub Actions ke "Legacy import" workflow se, pehle dry run. Bina tests wali 482 problems bhi aati hain par unpublished, wajah ke saath. Go/TypeScript starters chhoote: runner unhe nahi chalata | 2 Oct 2026 |
| Purane learners abhi nahi | 28 accounts ke password Supabase Auth me hain, jo bahar nahi aa sakte. Pehle learner ka "password bhool gaye" (email link) banega, phir har learner ko move ki soochna (DPDP) ke saath import (plan 92) | 2 Oct 2026 |
| Supabase ki keys bhi band (0058) | Owner ne 2 Oct ko haan kahi: `service_role` (secret key) se bhi hamari tables ka access hataya, jaise 0056 ne publishable key ke roles se. Hamari app keys use hi nahi karti; key leak ho to bhi koi table nahi khulti | 2 Oct 2026 |
| Mumbai DB me schema | Container se Postgres (5432) tak network nahi, isliye migrations Supabase connector se chalayi, har batch `schema_migrations` me bhi likha; phir local se 114 tables ka fingerprint milaya: sab barabar. 0054/0055 me `DELETE`/`DROP` hai, connector un par owner ki manzoori maangta hai: VM se `npm run migrate` ya owner ki haan | 2 Oct 2026 |
| Launch ka kram | Owner: F0 safai → Hire → Campus → UI/UX → Learn aakhir me → rehearsal → asli AI (`ANTHROPIC_API_KEY`) → live | 2 Oct 2026 |
| Cloud aur go-live ka tarika | **AWS Mumbai (ap-south-1)**, do kadam: pehle ek pilot machine (setup-server.sh), saath-saath Terraform se managed setup; pilot ka data RDS me **usi data key** ke saath (owner ne chuna) | 2 Oct 2026 |
| Machines: EC2 Auto Scaling + Docker, ECS/EKS nahi | Code runner ko gVisor (`runsc`) chahiye, jo Fargate par nahi chalta; wahi do images jo docker-compose chalata hai; chhoti team ke liye Kubernetes bhaari. Machine kharab ho to load balancer ka health check use badal deta hai | 2 Oct 2026 |
| SSH kahin nahi | Pilot aur managed dono me port 22 band; machine par jaana Session Manager se (IAM se, har session ka record). Koi key khone ka dar nahi | 2 Oct 2026 |
| Ek image, sab environments | Image repositories bootstrap me (staging/production dono ki saajhi), tags immutable (git commit). Production me `release.sh --tag` wahi image chalata hai jo staging par test hui; dobara build nahi | 2 Oct 2026 |
| WAF nahi | AWS ke managed rules SQL/script jaisi body rok dete hain, aur candidates ke coding answers bilkul wahi dikhte hain; IP par rate limit poore college lab (ek IP ke peeche 500 log) ko rok deta. API ki apni limits org aur attempt par hain | 2 Oct 2026 |
| M-F1 se alag: PgBouncer, S3 uploads, CDN abhi nahi | MASTER-PLAN M-F1 me teeno the. **PgBouncer:** connections ki seema `api_max × DATABASE_POOL_MAX` (prod 120) RDS ki seema se kaafi kam; paar jaane par alarm, tab jodenge. **Uploads S3:** scans/photos abhi Postgres me, storage khud badhta hai (1 TB tak); S3 ke liye code badlega, M-F1 ka agla tukda. **CDN:** Bharat ke candidates Mumbai se seedha; bundle budget CI me | 2 Oct 2026 |
| Company ke khaali bank me kya | Naya company org ka bank khaali hota hai, to role library ka test kuch nahi kheench pata. Faisla: practice site ke starter packs (CS fundamentals 80 MCQ, DSA 40 coding) ko hi exam bank me ek click me daalna, `starter` tag ke saath; ye "Add questions" waali ginti me nahi gine jaate. Naye sawaal nahi likhe; aptitude ka starter set baad me | 3 Oct 2026 |
| Report link me kya dikhe | Shortlist link sirf marks dikhata hai. Report link (row 90) me code ke sawaalon ka program bhi dikhta hai, kyunki hiring manager code dekh kar hi faisla karta hai; MCQ aur likhit jawab aur contact details nahi. Link kahin store nahi hota (signed, expiry ke saath), isliye beech me wapas nahi liya ja sakta; zyada se zyada 30 din | 3 Oct 2026 |
| Judge0 ke saath kya hamara rahe (G3) | Judge0 sirf chalata hai; output compare, checker, result marker, verdict ke naam hamare `judge.ts` me. Isse dono backend ka matlab ek, parity suite naap sakta hai, aur Judge0 ka `expected_output` compare (jo sirf exact hai) use nahi hota. Har test ek submission, isliye compiled bhasha har test par compile hoti hai: Judge0 ka yahi tarika, parity/load test me mehenga nikla to badlenge | 3 Oct 2026 |
| Judge0 me SQL aur checker Python se | Judge0 CE ka SQLite test ki tables stdin se nahi leta. Isliye SQL ka jawab hamare hi SQLite driver me likh kar Python program bana kar jaata hai; checker bhi Python wrapper se (teen files likh kar). Dono asli Python par test hue | 3 Oct 2026 |
| Judge0 ka `ALLOW_IP` nahi | Wo setup script ki apni `/languages` jaanch bhi rok deta. Rok teen jagah hai: sirf private IP par bind, security group me sirf API VM, aur token | 3 Oct 2026 |
| Judge0 image me abhi 6 bhashayein | Runner ki bhasha list (`languages.ts`) dono backend ki saajhi hai. Go, Rust, Kotlin, C#, TypeScript G4 (LeetCode jaisa editor) ke saath, taaki gVisor runner me bhi aayein aur parity bani rahe | 3 Oct 2026 |
| Code playback: keystroke nahi, edits | Har key ka record nahi: editor ke text me badlav ka sabse chhota edit (shuru aur ant ka saajha hissa chhod kar). Isse wahi playback milta hai, data kam, aur sadharan textarea (low-bandwidth mode) me bhi chalta hai. Proctoring ki tarah sealed; exam proctored na ho tab bhi code sawaal par chalta hai, aur candidate ko editor me bataya jaata hai | 3 Oct 2026 |
| Bada paste sirf sanket | 200+ characters ka paste reviewer ko "large paste" dikhta hai, score par koi asar nahi: candidate apna hi code editor me ek jagah se doosri jagah paste karte hain. Faisla insaan ka | 3 Oct 2026 |
| Pehle Hire, baaki baad me (plan 110) | Owner (12 Oct 2026): pehle company ka poora hiring portal (job se offer tak) banakar launch; Learn (user platform), college TPO aur scholarship uske baad. LAUNCH-PLAN ka kram "Hire → Campus" isi ke hisaab se: Campus ki rows 97–99 ruki | 12 Oct 2026 |
| Hire ke liye naya Jobs model, drives nahi (plan 112) | Drives college ke liye hain (roll no., CGPA, 7 fixed stages). Company ko email se pehchaana gaya candidate, resume, apne rounds aur offer chahiye; isliye `hire_*` tables alag. Exams, proctoring, AI interview, interviews, report wahi purane | 12 Oct 2026 |
| Candidate ke account (plan 111) | SECURITY.md/SPEC.md me "candidates ke account nahi" tha. Owner chahte hain candidate apni har application ek portal par dekhe, isliye job dhoondhne walon ke account bante hain: email code se (password nahi). Account se test seedha nahi khulta: test ab bhi invite code aur attempt token se | 12 Oct 2026 |
| AI naye sawaal likhe, insaan manzoor kare (plan 116) | Pehle faisla tha "model sawaal nahi likhta". Owner ne naye sawaal maange, isliye ab model draft likhta hai; draft tab tak kisi test me nahi jaata jab tak koi insaan padhkar manzoor na kare; code wale draft ka reference program runner par chalta hai | 12 Oct 2026 |
| AI screening ka score (plan 113) | Model sirf har skill par resume ki seedhi line deta hai; jo line resume me na mile wo hat-ti hai. Score server ke formula se banta hai (must-have 60, nice 15, experience 15, jawab 10), model ka diya number nahi. Model kabhi kisi ko aage ya bahar nahi karta | 12 Oct 2026 |
| Verify na hui company ki job (plan 117) | Job publish ho sakti hai, par job page par likha rehta hai "Parikshaa ne abhi verify nahi kiya" jab tak operator verify na kare; shikayat par operator job hata sakta hai, company suspend kar sakta hai | 12 Oct 2026 |

---

## Ruka hua kaam (owner ke intezaar me)

Ye kaam code me taiyaar hain, lekin owner ki taraf se kuch chahiye. Owner "kya pending hai" pooche to sabse pehle ye list batani hai.

| Kaam | Kis cheez ka intezaar | Uske baad kya hoga | Kab se |
|---|---|---|---|
| **F1 go-live: staging (G0) aur Company ID (G1)** ([STAGING.md](STAGING.md), Plan rows 100–101) | 3 Oct: owner ne kram ki haan di, G0 aur G1 ka code ban gaya. Ab chahiye ([STAGING.md](STAGING.md) §1): domain; Supabase staging project + Pro; naya `sb_secret` sirf VM ke liye (purane rotate); AWS VM; Vercel project + token; GitHub `staging` environment ke secrets/variables; `PARIKSHAA_OPERATORS` me operator ke emails. §11 ke baaki faisle (LiveKit, SEB, retention) G5–G8 se pehle | Owner staging par khud test kare (§3); phir G2 (Library) | 3 Oct 2026 |
| **Judge0 (G3)** ([deploy/judge0/README.md](../deploy/judge0/README.md), Plan row 103) | 3 Oct: code aur tests ban gaye. Ab chahiye: (1) GitHub repo variable `PYTHON_SHA256` (python.org par Python 3.12.7 ke `.tgz` ka SHA-256), phir Actions → **Judge0 image** chalana; (2) AWS Mumbai me Judge0 ki alag VM (`c7i.xlarge`, Ubuntu 22.04, public IP nahi, port 2358 sirf API VM se, metadata band); (3) VM par `setup-judge0.sh` ek token ke saath (reboot ke baad dobara); (4) API par `RUNNER_BACKEND=judge0`, `JUDGE0_URL`, `JUDGE0_TOKEN`. Token chat me mat bhejiye | `npm run parity` staging par (sab same hona chahiye), Judge0 band karke fallback dekhna, phir 1,000 ka load test; tab Judge0 asli exams ke liye | 3 Oct 2026 |
| **Supabase + Vercel par shift (F0)** ([SUPABASE.md](SUPABASE.md), [LAUNCH-PLAN.md](LAUNCH-PLAN.md) §4) | **2 Oct: Mumbai project `parikshaa-mumbai` bana, schema (0001–0058, sirf 0054/0055 baaki; naye 0059 proctoring v2, 0060 AI interviewer aur 0061 resume bhi abhi lagne hain), lockdown: publishable aur secret, koi Supabase key kisi table ko nahi khol sakti (0056, 0058); security advisor saaf. PR #43 merge ho gaya.** **Legacy import ke dry run ([run #1](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/actions/runs/37020954083), [run #2](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/actions/runs/37039571098), 2 Oct) chale hi nahi: workflow ko dono secrets khaali mile** (log me `***` ki jagah kuch nahi), kuch padha/likha nahi gaya. Owner ne kaha "baad me saath check karenge". Ab owner se: (1) GitHub repo → **Settings → Secrets and variables → Actions → tab "Secrets" → "Repository secrets"** me dono naam dikhne chahiye: `LEGACY_DATABASE_URL`, `PARIKSHAA_DATABASE_URL`. Agar wo "Variables", "Environment", "Codespaces" ya "Dependabot" me hain to wahan se hata kar yahan daalein. Value poora `postgresql://…pooler.supabase.com:5432/postgres` string (password ke saath). Phir Claude dry run dobara chalayega aur report dikhayega; asli import owner ki haan ke baad. (1a) Dono projects ki `sb_secret` keys badalna (2 Oct ko chat me aa gayi thi): Project Settings → API Keys. (2) 0054/0055, 0059, 0060, 0061, 0062, 0063, 0064 aur 0065: connector se teen koshish (2 Oct) 60 s me manzoori na milne se ruki, kuch nahi badla. Ab GitHub se: PR #45 merge ke baad Actions → **Migrate** → Run workflow, pehle *dry run* (sirf list), phir dry run hata ke. Isko bhi wahi `PARIKSHAA_DATABASE_URL` secret chahiye (Repository secrets me); khaali ho to workflow pehle hi saaf bata deta hai: connector jab manzoori maange to haan, ya VM se `npm run migrate`. (3) Asli candidates se pehle Supabase org ko Pro par (backup + PITR). (4) VM: AWS Mumbai (owner ne chuna), neeche wali row | Problems Learn site par; phir Vercel par web/console aur har PR ka preview | 2 Oct 2026 |
| **AWS par go-live (M-F1)** ([DEPLOY-AWS.md](DEPLOY-AWS.md)) | 2 Oct: owner ne VM ke liye **AWS Mumbai** chuna; database ab Supabase Mumbai hai, isliye sirf Kadam 1 (pilot VM) chahiye, RDS wala Kadam 2 nahi. (1) AWS account (Mumbai), root par MFA, ek admin user; laptop par AWS CLI + session-manager-plugin, Terraform 1.10+, Docker, jq, Node 22. (2) Domain ke DNS ka access. (3) Alarm aur bill ke liye ek email. (4) `ANTHROPIC_API_KEY`. (5) SES: "production access" ki request aur SMTP credentials (console me). Claude ke paas AWS ka access nahi, isliye commands owner chalayega (runbook me har kadam) ya kisi ko de | Pilot machine isi hafte live (Kadam 1), phir staging → production (Kadam 2), phir pilot ka data RDS me. Pehle staging apply me jo galti mile wo code me theek hogi | 2 Oct 2026 |
| **Hire: Parikshaa ka grievance officer** (plan row 112, HIRE-V2 §10 B8) | 12 Oct: har job page aur apply ka notice (S8) do shikayat contact batata hai: company ka, aur Parikshaa ka. Parikshaa ka naam aur email server par `HIRE_GRIEVANCE_NAME` aur `HIRE_GRIEVANCE_EMAIL` me chahiye (VM ke env me, secret nahi). Owner tay kare kaun hai aur kaunsa email. Iske bina job pages aur apply 503 dete hain | Env lagte hi job pages aur apply chalu | 12 Oct 2026 |
| **GitHub Actions band: billing** (sab CI aur deploy) | 12 Oct: PR #66 aur `main` (a861b2b) dono par har job (check, e2e, security, docker, deploy) shuru hi nahi hua. GitHub ka note: "recent account payments have failed or your spending limit needs to be increased". Code ki galti nahi; local par `npm run check`, build aur budget hare hain. Owner se: GitHub → **Settings → Billing & plans** me payment method ya Actions spending limit theek karna | PR #66 ka CI dobara chalana (Claude karega), phir merge | 12 Oct 2026 |
| **`main` par `npm ci` toota hai; Hire ka aage ka kaam PR ke intezaar me** (plan rows 111–112) | 12 Oct: PR #65 merge hua, lekin usse pehle GitHub par `main` ko Hire branch me merge karne se `package-lock.json` kharab JSON ban gaya, isliye `main` par `npm ci` (aur CI) fail hota hai. Fix (`49c4712`: lockfile npm se dobara, jsdom 30.1.1 par pin) aur H2a `claude/festive-maxwell-pb4k5v` par hain. Owner ki haan se PR [#66](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/66) khuli (12 Oct). Ab chahiye: #66 ka merge | `main` phir hara; H2a `main` me | 12 Oct 2026 |
| **Hire: forged X-Forwarded-For ki staging jaanch** (S6/F27, plan row 111) | 12 Oct: API me test hai ki client ka bheja `X-Forwarded-For` IP nahi badalta. Production me Vercel → Caddy → API hai aur `TRUST_PROXY=true`, isliye staging chalu hone par ek baar jaanchna hai ki Vercel client ka header badal deta hai | Staging (upar wali G0 row) chalu ho, phir Claude `curl -H "X-Forwarded-For: 1.2.3.4"` se jaanchega; galat nikla to `TRUST_PROXY` ko hop count/CIDR banayenge | 12 Oct 2026 |
| **Companies ka asli data** (plan 9) | Har company ke asli reports (kaunsa problem kab poocha gaya). Hum ye bana nahi sakte: galat data learners ko gumraah karega. Owner/content team console → Companies me reports jode, ya interview experiences se aata rahe | Company pages, readiness aur plan me company problems apne aap bhar jaayenge | 1 Oct 2026 |
| **Video lessons** (plan 9) | Kaun banayega, kis bhasha me, hosting kahan (Faisle me "baaki"). Lesson me `videoUrl` field taiyaar hai | Lessons me video dikhne lagega | 1 Oct 2026 |
| **Baaki editorials aur hints** (plan 9) | 110 editorials aur 260 hints ke liye pehle utne naye problems chahiye (apne likhe, asli tests ke saath). Content team ya owner ki haan ki main aur problems likhoon | DSA pack jaisa hi naya pack | 1 Oct 2026 |
| **Sahayak evals ka paid run** (plan 1a) | (2 Oct: review ab fixed JSON me hai, isliye eval ki files badli; run se pehle `--approve-harness` dobara.) Environment me `ANTHROPIC_API_KEY` (cloud environment → Edit → environment variable; `api.anthropic.com` network me allow). Phir owner ki haan | 1) judge-sanity (~$0.10) 2) pilot, 24 cases 3) grading par owner ki manzoori 4) pilot se kharche ka andaaza aur haan 5) poora baseline (360 cases), `report.html`, `record-scores.ts` se console aur tracker me scores | 30 Sep 2026 |
| **Bank transfer (NEFT) ke details** | Server env me `PARIKSHAA_BANK_ACCOUNT`, `PARIKSHAA_BANK_IFSC`, `PARIKSHAA_BANK_ACCOUNT_NAME`, `PARIKSHAA_BANK_NAME` | Quotation PDF par bank details chhapenge; tab tak console "bank details set nahi" batata hai | 1 Oct 2026 |
| **DPA aur SLA par lawyer** | `docs/legal/DPA.md`, `SLA.md` ke [ ] wale hisse: company ka naam, liability, uptime target, support ghante, sub-processors ke region | Pehli badi company ko bhej sakte hain | 1 Oct 2026 |
| **Asli model par pehla trial** | `ANTHROPIC_API_KEY` (upar wali hi) aur kuch asli samples: 3 JD, 5 handwritten copies (scan), 5 candidates ki photos (sahmati ke saath) | JD se test, handwritten marking aur proxy photo-check ki asli quality pata chalegi; abhi sab fake model se tested hain | 1 Oct 2026 |
| **WhatsApp ke do naye template** (offer, drive) | Meta Business me `offer` (naam, company, role, package, link) aur `drive` (naam, company, role, college, last date, link) template ki manzoori; [PILOT.md](PILOT.md) me text | Offer aur nayi drive WhatsApp par bhi jaayenge; tab tak sirf email | 2 Oct 2026 |
| **Contest day ke liye runner aur API ka size** (plan 34) | Kitne runner workers aur kitne API processes chalayein: load test (`e2e/contest-2000-*.txt`) batata hai ki ek 4-core machine par 2,000 ka contest bina error chalta hai, par verdict p95 ~22 s hai. 5 s ke liye zyada runner aur 2+ API processes chahiye: ye kharche ka faisla owner ka | `JUDGE_CONCURRENCY` set karke, aur machines badha kar, load test dobara | 2 Oct 2026 |
| **Push notifications ki keys** (plan 41) | Server env me `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (ek baar `npx web-push generate-vapid-keys`; private key chat me mat bhejiye, seedha server env me) | Plan page par "notification bhi" ka option dikhega, aur roz ka reminder phone par aayega | 2 Oct 2026 |
| **Play Store app (TWA)** (plan 43) | Google Play Console account, app ka naam aur package name (jaise `in.parikshaa.practice`), signing key kaun rakhega, aur learners ke liye privacy policy ka public page | `docs/PLAY-STORE.md` ke kadam: Bubblewrap se app, `TWA_PACKAGE`/`TWA_SHA256` server par, Play par upload | 2 Oct 2026 |
| **Agle features: Plan rows 50–52** (2 Oct 2026 ko owner ne kaha "yaad rakho, baad me karenge"; 42–49 ban gaye) | Owner kab kahe ki shuru karo. 50 (judge autoscale), 51 (video hosting), 52 (content) teeno me owner se cheezein chahiye (cloud, video host, content) | Har row apne tests ke saath banegi, phir ✅ | 2 Oct 2026 |
| **College/company ke agle features: Plan rows 65–74** (Batch A–J, 2 Oct 2026 ko owner ne kaha "yaad rakho, baad me karenge") | Owner kab kahe ki shuru karo, aur kaunsa batch pehle. F, G, H, I, J me owner se cheezein chahiye (API key, data, prices, manzoori, auditor) | Har batch apne tests aur screenshots ke saath | 2 Oct 2026 |
| **Poora roadmap: merge ka niyam aur content factory ki haan** ([ROADMAP-END-TO-END.md](ROADMAP-END-TO-END.md) §2a, plan row 123; accounts aur secrets ka step-by-step: [OWNER-SETUP.md](OWNER-SETUP.md)) | (1) Merge kaun kare: aap har PR, ya likh kar haan ki CI hara + review pass par Claude merge kare. (2) Content factory API par chalane ki haan, mahine ki spend limit ke saath (andaaza ek baar $1,500–3,000). API key aur GitHub billing upar wali rows me hain | Slices aap par ruke bina aage badhenge; raat ko content batch chalenge | 18 Oct 2026 |
| **Learn v2: samples ki manzoori, reviewers, file ka haq** ([LEARN-V2.md](LEARN-V2.md) §13, plan row 125) | (1) ✅ Editorial style, kitaab ka haq, chat history aur fair use: sab tay (19 Oct, Faisle dekho). (2) 10 coding + 10 aptitude + 2 lesson samples ki manzoori (LEARN-V2 §3g), iske bina 5,000 ka generation nahi. (3) Reviewer kaun (~900 ghante). (4) Factory ke liye Anthropic API key (upar wali row) | Template pakka → bulk content raat ko | 19 Oct 2026 |
| **Learn v2: owner ke saare problem batches** ([learn/PROBLEM-STANDARD.md](learn/PROBLEM-STANDARD.md) §6) | 19 Oct ko 4 series batches (25, 26, 28, 29) aur SQL template mile; audit me 40/40 easy, 12 test har ek, bade test nahi. Baaki saare series batches aur SQL problems `docs/learn/source/problems-v1/` me ya chat me | Basics track (500) ka upgrade raat ko factory se | 19 Oct 2026 |
| **Learn v2: mock v4.3 ki raay** ([learn/mock-v3/README.md](learn/mock-v3/README.md), plan rows 132–135) | 20 Oct: font, kaala default, roles aur 4-eyes manzoor; daam testing ke baad. 21 Oct: logo A final. 23 Oct: v4.3 bana (row 135). Ab owner se: (1) **Aaj** aur **profile** ka roop chuno (A / B / C / v4.2, mock me switch se); (2) 5–8 students + 2 HR/TPO ke saath 30 minute ka test karwana (script Claude dega); (3) aur badlav, ya "shuru karo" (F1–F7, [learn/CODE-READINESS.md](learn/CODE-READINESS.md)); (4) chahein to 21st.dev allow + `TWENTYFIRST_TOKEN` (`.claude/skills/README.md`) | Chune roop rakh kar baaki hatana; test ki raay se v4.4 (uska plan 23 Oct ko pakka: kadam 44-0–44-6, tracker row 136); "shuru karo" par product code (tokens → shell + kit → screens) | 20 Oct 2026 |
| **Master plan v3 par faisla** ([MASTER-PLAN.md](MASTER-PLAN.md), v2 ki jagah) | Owner ki haan ya na, aur [§19](MASTER-PLAN.md#19-owner-se-kya-chahiye) ki list: cloud + domain, API key + AI budget, providers (email/SMS/WhatsApp/Razorpay live), 3 pilot colleges + 2 companies, naam/brand, content team, vakeel, designer | Haan ke baad Phase 0 (M-F1 go-live) ki row Plan table me, phir build | 2 Oct 2026 |

## Plan: aage kya banega

Naya kaam shuru karne se pehle yahan entry jodo. Kaam ho jaaye to status ✅ karke upar ki table update karo, aur entry ko [Build log](#build-log) me le jao.

Sujhaya gaya kram (sabse zaroori pehle):

| # | Kaam | Blueprint | Kyun | Done kab | Status |
|---|---|---|---|---|---|
| 1a | **Sahayak evals** (shuru: 30 Sep 2026). Teen evals, ek hi case set par: **hint** (rung 1–2 me code ya poora algorithm leak na ho), **review** (planted bug pakde, learner ke code ki complexity sahi bataye, sahi program na likh de), **doubt** ("bas code de do" par bhi solution na de, sawaal ka jawab de). Cases: 40 apne likhe problems × 3 galat solutions (off-by-one, overflow, TLE), har galat solution runner par sach me fail hota hai; 120 doubts; ~20% Hindi. Judge: `claude-sonnet-5-5`, structured output. Runner asli `Sahayak` class chalata hai (PGlite par). Paid run sirf owner ki manzoori ke baad. **Ab tak:** cases owner ne manzoor kiye (30 Sep); 40 problems ke saare galat programs runner par check; runner, grader, judge-sanity aur tests ban gaye. **Baaki:** API key, pilot (24 cases), grading par manzoori, kharche ka andaaza, baseline run | §14, F4, F5 | Launch se pehle safety aur kharcha | Inputs aur grading par owner ki manzoori; baseline run ka `report.html`; targets: hint leak-free 98%, review bug 90%, complexity 95% | 🟡 chal raha |
| 1b | **Static hint 1 + solution par coins aadhe** (shuru: 30 Sep 2026). Admin har problem par ek "pehla hint" likh sake (console). Hint ladder ka rung 1 us problem par wahi hint dikhaye: model call nahi, credits 0. Hint na likha ho to pehle jaisa AI rung 1. Jis learner ne rung 4 (poora solution) le liya, us problem ko solve karne par coins aadhe | §14, F4 | AI ka kharcha bachana, aur solution dekh kar coins kamane par rok | Tests: static hint par model call nahi aur credit nahi katta; hint na ho to AI; rung 4 ke baad solve par aadhe coins; console me hint likhna/badalna | ✅ ban gaya (30 Sep 2026) |
| 2 | **Coupons, GST invoices, pricing page ka GST breakup** (shuru: 1 Oct 2026). Staff coupon banaye (% ya flat, kis plan par, kitni baar, kab tak, affiliate ka naam); learner checkout par code daale ya `?ref=CODE` link se aaye; har paid order par apni series (`PKP/…`) ka GST tax invoice, learner ke state ke hisaab se CGST+SGST ya IGST; pricing page par har plan ka GST breakup aur FAQ; console me coupons aur kis coupon/affiliate se kitni bikri | §16, F12 | Paid launch ke liye zaroori | Tests: coupon ki saari shartein, discount ke baad sahi amount Razorpay ko, paid hone par ek hi invoice, invoice number series, `?ref=` se code bhara jaana; console aur learner pages | ✅ ban gaya (1 Oct 2026) |
| 3 | **Roz ke reminders + analytics** (shuru: 1 Oct 2026). Learner plan page par roz ka email reminder chaalu kare aur samay chune (IST); har din ek hi email: aaj ke baaki tasks, revise ke cards, streak; email me ek click se band karne ka link. Analytics: signup, plan, solve, lesson, task, hint, purchase aur roz ka khulna — maujooda tables se gine jaate hain; console me activation (7 din me pehla solve), D1/D7 retention, funnel, roz ke active learners | F2, §17 | Retention aur metrics naapna | Tests: sahi ghante par sirf baaki kaam wale learners ko ek hi email, band karne ka link, analytics ke numbers; console aur learner pages | ✅ ban gaya (1 Oct 2026) |
| 4 | **Sprint quiz + revision notes, streak freeze** (shuru: 1 Oct 2026). Sprint ke saare tasks ho jaayein ya uske din nikal jaayein to quiz khule: us sprint ke MCQ/numeric sawaal (10 tak), 70% se kam par galat wale sawaal agle study day par revise tasks ban jaayein aur revision card aaj due ho; pass par coins. Sprint ke revision notes: us sprint ke lessons/problems par learner ke apne notes ek page par. Streak freeze ("aaj chhutti"): mahine me 2, streak nahi tootta, aaj ke tasks aage khisak jaate hain, us din reminder nahi | F7, 13.2 | Planner poora | Tests: quiz kab khulta hai, grading, 70% ka niyam aur revise tasks, coins ek baar; notes page; freeze ki limit, streak par asar, tasks ka khisakna; learner pages | ✅ ban gaya (1 Oct 2026) |
| 5 | **Playwright e2e: F1, F3, F12, F13** (shuru: 1 Oct 2026). Asli browser, asli Postgres, `packages/e2e/tests/prep-flows.spec.ts`. Har test apni alag organisation aur practice site banata hai (Plus on/off ek test ka doosre par asar na daale). F1: signup → plan banana (preview, start) → dashboard par aaj ka plan. F3: code problem par Run (sample ka nateeja) aur Submit (accepted), runner in-process (`E2E_RUNNER=local`, screenshots jaisa). F12: Plus page → Checkout (fake Razorpay) → confirm → Plus active, invoice khulta hai. F13: coin store se item lena (14 din purana account aur coins test setup me) | §20 | Regression se bachav | Chromium, Firefox, WebKit teeno me CI par chalein | ✅ ban gaya (1 Oct 2026). Chromium par yahan pass; Firefox/WebKit CI par |
| 6 | **Company v2: readiness, "list shuru karo", Company Pass** (shuru: 1 Oct 2026). Learner companies ko target kare (company page ya plan banate waqt); har target ka readiness score (pichhle 180 din ke sabse zyada poochhe gaye 50 problems me se kitne solve) company page aur dashboard par; "Is company ki list shuru karo" se company ke top problems ek apni list me; Company Pass: alag product jo sirf companies ki poori list kholta hai (Plus ke bina); plan banate waqt target companies ke unsolved problems plan ke aakhri 30% dino me | F9 | Company prep poora | Tests: readiness ginti, list banna aur Plus/Pass ke bina 5 ki seema, Company Pass kharidna aur uska asar, plan me company problems; learner aur console pages | ✅ ban gaya (1 Oct 2026) |
| 7 | **NoteSpace: AI draft, PDF export** (shuru: 1 Oct 2026). Sahayak ka "notes" mode: lesson ya **solve kiye hue** problem par revision note ka draft (key idea, steps, complexity, galtiyan), learner ke apne accepted code ke saath; credits katte hain, note apne aap save nahi hota: learner editor me badal kar save karta hai. Bina solve kiye problem par draft nahi (solution leak na ho). PDF: ek track ke saare notes, module ke hisaab se (topic notes alag), ek printable page par; browser ke "Print → Save as PDF" se | F15, §14 | Phase 5 | Tests: draft ke credits aur refund, unsolved problem par mana, contest me band, history me "notes"; track ke notes module ke kram me; learner pages | ✅ ban gaya (1 Oct 2026) |
| 8 | **Campus licence: CSV se bulk Plus, college dashboard** (shuru: 1 Oct 2026). Staff console me ek "cohort" banaye (college/batch ka naam, Plus ke kitne din); emails ki CSV daale, pehle dry run (sahi, galat, dobara, pehle se, kitne abhi milenge, kitne signup ke baad); import par jinka email **verified** account hai unhe turant Plus, baaki ko jab wo us email se signup karke verify karein (ya Google se aayein). Har email ko ek hi baar. College dashboard: har cohort me kitne joined, kitno ko Plus mila, 7 din me active, solve ki ginti, aur har student ki line | F16 | B2B sales | Tests: CSV parse aur dry run ki ginti, verified ko turant, unverified/naye ko verify par, dobara import par dobara Plus nahi, dashboard ke numbers, sirf staff; console page | ✅ ban gaya (1 Oct 2026) |
| 9 | **Content: jo imaandari se likha ja sake** (shuru: 1 Oct 2026). (a) **DSA starter pack**: Sahayak eval ke 40 apne likhe problems (statement, formats, constraints, reference program) ek click me site par; har problem ka pehla hint aur brute-force approach naya likha, optimal approach + reference Python editorial me; tests = examples + chhote random + edge cases, expected output reference program ka (asli runner par), pattern ke hisaab se track. (b) **Placement quiz**: 40 apne likhe MCQ (complexity, arrays, hashing, stack/queue, recursion, sorting/searching, trees/graphs, DP); onboarding me 8 sawaal, server jaanchta hai aur level sujhata hai. **Owner ke bina nahi**: companies ka asli data (reports), videos, baaki 110 editorials/260 hints ke liye naye problems ("Ruka hua kaam" dekho) | §15, F1 | Log content ke liye aate hain | Tests: pack ke har reference ka har test asli runner par pass, pack dobara banane par wahi; import ke baad hint free aur editorial tabs; quiz ki grading aur level, jawab browser ko nahi jaate; learner page | 🟡 jo ho sakta tha ban gaya (1 Oct 2026); baaki owner par |
| 10 | **V2-P0 Neev**: 1a–5 poore, PWA v1 (A1), achievement cards (C1), public profile (C6), pehla load test (G) | Master plan v2 | Baaki sab isi par khada hai | V2-8 ka gate: D1/D7 naap rahe; 1,000 ka exam start paas | ⬜ owner ki haan baaki |
| 11 | **V2-P1 Saboot**: Pramaan (B1), viva-verified solves (B2), leak-proof paper (B4), Premier League, squads, referral, WhatsApp sawaal | Master plan v2 | Hamara sabse bada fark | 20 college, 10,000 learners, D7 ≥ 25% | ⬜ owner ki haan baaki |
| 12 | **V2-P2 College**: TPO OS (D1–D5, D7; list [V2-12](#v2-12-college-aur-company-end-to-end-feature-list)), handwritten checking beta (D6), mock OA (A5) | Master plan v2 | Distribution ka sasta rasta | 50 college har hafte active; 3 paid pilot | ⬜ owner ki haan baaki |
| 13 | **V2-P3 Company** ([V2-12](#v2-12-college-aur-company-end-to-end-feature-list)): Parikshaa Score (B3), talent pool, hiring challenge, interview room, AI-allowed test (E1–E6) | Master plan v2 | Paisa yahan se | 20 paying companies; Score se 100 hiring | ⬜ owner ki haan baaki |
| 14 | **V2-P4 Aur exams + Bharat**: coaching white-label, OMR scan, GATE, SSC/Bank (F1–F4), awaaz + 11 bhashayein (A7), creators | Master plan v2 | Placement ke bahar ka bazaar | 25 coaching; Hindi/regional ≥ 40% | ⬜ owner ki haan baaki |
| 15 | **V2-P5 Scale + certificate**: 10,000 ka contest, pentest + bug bounty, DigiLocker, Play Store app | Master plan v2 | Badi company aur sarkar ka bharosa | Pentest ke critical/high 0 | ⬜ owner ki haan baaki |
| 16 | **Student master + drive manager** (CL8, CL52; shuru: 1 Oct 2026). College ke students ek baar (roll no., naam, email, phone, branch, batch, CGPA, backlogs) CSV se, dry run ke saath, dobara import par update. Drive: company, role, CTC, JD, eligibility (min CGPA, max backlogs, branches, batches), apply-by; eligible students apne aap nikle, drive me jude, rounds me aage badhein (applied → test → interview → offer/reject → joined), drive ke exam ka test ek click me bheja jaaye, CSV export company ke liye | V2-12 | TPO ka Excel khatam; NIRF ka data yahin se | Tests: import (galat CGPA, duplicate, update), eligibility, stage badalna audit ke saath, test bhejna; console me Students aur Drives page; screenshots | ✅ ban gaya (1 Oct 2026) |
| 17 | **JD se test + role library** (CO6, CO7; shuru: 1 Oct 2026). 8+ role templates (fresher aptitude, Java dev, Python dev, frontend, data analyst, QA, DevOps, BPO/support): skills, sections, time, difficulty. JD chipkao: model skills aur level nikaale (bina model ke role template se). Question bank se har section ke sawaal chune jaayein, kami ho to saaf bataya jaaye; draft exam editor me khule, author badle aur save kare | V2-12 | Recruiter 10 minute me test bheje | Tests: role template se draft, JD se skills (fake model), bank me kami ki report, draft save hokar exam bane; console me "New test from a job" | ✅ ban gaya (1 Oct 2026) |
| 18 | **Admit card + seat allocation** (CL24, CL25): rooms aur seats bhar kar candidates ko roll no. ke kram me seat; har candidate ka admit card PDF (seat, samay, QR); candidate apne link se bhi download kare | V2-12 | Exam din ki tension kam | Tests: allocation, kam seats par mana, PDF, QR se attendance; console card; screenshot | ✅ ban gaya (1 Oct 2026): `api/src/seats.ts`, `seats-routes.ts`, migration 0031; console `Rooms.tsx`. Photo admit card par nahi (sirf naam, roll, seat, QR) |
| 19 | **Hiring manager ko shortlist link** (CO23): expire hone wala signed link, bina login; manager Shortlist/Hold/Reject aur comment de; recruiter ko dikhe | V2-12 | Recruiter ↔ manager ka roz ka kaam | Tests: link, expiry, galat link, decision; public page; screenshot | ✅ ban gaya (1 Oct 2026): `api/src/shortlists.ts`, migration 0032; web `PublicPages.tsx`; console `Shortlists.tsx` |
| 20 | **PO/NEFT se payment** (CL57): quotation PDF (PO number ke saath), bank details; operator UTR ke saath payment record kare to credits + GST invoice | V2-12 | Colleges card se kam dete hain | Tests: quotation, record payment, double record par mana; console card | ✅ ban gaya (1 Oct 2026): `api/src/billing.ts` (quote, recordTransfer), migration 0033, `billing-cli transfer`; console `BankTransfer.tsx`. Bank details env me chahiye (Ruka hua kaam) |
| 21 | **Readiness heatmap** (CL51): branch × topic, students ke exam results se; kamzor students ki list | V2-12 | TPO ko pata chale kahan mehnat chahiye | Tests: heatmap ginti; console tab; screenshot | ✅ ban gaya (1 Oct 2026): `PlacementService.readiness`; console Placement → Readiness |
| 22 | **Open link se apply** (CO14): drive ka public link; student roll no./details bhar kar apply kare; eligibility check | V2-12 | Off-campus aur campus drive dono | Tests: apply, eligibility mana, band drive, throttle; public page; screenshot | ✅ ban gaya (1 Oct 2026): migration 0034, `placement.ts` (apply); web ApplyPage. Naye log `self_registered`, TPO ki alag manzoori nahi |
| 23 | **NIRF/NAAC + CO–PO reports** (CL54, CL47): placement report (placed, median/highest package, branch-wise) CSV; sawaal → CO mapping, CO→PO matrix, attainment | V2-12 | Ranking aur accreditation ka data | Tests: median, attainment levels; console; CSV | 🟡 Placement report rakha (year-wise, TPO ke liye); CO–PO aur NIRF/NAAC framing hataya ([LAUNCH-PLAN.md](LAUNCH-PLAN.md) §3) |
| 24 | **Kai lab ek dashboard + invigilator phone** (CL32, CL33): Live page par room-wise ginti; phone par attendance (admit card QR ya roll no.) | V2-12 | Bade drive me sab rooms ek jagah | Tests: attendance; console; screenshot phone | ✅ ban gaya (1 Oct 2026): `Rooms.tsx` (RoomsCard, AtTheDoor), `seats.ts` markPresent. Phone par QR BarcodeDetector se (Chrome/Android); baaki browser me roll no. |
| 25 | **Bolkar jawab** (CO10): written sawaal par "speak to answer": browser bolne ko likhta hai (dictation), candidate sudhaar sake; audio save nahi hota | V2-12 | Communication/BPO roles | Tests: sawaal ka flag, web mic button; 11 bhashaon me words | ❌ Hataya (2 Oct 2026, [LAUNCH-PLAN.md](LAUNCH-PLAN.md) §3): product sirf tech; code git history me, tables migration 0055 se gaye |
| 26 | **Interview room** (CO26, CO28): interview schedule, candidate ka link, saanjha code editor (live), video call ka link, interviewer ki scorecard | V2-12 | Hiring ka agla round platform par | Tests: schedule, candidate code sync, scorecard; screenshot | ✅ ban gaya (1 Oct 2026): `api/src/interviews.ts`, migration 0036; console `Interviews.tsx`; web InterviewPage. Video bahar ka link (Jitsi ya apna), whiteboard nahi |
| 27 | **Handwritten checking** (CL39): answer sheet ki photos upload, AI padh kar har sawaal ka mark sujhaaye, faculty manzoor/badle; CSV | V2-12 | Internal exams ki checking | Tests: fake model se suggestion, approve, kharcha cap; console; screenshot | ❌ Hataya (2 Oct 2026, [LAUNCH-PLAN.md](LAUNCH-PLAN.md) §3): product sirf tech; code git history me, tables migration 0055 se gaye |
| 28 | **Doosra examiner / moderation** (CL40): copy check hone ke baad doosra examiner (pehle wala nahi) naye sire se marks de; farq paper ke 10% se kam to pehle marks rahenge, zyada to "disputed", head examiner (exam:write) final kare; 10% sample chunna | V2-12 | University aur autonomous college ka niyam | Tests: wahi examiner mana, tolerance, disputed → settle | ❌ Hataya (2 Oct 2026, [LAUNCH-PLAN.md](LAUNCH-PLAN.md) §3): product sirf tech; code git history me, tables migration 0055 se gaye |
| 29 | **Console Hindi me** (CL5): top bar me "हिन्दी" switch; navigation, har page ka title aur ek line ka matlab Hindi me; device par yaad | V2-12 | Hindi-medium TPO aur faculty | Test: switch, yaad rehna, `lang` | 🟡 (1 Oct 2026): `console/src/language.ts`, `hindi.ts`. Pages ke andar ka text abhi English |
| 30 | **Kai college ki ek drive** (CO15): company ki drive me partner college, har college ka apna apply link, roll no. par college ka code (NITT-21CS001), college-wise ginti, CSV me College column | V2-12 | Company ka campus hiring ek jagah | Tests: do college ka same roll no., ginti, link band | ✅ ban gaya (1 Oct 2026): migration 0038, `placement.ts` (addCollege), console `DriveNetwork.tsx`. College-wise result report alag nahi |
| 31 | **Offer tracking** (CO30): offer link (role, LPA, joining date, note), candidate ek baar accept/decline kare; drive me sent/accepted/declined/waiting/joined/"join nahi kiya" | V2-12 | Company aur college dono ko pata ho kaun join karega | Tests: link, ek hi jawab, ginti, joined | ✅ ban gaya (1 Oct 2026): migration 0039, `placement.ts` (sendOffer, respondToOffer); web OfferPage; console `DriveNetwork.tsx`. Offer email/WhatsApp se apne aap nahi jaata, link copy karke bhejna hai |
| 32 | **Proxy pakadna** (CO19): ek network + browser se kai candidates, ek hi identity photo do attempts me, AI se selfie ↔ ID ↔ webcam photo milana (sirf sanket, faisla insaan) | V2-12 | Remote hiring test ka sabse bada dar | Tests: shared origin, lab me nahi ginna, reused photo, AI flag, audit | 🟡 (1 Oct 2026): migration 0040, `api/src/proxy.ts`; console `ProxyCheck.tsx`. Awaaz wala viva aur do device nahi; asli model par abhi nahi chalaya |
| 33 | **Enterprise ke liye DPA aur SLA** (CO35): code se likhe templates, Annex me data, suraksha aur sub-processors; SECURITY.md me naya data | V2-12 | Badi company ka procurement | Lawyer review | 🟡 (1 Oct 2026): `docs/legal/DPA.md`, `docs/legal/SLA.md`. Lawyer aur owner ki terms baaki (Ruka hua kaam); status page aur questionnaire nahi |
| 34 | **Contests v2** (F11, §20): contest me rank par coins (top 10 ko, ek baar), judge ki priority lane (contest ke submissions pehle), runner queue jo bheed me bhi kram se chale, 2,000 learners ek saath ka load test | F11, §20 | Contest bina atke chale, aur jeetne ka inaam | Tests: rank coins ek hi baar, queue ka kram aur timeout; load test ki report (p95, errors) | ✅ ban gaya (2 Oct 2026); autoscale ⬜ |
| 35 | **Payments v2** (§16): naye/purane users ko 30 din ka trial (ek baar), refund flow (staff refund kare → Razorpay refund, Plus ke din wapas, credit note), coin store me coupons, "mahine me 1" jaisi limit, alag DSA Pass | §16, F12 | Bechne ke aam tareeke poore | Tests: trial ek baar, refund se Plus band aur credit note, monthly limit | ✅ ban gaya (2 Oct 2026) |
| 36 | **Planner settings** (S6, F6): weekday/weekend ke alag minutes, chalte plan me deadline ya roz ka time badalna (plan dobara bane, kiya hua kaam rahe), time kam pade to 3 raaste (deadline aage, roz zyada, chhoti sheet), finish date khiskne par email | S6, F6 | Planner "Planly" jaisa poora | Tests: alag minutes se din, badlav par kiya hua bacha rahe, 3 raaste ke numbers, email ek baar | ✅ ban gaya (2 Oct 2026) |
| 37 | **Sahayak v2** (§14): review ka fixed JSON (logic, complexity, quality, edge cases), interview follow-up sawaal (solve ke baad 2 sawaal), chats 180 din baad apne aap delete (DPDP), admin page par evals ke scores | §14, F5 | Review ek jaisa aur jaancha ja sake; data kam rakhna | Tests: JSON schema, follow-up ka flow, 180 din wala delete, admin page | ✅ ban gaya (2 Oct 2026); evals ka paid run alag se owner par |
| 38 | **Profile aur cards** (S7, C1, C6): public profile `/u/:username` (learner chaahe to), share karne layak achievement cards (image), title naam ke saath har jagah | S7, F10 | Viral aur pehchaan | Tests: profile private by default, card image, title dikhna | ✅ ban gaya (2 Oct 2026) |
| 39 | **Community v2** (F14): interview experience par report/flag (staff queue), success stories, company logos (staff upload), pattern analysis (tags se aage) | F14, S5 | Bharosa aur content ki quality | Tests: flag queue, ek learner ek baar, logo upload ki seema | ✅ ban gaya (2 Oct 2026) |
| 40 | **Learn v2** (S3, S4, F8): lesson ke andar quiz, problem list me company/topic/pattern filter, IDE ka share link (code read-only), galat quiz sawaal ya note se revision card | S3, S4, F8 | Seekhna aur dohrana ek jagah | Tests: lesson quiz, filters, share link me hidden tests nahi, naye cards | ✅ ban gaya (`learn-v2.test.ts`; lesson note se card nahi, share hatane ka button nahi) |
| 41 | **PWA aur push** (§17): installable app, offline me aaj ka plan, push notification (reminder email ke saath) | §17, A1 | Mobile par roz ka loop | Tests: manifest, service worker cache, push ki subscription aur band karna | ✅ ban gaya (`pwa.test.ts`, `sw.test.ts`; VAPID keys owner se; offline submit queue aur TWA baaki) |
| 42 | **Offline v2** (A1 baaki): net na ho to submission queue me rahe aur net aate hi jaaye; lessons aur problems offline padhne ke liye cache | §17, A1 | 2G aur bina net wale din bhi kaam | Tests: offline submit queue (dobara na jaaye), lesson/problem cache, sw tests | ✅ ban gaya (`offline-queue.ts`, `sw.js`; tests `PracticeApp.test.tsx`, `sw.test.ts`) |
| 43 | **Play Store app (TWA)**: PWA ko Play Store par app ki tarah | A1 | Bharat me log app store se hi install karte hain | Play Store par listing, `assetlinks.json` | 🟡 server hissa bana (`/.well-known/assetlinks.json`, `TWA_PACKAGE`/`TWA_SHA256`, `docs/PLAY-STORE.md`, `pwa.test.ts`); Play Console account, package name, key aur learners ki privacy policy owner se |
| 44 | **Shared code ke links sambhalna**: learner apne share kiye links dekhe aur hata sake | F8 | Galti se share kiya code wapas lena | Tests: list, delete, delete ke baad 404 | ✅ ban gaya (`GET/DELETE /shares`, web "My shared solutions"; `learn-v2.test.ts`) |
| 45 | **SQL practice v2**: result table ki shakal me output, tables ka schema viewer | S4 | Abhi output sirf text hai | Tests: table render, schema dikhna | ✅ ban gaya (`SqlTables.tsx`, `sql-view.ts`; tests) |
| 46 | **Onboarding me target role** (SDE, data, frontend…), plan me us role ke topic pehle | S1 | Plan zyada apna lage | Tests: role chunna, plan ka kram | ✅ ban gaya (`prep-roles.ts`, `prep_plans.role`; `learn-v2.test.ts`, web test) |
| 47 | **Account delete par baaki prep data**: plan, cards, coins ke rows bhi hatana | §11 | DPDP: account gaya to data bhi | Tests: erase ke baad koi prep row nahi | ✅ ban gaya (`prep_erase_study`; `prep.test.ts`, store test) |
| 48 | **Staff ke editorials ka code CI me jaanchna**: editorial me diya code save par asli runner par tests ke saath chale | Content quality | Galat editorial na chhape | Tests: toota code save na ho | ✅ ban gaya (`editorial-code.ts`; `editorial-check.test.ts`) |
| 49 | **Editorial me "Better" approach ka tab** (Brute/Better/Optimal teeno) | F4 | Blueprint ka format | Tests: teen tab | ✅ ban gaya (`DSA_BETTER`, 17 problems; `content-dsa.test.ts`) |
| 50 | **Judge autoscale**: queue lambi ho to runner machines badhein, khaali ho to ghatein | G | Bade contest me verdict jaldi | Load test me p95 < 5 s | ⬜ pending: deploy kahan hoga (cloud) aur kharcha owner se |
| 51 | **Video hosting**: player, kitna dekha (progress), signed URL, watermark | S3 | Video lessons ke liye | Tests: progress save, URL ki expiry | ⬜ pending: host ka faisla aur videos owner se |
| 52 | **Content**: 110 aur editorials, 260 aur hints, 25 companies ka asli data, 60 video lessons | Content | Platform ki asli keemat | Har pack ke tests | ⬜ pending: content/data owner se ("Ruka hua kaam") |
| 53 | **T1 Naya data seal + retention** (shuru: 2 Oct 2026): scan ki hui copies, student list ke contact, interview code/notes ek server key se AES-256-GCM me band; retention sweep in par bhi (organisation ke din ke hisaab se) | V2-12 bharosa | SECURITY.md ki khud maani kami | Tests: DB me plain text nahi, padhne par wapas, purana data sweep se mitta | ✅ ban gaya (2 Oct 2026): `store/src/sealing.ts`, migration 0048, `privacy.ts` RetainedRecords; test `records-sealing.test.ts`. Purana plain data dobara likhne par seal |
| 54 | **CL63 Handwritten marks Results aur CO–PO me**: checked copy ke marks exam ke results, scorecard aur CO attainment me jaayein | V2-12 | Paper exam ka result bhi ek jagah | Tests: results row, CO attainment me copy ke marks | ❌ Hataya (2 Oct 2026, [LAUNCH-PLAN.md](LAUNCH-PLAN.md) §3): product sirf tech; code git history me, tables migration 0055 se gaye |
| 55 | **CO42 Offer email/WhatsApp se**: offer banate hi candidate ko link outbox se jaaye; dobara bhejna | V2-12 | Recruiter link copy na kare | Tests: outbox item, WhatsApp/email text | ✅ ban gaya (2 Oct 2026): `api/src/student-messages.ts`, migration 0049; WhatsApp template "offer" Meta ki manzoori baaki (Ruka hua kaam) |
| 56 | **CL67 Nayi drive ki alert**: drive kholte hi eligible students ko email/WhatsApp, apply link ke saath; ek student ko ek drive ki ek baar | V2-12 | TPO ka roz ka kaam | Tests: sirf eligible, ek baar, link | ✅ ban gaya (2 Oct 2026): `/drives/:id/alert`, console Placement "Tell eligible students"; WhatsApp template "drive" manzoori baaki |
| 57 | **CO38 Funnel dashboard**: har drive aur college ka applied → test → interview → offered → joined, kahan log chhoote | V2-12 | Company aur TPO dono ka pehla sawaal | Tests: ginti, college-wise; console | ✅ ban gaya (2 Oct 2026): `api/src/funnel.ts`, `/placement/funnel`; console Placement → Funnel, drive me college-wise |
| 58 | **CL26 Demo test**: har organisation ka ek "practice exam" link, asli CBT jaisa, bina marks aur bina record | V2-12 | Pehli baar CBT dene walon ka dar | Tests: demo attempt kahin nahi dikhta, credit nahi katta | ✅ ban gaya (2 Oct 2026): `web/src/demo.ts` (`/?demo`). Sample sawaal sabke liye ek jaise, organisation ke apne nahi |
| 59 | **CL60 Paper setter → HoD review → lock**: exam "review ke liye" bheja jaaye, reviewer manzoor ya lautaye (comment), manzoor ke baad paper badal na sake | V2-12 | Paper ki jimmedari aur leak se bachav | Tests: lock ke baad edit mana, audit, comment | ✅ ban gaya (2 Oct 2026): `api/src/exam-review.ts`, migration 0050; console `PaperReview.tsx` |
| 60 | **CL4 Staff CSV + CL6 Department**: staff CSV se (role, department); exam aur staff ka department; HoD ko sirf apna department | V2-12 | Badi university | Tests: import dry run, department filter | ✅ ban gaya (2 Oct 2026): `api/src/departments.ts`, migration 0051; console `StaffSheet.tsx`, exam list par department. Campus (kai college) nahi |
| 61 | **CO27 Calendar invite + CO41 Panel**: interview ka .ics (email ke saath), kai interviewers, sabke scorecard | V2-12 | Interview ka roz ka kaam | Tests: .ics, panel ke scorecards, average | ✅ ban gaya (2 Oct 2026): `interviews.ts` (panel, combine, calendar), migration 0052; console `Interviews.tsx`. Calendar API sync nahi, `.ics` email/download |
| 62 | **CL65 Internal marks (CIA)**: kai exams ke marks weightage se jod kar ek sheet, university format CSV | V2-12 | Har semester ka kaam | Tests: weightage, gair-hazir, CSV | ❌ Hataya (2 Oct 2026, [LAUNCH-PLAN.md](LAUNCH-PLAN.md) §3): product sirf tech; code git history me, tables migration 0055 se gaye |
| 63 | **CL62 Divyang suvidha**: candidate par extra time %, scribe note, bada font; exam me apne aap | V2-12 | Niyam aur insaaf | Tests: extra time timer me, note | ✅ ban gaya (2 Oct 2026): `api/src/accommodations.ts`, migration 0053; console `Arrangements.tsx`; web instructions. Section-wise time par extra time sirf poore exam me |
| 64 | **CO39 Candidate status page**: candidate apne link se dekhe: drive me kis round me, test, interview, offer | V2-12 | Recruiter ke phone kam | Tests: sirf apni jaankari, galat link | ✅ ban gaya (2 Oct 2026): `placement.ts` status, `/status/:code`; web StatusPage |
| 65 | **Batch A: jo aadhe hain unhe poora karna** (sabse sasta, pilot me seedha kaam aayega). CL5 console ke pages ke andar ka text Hindi me; CL9 student khud register kare, TPO manzoor kare; CL18 exam ke liye aptitude/reasoning/verbal packs; CL19 sawaal par Bloom level; CO8 SQL sawaal exam ke author flow me; CL6 ek university me kai college/campus | V2-12 | Pilot colleges ki seedhi maang | Har ek ke tests; console aur screenshots | ⬜ baaki |
| 66 | **Batch B: exam ka bharosa**. CL64 online written answers par doosra examiner; CL61 debarred list (kam attendance par exam se bahar); CL20 har candidate ke alag numbers wale sawaal (parameterised); CL34 candidate-code watermark jo photo me bhi dikhe | V2-12, B4 | Leak aur galat marking se bachav | Tests; ek candidate ka paper doosre se alag | ⬜ baaki |
| 67 | **Batch C: company ke roz ke kaam**. CO24 candidates ki side-by-side tulna; CO37 sales role template; CO40 fairness report (branch, college, bhasha); CO43 background verification ko data bhejna; CO11 take-home project (GitHub repo, rubric) | V2-12 | Recruiter ka faisla tez aur saaf | Tests; console; screenshots | ⬜ baaki |
| 68 | **Batch D: college aur company ke beech**. CL53 company ke liye college ka portal (drive request, shortlist dekhna); CL59 student ka verified profile jo company dekhe (student ki manzoori se); CL66 company CRM (contacts, visits, MoU); CL48 maa-baap ko report (student ki manzoori se) | V2-12 | Dono taraf ek hi jagah | Tests, manzoori ka record | ⬜ baaki |
| 69 | **Batch E: interview aur proctoring aage**. CO26 whiteboard interview room me; CO10 video jawab + English speaking score; CO19 awaaz ka viva proxy ke liye; CO20 phone se doosra camera | V2-12 | Remote hiring ka bharosa | Tests; asli phone par jaanch | ⬜ baaki |
| 70 | **Batch F: AI wale** (API key aur evals ke baad). CL17 syllabus se AI draft sawaal; CO12 AI-allowed test (prompts ledger me); CO29 AI pehla round (awaaz, Hinglish); T2 asli model par evals (JD, handwriting, photo); T3 "AI ne sujhaya, X ne manzoor kiya" har jagah ek jaisa | V2-12 | AI se kaam, faisla insaan ka | Evals ke numbers; owner ki manzoori | ⬜ API key ka intezaar |
| 71 | **Batch G: bada data aur score**. CO16 verified talent pool + Parikshaa Score se search; CO25 role benchmark ("top 20%"); CL55 Campus Premier League | V2-12, B3 | Kaafi data ke baad hi sahi | Kaafi students ka data | ⬜ data ka intezaar |
| 72 | **Batch H: paisa aur contract**. CL58 TPO OS free, proctored aur handwritten paid; CO33 pay-per-shortlist, saal ka contract | V2-7 | Kamai | Owner ke prices | ⬜ owner ka faisla |
| 73 | **Batch I: bahar ki manzoori wale**. CL10 APAAR/DigiLocker se verify; CO31 DigiLocker documents; CO4 Naukri/LinkedIn se candidate | V2-12 | Sarkari aur bahar ke partner | Onboarding/API ki manzoori | ⬜ bahar ki manzoori |
| 74 | **Batch J: compliance**. CO35 security questionnaire ka jawab + status page; CO36 pentest, ISO 27001; CO9 frontend/full-stack task browser IDE me | V2-12 | Badi company ka procurement | Auditor; lawyer | ⬜ paisa aur auditor |
| 75 | **M-F1 Production go-live, AWS Mumbai** (shuru: 2 Oct 2026; owner ne chuna: AWS Mumbai, do kadam). **Kadam 1:** ek EC2 VM (ap-south-1) par pilot, pehle se bani `setup-server.sh` se: Terraform VM, Elastic IP, SSH ki jagah SSM, encrypted disk, S3 me raat ka backup. **Kadam 2:** managed setup Terraform se: VPC (2 AZ), RDS Postgres 16 (TLS zaroori, PITR, prod me Multi-AZ, Hyderabad me backup copy), ALB + ACM (HTTPS), API ke servers Auto Scaling me (kam se kam 2 prod me), code runner alag servers par gVisor ke saath (koi bahar ka connection nahi, CPU se autoscale), ECR, Secrets Manager (data key DB backup se alag), SES (email), CloudWatch logs 180 din + alarms; staging aur production. Release script: image ECR me, migration, rolling refresh. Runbook `docs/DEPLOY-AWS.md` | MASTER-PLAN M-F1 | Ek bhi asli user ke bina baaki sab theory hai | `terraform validate` har root module par; runbook ke har kadam ka command; staging par `npm run smoke` (AWS account owner ka); Phase 0 gate: 1 asli exam (500) + 1,000 learners | 🟡 Code taiyaar, apply owner ke AWS account par ([DEPLOY-AWS.md](DEPLOY-AWS.md)). **Kahan:** `deploy/aws/` (bootstrap, pilot, modules/stack, envs/staging, envs/production, scripts), CI ka `deploy` job aur e2e ka "Import as RDS would". **Tests:** pilot 4 + stack 9 (`terraform test`, mocked AWS), scripts 43 (fake AWS), pilot ka DB RDS jaise khaali server me import + har chain verify (CI, har PR). **Baaki:** asli account par pehla apply (staging), uploads S3 me (code badlega), CDN, CI se deploy (M-F2), machine ki memory/disk metrics, SES bounces |
| 76 | **F0 Safai + neev**: handwritten checking, NAAC/NIRF/CO-PO, CIA internal marks, spoken answers hatana (migration ke saath); Supabase (Mumbai) + Vercel + ek VM par shift; uploads Supabase Storage me; preview har PR; Sentry; Supabase Data API ka security check CI me (2 Oct 2026, [LAUNCH-PLAN.md](LAUNCH-PLAN.md)) | LAUNCH-PLAN v2 | Extra features aur bhaari infra hatake, har PR ka live preview | Previews + staging chal rahe; hataye features gaayab; sab tests green | 🟡 Safai ho gayi ([#43](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/43)): handwritten checking, CO–PO, CIA internal marks, spoken answers hataye (13 routes, migration 0055 se tables), NIRF/NAAC ka naam hata kar year-wise placement report rakha. Supabase: Mumbai project, schema, lockdown (migrations 0056, 0058 + test: koi Supabase key table nahi kholti) aur advisor saaf ([SUPABASE.md](SUPABASE.md)). Baaki: Vercel, VM (AWS Mumbai), uploads Storage me, Sentry/PostHog/UptimeRobot jodna |
| 77 | **F1 Hire**: proctoring v2 (secure mode, screen + camera + awaaz, photo ID), AI interviewer (chat + code, phir awaaz), AI-fluency IDE test, 60 role templates, frontend/SQL/take-home sawaal, self-serve kharid, report v2 (2 Oct 2026, [LAUNCH-PLAN.md](LAUNCH-PLAN.md)) | LAUNCH-PLAN v2 | Paying companies | Startup signup → test → shortlist; 10 me se 9 proxy pakde | 🟡 shuru (2 Oct 2026). Hisse rows 84–90 me; 84 (60 role templates) ban gaya |
| 78 | **F2 Campus**: Classes (course → module → content → practice → test → contest, attendance, progress, lab record), admission/scholarship test (rank list), subject-wise coding internal test, TPO dashboard + company sharing (2 Oct 2026, [LAUNCH-PLAN.md](LAUNCH-PLAN.md)) | LAUNCH-PLAN v2 | Colleges ka asli kaam, CodeTantra + Superset ek jagah | Ek class poora semester, ek admission test, ek drive | ⬜ |
| 79 | **F3 UI/UX**: teeno ka ek shell, design system v3, marketing site + help center, LCP < 2 s (2 Oct 2026, [LAUNCH-PLAN.md](LAUNCH-PLAN.md)) | LAUNCH-PLAN v2 | Ek brand | Visual baselines, axe, Lighthouse | ⬜ |
| 80 | **F4 Learn (aakhir me)**: Parikshaa ID, A2Z jaisa DSA path, CS subjects, aptitude, company questions, contests v3, AI tutor v3, discuss, PWA, Free/Plus, 500 problems (2 Oct 2026, [LAUNCH-PLAN.md](LAUNCH-PLAN.md)) | LAUNCH-PLAN v2 | LeetCode/TUF ke muqable | Signup → path → solve → contest → Pramaan; 500 problems | ⬜ |
| 81 | **F5 Rehearsal**: sab flows production jaisa, 5,000 exam + 2,000 contest, crash, restore, security review, `docs/READINESS.md` (2 Oct 2026, [LAUNCH-PLAN.md](LAUNCH-PLAN.md)) | LAUNCH-PLAN v2 | Live se pehle sab ek saath | Readiness report, sab fix | ⬜ |
| 82 | **F6 Asli AI test** (`ANTHROPIC_API_KEY` ke baad): har AI feature ka eval aur `cost-run` (2 Oct 2026, [LAUNCH-PLAN.md](LAUNCH-PLAN.md)) | LAUNCH-PLAN v2 | AI abhi nakli model se tested | Eval reports, pricing pakki | ⬜ |
| 83 | **F7 Live**: production, 3 college pilot, pehli companies, Learn public, `v1.0` (2 Oct 2026, [LAUNCH-PLAN.md](LAUNCH-PLAN.md)) | LAUNCH-PLAN v2 | Live | Asli exam bina incident; v1.0 | ⬜ |
| 84 | **F1a 60 role templates** (F1 Hire). 9 se 60 roles, sirf tech, 7 families (campus, software, web/mobile, data/AI, cloud, quality/security, enterprise); console me role dhoondhna aur family ke groups; support/BPO hataya | LAUNCH-PLAN v2 F1 | Recruiter apna role turant paaye (HackerRank/Mettl ke paas sau se zyada) | Har role ka draft bina model ke bane; tests: 60, har family me 5+, har paper 20–120 min | ✅ ban gaya (2 Oct 2026): `api/src/roles.ts`, `job-test.test.ts`; console `JobTest.tsx` (search + groups). Roles bank ke sawaalon se bharte hain: bank me us vishay ke sawaal na hon to draft saaf batata hai |
| 85 | **F1b Proctoring v2**: secure mode (full screen + copy/paste/tab ka record pehle se; naya: poore test me screen share ki zid, doosri screen ka pata), awaaz ki jaanch (shor/baat ka signal, recording nahi), photo ID aur chehra pehle se (proxy.ts) | LAUNCH-PLAN v2 F1 | 10 me se 9 proxy pakadna | Tests; e2e me screen share na dene par test na khule; owner ke saath 10 proxy ka trial | 🟡 Pehla hissa bana (2 Oct 2026): exam editor me "Secure mode" (poori screen share poore test me; share rukna/dobara shuru aur doosri screen event) aur "awaaz suno" (browser me sirf loudness; kuch record nahi, sirf event). Gate par screen + mic kadam, exam page par "dobara share karo" banner. Kahan: core `ProctoringPolicy.screenShare/audio`, migration 0059, `api/src/proctoring.ts`, web `screen.ts`, `voice.ts`, `proctoring.ts`, `CameraCheck.tsx`; console ExamEditor + Proctoring view. Tests: API 4, web 11, console. Baaki: asli browser me jaanch (Chrome/Edge), 10 proxy ka trial, Hindi ke alawa bhashaon me nayi strings |
| 86 | **F1c AI interviewer (chat + code)**: role aur resume se sawaal, candidate ke code par follow-up, transcript ledger me, scorecard insaan ke liye; awaaz baad me | LAUNCH-PLAN v2 F1 | HackerRank Chakra / HackerEarth ke muqable | Fake model se poora interview test; asli model F6 me | 🟡 Chat + code wala interview bana (2 Oct 2026). Recruiter role (60 me se) ya JD, level, 2–8 sawaal, 10–90 min chunta hai aur candidate ko link bhejta hai. AI ek-ek sawaal poochta hai, har jawab par ek follow-up, phir agla; samay khatam to wahi ruk jaata hai. AI ko candidate ka naam/email/ref kabhi nahi jaata, JD aur jawab `<job>`/`<answer>` me data ki tarah. Transcript hash chain me (badla gaya to console me laal chetavni), candidate ke shabd aur code sealed. Ant me AI har criterion (Problem solving, Technical knowledge, Code quality, Communication) ko 1–5 deta hai, candidate ke apne shabd saboot ki tarah, aur fikr ki baatein; faisla insaan karta hai (scorecard, audit). Kharcha spend cap ke andar (`interview` route). Kahan: migration 0060, store `ai-interview-store.ts`, api `ai-interview.ts`, `ai-interview-routes.ts`, web `components/AiInterview.tsx` (`?ai-interview=`), console `AiInterviews.tsx` (nav "AI interviews"). Model busy ho to candidate "Ask the next question" se dobara poochh sakta hai (jawab bacha rehta hai). Tests: API 7, web 4, console 3. Row 93 me resume se sawaal, email se link aur retention sweep bhi ban gaye. **Baaki**: WhatsApp se link, awaaz, asli model par jaanch (F6), Supabase par 0060 aur 0061 |
| 87 | **F1d AI-fluency IDE test**: AI allowed sawaal, candidate ke prompts aur AI ke jawab ledger me, reviewer ko dikhe kaise use kiya | LAUNCH-PLAN v2 F1 | Aaj ki naukri me AI use hota hai | Tests: prompts ledger me, report me dikhte | 🟡 Pehla hissa bana (2 Oct 2026): author code sawaal par "AI allowed" chunta hai (`CodeQuestion.aiAssist`). Candidate ke code workspace me "AI assistant" tab: sawaal, uska code aur us sawaal ki pichhli baatcheet saath jaati hai; ek sawaal par 20 tak; jawab aane se pehle ledger me naya event `ai_assisted` (prompt, reply, code sealed, answers jaise). Reviewer ko attempt review me "Use of the AI assistant": har sawaal, AI ka jawab, us waqt ka code. Kharcha `assist` route par spend cap ke andar; cap khatam ho to candidate ko "carry on without it" (503), exam nahi rukta. Candidate ke data export (DPDP) me bhi. Kahan: core `domain.ts`/`attempt.ts`, store `sealing.ts`, migration 0062, api `service.ts` (`askAssistant`), `POST /attempts/me/assist`, web `AiAssist.tsx` + `CodeAnswer` tab, console `CodeFields.tsx`, `AttemptReview.tsx`. Tests: core 2, API 4, web 4, console 3. **Baaki**: AI-use ka score/summary (model se "kaise use kiya" ka aakalan), Hindi ke alawa bhashayein, asli model par jaanch (F6) |
| 88 | **F1e Naye sawaal**: frontend (HTML/CSS/JS browser me, tests ke saath), SQL author flow me, take-home (repo link + rubric) | LAUNCH-PLAN v2 F1 | Roles ke sections asli kaam jaise | Har type ka author → candidate → marks test | 🟡 Pehla hissa bana (3 Oct 2026): **take-home**. Author short sawaal par "Take-home" chunta hai (`ShortQuestion.takeHome`). Candidate link (sirf https, host ke saath) aur notes deta hai, jawab `{link, notes}` JSON (core `takehome.ts`); galat link commit par hi mana. Model ise kabhi grade nahi karta (wo repo khol nahi sakta): grading par 0, method `person`; console Marking me link (dobara jaanch ke baad hi clickable) aur notes, "0 jab tak aap marks na den"; marks `score_revised` se, audit ke saath. Kahan: core `takehome.ts`, `scoring.ts`, `candidate-view.ts`; api `service.ts` (commit par jaanch), `marking.ts`; web `TakeHome.tsx`; console `QuestionFields.tsx`, `Marking.tsx`; strings 11 bhashaon me. Tests: core 3, API 2, web 3, console 2. **Baaki**: frontend sawaal (browser me HTML/CSS/JS + tests; runner me headless browser chahiye), SQL author flow (ek baar tables, reference query se expected output), results me "insaan ke marks baaki" ka nishaan |
| 89 | **F1f Startup ka self-serve rasta**: signup → role chuno → test bhejo → shortlist, ek flow; credits kharid (Razorpay pehle se) | LAUNCH-PLAN v2 F1 | Bina sales call ke paying company | e2e: naya org 10 minute me test bheje aur shortlist banaye | ✅ ban gaya (3 Oct 2026). Signup par "Hum hain: college / company" (`organisations.kind`, migration 0063; `/auth/me` aur dashboard me `kind`). Company ke home par "Hire in four steps" card (`console/src/components/Home.tsx` `HirePath`): 1 role chuno (role library drawer), 2 candidates bulao, 3 results, 4 shortlist link; har kadam dashboard ki ginti se tick (`setup.finished`, `setup.shortlists` naye), sab ho jaye to card hat jata hai. Khaali bank ke liye **starter sawal** ek click me (`POST /onboarding/starter`, `onboarding.ts` `STARTER_QUESTIONS`): practice packs ke 80 CS fundamentals MCQ aur 40 DSA coding sawal (tests ke saath), role ke shabdon par tag. Credits wahi purana banner + Razorpay kharid. Tests: `api/src/self-serve.test.ts` (naya company org: signup → starter → SDE intern role se test → 2 candidates → asli runner par code grade → shortlist link, 10 min se kaafi kam), console `Onboarding.test.tsx` (+5), browser `e2e/tests/onboarding.spec.ts` (company signup → starter → role se test, axe dono theme). Screenshots: `docs/screenshots/hire-01…07` (`e2e/screenshots/hire-campus.shots.ts`). **Baaki:** starter me aptitude/reasoning/verbal sawal nahi (in sections wale roles ka pool chhota rahega, draft chetavni deta hai); starter sawal public practice ke hain, asli round me apne sawal milao; browser e2e invite se shortlist tak nahi jata (woh API test me hai) |
| 90 | **F1g Candidate report v2**: ek page: score, sections, code, integrity signals, viva, AI use; PDF aur share link | LAUNCH-PLAN v2 F1 | Hiring manager ka faisla ek jagah | Tests; screenshot | ✅ ban gaya (3 Oct 2026). `api/src/candidate-report.ts`: report me **AI use** (har sawaal par prompts, `results.ts` `aiUse`); poori report ka **PDF** `/attempts/:id/report.pdf` (pehla page faisle ka: marks, percent, rank, qualifying, sections bar, har sawaal tests aur AI prompts ke saath, proctoring ki observations, follow-up sawaal, AI use; phir har program, 60 line tak); hiring manager ke liye **share link** `POST /attempts/:id/report-link` (1–30 din, `org.attempt.expiry.mac`, kahin store nahi, audit `report.shared`), public `/reports/:code` aur uska PDF: email nahi, MCQ/likhit jawab nahi, sirf code; expire par "expired", set aside/erase par "withdrawn", galat link par throttle. Web `?report=` page (`PublicPages.tsx` `ReportPage`); console Scorecard me "Report PDF", "Share with a hiring manager" (din chuno, link copy) aur AI use card. Tests: API `candidate-report.test.ts` (7: AI use, PDF, link, expiry, forged/badla hua link, withdrawn, kaun bana sakta hai, lambe paper ka PDF), web 2, console 1; screenshot `docs/screenshots/college-09-candidate-report.png`. **Baaki:** link ko beech me wapas lene ka tareeka nahi (expiry ya result set aside hi rokta hai); PDF me Helvetica hai, Hindi naam/code ke non-Latin akshar sahi nahi chhapte |
| 91 | **Purane app ki problems laana** (owner ne 2 Oct ko kaha: Singapore Supabase ka kaam ka data naye project me). 1,260 problems: statement, tests (sample/hidden), starter code, reference solution → hamari practice problems (stdin program, wahi tests). Bina tests wali unpublished, wajah ke saath; dobara chalao to update, duplicate nahi; site ki apni problem nahi chhooti | Faisle: purana data | Owner ka content bekaar na jaaye; Learn ko 778 judge hone wali problems turant | Tests: mapping, dry run, idempotent, slug takraav; asli source par dry run | 🟡 Importer bana aur tested (2 Oct 2026): `api/src/legacy-import.ts`, `legacy-import-cli.ts`, workflow `.github/workflows/legacy-import.yml`. Source par SQL se ginti: 778 publish, 482 bina tests. Baaki: owner ke do GitHub secrets, phir dry run aur asli run; import ke baad reference solutions ko runner par chala kar jaanchna |
| 92 | **Purane learners laana** (28 accounts) + learner ka "password bhool gaye" (email link) | Faisle: purane learners | Purane users ka account aur unke solve | Tests: reset link ek baar, 30 min; import par soochna email; solve history | ⬜ Email provider aur reset flow ke baad |
| 93 | **F1c-2 AI interviewer v2** (row 86 ko poora karna): (a) candidate ko link email se (outbox, "interview" kind, cancel par bhi mail); (b) retention sweep: khatam/cancel interviews aur kabhi na shuru hue purane invite, transcript ke saath, org ki retention ke hisaab se; (c) resume se sawaal: recruiter resume paste kare (sealed), model ko bhejne se pehle naam, email, phone aur profile links hata diye jaayein, `<resume>` me data ki tarah | LAUNCH-PLAN v2 F1 | Recruiter ko link copy karke bhejna na pade; purana data na bache; sawaal candidate ke kaam par | Tests: email outbox me aur cancel par skip; sweep sahi rows hatata hai; model ke prompt me resume ka kaam hai par naam/email/phone nahi | ✅ ban gaya (2 Oct 2026): migration 0061 (`resume`, sealed); `api/src/ai-interview.ts` (`redactResume`, `deliver`, email outbox "interview" kind ke purpose `ai_invite`/`ai_cancel`), `AiInterviewStore.sweep` (retention me `ai_interviews`); console me resume ka khaana aur transcript ke upar resume. Tests: `ai-interview-v2.test.ts` (6), console. Kami: WhatsApp se link abhi nahi (Meta template chahiye); naam ke alawa resume me koi aur pehchaan (college ka naam, pata) model tak ja sakti hai |
| 94 | **Migrate workflow** (owner ne 2 Oct ko kaha): connector ki manzoori 60 s me nahi pahunchti, isliye GitHub Actions se `npm run migrate`; dry run pehle; khaali secret par saaf error | F0 (Supabase) | Mumbai DB me baaki migrations | Test: `pendingMigrations` kuch likhta nahi, sahi list deta hai | ✅ ban gaya (2 Oct 2026): `.github/workflows/migrate.yml`, `store/src/migrate.ts` (`pendingMigrations`), `migrate-cli --dry-run`; test `migrate.test.ts`. Asli run owner ke secret par ruka hai |
| 95 | **F2a Classes (staff ka hissa)**: class = practice site ka cohort + course (track: modules, lessons, problems) + tests (exams) + contests; sessions aur attendance; class ka dashboard: har student ka course progress, har test ka %, contest me solve, attendance % | LAUNCH-PLAN v2 F2 | College ki class ek jagah (CodeTantra jaisa) | Tests: class banana, test/contest jodna, attendance, progress sahi; console page | ✅ ban gaya (3 Oct 2026). Migration `0064_classes.sql` (classes, class_tests, class_contests, class_sessions, class_attendance; RLS staff-only, learner ko kuch nahi dikhta); `store/src/class-store.ts` (progress: track ke lessons padhe aur problems solve, har contest me solve, attendance); `api/src/classes.ts` + `classes-routes.ts`: `/classes` (list, banana, options), `/classes/:id` (har student ek line: course %, har test ka % (email se, best graded attempt), har contest me solve, attendance), `PUT /classes/:id` (course, tests, contests), sessions aur `PUT …/attendance`; marks sirf `attempt:review` wale ko; audit `class.created`/`class.updated`. Console "Classes" page (nav me, Hindi label): class banana, students table, tests/contests chunna, session jodna aur haazri (sab ticked se shuru, gair-haazir hatao). Tests: API `classes.test.ts` 3, store `class-store.test.ts` 2 (RLS samet), console `Classes.test.tsx` 5. Screenshots: `campus-01-classes`, `campus-02-class-page`. **Baaki:** student ko apni class practice site par nahi dikhti (row 96); attendance CSV/report download nahi; test ka % email match par hai, roll number par nahi |
| 96 | **F2b Class ka student hissa + lab record**: practice site par "Meri classes" (course, aane wale test/contest, apni attendance); lab record (har practical ka program aur output, teacher ka sign-off, PDF) | LAUNCH-PLAN v2 F2 | Student ko ek jagah sab | Tests; screenshot | ✅ ban gaya (3 Oct 2026). Practice site par `GET /practice/:site/classes` ("Meri classes": course ka link, tests, contests, har session ki apni haazri, lab ki pragati) aur web par `/classes` page + dashboard par "Aapki kakshaen" card (`web/src/practice/ClassPages.tsx`); sirf **verified email** wale learner ko (koi bhi kisi ka email daal kar signup kar sakta hai). **Lab record**: class ke course ka har coding problem ek practical, student ka aakhri pass hua program aur tests; teacher ka sign-off (migration 0065 `class_lab_signoffs`, staff-only RLS, audit `class.lab_signed`/`class.lab_unsigned`); student aur staff dono ke liye PDF (`classes.ts` `drawLabRecord`). Console me har student ka "Lab record" drawer: program dekho, sign off / wapas lo, PDF. Tests: API `class-lab.test.ts` 3 (verify se pehle kuch nahi, bahar wale ko kuch nahi, sign-off, PDF, asli runner), store RLS, web 4 + routes, console 1. **Baaki:** lab record me program ka output (sirf tests kitne pass) nahi; practical ka "aim/theory" likhne ki jagah nahi. Screenshots: `docs/screenshots/campus-01…05` |
| 97 | **F2c Admission/scholarship test**: bada scale (open link se registration), rank list (tie ka niyam), result publish, scholarship slab | LAUNCH-PLAN v2 F2 | College ki admission ki kamai | 5,000 candidate ka rank list test | ⬜ |
| 98 | **F2d Subject-wise coding internal test**: subject → har unit ka coding test, marks class me; teacher ke liye ek click se test | LAUNCH-PLAN v2 F2 | Internal coding exam (CodeTantra) | Tests | ⬜ |
| 99 | **F2e TPO dashboard + company sharing**: class/batch ka placement readiness, company ke saath student profile/shortlist share (student ki manzoori se) | LAUNCH-PLAN v2 F2 | Superset jaisa | Tests; screenshot | ⬜ |
| 100 | **G0 Neev + staging** (F1 go-live, 3 Oct 2026, [F1-GO-LIVE-PLAN.md](F1-GO-LIVE-PLAN.md) §8): uploads (photos, ID, snapshots) DB se Supabase Storage me; API + worker ka Docker compose (Caddy) Mumbai VM par; GitHub Actions se staging deploy + smoke, production manzoori ke saath; Vercel par web aur console (har PR ka preview); pooler (transaction mode) ke peeche RLS ka test; Data API band ka test; Sentry + uptime | LAUNCH-PLAN F0/F1 | Owner staging par khud test kar sake; video/recording ke liye Storage zaroori | Staging URL par login + exam + smoke green; PR preview; Storage tests | 🟡 code ban gaya (3 Oct 2026), tests ke saath; asli staging owner ke accounts ke baad ([STAGING.md](STAGING.md)) |
| 101 | **G1 Company ID + operator panel** ([F1-GO-LIVE-PLAN.md](F1-GO-LIVE-PLAN.md) §3): har organisation ka `PKC-XXXXXX` ID; console me operator panel (companies ki list, nayi company + owner ko invite email, credits, suspend/resume, audit); company profile (logo, default proctoring level, recording retention); hiring manager ka sirf-apne-tests scope | LAUNCH-PLAN F1 | Owner ne maanga: har company ka ID aur dashboard | Tests: sirf operator banaye, invite ek baar, suspend par sign-in band, ID unique; screenshots | 🟡 ban gaya (3 Oct 2026): ID, operator panel, invite, pause/resume, credits; company profile aur hiring manager scope baaki |
| 102 | **G2 Parikshaa Library** ([F1-GO-LIVE-PLAN.md](F1-GO-LIVE-PLAN.md) §4): global `library_questions`/`library_sets` (versioned), console me browse (type, topic, difficulty, language, role), "Add to my bank" copy + version link, Hire-only tier (practice par kabhi nahi), exposure ginti, role sets; maujooda packs library me; purane 1,260 problems ka review queue (row 91) | LAUNCH-PLAN F1 | Company library se SDE/DSA/MCQ/aptitude sawaal le ya apne banaye | Tests: RLS (sirf content team likhe), copy aur version, Hire-only practice me na dikhe; screenshots; content target §4.2 content team par | 🟡 ban gaya (3 Oct 2026): library, browse, add/pick, versions, hire-only tier, exposure, operator tools, 165 sawaal; aptitude/frontend content, role sets, legacy review queue baaki |
| 103 | **G3 Judge0 backend** ([F1-GO-LIVE-PLAN.md](F1-GO-LIVE-PLAN.md) §5.1–5.3): `Judge0CodeRunner` maujooda `CodeRunner` ke peeche (`RUNNER_BACKEND`), batch + poll, verdict/checker hamare `judge.ts` me; apna compiler image (Python 3.12, Node 20, Java 21, GCC 13, Go, Rust, Kotlin, C#, TS, SQLite); alag hardened VM (cgroup v1, network band, callbacks band, token); gVisor fallback; parity suite | LAUNCH-PLAN F1 | Owner ne maanga: Judge0 se apna LeetCode jaisa compiler | Fake Judge0 se unit tests; staging par parity 0 farq, 1,000 ka load p95 < 5 s, Judge0 band par fallback | 🟡 code + tests ban gaye (Platform table ki row); image build, Judge0 VM aur staging par parity run owner ke AWS/GHCR ke baad |
| 104 | **G4 LeetCode jaisa IDE** ([F1-GO-LIVE-PLAN.md](F1-GO-LIVE-PLAN.md) §5.4): har sawaal ke kai bhashaon ke starter, custom input, har test ka runtime/memory, attempt me submissions ki history, code playback, bade paste ka sanket, test groups, author wizard (signature → starters, reference se expected output) | LAUNCH-PLAN F1 | Coding test candidate ko LeetCode jaisa lage. Survey (3 Oct): custom input, runtime/memory, hidden test ka sirf pass/fail, reset, font size, dark, full screen pehle se hain. Do hisse: **G4a** (ab): attempt me har sawaal ki submissions ki history (purana code dekhna/wapas laana), code playback (editor ki timeline, reviewer console me chala kar dekhe), bade paste ka sanket, author ke liye reference program se expected output bharna aur saare tests chalana. **G4b** (baad me): test groups (subtask), nayi bhashayein (Go, Kotlin, C#, Rust, TS) dono runner me, editor keymaps (vim/emacs), report me runtime/memory + playback link | Har feature ka test; screenshots. G4a: history, playback aur reference-run API + console/web tests ke saath | 🟡 G4a ban gaya (Platform table ki row); G4b baaki |
| 105 | **G5 Strict proctoring** ([F1-GO-LIVE-PLAN.md](F1-GO-LIVE-PLAN.md) §6.1): full screen ki zid (overlay, ginti, optional band), browser me chehra jaanch (MediaPipe, lazy chunk: koi nahi / do chehre / mudna), frame kahin nahi jaata | Row 85 | Proctoring level 2 | Tests; Chromium/Firefox/Safari/Edge par jaanch | ⬜ owner ki haan |
| 106 | **G6 Live video + recording** ([F1-GO-LIVE-PLAN.md](F1-GO-LIVE-PLAN.md) §6.2): LiveKit (`LiveVideo` interface), candidate publish-only, proctor subscribe-only token; console me proctor wall (grid, warning, flag); Egress se Supabase Storage me recording, retention sweep, report me clips; kharab net par snapshot mode; sahmati screen | Row 85 | Owner ne maanga: live video capture | Token adhikaar, retention delete, report link ke tests; staging par 50 headless candidates | ⬜ owner ki haan + LiveKit account + retention ki haan |
| 107 | **G7 Third eye (phone camera)** ([F1-GO-LIVE-PLAN.md](F1-GO-LIVE-PLAN.md) §6.3): QR (signed, 5 min, ek baar), phone par `/eye/<code>`, piche ka camera, Wake Lock, lagane ki guide + preview, room scan, LiveKit ya lite (photos), toota connection ki ghatnaayein | Row 85, Batch E (CO20) | Owner ne maanga: third eye | Tests (mobile emulation); owner ke Android + iPhone par jaanch | ⬜ owner ki haan |
| 108 | **G8 Safe Exam Browser lockdown** ([F1-GO-LIVE-PLAN.md](F1-GO-LIVE-PLAN.md) §6.4): exam ki `.seb` config, Config Key hash ki server par jaanch (header aur JS API), SEB na ho to guide page | Row 85 | Owner ne maanga: secure browser | Hash sahi/galat/missing tests; Windows + Mac par asli SEB | ⬜ owner ki haan |
| 109 | **G9 F1 poora + live** ([F1-GO-LIVE-PLAN.md](F1-GO-LIVE-PLAN.md) §6.5, §7, §9): frontend sawaal + SQL author flow (row 88), AI-fluency rubric (row 87), 10-proxy trial, 1,000 ka exam load test, security review (Judge0 escape tests, token adhikaar), runbook, production deploy, 3–5 pehli companies | LAUNCH-PLAN F1/F7 | F1 live | 9/10 proxy pakde; readiness green; pehla asli test bina incident | ⬜ owner ki haan + prices + pehli companies |
| 110 | **Hire v2: job post se offer tak, poora** (owner ne 12 Oct 2026 ko kaha: pehle ye banao aur launch karo; Learn, TPO aur scholarship iske baad). Company job post kare → log apply karein → AI screen karke shortlist sujhaaye → test/interview link email par → monitoring aur cheating ki pehchaan → sirf genuine aur achhe aage → rounds → offer; candidate, company aur platform admin teeno ke pages. Hisse rows 111–120 me. Design: [HIRE-V2.md](HIRE-V2.md), aage kaise badhna hai: [HIRE-HANDOFF.md](HIRE-HANDOFF.md) | Owner, 12 Oct 2026 ([HIRE-V2.md](HIRE-V2.md)) | Pehli paying company ka poora hiring cycle ek portal par | Ek company: job post → 50 applicants → AI screen → test → interview → offer accept → hired, sab portal par; candidate apne portal par har kadam dekhe | 🟡 shuru (12 Oct 2026): design, code map, plan rows |
| 111 | **H1 Candidate accounts**: email code se sign-in (password nahi), sessions, profile, resume (PDF/DOCX se text), apna data download aur account delete | Owner, 12 Oct 2026 ([HIRE-V2.md](HIRE-V2.md)) | Candidate apni saari applications ek jagah dekhe; email pakka ho | Tests: code ki koshishein aur expiry, dusre candidate ka data nahi, resume parse, delete par har company ki copy se PII hate | 🟡 H1a ban gaya (12 Oct 2026), tests ke saath: email code se sign-in (password nahi; code aur email dono DB me nahi, sirf HMAC/blind index; 5 koshish, 10 min, limits), sessions (tab ke liye 12 ghante, "is device par yaad rakho" 14 din), sealed profile, data export, step-up code se account delete, 3 saal ke unused account ki chetavni aur 30 din baad delete. Applicant scope kisi company ki table nahi padh sakta. H1b (resume) bhi ban gaya: PDF/DOCX 2 MB tak, text alag worker me (pehle 10 pages, 60 000 akshar, password wali PDF aur macro wali Word file mana, zip bomb ruk jaata hai), file sealed hokar storage bucket me (bucket na ho to DB me). Kahan: migration `0070_candidate_accounts.sql`, `store/src/candidate-store.ts`, `api/src/candidates.ts`, `api/src/candidate-routes.ts` (`/candidate/*`), `api/src/resume.ts` + `resume-worker.ts`. Baaki: delete par har company ki copy hatana (H2d, jab applications banenge), web ke pages (H9) |
| 112 | **H2 Jobs + apply + pipeline**: job (skills, experience, CTC, openings, screening sawaal + knockout), rounds ka kram, publish/pause/close, public job page, careers page, apply (account + consent), pipeline, aage badhana/reject, timeline, notes, mails | Owner, 12 Oct 2026 ([HIRE-V2.md](HIRE-V2.md)) | Drives college ke liye hain (roll no., CGPA); company ko alag model chahiye | Tests: do org alag, applicant sirf apna dekhe, knockout, ek job me ek baar apply | 🟡 H2a ban gaya (12 Oct 2026), tests ke saath: migration 0071 (saari Hire tables, baad ke slices ke status bhi), naye roles recruiter aur hiring manager (manager sirf apni jobs dekhe, exams kuch nahi), job likhna (screening sawaal; umar/shaadi/dharm/jaati/viklangta par knockout mana), rounds ka kram, publish (job ka address ek baar milta hai)/pause/close/copy/draft delete. Jab tak Parikshaa company verify na kare: 2 open jobs, 100 applications, AI screening band, paise maangne wali JD hold. Kahan: `store/migrations/0071_hire.sql`, `store/src/hire-store.ts`, `api/src/hire.ts`, `api/src/hire-routes.ts` (`/hire/jobs*`). H2b bhi ban gaya (12 Oct 2026), tests ke saath: public job page aur careers page ka data (draft/held/suspended company → 404), apply se pehle notice (English + Hindi: AI, data Bharat se bahar, kitne din, shikayat kise; hash consent ke saath), apply (last din 23:59 IST tak, unverified company par 100, roz 20, ek job par ek insaan ki ek application chahe email ko dots/plus se badlein, knockout par application wahin khatam, reject ke baad 90 din baad dobara), har application me profile aur resume ki sealed copy, candidate ka portal (har kadam: intezaar / aapki baari / ho gaya / aage nahi; score ya note kabhi nahi), withdraw, mails (company suspend ho to ruk kar baad me jaati hain). Kahan: `0072_hire_apply.sql`, `store/src/hire-application-store.ts`, `api/src/hire-apply.ts`, `api/src/hire-messages.ts`, `api/src/hire-apply-routes.ts` (`/hire/public/*`, `/candidate/applications*`). H2c bhi ban gaya (13 Oct 2026), tests ke saath: pipeline (ek query me job ki saari applications: har round ki haalat aur score, AI ki raay, integrity, "is kadam me kitne din"; round/status/naam/AI raay/integrity/SLA ke filter; 1 000 applications 1 s se kam me), aage badhana aur reject (ek saath 200 tak, har ek ka jawab ki hua ya kyon nahi; reject par P20 wajah zaroori; AI ki raay se chuni list ko reject karne par likhit wajah), integrity high wale ko aage badhane par likhit wajah (10+ akshar, alag private event aur audit), restore (withdraw kabhi nahi; usi insaan ki nayi application ho to mana), private notes, candidate ko message (portal me thread), timeline. Mails: "<Company> via Parikshaa" aur reply job ke contact par; rejection mail 24 ghante baad, koi wajah nahi, job ki apni ek line; us din me restore ho to mail nahi jaati aur portal par rejection dikhti hi nahi. Jab tak company verify na ho: staff ka likha koi shabd mail me nahi, resume download nahi. Viewer ko email/phone/jawab/resume nahi; hiring manager sirf apni jobs. Kahan: `0073_hire_pipeline.sql`, `store/src/hire-pipeline-store.ts`, `api/src/hire-pipeline.ts`, `api/src/hire-pipeline-routes.ts` (`/hire/jobs/{jobId}/applications*`, `/hire/applications/*`), `api/src/hire-messages.ts`, `api/src/delivery.ts` (`replyTo`, `fromName`). Baaki: erasure, retention aur import/claim (H2d), console UI (H8), web pages (H9) |
| 113 | **H3 AI screening**: resume vs JD; har skill par resume se seedhi line (server jaanchta hai ki wo line resume me hai), score server ka formula, knockout, resume me AI ko diye hukm pakadna | Owner, 12 Oct 2026 ([HIRE-V2.md](HIRE-V2.md)) | Sainkdon applicants me se pehli chhatni | Tests: banaayi hui evidence hat-ti hai, score formula, injection, spend cap | ⬜ |
| 114 | **H4 Rounds + offer**: test bhejna (job ke din), nateeje wapas, AI interview, live interview + panel, hiring manager review, offer (letter PDF, link, expiry), accept/decline, hired, "job band karo aur baaki ko batao" | Owner, 12 Oct 2026 ([HIRE-V2.md](HIRE-V2.md)) | Shortlist se offer tak ek hi jagah | Tests: har round ka settle, offer ek baar, expiry | ⬜ |
| 115 | **H5 Genuineness (integrity)**: 12 nishaan (photo, proxy, tab/paste, similarity, viva, bahut tez, duplicate, resume injection, claim vs test, AI interview concerns…), level clear/review/high, insaan ka "genuine" faisla, high ko aage badhane par likhit wajah; overall score, compare, job report | Owner, 12 Oct 2026 ([HIRE-V2.md](HIRE-V2.md)) | "Sirf genuine candidate aage" | Har nishaan ka test; koi bhi apne aap reject nahi | ⬜ |
| 116 | **H6 Naye sawaal**: AI sawaal ka draft banaye (MCQ, numeric, code), code ka reference program runner par chal kar tests banaye, insaan manzoor kare tabhi test me; kaunsa sawaal kitni baar use hua | Owner, 12 Oct 2026 ([HIRE-V2.md](HIRE-V2.md)) | Har job ke liye taaza sawaal, leak kam | Tests: draft test me nahi jaata, fail hone wala code draft girta hai | ⬜ |
| 117 | **H7 Platform admin (operator)**: G1 wala operator panel hi badhega (alag login nahi; staff + `PARIKSHAA_OPERATORS` + 2FA pehle se hai), companies ki list aur ginti, verify/suspend ka Hire par asar, job ki shikayatein (fake job hatana), candidate dhoondhna aur data mitana, hafte ke figures | Owner, 12 Oct 2026 ([HIRE-V2.md](HIRE-V2.md)) | Parikshaa ki taraf se sab sambhalna, fake jobs se candidates ki hifazat | Tests: operator ke bina koi cross-org read nahi, suspend ka asar | ⬜ |
| 118 | **H8 Console "Hiring"**: jobs, job editor, pipeline board + table, candidate drawer, compare, job report, AI drafts, company home ke steps | Owner, 12 Oct 2026 ([HIRE-V2.md](HIRE-V2.md)) | Recruiter aur hiring manager ka roz ka kaam | Component tests, bundle budget, screenshots | ⬜ |
| 119 | **H9 Candidate ka portal (web)**: job page, careers page, apply, `/my` (applications, har round, test/interview/offer link, withdraw, profile, privacy) | Owner, 12 Oct 2026 ([HIRE-V2.md](HIRE-V2.md)) | Candidate ko har kadam pata ho | Component tests, bundle budget, phone par | ⬜ |
| 120 | **H10 Poora flow e2e + docs**: Playwright me signup se hired tak, screenshots, SECURITY.md/SPEC.md me candidate aur operator accounts | Owner, 12 Oct 2026 ([HIRE-V2.md](HIRE-V2.md)) | Launch se pehle saboot | e2e green, screenshots | ⬜ |
| 121 | **Learn ko takeUforward ke barabar, apne content se**: engine zyaadatar ✅ hai; kami content ki: apna DSA path (~450 items, apna kram), content pipeline (AI draft → runner par jaanch → insaan ki manzoori), chhoti sheets, CS subjects ke lessons + SQL 50 + aptitude, LLD, video, Learn me AI mock interview. Poori tulna, "TUF se behtar kya" (research 18 Oct: mass-recruiter mocks, dry-run player, micro-viva/Pramaan, Hinglish, sasta AI mock), agle 10 saal ke daav (AI ke saath code, samajh ka saboot, Open Badges 3.0 Pramaan, mastery model, problem variants, awaaz/bhasha) aur slices L1–L20: [LEARN-TUF-GAP.md](LEARN-TUF-GAP.md) | Owner, 18 Oct 2026 (row 80 F4 Learn ka content hissa) | Students ke liye TUF ka free/sasta, Hindi wala vikalp | L1 path owner ne manzoor kiya; DSA 450 problems live, har ek par editorial + hint, CI me runner par hare | ⬜ sirf plan (18 Oct 2026); build Hire ke baad (owner) |
| 122 | **Build Labs: bana kar seekho, live environment me**: projects jo ship hon + specialisation tracks (Foundations, Web/full-stack, Data, AI/ML, Cloud/DevOps, Security). Teen tarah ke environment: browser (Pyodide/JupyterLite, SQL WASM; server kharch lagbhag ₹0), runner stages (hamara gVisor runner, CodeCrafters jaisa), live microVM lab (terminal, editor, ports, Docker/k3s; provider adapter). Har step par check script, hint ladder, "samjhao" sawaal; progress events, teacher/TPO heatmap, Pramaan bahar grading se; Campus aur Hire se jod. Plan: [LEARN-BUILD-LABS.md](LEARN-BUILD-LABS.md) | Owner, 18 Oct 2026 (row 121 ka F8/F9) | Hands-on seekhna; freshers me "shipped work" ki maang | P0: 6 labs live (3 build-your-own + 3 data), progress dashboard, reference solutions CI me pass | ⬜ sirf plan (18 Oct 2026) |
| 123 | **Poora platform end-to-end: roadmap, content factory, kharch aur samay**: bacha kaam ~80 slices (Hire, go-live, Campus, UI, Learn L4–L20, Build Labs, launch); owner ka ek-baari aur hafte ka kaam; connectors/MCP/skills; content factory (AI draft → runner/solver se machine jaanch → duplicate jaanch → 5–10% insaan) DSA 450→1,000, aptitude 5,000, CS lessons + MCQ, mocks, labs; tokens, $200 plan par mahine, mahine ka infra aur AI bill, ek-baari kharch. Poora: [ROADMAP-END-TO-END.md](ROADMAP-END-TO-END.md) | Owner, 18 Oct 2026 | Owner ko ek jagah dikhe ki kya bacha, kitna samay aur kitna kharch, aur unse kya chahiye | Owner §2a ki list poori kare; content factory ka code + pehla 50 DSA batch machine-check pass | ⬜ sirf plan (18 Oct 2026); Hire pehle (owner) |
| 124 | **Learn launch: platform, content, judge, AI model, kharch**: TUF ke platform-features video ka frame-by-frame map aur hamare code se tulna; MVP scope (DSA 300→450, aptitude module + 1,500→5,000 sawaal, CS core lessons, SQL 50, Sahayak, Hindi/Hinglish); judge (in-house gVisor runner primary, Judge0 doosra; queue API se bahar, autoscale, compile cache, ek submission ~₹0.005–0.01); teen padaav (2k/20k/1 lakh DAU) par mahine ka kharch; AI: Haiku 5.5 default (~₹0.03/hint), apna GPU model sirf 1 crore+ requests aur eval pass hone par, embeddings open-source CPU par; brand/UI v2 (dark-first marketing, apna mascot); 8–10 hafte me public launch. Poora: [LEARN-LAUNCH-PLAN.md](LEARN-LAUNCH-PLAN.md) | Owner, 19 Oct 2026 (rows 121–123 ka launch hissa) | Learn jaldi launch karna | Private beta (300–500 students) chale; judge p95 < 5 s staging par; Sahayak eval pass; DSA 300 + aptitude 1,500 live | ⬜ sirf plan (19 Oct 2026); priority owner tay karein (Hire ya Learn) |
| 125 | **Learn v2: poora platform + poora content** (owner ne Learn ko Hire se pehle kiya): 5,000 coding (A2Z 520, interview bank 2,480, CP 2,000; apne statements/tests, Polygon jaisa package), lamba editorial (owner ki PDF wali style; PDF abhi nahi mili, template LEARN-V2 §3c), code se bane sketch-style visuals, 5,000 aptitude, DBMS/OS/CN/OOPs, LLD/HLD/patterns, 6 languages, CP math, SQL 300; judge v2 (queue bahar, testlib, interactive, PyPy); 18 "behtar" features (chhota galat test, complexity jaanch, mistake notebook…); poora admin panel; architecture + security; text-only launch, video + DRM phase 2. Design: [LEARN-V2.md](LEARN-V2.md), kaam: [LEARN-HANDOFF.md](LEARN-HANDOFF.md) (~55 slices) | Owner, 19 Oct 2026 | Learn jaldi aur poora | Sample-first (10+10+2) owner manzoor kare; launch content (1,500 coding, 2,000 aptitude, CS lessons) live; private beta hafta 8; public launch hafta 10–11 | ⬜ design ✅ (19 Oct 2026), build shuru: LV-F3 |
| 126 | **Roadmaps + AI tutor + AI courses (roadmap.sh jaisa, apne content se)**: owner ne roadmap.sh ke Pro features aur `nilbuild/developer-roadmap` diya. Uska licence content sirf niji istemaal ke liye deta hai, isliye unke roadmaps/text/images nahi; features apne: 15 role + 20 skill roadmaps (har node par hamara lesson, problems, quiz, lab, Pramaan), custom roadmap editor (free 3, Plus 100), AI roadmap, AI courses/guides (maangne par, dedupe, "Expert ne jaancha" label), unlimited quizzes, Plus me unlimited Sahayak (fair use), chat history ki marzi, "Plus beta". Design: [LEARN-V2.md](LEARN-V2.md) §4b, slices LV-M1–M8 ([LEARN-HANDOFF.md](LEARN-HANDOFF.md)) | Owner, 19 Oct 2026 | roadmap.sh se behtar: roadmap ke har node par practice, judge, labs aur Pramaan; Hindi; Bharat ke career raaste; Campus/Hire se jod | 35 roadmaps live, custom editor, AI course + quiz, fair-use metering tests ke saath | ⬜ sirf plan (19 Oct 2026) |
| 127 | **Code Studio + guided labs + har technology ke arenas**: browser me VS Code jaisa IDE (CodeMirror 6, files, terminal, preview, tests, checkpoints); har step par likho → run → test → submit; 13 arenas (JS, frontend/React, backend/Node, SQL, Python, DS, ML, DL/GenAI, Java/Spring, Go, DevOps, LLD, HLD); 13 graders (unit, http, Playwright dom, visual, a11y, sql, dataframe, metric, notebook, script, simulator, metrics, AI rubric sirf salah); HLD ke liye design canvas + simulator. Design: [learn/CODE-STUDIO.md](learn/CODE-STUDIO.md), slices LV-K1–K12, LV-X1–X12 | Owner, 19 Oct 2026 | Learning by doing, har technology me LeetCode jaisa | Studio core + web preview + Pyodide + guided lab engine live, 1 React aur 1 data lab poore; starter fail/solution pass har lab par | ⬜ sirf plan (19 Oct 2026) |
| 128 | **Content catalog**: ~65 courses (shuruaat, DSA/CP, CS core, languages, web, data/AI, DevOps, system design, career), ~2,200 lessons, ~320 guided labs, ~2,800 arena problems, ~550 articles (Indian apps ka system design, placement guides, hamare data se), 60 cheat sheets; har type ka design template; launch par ~20 courses. Saath me "aur kya planning baaki hai" ki list (19 hisse). Design: [learn/CONTENT-CATALOG.md](learn/CONTENT-CATALOG.md), [learn/OPEN-PLANNING.md](learn/OPEN-PLANNING.md), slices LV-W1–W5 | Owner, 19 Oct 2026 | Poora content ek jagah, kram ke saath | Launch ke 20 courses live, 30 articles, cheat sheets 10 | ⬜ sirf plan (19 Oct 2026) |
| 129 | **All-in-one platform: seekho, practice, banao, saboot, muqabla, career, saath**: research (Boot.dev, Scrimba, Exercism, Frontend Mentor, Hyperskill, Unstop, PNAS 2025 AI-tutor study, 97% gharon me phone par 7% me computer) se 25 nayi cheezein: phone-first (Parsons, output predict, Daily 10), code-casts, project briefs + Ship it, hackathons, mentors, proctored certificates, career hub (resume, portfolio, jobs), peer mocks, cohorts, gamification v2 (league), skill graph, AI ke do mode (seekhne me jawab nahi, banane me poori madad), forum, college chapters, college lab mode, GitHub jod, wellbeing, AI ka label. Har page ka UX (10 niyam, dhaancha, phone, naap: SUS ≥ 80). Launch kharch: lean ~₹5.2 lakh, beech ~₹15–20 lakh, poora ~₹33 lakh; build ~140 sessions (ek account mix ~4–5 mahine). Design: [learn/ALL-IN-ONE.md](learn/ALL-IN-ONE.md), [learn/UX-BLUEPRINT.md](learn/UX-BLUEPRINT.md), slices LV-N | Owner, 19 Oct 2026 | Students ke liye ek hi jagah: seekhna, banana, saboot aur naukri | Phase A ki 11 cheezein launch ke saath live, tests ke saath; 20 student interviews; SUS ≥ 80 beta me | ⬜ sirf plan (19 Oct 2026) |
| 130 | **Learn v2 ka clickable UI mock**: owner ne maanga "pehle poora mock UI flow ke saath, code baad me". 46 screens design canvas par: landing, signup, onboarding, home, catalog, roadmap, course, lesson (dry-run slider), DSA sheet, problem, verdict (sabse chhota galat test, hints), editorial (4 kadam), aptitude, revision, contests, Code Studio, arenas, HLD canvas, project brief, Pramaan, career hub, profile, jobs, Sahayak (do mode), community, cohort, progress, Plus, settings; 7 phone screens (Daily 10, Parsons, dry run, code keyboard, league); 6 admin (factory, package + 10 gates, 4-eyes review, AI kharcha, contests). Files: [learn/mock/](learn/mock/README.md) | Owner, 19 Oct 2026 | Code se pehle UI aur flow par owner ki haan | Owner mock dekh kar badlaav bataye; UI slices isi se match | 🟡 v1 bana (19 Oct), owner ne nakaara (20 Oct); v2 bana (20 Oct), owner ne nakaara ("TUF jaisa"); ab v3: row 131 |
| 131 | **Learn mock v3 "Kaagaz aur Blackboard" + admin panel**: owner ne v2 nakaara (20 Oct: "TUF jaisa, alag aur behtar chahiye; Build ke 3 screens nahi pasand; modern admin saare roles ke saath, secure; Sahayak teesra pane jo hata sakein; logo behtar"). Naya look (kaagaz/blackboard, stationery rang, serif display, naya logo), ek sidebar, Sahayak 3rd pane, Build ke 3 screens naye, ~41 learner + brand + 24 admin screens (8 roles, 2FA, 4-eyes, audit). Design faisla [learn/DESIGN-V3.md](learn/DESIGN-V3.md), mock `learn/mock-v3/` | Owner, 20 Oct 2026 | Code se pehle look aur flow par owner ki haan | Har screen 1440 + 390, dono theme, overflow 0; owner dekh kar haan/badlaav | 🟡 mock bana (20 Oct), owner ki raay baaki: **68 screens** (43 learner + naksha/brand, 25 admin), React app [learn/mock-v3/](learn/mock-v3/README.md), link https://claude.ai/artifact/LDK6qdh2qKj8WzWYAiN4Zn, screenshots `learn/mock-v3/screens/` (68 desktop, 14 dark, 14 phone, 4 हिंदी, overview). Jaanch: 68 × 7 (1440/1024/390, light/dark, हिंदी) overflow 0, console error 0; admin 4 roles me khola. Baaki: ye sirf mock hai (asli data, login, judge, AI nahi; automated tests nahi), har screen par loading/khaali/error nahi, lambe Hindi paragraph kai jagah English me; owner ki haan ke baad hi product code; owner ne v3 dekha (20 Oct): "sab achha, font AI wala" → v4 (row 132) |
| 132 | **Learn mock v4 "Kaagaz aur Syaahi" (v3 ka refine)**: owner ne v3 dekha (20 Oct: "sab achha laga, bas font AI wala; har page complete dark black, sab saaf dikhe, light me bhi; har border/box/animation refine; Code Studio VS Code jaisa; admin ka har page har pehlu se; human feel"). Naya font (IBM Plex Sans + Plex Devanagari, JetBrains Mono), kaala default, dono theme me dikhne ke niyam, kit refine, Studio VS Code jaisa, admin pages gehre. Faisla [learn/DESIGN-V4.md](learn/DESIGN-V4.md), app wahi `learn/mock-v3/app`, link wahi | Owner, 20 Oct 2026 | Code se pehle look par owner ki haan | Har screen 1440 + 1024 + 390, dono theme, हिंदी, 4 roles: overflow 0, console error 0; text contrast 4.5:1; owner dekh kar haan/badlaav | 🟡 mock v4 bana (20 Oct), owner ki raay baaki: IBM Plex Sans + Plex Devanagari + JetBrains Mono, kaala default (`#000`), light "kaagaz", kit refine (radius, dhaar, button/input/checkbox/table/popup), Code Studio VS Code jaisa (`src/screens/studio.tsx`), admin gehra (learners views, community tabs, aptitude sets + mock builder, companies verification, contests list, problem editor editorial/visuals). Link wahi https://claude.ai/artifact/LDK6qdh2qKj8WzWYAiN4Zn, screenshots `learn/mock-v3/screens/`. Jaanch: 68 × 7 overflow 0, console error 0, 4 roles; text contrast mukhya ≥ 4.8:1. Baaki: sirf mock (asli data/login/judge/AI nahi, automated tests nahi), har screen par khaali/error haalat nahi, lambe Hindi paragraph kai jagah English me |
| 133 | **Learn mock v4.1: P logo, 2→3 pane, Studio aur motion refine**: owner (20 Oct): "logo P word se batao; problem page default 2 slide (statement + code), AI par click karu to 3 me auto adjust, AI band karu to wapas auto adjust; Studio aur better refine; har page ka UI, section, component, visibility, animation, smoothness, transitions, naye features refine". Kya: P se naya logo (3 option, ek chuna hua har jagah), Panes me khulna/band hona animate (flex), problem/SQL me Sahayak default band, Studio me quick fix, diff view, inline chat, hover card, test run animation; kit me sliding tab underline, meter grow, card stagger, modal/drawer/toast motion, shortcuts sheet (?) | Owner, 20 Oct 2026 | Owner ki raay | Problem page 2 pane se khule, AI se 3 aur wapas 2 bina jhatke; P logo 16px tak saaf; 68 × 7 jaanch saaf; reduce-motion me animation band | 🟡 mock v4.1 bana (20 Oct), owner ki raay baaki: problem/SQL default 2 pane, Sahayak `useAi` se teesra pane flex-grow animate se khulta/band (`src/ui/focus.tsx`, naap: [601, 813, 0] → [423, 572, 409] → wapas); P logo ke 3 option `LogoMark variant` (`src/ui/kit.tsx`), `#brand` par "Poore app me lagao", default A "Pass"; Studio me change marks, hover card, quick fix (pehle badlav dikhe, "madad li" note), Ctrl+I inline Sahayak (sirf hint), diff tab, test ek-ek karke (8/12 → 10/12); kit me `usePresence` (modal/drawer/menu/toast ka exit), tab line khiskti, meter bharta, Sahayak pane column badha kar khulta; bell se notifications drawer, `?` shortcut sheet, G + akshar jump. Jaanch: 68 × 7 aur 25 admin route × 4 role saaf, console error 0. Baaki: logo ka chunav owner ka; sirf mock (automated tests nahi, asli data/judge/AI nahi) |
| 134 | **Learn mock v4.2: logo A final, SQL = DSA jaisa, profile HR ke liye, landing gehra, ML notebook, naye features, code ki taiyaari**: owner (21 Oct): "A wala logo final; user aur admin dono taraf features; landing aur behtar, zyada content; AI/ML projects ke liye Colab jaisa kuch; SQL page DSA jaisa hi (SQL ke sawaal, editor me query, baaki same); profile me sab kuch, HR se share ho, baaki platforms ka data summary me, profile card share; aur kya naye features; code me badalne ke liye aapko kya chahiye; sab GitHub par taaki doosre account se bhi wahi design bane". Kya: logo A har jagah + favicon, B/C hatao; SQL workspace = problem workspace (wahi panes, tabs, test cases, Sahayak); profile v2 (verified skills, platforms ka saar, public link + privacy, recruiter view, PDF, share card); landing ke naye hisse (kaise chalta hai, Studio + notebook, Pramaan profile, colleges, FAQ, daam `₹[...]`); `#notebook` (Pyodide jaisa notebook + "Colab me kholo" GPU ke liye); naye learner features (AI mock interview) aur admin pages (integrations/runtime, recruiters/share links); docs: design system (code ke liye), code ki taiyaari (owner se kya chahiye, connectors), naye features ki list | Owner, 21 Oct 2026 | Owner ki raay | Logo A har jagah aur 16 px par saaf; SQL page problem page jaisa (2 pane + Sahayak teesra); profile share + card; naye screens 1440/1024/390 dono theme हिंदी me saaf; 4 roles; docs GitHub par | 🟡 mock v4.2 bana (21 Oct), owner ki raay baaki: logo A final + favicon (`src/ui/kit.tsx`); SQL = DSA `Workspace` (`src/screens/problem.tsx`); profile v2 + share modal + card (`src/screens/profile.tsx`); landing ke 6 naye hisse; `#notebook` (browser Python / CPU job / Colab GPU); `#interview` (AI mock interview); admin `#adm-runtime`, `#adm-recruiters` (`src/admin/a-platform.tsx`, MATRIX `runtime`, `recruiters`). Docs: [learn/DESIGN-SYSTEM.md](learn/DESIGN-SYSTEM.md), [learn/CODE-READINESS.md](learn/CODE-READINESS.md), [learn/FEATURE-IDEAS.md](learn/FEATURE-IDEAS.md). Jaanch: 72 × 7 aur 27 admin × 5 role, overflow 0, console error 0. Baaki: sirf mock (asli data, judge, AI, Colab hand-off, platforms ka sync nahi; automated tests nahi); owner ke faisle F1–F7 |
| 135 | **Learn mock v4.3: design ko "best" ki taraf (jaanch + 5 sudhaar)**: owner (23 Oct): "v4.3 shuru karo" (U1–U5 aur jaanch). Kyun: v4.2 ke screenshots me dikha ki app ke andar brand ki pehchaan kho jaati hai, Aaj par sab barabar zor se bolte hain, phone par kaam der se dikhta hai, profile dashboard hai document nahi, dark me gehraai kam, problem ki top bar bhari, aur sirf "sab theek" wali haalat bani hai. Kya: U0 jaanch (axe 72 screens dono theme + phone, touch size, Hindi aankh se, reduced motion); U4 dark me 3 parat + kam border, focus bar ki kam zaroori cheezein menu me; U1 Aaj ke 3 roop (switch se, owner chune), phone ki pehli screen par kaam; U3 profile ke 3 roop (ek "saboot ka kaagaz"); U2 brand ke 6 khaas pal (pehla AC, streak bachi, Pramaan pass, plan halka, HR ne dekha, contest nateeja) + diya wale khaali screens; U5 12 mukhya screens par khaali / loading / error / offline / pehli baar; U6 jaanch, screenshots, README, DESIGN-SYSTEM, publish | Owner, 23 Oct 2026; [learn/DESIGN-SYSTEM.md](learn/DESIGN-SYSTEM.md) | Owner ki raay; asli users par test se pehle jo main kar sakta hoon | axe me serious/critical 0 (72 screens, dono theme); phone par touch target ≥ 40 px; Aaj aur profile ke 3-3 roop switch se; 6 pal; 12 screens × 5 haalat; 72 × 7 jaanch saaf; wahi link par publish | 🟡 mock v4.3 bana (23 Oct), owner ki raay baaki: Aaj ke 3 roop (`src/screens/today43.tsx`) aur profile ke 3 roop (`src/screens/profile43.tsx`) switch se (`src/lib/variant.tsx`); dark me 3 parat + `--card-line`/`--sheen` (`src/styles/tokens.css`); focus bar ka ⋯ menu (`src/ui/focus.tsx`); 6 pal `Moment` (`src/ui/kit.tsx`); 12 screens × 5 haalat (`src/ui/states.tsx`); styles `src/styles/v43.css`. Jaanch: axe (`a11y.mjs`) 72 screens 1440/390 × kaala/light × en/हिंदी me 0 (pehle 69–72 screens), phone par chhote touch 889 → 0; 72 × 7 overflow/console 0; admin 5 role saaf. Docs: [learn/DESIGN-SYSTEM.md](learn/DESIGN-SYSTEM.md) (v4.3), README, screenshots `learn/mock-v3/screens/v43/`. Baaki: sirf mock (koi asli data/test nahi); asli users par test nahi hua; screen reader se poora safar insaan ne nahi chalaya |
| 136 | **Learn mock v4.4: raay se final (roop final + user test ke fix)**: owner (23 Oct): "Pehle poora v4.4 ka plan banao", phir plan pakka kiya. Kadam: 44-0 plan + user-test script (30 min, 5–8 students + 2 HR/TPO; script Claude dega) → 44-1 roop final (Aaj aur Profile ka ek-ek roop chunna, baaki roop + `VariantBar` hatao, DESIGN-SYSTEM me chuna roop likho) → 44-2 test ki dikkato ke fix (sirf wahi, naya design nahi) → 44-3 screen reader + keyboard ka poora safar (learner + admin) → 44-4 owner ke chune feature screens (sujhaav: L1, L7, L9, A2, A8) → 44-5 sirf-mock cheezo ki safai + 12 screens ki 5 haalatein final roop par → 44-6 QA + screenshots + README/DESIGN-SYSTEM + publish. Gates: G1 test ke log aur samay (owner), G2 roop ka faisla (owner), G3 kaunse feature (owner). Poora plan [LEARN-HANDOFF.md](LEARN-HANDOFF.md) §5 me | [learn/DESIGN-SYSTEM.md](learn/DESIGN-SYSTEM.md); [learn/FEATURE-IDEAS.md](learn/FEATURE-IDEAS.md) | v4.3 ke baad design ke khule sawaal (kaunsa roop, asli users ki raay, screen reader ka safar) band karke mock ko final karna, taaki F1 "shuru karo" par design pakka ho | Roop ka switch mock se gaya ho aur chuna roop DESIGN-SYSTEM me likha ho; gambhir test-dikkato ki list khaali ya owner se band; keyboard/SR ke dono safar bina mouse ke poore; `qa.mjs` overflow/console 0, `a11y.mjs` axe 0 (dono theme, phone, EN/HI), touch 40 px se chhota 0; README v4.4 + naya preview link push | 🟡 Plan pakka (23 Oct 2026); 44-0 chal raha: test script banana baaki, phir G1 owner se |

## Master plan v2: taiyaari se naukri tak, ek bharosemand platform

**Likha gaya:** 1 Oct 2026 · **Status:** prastaav. Owner ki haan ke baad har hissa upar ki [Plan](#plan-aage-kya-banega) table me entry banega, aur tabhi build shuru hoga. Faisle jo owner ko lene hain, [neeche](#v2-11-owner-se-kya-chahiye) hain.

### V2-1. Ek line me

**Student free me taiyaari kare → har taiyaari ka saboot bane (Parikshaa Pramaan) → college aur company usi saboot par bharosa karein aur dobara-dobara test na karwayein → paisa company, college aur coaching dete hain, student nahi.**

Aaj student har company ka alag online test deta hai, LeetCode ki ginti AI se nakli ban sakti hai, aur company ko kisi score par bharosa nahi. Jo platform "ye student sach me jaanta hai" ka **saboot** de sake, woh dono taraf jeetega.

### V2-2. Hamari asli taakat (jo code me pehle se hai)

Ye cheezein bani hui hain aur tests ke saath chal rahi hain. Plan inhi par khada hai, kyunki inhe copy karna mushkil hai:

| Taakat | Kahan | Kyun kaam ki |
|---|---|---|
| **Integrity ledger**: har attempt ek hash-chain, candidate ko receipt, bahar se verify | `packages/core`, `packages/verify`, scorecard QR (`/?scorecard=`) | Result ke saath chhed-chhaad pakdi jaati hai. Candidate khud apna record jaanch sakta hai |
| **Micro-viva**: jawab ke baad AI follow-up sawaal, "kya isne khud likha?" | exam engine | "Suspicion score" ki jagah seedha samajh ki jaanch. AI se copy kiya jawab pakda jaata hai |
| **11 bhashayein + Hinglish grading**, 2G low-bandwidth mode | `web/src/locales`, ROADMAP §9 | Tier-2/3 aur Hindi-medium student |
| **NTA jaisa CBT interface** | candidate exam | JEE/NEET/CUET/SSC wale students isi se pehchaante hain |
| **Lab mode, WhatsApp, ATS, GST billing, rechecks, marking** | PR #32 | College aur company ka poora exam-din |
| **Prep ka core loop**: planner, Sahayak, coins, company pages, contests | upar ki tables | Roz aane ki wajah |

Kami (jo abhi nahi hai): app/PWA, awaaz (voice), content ka size, public profile, companies ke liye talent pool, analytics, bade contest ka load test.

### V2-3. Competitors: kiske paas kya hai, kahan jagah khaali hai

Ye tasveer 1 Oct 2026 ki public jaankari se hai. "Kisi ke paas nahi" ka daava hum pakka nahi kar sakte. Isliye neeche likha hai ki **ek saath** kiske paas nahi hai. Launch se pehle har daave ko dobara jaanchna hai.

| Kism | Khiladi | Unki taakat | Khaali jagah (jahan hum jeetein) |
|---|---|---|---|
| Coding prep | LeetCode, GeeksforGeeks, takeUforward, Coding Ninjas, Scaler | Content, community, brand | Zyaadatar English. "Solved count" AI se banaya ja sakta hai, iska koi saboot nahi. Achhe courses mehnge |
| Aptitude aur company mocks | PrepInsta, IndiaBIX, FACE Prep, PlacementPreparation.io | Company-wise pattern | Asli proctoring nahi, personal plan nahi, hiring se juda nahi |
| Common placement test | AMCAT (SHL), eLitmus, CoCubes | Ek score, kai companies | Student fees deta hai. Score ka hisaab chhupa hota hai. Taiyaari ka loop nahi. Candidate score khud verify nahi kar sakta |
| B2B assessment | Mercer Mettl, HackerRank, HackerEarth, iMocha, TCS iON, Unstop | Enterprise proctoring, AI proctoring, bade clients | Har test mehnga. AI "cheating score" ek black box. English pe zor. Candidate ko badle me kuch nahi milta |
| Govt aur entrance prep | Testbook, Adda247, PW, Unacademy | Bahut content, mock tests, Hindi | Hiring se juda nahi, coding kam |
| AI mock interview | PlacementDo jaise naye tools, Coding Ninjas ka AI | Voice practice | Saboot nahi, regional bhasha kam, prep aur hiring se alag |
| Campus placement ERP | Superset jaise tools | Drive management | Assessment aur prep nahi |

Nichod: **prep + proctored assessment + verifiable saboot + Bharat ki bhashayein + college ka free system + company ka talent pool**, ye sab **ek jagah** kisi ek khiladi ke paas nahi dikhta. Yahi hamari jagah hai.

### V2-4. Do tarafa soch: kaun, kya dard, hum kya denge

| Kaun | Aaj ka dard | Hum kya denge | Woh kyun aayega |
|---|---|---|---|
| **Student, tier-1** | Har company ka alag OA, LeetCode grind ka saboot nahi | Ek Pramaan jo sab companies dekhein, Parikshaa Score, company-wise plan | Kam test, zyada interview call |
| **Student, tier-2/3, Hindi/regional medium** | English content, mehngi coaching, sasta phone, kamzor net | 11 bhashaon me Sahayak (awaaz se bhi), 2G PWA, WhatsApp par roz ka sawaal, sab free | Pehli baar apni bhasha me placement taiyaari |
| **Govt job / GATE / entrance aspirant** | Mock tests bikte hain, interface asli jaisa nahi | NTA/TCS iON jaisa CBT free, All-India rank | Asli exam jaisa abhyaas, free |
| **Maa-baap** | Bachcha kya kar raha hai pata nahi | Hafte ki WhatsApp report (student ki manzoori se) | Bharosa, aur college/coaching ki sifarish |
| **TPO / placement cell** | Excel me drives, NIRF/NAAC ke liye data jodna, students ki taiyaari ka andaaza nahi | Free "TPO OS": students, drives, eligibility, readiness heatmap, NIRF/NAAC reports ek click | Kaam aadha, ranking ke liye data taiyaar |
| **Faculty** | Internal exams check karna, CO-PO attainment | Handwritten copy scan karke AI se sujhaya hua marking, CO-PO report | Hafte bachenge |
| **Badi company (mass hiring)** | Lakhon applicants, proxy, paper leak, mehnga assessment | Leak-proof paper, identity + viva, 50 college ek saath lab mode me, verified talent pool | Sasta, bharosemand, kam fraud |
| **Startup / SME** | Recruiter nahi, test ka budget nahi | Free hiring challenge, sirf shortlist par paisa | Bina sales call ke hiring |
| **Coaching institute (chhote shehar)** | Apna CBT nahi, OMR ka jhanjhat | White-label NTA-jaisa CBT, phone camera se OMR scan, All-India rank | Apne brand me online test series |
| **Hum (operator)** | AI ka kharcha, content ka size, bharosa banana | Static-first content, creators, sasta model routing | Har student free rahe aur business bhi chale |

### V2-5. Chhe bade daav (jo ek saath kisi ke paas nahi)

1. **Parikshaa Pramaan (Skill Passport)**: har proctored test, "samjha hua" solve, contest aur viva ek **signed, verifiable** profile me aata hai. QR, public link aur LinkedIn "Add to profile". Isme koi cheez haath se likhi nahi hoti: sab ledger se aata hai.
2. **"Samjha hua" solve (viva-verified)**: accepted submission ke baad 2 chhote sawaal (text ya awaaz me), jaise "complexity kyun ye hai?" ya "khaali input par kya hoga?". Paas hone par hi solve ✔✔ ginta hai. AI ke zamane me sirf ginti bekaar hai. Ye ginti asli hai.
3. **Parikshaa Score (PS)**: har mahine ek free, proctored national test (aptitude, coding, CS fundamentals, communication). Score 12 mahine valid, section-wise breakdown ke saath, aur kamzor hisson se apne aap naya study plan bane. Companies isi score se shortlist karein: "ek test, sab companies".
4. **Leak-proof paper**: har candidate ka paper thoda alag hota hai (options ka kram, numbers badle hue variants, shabdon ke variants), aur us par ek halka candidate-code watermark hota hai jo photo ya screenshot me bhi rehta hai. Paper leak ho to photo se pata chal jaata hai kiske paper ki thi. Ledger batata hai kisne kab kya dekha. (NEET 2024 ke baad "paper leak" Bharat me sabse bada dar hai.)
5. **Bharat-first pahunch**: Sahayak se awaaz me doubt poochhna (11 bhashayein), WhatsApp par roz ka sawaal aur hafte ki report, ₹6,000 wale phone aur 2G par chalne wala PWA, offline lessons.
6. **College ke liye hamesha free TPO OS**: drives, eligibility, readiness, NIRF/NAAC reports aur handwritten exam checking. College free me judta hai, aur uske students apne aap aate hain. Distribution ka sabse sasta rasta yahi hai.

### V2-6. Features, stambh (pillar) ke hisaab se

Har row ka ID `V2-<pillar><number>` hai. Build shuru karte waqt ID ke saath upar ki Plan table me entry banegi.

#### A. Student: free taiyaari (B2C)

| ID | Feature | Kya aur kaise | Done kab |
|---|---|---|---|
| A1 | **PWA + offline** | Install hone wala app (Play Store par TWA wrapper), lessons aur problems offline cache, submissions queue me jaakar net aane par jaati hain | ₹6,000 ke Android par, 2G par, pehla page < 2.5 s |
| A2 | **Browser me turant Run** | Python/JS ka Run browser ke andar WebAssembly (Pyodide) se: server ka chakkar nahi, offline bhi. Submit abhi bhi server judge par | Run < 300 ms, offline kaam kare |
| A3 | **Placement quiz + target companies se plan** | 8–12 sawaal ka adaptive quiz level tay kare. Target role ya company chuno, plan ke aakhri 30% din me unke sawaal | Tracker ki §1 rows ✅ |
| A4 | **JD se plan** | Job description chipkao, Sahayak skills nikaale, gap dikhaye aur 2–6 hafte ka plan bana de | 20 asli JD par sahi skills |
| A5 | **Company mock OA simulator** | TCS NQT, Infosys, Accenture, Wipro, Capgemini, Cognizant jaise pattern: section, time aur negative marking wahi. Proctoring bhi wahi jo asli exam me, taaki aadat pade | 10 pattern, har ek ka readiness % |
| A6 | **Aptitude + verbal + CS tracks** | Quant, reasoning, verbal, OS/DBMS/CN/OOP: Hindi aur English me | Har track me 300+ sawaal |
| A7 | **Sahayak v2** | Awaaz se doubt (Bhashini ya browser speech), 11 bhashayein, notes ka AI draft, interview follow-ups, review ka fixed JSON | Tracker ki §5 rows ✅; evals targets paas |
| A8 | **AI mock interview (awaaz)** | Company persona, Hinglish, follow-ups; report me samajh, communication aur galtiyaan. Micro-viva engine ka hi istemal | 5 persona; har session ki report |
| A9 | **Resume jo saboot se bane** | Resume ki har line Pramaan se judi ("Solved 300 — 180 viva-verified"), ATS-friendly PDF, Hindi/English | Recruiter link khole to har daava verify ho |
| A10 | **Streak freeze, sprint quiz, reminders** | Tracker ki §2 ki baaki rows, WhatsApp/email/push reminders | §2 rows ✅ |

#### B. Saboot aur bharosa (dono taraf ki jadd)

| ID | Feature | Kya aur kaise | Done kab |
|---|---|---|---|
| B1 | **Parikshaa Pramaan v1** | W3C Verifiable Credential jaisa JSON, Ed25519 se signed. Public key site par. `/p/<id>` public page, QR, PDF, LinkedIn "Add to profile". Kya dikhana hai, ye student chune | Offline verify tool (`packages/verify`) signature aur ledger dono jaanche |
| B2 | **Viva-verified solves** | Accepted ke baad 2 sawaal. Pehle admin ke likhe sawaal (0 AI kharcha, static hint jaisa), na hon to AI. Leaderboard aur Pramaan sirf ✔✔ ginein | Eval: copy kiye solution wale 90% viva me fail hon, asli wale 95% paas |
| B3 | **Parikshaa Score (PS)** | Mahine me ek slot, ghar se (camera + identity + viva) ya partner college ke lab me (lab mode, "high-trust" tier). Items IRT se calibrated, har candidate ka alag paper (B4) | 2 pilot slots, score ka test-retest stable |
| B4 | **Leak-proof paper** | Parameterised variants (numbers, options, shabd), per-candidate kram, candidate-code watermark (CSS overlay jo photo me dikhe), leaked photo se candidate dhoondhne ka tool console me | Kisi test paper ki photo se 30 s me candidate mil jaaye |
| B5 | **Proxy aur collusion pakadna** | Identity photo + awaaz viva; jawab ke samay aur similarity se "saath baithe" jode (winnowing pehle se hai). Faisla hamesha insaan ka | Report me jode aur kaaran |
| B6 | **DigiLocker me Pramaan** | Issuer ke roop me DigiLocker/NeGD ke saath onboarding (sarkari process). Uske baad Pramaan student ke DigiLocker me | Owner ka kaam: application (neeche) |
| B7 | **Leaderboard ki safai** | Plagiarism, bahut tez solve aur viva fail wale solves ranking se bahar. Kaaran student ko dikhe, appeal ho sake | Top 100 me manual audit par 0 nakli |

#### C. Viral hona aur badhna

| ID | Feature | Kya aur kaise | Kyun viral |
|---|---|---|---|
| C1 | **Achievement cards** | 9:16 (WhatsApp status/Instagram story) aur 1:1 card, Hindi/regional me, ek tap me share. Card par QR jo Pramaan khole | Har streak, contest aur Score ek post ban jaata hai |
| C2 | **Campus Premier League** | College vs college aur state leaderboard: mahine ka "Top campus", TPO ko badge | TPO khud students ko jodta hai |
| C3 | **Squads** | 3–5 dost, saanjha streak, ek toote to sab ko yaad dilaye | Dost dost ko laata hai |
| C4 | **Referral** | Dono ko Sahayak credits + Plus ke din. Coupon/affiliate `?ref=` (tracker plan #2) | Seedha K-factor |
| C5 | **Sponsored weekly contest** | Company prize de, top 50 ko seedha interview call. "Contest se naukri" | Har hafte khabar |
| C6 | **Public profile `/u/:username`** | Pramaan, rating, achievements; SEO ke liye fast static page | Google se naye students |
| C7 | **Placement Wrapped** | Saal ke ant me "tumhara saal", share hone layak | Dec–Jan me lehar |
| C8 | **Creator programme** | Teachers aur YouTubers tracks/lessons banayein, moderation ke baad publish. Plus ki kamai me hissa | Content ka size + creators ka apna audience |
| C9 | **Campus ambassador** | Har college me 1–2 students: coins, certificate, swag. Console me ambassador dashboard | Tier-3 me pahunch |
| C10 | **WhatsApp Roz Ka Sawaal** | Subah ek MCQ WhatsApp buttons se, jawab par turant explanation, streak. Kharcha Meta ki per-message pricing par (pehle naapna) | App ke bina bhi judaav |

#### D. College (free TPO OS + paid proctored exams)

| ID | Feature | Kya aur kaise | Done kab |
|---|---|---|---|
| D1 | **Campus licence + bulk CSV** | 500 students ek CSV se, Plus sabko (tracker plan #8) | 500 students 1 minute me |
| D2 | **Readiness heatmap** | Branch/batch ke hisaab se kaun kis topic me kamzor; kamzor students ki early warning, faculty ko remedial list | TPO ek page par dekhe |
| D3 | **Drive manager** | Company registration, eligibility (CGPA, backlogs, branch), apply, round-wise status, offer upload | Ek poori drive bina Excel ke |
| D4 | **NIRF / NAAC reports** | Placement %, median salary, higher studies: NIRF ke format me export. NAAC Criterion 5 ka data | Pilot college ki report TPO manzoor kare |
| D5 | **CO–PO attainment** | Har sawaal course outcome se juda, attainment report PDF/Excel | NBA format me report |
| D6 | **Handwritten copy checking** | Phone se answer sheet scan, AI likha hua padhe aur rubric se mark sujhaye, faculty manzoor kare. Sab ledger me (rechecks pehle se hain) | 200 asli copiyon par faculty se 90% match |
| D7 | **Semester internals** | Lab mode + NTA CBT + question quality report (pehle se). Paper setter ke liye AI se question paper, syllabus aur blueprint ke hisaab se | Ek internal exam poora online |

#### E. Company (paisa yahan se)

| ID | Feature | Kya aur kaise | Done kab |
|---|---|---|---|
| E1 | **Verified talent pool** | Sirf wahi students jo khud "discoverable" chunein (DPDP consent). Filter: Score, verified skills, shehar, bhasha, graduation year | Consent log, student kabhi bhi hat sake |
| E2 | **Hiring challenge** | Company free me challenge daale, students dein, shortlist par paisa | Pehli 5 company se hiring |
| E3 | **Mass drive** | 50 college, ek paper, ek samay, lab mode, variants + watermark, results ek jagah | 5,000 candidates ek saath 10:00 baje |
| E4 | **Interview room** | Video (WebRTC) + saanjha editor + whiteboard, interviewer ki rubric, recording sirf dono ki manzoori se | 30 min interview bina ruke 4G par |
| E5 | **"AI-allowed" assessment** | Candidate test me diya gaya AI assistant use kar sakta hai; har prompt ledger me; grading me dekha jaata hai ki AI ka sahi istemal kiya ya nahi | 2026 ki hiring ki asli zaroorat |
| E6 | **Pay-per-shortlist pricing** | SME ke liye sirf shortlist par, badi company ke liye credits ya saal ka contract (GST billing pehle se hai) | Self-serve kharid |

#### F. Dusre exams (placement ke baad)

| ID | Feature | Kya aur kaise | Kram |
|---|---|---|---|
| F1 | **Coaching white-label** | Coaching institute ka apna subdomain aur logo, NTA-jaisa CBT, test series, All-India rank (sab coaching milakar, naam chhupa ke) | Pehla |
| F2 | **Phone se OMR scan** | Offline test ki OMR sheet phone camera se jaanchi jaaye, result online | F1 ke saath |
| F3 | **GATE CS track** | CS fundamentals pack ko GATE syllabus tak badhana, GATE jaisa virtual calculator (pehle se), NAT sawaal | Doosra |
| F4 | **SSC / Bank / Railway aptitude** | Aptitude content wahi, Hindi pehle; TCS iON jaisa interface | Teesra |
| F5 | **School aur CUET** | Under-18 ke liye maa-baap ki verifiable consent (DPDP) zaroori, isliye sabse baad | Chautha |

#### G. Sabse tez (speed ke vaade, naap ke saath)

| Kya | Target | Kaise |
|---|---|---|
| Pehla page (4G, sasta Android) | < 1.5 s LCP; 2G par < 4 s | Bundle budget (pehle se), Brotli, images lazy, font subset, Mumbai/Hyderabad region |
| API TTFB Bharat me | p95 < 200 ms | India region server, connection pooling, read replica |
| Judge verdict | p95 < 2 s (normal), contest me < 5 s | Warm runner pool, priority lane (tracker §9), autoscale |
| Exam start burst | 5,000 candidates 60 s me | Load test (ROADMAP §10), pre-signed tokens, CDN par static |
| Contest | 10,000 ek saath | Queue, backpressure, scoreboard cache |

Har release me ye naap CI ya nightly load test me chale. Target se neeche gaye to release ruke.

#### H. Suraksha aur privacy (bharosa hi product hai)

| ID | Kya | Kyun |
|---|---|---|
| H1 | **Passkeys (WebAuthn)** staff aur learners dono ke liye; staff ke liye 2FA pehle se hai | Password chori ka ant |
| H2 | **DPDP Act 2023 + DPDP Rules 2025** ke hisaab se consent manager, data export/delete, retention (tutor chats 180 din, tracker §5), under-18 ke liye maa-baap ki consent | Kanoon; school aur coaching ke liye zaroori |
| H3 | **CERT-In directions**: incident 6 ghante me report karne ki prakriya, logs 180 din Bharat me | Kanoon |
| H4 | **Bahar ka pentest + bug bounty**, phir ISO 27001 ki taiyaari (ROADMAP ki "honestly not in here" list) | Badi company ka procurement |
| H5 | **Data Bharat me**: DB aur files India region me. Model calls ke India region ka sawaal ROADMAP me khula hai | Colleges aur sarkari buyers poochhte hain |
| H6 | **Koi AI "cheating score" nahi**: photo ya tab switch sirf insaan ke dekhne ka kaaran hai, faisla nahi (ROADMAP §14 ka siddhant). Marketing me bhi yahi | Students ka bharosa; galat aarop se bachav |

#### I. AI, kharche ke saath

- **Static pehle, AI baad me**: pehla hint, viva ke sawaal aur editorials admin/creator ke likhe hon; AI tabhi chale jab likha hua na ho (1b jaisa).
- **Model routing**: chhote kaam (quiz check, tagging, OCR ke baad saaf karna) sabse saste model par; review, interview aur grading bade model par. Prompt caching har jagah.
- **Credits**: free student ko mahine ke credits. Kharcha org ke spend cap me gine (pehle se).
- **Evals pehle**: har naya AI feature (viva, interview, handwritten checking) tabhi launch ho jab uska eval set paas ho, Sahayak evals ki tarah (plan 1a).
- **Kharcha naapna**: §0 cost-run se har feature ka "₹ per active student per mahina" nikaalna. Free rehne ki shart yahi number hai.

### V2-7. Paisa kahan se (student hamesha free)

| Kahan se | Kaise | Kab |
|---|---|---|
| Company | Assessment credits, mass drive, pay-per-shortlist, talent pool ka subscription, interview room | P3 se |
| College | TPO OS free. Proctored semester exams, handwritten checking aur NAAC/NIRF pack paid (per student per saal) | P2 se |
| Coaching | White-label test series: per student per test, ya saal ka plan | P4 se |
| Plus (optional) | Zyada Sahayak credits, mock interviews, Company Pass. Core taiyaari kabhi paywall ke peeche nahi | Pehle se (tracker §6) |
| Sponsor | Contest aur Premier League ke sponsor, "top 50 ko interview" | P1 se |

Siddhant: **jo student ke career ke liye zaroori hai (practice, plan, Score, Pramaan) woh free rahega.** Paisa convenience aur institutions se aata hai.

### V2-8. Phases aur samay

Samay ek chhoti team (2–4 engineers + content) ke hisaab se andaaza hai, vaada nahi. Har phase ke ant me ek **gate** hai: gate paas na ho to agla phase nahi shuru hoga.

| Phase | Samay | Kya banega | Gate (aage badhne ki shart) |
|---|---|---|---|
| **V2-P0 Neev** | 0–4 hafte | Plan 1a–5 poore (evals run, coupons/invoices, reminders + analytics, e2e), A1 PWA v1, C1 cards, C6 public profile, G ka pehla load test | Analytics se D1/D7 naap rahe hain; exam start 1,000 ek saath paas |
| **V2-P1 Saboot** | 1–3 mahine | B1 Pramaan, B2 viva-verified, B4 leak-proof paper, B7, C2 Premier League, C3 squads, C4 referral, C10 WhatsApp sawaal, A3 | 20 college, 10,000 learners, D7 ≥ 25% |
| **V2-P2 College** | 3–5 mahine | D1–D5, D7, D6 beta, A5 mock OA, A6 tracks | 50 college har hafte active; 3 college paid pilot |
| **V2-P3 Company** | 5–7 mahine | B3 Parikshaa Score (2 pilot slots), E1–E6, A8 mock interview, A9 resume | 20 paying companies; Score se pehli 100 hiring |
| **V2-P4 Aur exams + Bharat** | 7–10 mahine | F1–F4, A7 awaaz + 11 bhashayein, C8 creators, C9 ambassadors | 25 coaching institutes; Hindi/regional learners ≥ 40% |
| **V2-P5 Scale + certificate** | 10–12 mahine | 10,000 ka contest, H4 pentest + bug bounty, B6 DigiLocker, Play Store app, F5 ki taiyaari | Pentest ke critical/high 0; contest bina ruke |

### V2-9. Kya naapenge (metrics)

- **North star:** har hafte kitne **verified skills** (viva-verified solves + Score + Pramaan) bane. Ye student ki taiyaari aur company ka bharosa dono ko ek number me naapta hai.
- **Student:** activation (pehle din plan + 1 solve), D7, D30, hafte me active din, viva pass rate.
- **Viral:** K-factor (ek student kitne laata hai), share ki ginti, referral se signup.
- **College:** active college, TPO hafte me kitni baar aata hai, readiness me sudhaar.
- **Company:** Score/Pramaan se shortlist → interview → offer ka funnel, repeat company.
- **Bharosa:** leak ke case, galat flag par appeals, uptime, judge p95.
- **Kharcha:** ₹ AI kharcha per active student per mahina.

### V2-10. Khatre aur imaandari

| Khatra | Asar | Bachav |
|---|---|---|
| Free Score par cheating | Score ki keemat khatam | Viva, variants, watermark, "high-trust" lab tier, B7 audit; company ko dikhe ki score kis tier ka hai |
| AI ka kharcha free users se badh jaaye | Paisa khatam | Static-first, routing, credits, cost-run gate (V2-I) |
| Content ka size (editorials, videos, company data) | Log nahi rukenge | Creators (C8), content team, evals se quality |
| DigiLocker issuer banna sarkari process hai | Der | B1 pehle apne signature se; DigiLocker baad me, bonus |
| DPDP: under-18 aur consent | Jurmana, bharosa | School/CUET sabse baad (F5); consent manager P1 me |
| "Kisi competitor ke paas nahi" galat nikle | Marketing par sawaal | Har daava launch se pehle dobara jaanchna; daava "ek saath" ka ho |
| AI mark ya viva galat ho | Student ke saath anyaay | Faisla hamesha insaan ka, rechecks (pehle se), evals |
| Handwritten OCR Hindi/regional me kamzor | D6 fail | Pehle English + Hindi, faculty-in-loop, 200 copiyon ka eval |
| Team chhoti, scope bada | Kuch bhi poora nahi | Phase gates; ek waqt me ek phase |

### V2-11. Owner se kya chahiye

Ye faisle owner ke hain. Jab tak na milein, related build shuru nahi hoga:

1. **Haan ya na**: kya scope placement se badhkar college OS, company talent pool aur coaching tak jaaye? (Faisle table me "prastaav")
2. **Naam aur brand**: "Parikshaa Prep", "Parikshaa Pramaan", "Parikshaa Score" pakke hain ya nahi.
3. **Siddhant**: kya ye pakka hai ki core taiyaari aur Score student ke liye hamesha free rahega?
4. **Budget**: AI ka mahine ka budget, aur `ANTHROPIC_API_KEY` (evals ka paid run pehle se ruka hai).
5. **Content**: content team ya creators; videos kaun banayega, kis bhasha me.
6. **Sarkari/kanooni**: DigiLocker issuer application, company registration, privacy policy par vakeel ki salah (DPDP).
7. **Pehle partners**: 3 pilot college, 2 sponsor company, 5 coaching institute.

### V2-12. College aur company: end-to-end feature list

Ye list ek college aur ek company ke **poore safar** ke hisaab se hai, pehle din judne se lekar result, placement aur bill tak. Har row me likha hai ki aaj code me kya hai (✅ ban gaya, tests ke saath · 🟡 aadha · ⬜ naya), taaki pata rahe kitna kaam sach me baaki hai. ✅ wali rows ki poori detail [ROADMAP](ROADMAP.md) me hai.

#### Teen usool: har feature inhi par parkha jaayega

1. **Aasaan:** TPO ya recruiter bina training ke 10 minute me pehla test bhej de. Har kaam ka template ho ("TCS jaisa aptitude", "Java developer"). Koi bhi kaam 3 click se zyada ka na ho. Console Hindi me bhi ho.
2. **Bharosemand:** har number ledger se aaye aur bahar se verify ho sake. AI kabhi faisla nahi karta, sirf sujhaata hai; faisla insaan ka hota hai aur uska naam record me jaata hai. Data Bharat me rahe, aur DPDP ke hisaab se chale.
3. **Bilkul fit:** Indian exam ki aadatein pehle se hon: negative marking, sections, NTA jaisa interface, CGPA/backlog eligibility, NIRF/NAAC, GST, PO aur NEFT se payment, aur Hindi.

#### College ka safar

**1. Judna aur team**

| ID | Feature | Status | Note |
|---|---|---|---|
| CL1 | Khud sign-up, email verify, sample exam, guided tour | ✅ | Self-serve (PR G1–G3) |
| CL2 | 5 roles (owner, author, invigilator, reviewer, read-only), 2FA, Google/Microsoft SSO | ✅ | ROADMAP §1 |
| CL3 | Hindi me college guide | ✅ | `docs/pilot` |
| CL4 | Staff ko CSV se ek saath jodna (department-wise) | ✅ | CSV (email, naam, role, department), pehle check phir save; har naye member ko apna password set karne ka link (`api/src/departments.ts`, console `StaffSheet.tsx`). Pehle se maujood staff chhoda jaata hai, badla nahi |
| CL5 | Console Hindi me | 🟡 | Top bar ka "हिन्दी" switch: navigation, titles aur page ki ek line Hindi me (`console/src/language.ts`). Pages ke andar abhi English |
| CL6 | Department aur campus (ek university, kai college) | 🟡 | Department ✅: staff aur exam ka department, owner ke siwa member ko sirf apne department ke (aur bina department ke) exams (`departments.ts`, migration 0051). Ek university me kai college/campus abhi nahi |

**2. Students ka data**

| ID | Feature | Status | Note |
|---|---|---|---|
| CL7 | Har exam ke liye candidates CSV se, dry run ke saath | ✅ | ROADMAP §5 |
| CL8 | **Student master**: roll no., branch, batch, CGPA, backlogs, phone. Ek baar daalo, har exam aur drive me kaam aaye | ✅ | Console → Placement → Students; `api/src/placement.ts`, `student-import.ts`, migration 0029. CSV dry run ke saath, dobara import par update. Screenshot `pilot-19` |
| CL9 | Student khud register kare (college ka link), TPO manzoor kare | 🟡 | Drive ke apply link se naye log khud jud sakte hain (`self_registered`), lekin TPO ki alag manzoori ka step nahi |
| CL10 | APAAR ID / DigiLocker se naam aur marks verify | ⬜ | Sarkari onboarding chahiye (B6) |

**3. Sawaal aur paper**

| ID | Feature | Status | Note |
|---|---|---|---|
| CL11 | Question bank: topic, difficulty, tags; CSV aur Word (.docx) import, pictures ke saath | ✅ | ROADMAP §3 |
| CL12 | Passages, negative marking, ek se zyada sahi option, numeric | ✅ | |
| CL13 | Sections, pools se random paper (har candidate alag), section ka apna time | ✅ | Draw seeded, auditor dobara bana sakta hai |
| CL14 | Coding (Python, JS, C, C++, Java), LeetCode jaisa workspace, hidden tests | ✅ | ROADMAP §4 |
| CL15 | 11 bhashaon me sawaal ka anuvaad | ✅ | ROADMAP §9 |
| CL16 | Question quality report (bahut aasaan, bahut mushkil, farq na karne wale) | ✅ | Insights (PR #32) |
| CL17 | **Syllabus/topic se AI draft sawaal**, author jaanch kar manzoor kare | ⬜ | Evals ke saath |
| CL18 | Taiyaar packs: aptitude, reasoning, verbal, CS fundamentals, company patterns | 🟡 | CS fundamentals aur SQL packs Prep me hain. Exam ke liye aptitude packs baaki |
| CL19 | Har sawaal ka CO (course outcome) aur Bloom level | 🟡 | Sawaal → CO mapping exam ke Results par (`outcomes.ts`). Bloom level nahi |
| CL20 | Parameterised variants (har candidate ke alag numbers) | ⬜ | Leak-proof paper (B4) |

**4. Exam se pehle**

| ID | Feature | Status | Note |
|---|---|---|---|
| CL21 | Exam window, invitation email, SMS (MSG91) aur WhatsApp; din pehle aur ghanta pehle reminder | ✅ | |
| CL22 | Time badalne par sabko naya time apne aap | ✅ | |
| CL23 | Try test (staff preview), system check candidate ke liye | ✅ | |
| CL24 | **Admit card / hall ticket PDF**: photo, seat, lab, QR | ✅ | Admit card PDF: naam, roll, centre/room/seat, samay, QR (`seats.ts`). Candidate apne invite link se bhi le. Photo nahi |
| CL25 | Lab aur seat allocation (kaunsa student kaunse lab, kaunsi seat) | ✅ | Rooms aur seats, roll no. ke kram me; kam seats par mana (`seats.ts`, console `Rooms.tsx`) |
| CL26 | Candidate ke liye demo test (asli jaisa, bina marks) | ✅ | `/?demo`: asli CBT screen par 5 sample sawaal, server ko kuch nahi jaata, credit nahi katta (`web/src/demo.ts`); invite page se link. Organisation ke apne sawaal wala demo nahi |

**5. Exam ka din**

| ID | Feature | Status | Note |
|---|---|---|---|
| CL27 | NTA jaisa CBT, calculator, palette, 11 bhashayein, keyboard se poora exam | ✅ | |
| CL28 | Autosave, net jaane par bhi kuch na khoye, 2G mode | ✅ | ROADMAP §2, §9 |
| CL29 | Lab mode: sirf lab ke network se, sab ek saath shuru | ✅ | PR #32 |
| CL30 | Identity photo, webcam photos, tab/full-screen events (sirf insaan ke dekhne ke liye) | ✅ | Default off. ROADMAP §14 |
| CL31 | Live sitting: kaun shuru, kahan tak, away/idle, sabko announcement, time badhana, reopen | ✅ | ROADMAP §8 |
| CL32 | **Kai lab ek dashboard par** (centre-wise), har lab ka invigilator alag | ✅ | Live page par room-wise ginti (present, started, submitted) (`Rooms.tsx`). Har lab ka alag invigilator login nahi |
| CL33 | Invigilator phone se (attendance QR scan, incident note) | ✅ | Phone par "At the door": QR scan (BarcodeDetector) ya roll no., doosri baar scan par chetavni. Incident note nahi |
| CL34 | Candidate-code watermark jo photo me bhi dikhe | ⬜ | B4 |

**6. Checking**

| ID | Feature | Status | Note |
|---|---|---|---|
| CL35 | MCQ/numeric/code apne aap; short answer AI se, rubric ke saath | ✅ | |
| CL36 | Micro-viva: AI follow-up se "khud likha ya nahi" ka saboot | ✅ | |
| CL37 | Written answers ka blind marking queue (J/K, Enter) | ✅ | PR #32 |
| CL38 | Code similarity (MOSS jaisa) | ✅ | |
| CL39 | **Handwritten copy scan karke AI se sujhaya hua marking** | ❌ | Hataya (2 Oct 2026, [LAUNCH-PLAN.md](LAUNCH-PLAN.md) §3): product sirf tech; code git history me, tables migration 0055 se gaye |
| CL40 | Doosra examiner (moderation), farq zyada ho to teesra | ❌ | Hataya (2 Oct 2026, [LAUNCH-PLAN.md](LAUNCH-PLAN.md) §3): product sirf tech; code git history me, tables migration 0055 se gaye |

**7. Result**

| ID | Feature | Status | Note |
|---|---|---|---|
| CL41 | Cut-off, qualified/failed, results table, CSV/Excel | ✅ | |
| CL42 | Analytics: mean, median, histogram, har sawaal ki difficulty | ✅ | |
| CL43 | Scorecard PDF, QR se public verify | ✅ | PR #32 |
| CL44 | Result email/WhatsApp se, candidate apne marks sawaal-wise dekhe | ✅ | |
| CL45 | Recheck: 7 din, 3 sawaal, badlaav ledger me | ✅ | |
| CL46 | Candidates across tests (Insights), Moodle gradebook (LTI 1.3) | ✅ | |
| CL47 | **CO–PO attainment report** (NBA format) | ❌ | Hataya (2 Oct 2026, [LAUNCH-PLAN.md](LAUNCH-PLAN.md) §3): product sirf tech; code git history me, tables migration 0055 se gaye |
| CL48 | Maa-baap ko report (student ki manzoori se) | ⬜ | |

**8. Placement cell (TPO OS)**

| ID | Feature | Status | Note |
|---|---|---|---|
| CL49 | College ki practice site aur Prep (plan, Sahayak, contests) | ✅ | ROADMAP §15, §16 |
| CL50 | Campus licence: CSV se sabko Plus | ✅ | Tracker plan #8 (PR #35): cohort, CSV dry run, verify par Plus, console → Practice → Campus |
| CL51 | **Readiness heatmap** (branch/batch × topic), kamzor students ki list | ✅ | Branch × topic, <40% wale students aur unka sabse kamzor topic (Placement → Readiness) |
| CL52 | **Drive manager**: company, JD, eligibility (CGPA, backlogs, branch), apply, rounds, offer | ✅ | Console → Placement → Drives: eligible students apne aap, drive ka test ek click me, rounds (applied → test → interview → offer/join), offer LPA, company ke liye CSV. Student apply link se khud bhi apply kar sakta hai (CO14). Screenshot `pilot-20` |
| CL53 | Company ke liye college ka portal (drive request, shortlist dekhna) | ⬜ | E3 se juda |
| CL54 | **NIRF / NAAC reports** (placement %, median salary, higher studies) | ✅ | Year-wise placement report (batch aur branch: placed, median/highest/average package); "NIRF/NAAC" ka naam hataya, report TPO ke kaam ki hai. Higher studies track nahi |
| CL55 | Campus Premier League (college ranking) | ⬜ | C2 |

**9. Paisa**

| ID | Feature | Status | Note |
|---|---|---|---|
| CL56 | Prepaid credits (Razorpay) ya monthly invoice; GST invoice, credit note, TDS | ✅ | ROADMAP §12 |
| CL57 | **Saal ka licence, PO aur NEFT** se payment ka record, quotation PDF | ✅ | Quotation PDF (PO no., bank details), operator UTR se payment record kare to credits aur GST invoice (`billing.ts`, `billing-cli transfer`) |
| CL58 | TPO OS free; proctored exam aur handwritten checking paid | ⬜ | V2-7 |
| CL59 | Student ka verified profile (CGPA, scores, offers) jo company dekhe | ⬜ | |
| CL60 | Paper setter → HoD review → lock | ✅ | Setter review ke liye bheje, koi doosra manzoor kare ya comment ke saath lautaye; review me aur manzoor ke baad paper lock; owner wajah ke saath khole; sab audit (`api/src/exam-review.ts`, migration 0050, console `PaperReview.tsx`) |
| CL61 | Debarred list (kam attendance) | ⬜ | |
| CL62 | Divyang (PwD) suvidha: extra time, scribe, bada font | ✅ | Candidate par extra time % (20 min/ghanta = 33%), scribe, bada font; extra time attempt shuru hote hi ledger me `time_extended` (kisne diya, naam ke saath); instructions me dikhta hai, test bade font me khulta hai; staff ka note seal, audit me nahi (`api/src/accommodations.ts`, migration 0053, console `Arrangements.tsx`). Section-wise time wale exam me sirf poore exam ka time badhta hai; scribe sirf note hai, invigilator karta hai |
| CL63 | Handwritten marks Results aur CO–PO me | ❌ | Hataya (2 Oct 2026, [LAUNCH-PLAN.md](LAUNCH-PLAN.md) §3): product sirf tech; code git history me, tables migration 0055 se gaye |
| CL64 | Online written answers par doosra examiner | ⬜ | |
| CL65 | Internal marks (CIA) ka jod, university format | ❌ | Hataya (2 Oct 2026, [LAUNCH-PLAN.md](LAUNCH-PLAN.md) §3): product sirf tech; code git history me, tables migration 0055 se gaye |
| CL66 | Company CRM (contacts, visits, MoU) | ⬜ | |
| CL67 | Nayi drive ki alert eligible students ko | ✅ | "Tell eligible students": sirf eligible aur drive me na jude students ko email/WhatsApp, apply link ke saath, ek student ko ek drive ki ek baar (`api/src/student-messages.ts`). Apply link khula hona chahiye; button TPO dabata hai, apne aap nahi. WhatsApp template Meta se manzoor hona baaki |

#### Company ka safar

**1. Judna aur jodna**

| ID | Feature | Status | Note |
|---|---|---|---|
| CO1 | Self sign-up, roles, 2FA, SSO (Google, Entra, Okta) | ✅ | |
| CO2 | ATS: Greenhouse, Lever, Zoho Recruit, Darwinbox; Test connection | ✅ | Asli accounts par abhi nahi chalaya |
| CO3 | Webhooks (signed), API keys, OpenAPI | ✅ | |
| CO4 | Naukri/LinkedIn job se candidate lana | ⬜ | Unki API ki shartein pehle dekhni hongi |

**2. Job se test**

| ID | Feature | Status | Note |
|---|---|---|---|
| CO5 | Question bank, coding, sections, random paper, negative marking | ✅ | College jaisa hi |
| CO6 | **JD chipkao → test ka draft** (skills, levels, time), recruiter badle | ✅ | Exams → "From a job"; `api/src/job-test.ts`. Model sirf role, seniority aur skills padhta hai; sawaal hamesha apne bank se, kami saaf likhi. Kharcha spend cap me ("author" route, migration 0030). Asli model par abhi nahi chalaya (tests fake model se). Screenshots `pilot-21`, `pilot-22` |
| CO7 | **Role library**: Java/Python dev, data analyst, QA, DevOps, BPO, sales, fresher aptitude | ✅ | `api/src/roles.ts`: **60 tech roles**, 7 families (plan 84, 2 Oct 2026); console me search aur groups. Support/BPO aur sales hataye: product sirf tech |
| CO8 | SQL exam me (practice me pehle se) | 🟡 | Runner me SQL hai. Exam ke author flow me jaanchna baaki |
| CO9 | Frontend/full-stack task (React, API) browser IDE me | ⬜ | |
| CO10 | **Bolkar ya video jawab** (communication, sales, BPO roles), English speaking score | ❌ | Hataya (2 Oct 2026, [LAUNCH-PLAN.md](LAUNCH-PLAN.md) §3): product sirf tech; code git history me, tables migration 0055 se gaye |
| CO11 | Take-home project (GitHub repo), rubric se check | ⬜ | |
| CO12 | "AI-allowed" test (prompts ledger me) | ⬜ | E5 |

**3. Candidates bulana**

| ID | Feature | Status | Note |
|---|---|---|---|
| CO13 | CSV bulk invite, email/SMS/WhatsApp, reminders, ATS se apne aap | ✅ | |
| CO14 | **Open link / careers page** se khud apply karke test (eligibility sawaal ke saath) | ✅ | Drive ka public link, roll no. + college ki email; off-campus me naye log (`placement.ts` apply). Throttled |
| CO15 | **Multi-college drive**: 50 college, ek paper, ek samay, lab mode | ✅ | Partner college, har ek ka link, roll no. par college code, college-wise ginti, CSV me College (`DriveNetwork.tsx`). Lab mode pehle se. College-wise result report alag nahi |
| CO16 | Verified talent pool aur Parikshaa Score se search | ⬜ | E1, B3 |

**4. Test aur bharosa**

| ID | Feature | Status | Note |
|---|---|---|---|
| CO17 | Identity photo, webcam, browser events, micro-viva, code similarity | ✅ | |
| CO18 | Ledger, receipt, public verify | ✅ | |
| CO19 | Proxy pakadna: identity + awaaz ka viva, "saath baithe" jode | 🟡 | Ek network + browser se kai candidates, ek photo do jagah, AI se selfie ↔ ID ↔ webcam (`proxy.ts`, Results → Signs of a proxy). Sirf sanket. Awaaz ka viva nahi |
| CO20 | Second-device camera (phone se room ka view) | ⬜ | ROADMAP §14 me "not in it" |
| CO21 | Lockdown browser | ❌ abhi nahi | Install ka jhanjhat; lab mode aur viva pehle. Badi company maange to dobara sochenge |

**5. Shortlist**

| ID | Feature | Status | Note |
|---|---|---|---|
| CO22 | Cut-off, results, report, analytics, export | ✅ | |
| CO23 | **Hiring manager ko shortlist link** (expire hone wala), Shortlist/Reject button, comment | ✅ | Expire hone wala link, sirf marks, Shortlist/Hold/Reject + comment, recruiter ko Results par dikhe (`shortlists.ts`) |
| CO24 | Candidates ki side-by-side tulna | ⬜ | |
| CO25 | Score ka role benchmark ("is role ke top 20%") | ⬜ | Kaafi data ke baad |

**6. Interview**

| ID | Feature | Status | Note |
|---|---|---|---|
| CO26 | **Interview room**: video + saanjha code editor + whiteboard | 🟡 | Interview room: candidate link, live code (2 second), problem badalna, video bahar ka link (Jitsi ya apna) (`interviews.ts`). Whiteboard aur andar ka video nahi |
| CO27 | Interview scheduling (Google/Outlook calendar) | ✅ | Interview banate hi panel aur candidate ko email me `.ics` calendar invite, cancel par cancel wala invite; room se "Add to calendar" download (`interviews.ts` calendar). Google/Outlook API se seedha sync nahi; reschedule nahi, naya banana padta hai |
| CO28 | Structured scorecard har round ka, panel ke notes | ✅ | Criteria 1–5, recommendation, summary; interviewer ke private notes (`interviews.ts`) |
| CO29 | AI pehla round (awaaz, Hinglish), report insaan dekhe | ⬜ | A8 ka engine |

**7. Offer aur joining**

| ID | Feature | Status | Note |
|---|---|---|---|
| CO30 | Offer status tracking (offered, accepted, joined) | ✅ | Offer link: candidate accept/decline ek baar; sent/accepted/declined/waiting/joined/"join nahi kiya" (`placement.ts`, web OfferPage) |
| CO31 | DigiLocker se documents verify | ⬜ | |

**8. Paisa aur enterprise**

| ID | Feature | Status | Note |
|---|---|---|---|
| CO32 | Credits, monthly invoice, GST, TDS | ✅ | |
| CO33 | Pay-per-shortlist, saal ka contract | ⬜ | E6 |
| CO34 | Audit log, privacy notice, retention, data Bharat me, SECURITY.md | ✅ | |
| CO35 | DPA template, security questionnaire ka taiyaar jawab, status page, SLA | 🟡 | DPA aur SLA templates `docs/legal/` me, code se likhe; lawyer aur owner ki terms baaki. Questionnaire aur status page nahi |
| CO36 | Pentest, ISO 27001 | ⬜ | Paisa aur auditor chahiye (ROADMAP "not in here") |
| CO37 | Sales role template | ❌ | Nahi banega (2 Oct 2026): product sirf tech ([LAUNCH-PLAN.md](LAUNCH-PLAN.md) §1). Tech roles 60 ho gaye (plan 84) |
| CO38 | Funnel dashboard (drive aur college-wise) | ✅ | Har drive aur college ka applied → test → interview → offered → joined, aur chhode (`api/src/funnel.ts`, `/placement/funnel`, console Placement → Funnel) |
| CO39 | Candidate status page | ✅ | Apply karte hi candidate ko signed link; usme sirf apna round, test, interview, offer (`placement.ts` status, web StatusPage); recruiter har application ka link copy kar sake |
| CO40 | Fairness report (branch, college, bhasha) | ⬜ | |
| CO41 | Interview panel: kai interviewer, sabke scorecard | ✅ | 8 tak staff panel me; har ek apna scorecard, interview ka scorecard sabka average (recommendation ka jhukaav), sab score karein tab band (`interviews.ts` combine, migration 0052). Panel chunne ke liye staff list dekhne ki permission chahiye |
| CO42 | Offer email/WhatsApp se apne aap | ✅ | Offer banate hi outbox se email/WhatsApp (jo bhi student list me ho), bhejte waqt check: offer badla ya jawab aa gaya to nahi jaata (`student-messages.ts`). WhatsApp template Meta se manzoor hona baaki |
| CO43 | Background verification handoff | ⬜ | |
| T1 | Scan copies, student contact, interview notes seal + retention | ✅ | AES-256-GCM, server key se nikli alag key har tarah ke data ke liye: copies ke pages aur AI sujhav, student list ka email/phone, interview ka email/code/notes, divyang note; retention sweep copies aur khatam interviews par (`store/src/sealing.ts`, migration 0048, `privacy.ts`). Pehle se pada plain data dobara likhne par hi seal hota hai |
| T2 | Asli model par evals: JD, handwriting, photo | ⬜ | API key ka intezaar |
| T3 | "AI ne sujhaya, X ne manzoor kiya" har jagah ek jaisa | ⬜ | |

#### Pehle kya banega (college + company, top 12)

Ye kram isliye hai kyunki inme kam mehnat me sabse zyada "aasaan" aur "bharosa" milta hai, aur ye pilot colleges se seedha jude hain:

1. CL8 Student master + CL52 Drive manager: TPO ka Excel khatam
2. CO6 JD se test + CO7 role library: recruiter 10 minute me test bheje
3. CL24 Admit card + CL25 seat allocation: exam din ki tension kam
4. CO23 Hiring manager shortlist link
5. CL57 Saal ka licence, PO aur NEFT
6. CL51 Readiness heatmap
7. CO14 Open link se apply (off-campus drive)
8. CL54 NIRF/NAAC + CL47 CO–PO reports
9. CL32 Kai lab ek dashboard + CL33 invigilator phone se
10. CO10 Bolkar jawab aur English speaking
11. CO26 Interview room
12. CL39 Handwritten checking (evals ke baad)

Inka kaam V2-P2 (college) aur V2-P3 (company) me aata hai. Build shuru karte waqt har ID upar ki Plan table me alag row banega.

### V2-13. Jo ban gaya, wo dikhta kaisa hai (screenshots)

College aur company ke bane hue features ki tasveerein, `packages/e2e/screenshots/college.shots.ts` se asli server aur browser par li gayi (`npm run screenshots -w @parikshaa/e2e`). Pehle ki tasveerein (`pilot-01`…`pilot-22`: WhatsApp invite, lab mode, recheck, scorecard, students, drive, JD se test) [PILOT.md](PILOT.md) me hain.

| File | Kya dikhta hai | Tasveer |
|---|---|---|
| `college-01-seats-and-arrangements` | Exam din: seats aur admit card, divyang suvidha (CL24, CL25, CL62) | ![Exam din: seats aur admit card, divyang suvidha (CL24, CL25, CL62)](screenshots/college-01-seats-and-arrangements.png) |
| `college-02-candidate-arrangements` | Candidate ke instructions me uski suvidha (CL62) | ![Candidate ke instructions me uski suvidha (CL62)](screenshots/college-02-candidate-arrangements.png) |
| `college-03-results-page` | Results ka poora page aur shortlist | ![Results ka poora page aur shortlist](screenshots/college-03-results-page.png) |
| `college-07-shortlists` | Hiring manager ke liye shortlist link (CO23) | ![Hiring manager ke liye shortlist link (CO23)](screenshots/college-07-shortlists.png) |
| `college-08-shortlist-for-the-manager` | Manager ka shortlist page, bina login (CO23) | ![Manager ka shortlist page, bina login (CO23)](screenshots/college-08-shortlist-for-the-manager.png) |
| `college-09-readiness` | Readiness heatmap, branch × topic (CL51) | ![Readiness heatmap, branch × topic (CL51)](screenshots/college-09-readiness.png) |
| `college-10-funnel` | Funnel, har drive aur college (CO38) | ![Funnel, har drive aur college (CO38)](screenshots/college-10-funnel.png) |
| `college-11-placement-report` | Year-wise placement report (CL54) | ![Year-wise placement report (CL54)](screenshots/college-11-placement-report.png) |
| `college-12-drive-colleges-offers-funnel` | Drive: apply link, alert, funnel, colleges, offers, status link (CO14, CO15, CO30, CL67) | ![Drive: apply link, alert, funnel, colleges, offers, status link (CO14, CO15, CO30, CL67)](screenshots/college-12-drive-colleges-offers-funnel.png) |
| `college-13-apply-page` | Student ka apply page (CO14) | ![Student ka apply page (CO14)](screenshots/college-13-apply-page.png) |
| `college-14-application-status` | Candidate status page (CO39) | ![Candidate status page (CO39)](screenshots/college-14-application-status.png) |
| `college-15-offer-page` | Offer page: accept/decline (CO30, CO42) | ![Offer page: accept/decline (CO30, CO42)](screenshots/college-15-offer-page.png) |
| `college-16-interview-room-scored` | Interview room: live code, scorecard, calendar (CO26, CO27) | ![Interview room: live code, scorecard, calendar (CO26, CO27)](screenshots/college-16-interview-room-scored.png) |
| `college-17-schedule-with-panel` | Interview schedule karna, panel ke saath (CO41) | ![Interview schedule karna, panel ke saath (CO41)](screenshots/college-17-schedule-with-panel.png) |
| `college-18-candidate-interview-room` | Candidate ka interview room (CO26) | ![Candidate ka interview room (CO26)](screenshots/college-18-candidate-interview-room.png) |
| `college-19-paper-review` | Paper review aur lock (CL60) | ![Paper review aur lock (CL60)](screenshots/college-19-paper-review.png) |
| `college-20-staff-sheet-and-departments` | Staff CSV se, departments (CL4, CL6) | ![Staff CSV se, departments (CL4, CL6)](screenshots/college-20-staff-sheet-and-departments.png) |
| `college-21-exams-with-department` | Exam list par department (CL6) | ![Exam list par department (CL6)](screenshots/college-21-exams-with-department.png) |
| `college-22-console-in-hindi` | Console Hindi me (CL5) | ![Console Hindi me (CL5)](screenshots/college-22-console-in-hindi.png) |
| `college-23-billing-quotation-neft` | Quotation aur NEFT se payment (CL57) | ![Quotation aur NEFT se payment (CL57)](screenshots/college-23-billing-quotation-neft.png) |
| `college-24-demo-test` | Demo test (CL26) | ![Demo test (CL26)](screenshots/college-24-demo-test.png) |

---

## Build log

Naya sabse upar.

| Tareekh | PR | Kya bana |
|---|---|---|
| 13 Oct 2026 | [#66](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/66) | **Hire H2c** (plan 112): pipeline (0073, `hire-pipeline-store.ts`, `hire-pipeline.ts`, `/hire/jobs/{jobId}/applications*`, `/hire/applications/*`): aage badhana/reject/restore ek saath 200 tak, integrity override par likhit wajah, notes, candidate ko message, rejection mail 24 ghante baad (restore par ruk jaati hai), har Hire mail "<Company> via Parikshaa" + reply-to |
| 12 Oct 2026 | [#66](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/66) | **Hire H2a (baaki) + H2b** (plan 112): jobs ka store, service aur `/hire/jobs*` (S18 limits, knockout niyam); apply: public job/careers page, notice (English + Hindi), apply ki saari jaanch, sealed copy, portal, withdraw, mails (0072). Saath me `main` ka toota lockfile theek (jsdom 30.1.1 pin) |
| 12 Oct 2026 | [#65](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/65) | **Hire v2 shuru**: design ([HIRE-V2.md](HIRE-V2.md)), maujooda code ka naksha, handoff file, plan rows 110–120; daily reminder ke 4 tests ki time bomb theek (plan 110). Saath me H1 (candidate accounts + resume, plan 111) aur H2a ki migration 0071 + naye roles |
| 4 Oct 2026 | [#47](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/47) | **G4a LeetCode jaisa IDE, pehla hissa** (plan 104): attempt me submissions ki history (purana code wapas), code playback (sealed edits, reviewer player, bade paste ka sanket), author ka reference program (saare tests, expected output bharna) |
| 3 Oct 2026 | [#47](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/47) | **G3 Judge0 backend** (plan 103): `Judge0CodeRunner` (batch + poll, bhasha naam se, verdict/checker hamare), in-house runner par fallback, `RUNNER_BACKEND`, `npm run parity`, `deploy/judge0` (hardened conf, apna compiler image, VM setup script + tests), image workflow |
| 3 Oct 2026 | [#47](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/47) | **G2 Parikshaa Library** (plan 102): global library (version, open/hire-only, exposure), console → Parikshaa Library (filters, preview, add, pick at random, newer version), operator tools, 165 built-in sawaal (CS, programming, DSA, SQL) |
| 3 Oct 2026 | [#47](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/47) | **G1 Company ID + operator panel** (plan 101): har organisation ka `PKC-XXXXXX`, console → Companies (sirf operator, second factor ke saath): company kholna + owner ko 7 din ka link, pause/resume, credits, invite dobara; audit dono taraf |
| 3 Oct 2026 | [#47](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/47) | **G0 staging ka code** (plan 100): photos Supabase Storage me (sealed), Vercel build + `/api` proxy edge secret ke saath, VM sirf API + runner Supabase DB par, deploy workflows, pooler test, [STAGING.md](STAGING.md); microphone wali Permissions-Policy galti theek |
| 3 Oct 2026 | [#47](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/47) | **F1 go-live plan** (sirf plan, code nahi): [F1-GO-LIVE-PLAN.md](F1-GO-LIVE-PLAN.md): Supabase/Vercel/VM ka bantwara, company ID + operator panel, Parikshaa Library, Judge0, LeetCode jaisa IDE, proctoring levels (live video, third eye, SEB), staging, kharcha; plan rows 100–109 |
| 3 Oct 2026 | [#46](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/46) | **F2b class ka student hissa + lab record**: practice site par "Meri classes" (verified email par), lab record me teacher ka sign-off aur PDF, console me lab drawer (plan 96) |
| 3 Oct 2026 | [#46](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/46) | **F2a Classes (staff ka hissa)**: class = cohort + course (track) + tests + contests, sessions aur haazri, har student ek line wala dashboard, console "Classes" page (plan 95) |
| 3 Oct 2026 | [#46](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/46) | **F1g candidate report v2**: report me AI use, poori report ka PDF, hiring manager ke liye expiry wala share link aur uska web page, console me PDF/Share (plan 90) |
| 3 Oct 2026 | [#46](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/46) | **F1f startup ka self-serve rasta**: signup par company/college, company home par "Hire in four steps", khaali bank me starter sawal ek click, signup se shortlist tak API test (plan 89) |
| 3 Oct 2026 | [#45](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/45) | **F1e take-home sawaal**: link + notes, model grade nahi karta, Marking me insaan marks deta hai (plan 88) |
| 2 Oct 2026 | [#45](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/45) | **F1d AI-fluency, pehla hissa**: code sawaal par AI assistant tab, har prompt/jawab ledger me (`ai_assisted`), reviewer ko poori baatcheet; migration 0062 (plan 87) |
| 2 Oct 2026 | [#45](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/45) | **Migrate workflow**: GitHub Actions se Mumbai DB me migrations, dry run pehle (plan 94) |
| 2 Oct 2026 | [#45](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/45) | **F1c-2 AI interviewer v2**: candidate ko link email se (aur cancel par), resume se sawaal (naam/email/phone/links hata kar model ko), retention sweep me AI interviews; migration 0061 (plan 93) |
| 2 Oct 2026 | [#44](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/44) | **F1c AI interviewer, chat + code**: role/JD se sawaal, har jawab par follow-up, samay seema, hash chain wala sealed transcript, AI ka saboot ke saath aakalan, faisla insaan ka; candidate ka chat page aur console page; migration 0060 (plan 86) |
| 2 Oct 2026 | [#44](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/44) | **F1b Proctoring v2, pehla hissa**: secure mode (poori screen share, doosri screen), awaaz ka signal (bina recording); migration 0059 (plan 85) |
| 2 Oct 2026 | [#43](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/43) | **F1a + Supabase Mumbai**: 60 tech role templates, 7 families, console me search (plan 84); Supabase `parikshaa-mumbai` me poora schema, migration 0056 (publishable key ke roles ka lockdown), 0057 (function search_path) aur 0058 (secret key ka `service_role` bhi band), advisor saaf; purane app ki problems ka importer + workflow (plan 91); [SUPABASE.md](SUPABASE.md) |
| 2 Oct 2026 | [#43](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/43) | **Launch plan v2 + F0 safai**: product sirf tech, teen darwaze ([LAUNCH-PLAN.md](LAUNCH-PLAN.md)); handwritten checking, CO–PO attainment, CIA internal marks aur spoken answers hataye (code, 13 API routes, console, tests, screenshots; migration 0055 tables hatati hai); placement report ab "year-wise"; onboarding test ka 1/64 flake theek |
| 2 Oct 2026 | [#42](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/42) | **M-F1 go-live ka code, AWS Mumbai** ([DEPLOY-AWS.md](DEPLOY-AWS.md)): `deploy/aws/` me bootstrap (state bucket, saajhi image repos), pilot machine (setup-server.sh, S3 backup, snapshot, Session Manager), managed stack (VPC, RDS 16 Multi-AZ + Hyderabad backup, ALB, Auto Scaling, gVisor runners alag, Secrets Manager, SES, alarms), staging/production; `put-secrets.sh`, `release.sh`, pilot→RDS import. Tests: terraform 13 (mocked), scripts 43, CI me RDS jaisa import + chain verify. Asli account par apply baaki (Ruka hua kaam) |
| 2 Oct 2026 | [#41](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/41) | [Master plan v3](MASTER-PLAN.md): ek Parikshaa ID, teen darwaze (Learn, Campus, Hire), ~90 epics phases 0–5 ke saath, UI/UX plan, Phase 0–1 ka task-level breakdown. Sirf plan, code nahi |
| 2 Oct 2026 | [#40](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/40) `a54d2aa`, `2fa24cd`, `c4827a7` | main (#39) merge: is branch ki migration ab `0054_prep_next`. CI (WebKit): "⋯" menu sirf button hilne par band hota hai (page ka koi hissa baad me load hone par nahi); onboarding test me beech me cancel hua animation bhi khatam gina jaata hai |
| 2 Oct 2026 | [#40](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/40) `95d19a3`, `c4bb7ed` | Plan 42: offline me diya jawab device par, net aate hi jama (contest ka nahi); lessons/tracks/problems offline. Plan 43: TWA ka server hissa (`assetlinks.json`), `docs/PLAY-STORE.md` |
| 2 Oct 2026 | [#40](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/40) `2e36ab7`, `783cf63`, `ce85a5e` | Plan 48: staff editorial ka code save par tests par chalta hai. Plan 45: SQL examples aur result tables me. Plan 46: plan me target role (SDE/backend/frontend/data) |
| 2 Oct 2026 | [#40](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/40) `eaecb4f`, `931ce8b`, `9da00af` | Plan 49: 17 DSA problems me "Better" tab. Plan 47: account delete par saara prep data (`prep_erase_study`). Plan 44: apne share links ki list aur hatana |
| 2 Oct 2026 | [#40](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/40) `347a0ea` | CI (WebKit): menu focus par band ho jaata tha, aur contrast check beech ke rang par naapta tha; dono theek |
| 2 Oct 2026 | [#38](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/38) `aa2fcde` | CI: F12 e2e invoice series (teen browser ek database) theek |
| 2 Oct 2026 | [#39](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/39) | Bane hue college/company features ke 24 screenshots (`college-01`…`college-24`, [V2-13](#v2-13-jo-ban-gaya-wo-dikhta-kaisa-hai-screenshots)); baaki 39 features ka kram Plan rows 65–74 (Batch A–J) me |
| 2 Oct 2026 | [#39](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/39) | Agle 12: naya data seal + retention (0048), handwritten marks Results/CO me, offer aur nayi drive email/WhatsApp se (0049), funnel, demo test, paper review + lock (0050), staff CSV + department (0051), interview panel + calendar invite (0052), internal marks (CIA), divyang suvidha (0053), candidate status page. Main ka toota build (#35 ke merge se gaye store exports) bhi theek |
| 2 Oct 2026 | [#38](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/38) `ea7e802` | Plan 41: PWA (manifest, icons, `sw.js`: page aur aaj ka plan offline, session ke hash par), push (`prep_push_subscriptions` 0047, `web-push`, sirf browsers ke push services, reminder email ke saath); account mitane par push aur public profile bhi mitte hain. `aefd54e`: CI stylelint ke 13 errors theek |
| 2 Oct 2026 | [#38](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/38) `c5aefc4` | Plan 40: lesson quiz (0046), galat jawab aur problem note se revision card, code ka read-only share link, problem list me company aur pattern filter |
| 2 Oct 2026 | [#38](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/38) `2a870a7` | Plan 39: interview experience report/flag (3 par hold), success stories, company logos, pattern analysis (0045) |
| 2 Oct 2026 | [#38](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/38) `a62d9e2` | Plan 38: public profile `/u/:username` (0044), achievement cards (SVG, story/square, en/hi), title har naam ke saath |
| 2 Oct 2026 | [#38](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/38) `a75c4c0` | Plan 37: Sahayak review fixed JSON me, interview follow-ups, 180 din baad chats delete (0043), console par eval scores |
| 2 Oct 2026 | [#38](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/38) `e175562` | Plan 34: contest rank coins, judge queue me contest lane (4:1), 2,000 learners ka load test (`e2e/contest-2000-*.txt`) |
| 2 Oct 2026 | [#38](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/38) `3799f75`, `471b592` | Plan 35: free trial, refund ke saath credit note, coins se coupon, monthly limit, DSA Pass |
| 2 Oct 2026 | [#38](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/38) `2206cfd` | Plan 36: weekday/weekend minutes, plan fit karne ke 3 tareeke, plan badalna, late email |
| 2 Oct 2026 | [#38](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/38) `e1b1892`, `2b543e2` | Main ki marammat (#36/#37 ke merge ke baad imports, migration list, openapi); baaki Prep features Plan me rows 34–41 |
| 1 Oct 2026 | [#34](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/34) | Top 12 ke baaki 10 aur 6 aur: admit card + seats + attendance (0031), shortlist link (0032), PO/NEFT (0033), readiness heatmap, apply link (0034), NIRF report + CO–PO (0035), bolkar jawab, interview room (0036), handwritten checking + moderation (0037), kai college ki drive (0038), offer tracking (0039), proxy sanket (0040), console Hindi, DPA/SLA templates. e2e 39/39, visual 74/74 |
| 1 Oct 2026 | [#34](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/34) | Student master + drive manager (CL8, CL52), JD se test + 9 roles ki library (CO6, CO7); console me Placement page aur "From a job"; migrations 0029, 0030; screenshots `pilot-19`…`pilot-22` |
| 1 Oct 2026 | — (branch `claude/elegant-ramanujan-hmolxs`) | V2-12: college aur company ka end-to-end feature list (94 features, har ek ka aaj ka status), 3 usool, pehle banne wale top 12 |
| 1 Oct 2026 | — (branch `claude/elegant-ramanujan-hmolxs`) | Master plan v2 likha: competitors, dono taraf ki zaroorat, 6 bade daav, 9 stambh, phases, metrics, khatre. Abhi sirf plan, code nahi |
| 30 Sep 2026 | [#33](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/33) `850cb5d` | Pehla hint admin ka likha (free, bina AI); worked solution ke baad solve par coins aadhe; tracker me "Ruka hua kaam" |
| 30 Sep 2026 | [#33](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/33) `cdf6fd9` | Sahayak evals ka dhaancha: 40 problems (360 cases), runner, grading, judge-sanity, tests. Paid baseline run abhi baaki |
| 30 Sep 2026 | [#33](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/33) | Ye tracker, aur `CLAUDE.md` me rule ki har build ise update kare |
| 29 Sep 2026 | [#30](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/30) `84391f5` | Prep pages design system par; interview rounds me problems ke titles; screenshots, visual baselines, prep pages par axe |
| 29 Sep 2026 | [#27](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/27) `a270c39` | SQL (SQLite) runner language, editorial approach tabs, starter packs (CS fundamentals, SQL), ROADMAP §16 |
| 29 Sep 2026 | #27 `a858ee4` | Companies (30/60/180), interview experiences, coin store, contest rating, titles, achievements; account delete ab prep data bhi hatata hai |
| 28 Sep 2026 | #27 `4452ad8`, `6db65a4` | Plus (Razorpay), credits, Sahayak tutor (hint, review, doubt), learner aur console pages |
| 28 Sep 2026 | #27 `0fe6512`, `c939807` | Tracks, lessons, study plan, focus timer, revision, lists, notes, POTD, coins; learner pages aur console authoring |
| 28 Sep 2026 | — | Blueprint bana: TUF ZENKAI research + poora plan |
