# Parikshaa Prep — build tracker

**Parikshaa Prep Blueprint** (28 Sep 2026) ka har feature yahan track hota hai: kya ban gaya, kya aadha hai, kya baaki hai, aur aage kya banana hai. Blueprint ka poora plan (design, flows, data model, pricing) yahan hai: <https://claude.ai/artifact/AGkGV3SkmmsszWzL4EVZuh>. Isi ka engineering version [ROADMAP §16](ROADMAP.md#16-prep-a-practice-site-to-prepare-on) me hai. Blueprint ke aage ka bada plan (Pramaan, Parikshaa Score, college aur company ka hissa, dusre exams) [Master plan v2](#master-plan-v2-taiyaari-se-naukri-tak-ek-bharosemand-platform) me hai: abhi prastaav, owner ki haan baaki.

Aakhri update: **1 Oct 2026** (Master plan v2 joda) · Prep ka kaam PR [#27](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/27) aur [#30](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/30) me merge hua

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
| Dashboard aur planner | 7 | 2 | 6 | 0 |
| Learn aur practice | 6 | 3 | 2 | 0 |
| Revision, lists, notes | 4 | 1 | 2 | 0 |
| Sahayak AI | 12 | 3 | 3 | 0 |
| Plus aur payment | 5 | 2 | 6 | 0 |
| Coins, store, gamification | 10 | 2 | 3 | 0 |
| Company prep aur community | 8 | 1 | 6 | 0 |
| Contests | 3 | 0 | 2 | 0 |
| Content | 3 | 1 | 5 | 1 |
| Platform, quality, B2B | 6 | 2 | 5 | 0 |
| **Kul** | **64** | **17** | **40** | **1** |

Ye ginti neeche ki tables se hai. Koi row badle to ye bhi badlo.

Seedhi baat: blueprint ka **core loop** (aaj ka plan → kaam → atakne par Sahayak → coins aur streak → company readiness) **chal raha hai**. Sabse bade baaki kaam hain: **content** (editorials, videos, static hints, company data), **payments ki poori dukaan** (coupons, invoices, passes), **Sahayak ke evals**, aur **reminders aur analytics**.

---

## Status, blueprint ke hisaab se

### 1. Dashboard aur onboarding (blueprint S1, S2, F1)

| Feature | Status | Kahan | Note |
|---|---|---|---|
| Dashboard: aaj ka plan sabse upar, streak, coins, POTD, due revision, "continue" | ✅ | `web/src/practice/PrepPages.tsx` → `HomePage`; API `GET /practice/:site/home` | Pehli visit par +1 coin check-in |
| Onboarding: track, level, deadline, roz ke minutes, off days, plan preview | ✅ | `PlanSetup`; `POST /practice/:site/plan/preview` | |
| Onboarding: 8 sawaal ka placement quiz | ⬜ | | Level abhi khud chunna padta hai |
| Onboarding: target role aur companies | ⬜ | | Company page alag se hai, plan se juda nahi |
| Weekday aur weekend ke alag minutes | ⬜ | | Abhi ek hi "roz ke minutes" |

### 2. Planner, "Planly" jaisa (S6, F2, F6, F7)

| Feature | Status | Kahan | Note |
|---|---|---|---|
| Deterministic plan generator, 7 din ke sprints, har sprint ke ant me revision, 20% din khaali | ✅ | `api/src/prep-plan.ts` | Golden tests: `prep-plan.test.ts` |
| Chhoota task apne aap aage, nayi finish date, "on track" | ✅ | `reschedule()`; plan padhte waqt chalta hai | Cron nahi: app kholne par hota hai |
| Time kam pade to 3 raaste (deadline aage, time zyada, chhoti sheet) | 🟡 | `fits` flag | Suggestion wala UI baaki |
| Today, Sprints, Completed tabs | ✅ | `PlanView` | |
| Apne custom tasks | ✅ | `POST /plan/tasks` | |
| Study mode / focus timer, hafte ka total | ✅ | `FocusTimer`; `prep_focus` | |
| Plan settings (deadline ya time badalna) | 🟡 | `DELETE /plan` | Abhi plan band karke naya banana padta hai |
| Streak freeze ("aaj chhutti") | ⬜ | | |
| Sprint ke revision notes + sprint quiz | ⬜ | | Blueprint F7 |
| Finish date badalne par email | ⬜ | | Reminders ke saath aayega |

### 3. Learn aur practice (S3, S4, F3, F10)

| Feature | Status | Kahan | Note |
|---|---|---|---|
| Tracks (sheets): modules me lessons aur problems | ✅ | `prep_tracks`, console → Practice → Tracks | |
| Lessons: Markdown + video link, "done" | ✅ | `LessonPage` | |
| Har track ke pehle modules free, baaki Plus | ✅ | `PrepService.#locked` | |
| Video hosting, player progress, signed URL, watermark | ⬜ | | Abhi sirf bahar ka link. Host ka faisla baaki |
| Lesson ke andar quiz | 🟡 | | Track me lesson ke baad MCQ problems rakhe ja sakte hain (CS pack yahi karta hai) |
| Problem workspace, Run/Submit, drafts device par | ✅ | §15 practice site | |
| Editorial Brute / Better / Optimal tabs | ✅ | `web/src/practice/editorial.ts` | `## Brute force`, `## Better`, `## Optimal` headings se |
| SQL practice | 🟡 | runner `sql` language (SQLite) | Chalta hai. Result table aur schema viewer UI baaki: output text me dikhta hai |
| Problem of the day + calendar, +5 coins | ✅ | `PotdPage`, console → Problem of the day | |
| Online IDE ka share link | ⬜ | | |
| Company, topic aur pattern se problem filter | 🟡 | | Topic (tags) aur difficulty hai. Company aur pattern filter baaki |

### 4. Revision, lists, notes (S8, F8, F15)

| Feature | Status | Kahan | Note |
|---|---|---|---|
| Spaced revision (SM-2 lite), roz max 15 cards | ✅ | `RevisePage`; `review()` in `prep-plan.ts` | Solve karte hi card banta hai |
| Galat quiz sawaal ya note se bhi card | 🟡 | | Abhi sirf solved problems se |
| Lists (bookmarks + apni lists) | ✅ | `SaveMenu`, `ListsPage` | |
| Notes: problem, lesson ya topic par | ✅ | `NoteEditor`, `NotesPage` | |
| Notes ka AI draft | ⬜ | | Sahayak ka "notes" mode |
| Notes ka PDF export | ⬜ | | |
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
| Review ka fixed JSON (logic, complexity, quality, edge cases) | 🟡 | | Review Markdown me aata hai, fixed JSON nahi |
| Notes draft mode | ⬜ | | |
| Interview follow-up sawaal | ⬜ | | Phase 6 |
| Chats 180 din baad apne aap delete | ⬜ | | DPDP |
| Evals (hint me code leak nahi, review bug pakde, doubt par solution nahi) | 🟡 | `api/src/testing/sahayak-eval/`, `.claude/hillclimb/sahayak-*` | 360 cases (40 problems), grading aur runner tests ke saath ban gaye. **Paid baseline run abhi nahi hua**: API key aur owner ki manzoori chahiye. Scores abhi nahi hain |
| Admin page par AI kharcha aur eval scores | 🟡 | console Usage page | Kharcha dikhta hai, evals nahi |

### 6. Plus aur payment (section 16, F12, F16)

| Feature | Status | Kahan | Note |
|---|---|---|---|
| Plus on/off per site, free modules, monthly credits | ✅ | console → Practice → Plus | |
| Plans (Plus ke din, ya credits pack), staff set karta hai | ✅ | `prep_products` | |
| Razorpay Checkout + webhook, signature verify, idempotent | ✅ | `api/src/prep-plus.ts` | |
| Plus se lessons, plan, company ki poori list khulti hai | ✅ | | |
| Staff kisi learner ko Plus de (campus licence, scholarship) | ✅ | `POST /practice-admin/learners/:id/plus` | |
| Plan/pricing page | 🟡 | `PlusPage` | Plans aur kharidna hai. FAQ aur GST breakup page baaki |
| Billing page: orders | 🟡 | `GET /orders` | Orders dikhte hain. Invoices baaki |
| Learner ke liye GST invoice (PDF, number series) | ⬜ | | Exam billing ka `gst.ts` reuse ho sakta hai |
| Coupons aur affiliate `?ref=` | ⬜ | | |
| Alag passes (DSA Pass, Company Pass) | ⬜ | | Abhi ek hi "Plus" |
| Purane users ko 30 din ka trial | ⬜ | | Staff grant se haath se ho sakta hai |
| Refund flow | ⬜ | | |
| Campus licence: CSV se bulk Plus, college dashboard | ⬜ | | Abhi ek-ek learner ko grant |

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
| "Mahine me 1" jaisi limit | 🟡 | `per_learner` | Abhi kul limit hai, mahine wali nahi |
| Title naam ke saath har jagah | 🟡 | | Rating page par dikhta hai |
| Quiz pass par +20, contest rank par coins | ⬜ | | |
| Shareable achievement cards | ⬜ | | |
| Store me coupons | ⬜ | | |

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
| Pattern analysis (sirf topic nahi) | 🟡 | | Tags se topics. Alag "pattern" field nahi |
| "Is company ki list shuru karo" (folder) | ⬜ | | |
| Readiness score (top 50 me kitne solved) | ⬜ | | |
| Plan ke aakhri 30% din me target company problems | ⬜ | | |
| Company logos | ⬜ | | |
| Experience report/flag karna (learner) | ⬜ | | |
| Success stories | ⬜ | | |

### 9. Contests (F11)

| Feature | Status | Kahan | Note |
|---|---|---|---|
| Weekly contests, ICPC scoreboard | ✅ | §15 | |
| Rating: Elo, contest khatam hone ke baad ek baar | ✅ | `api/src/prep-community.ts` | |
| Contest me Sahayak aur editorial band | ✅ | | |
| Judge ki priority lane, queue, autoscale | ⬜ | | Contest day ke liye |
| Public profile `/u/:username` | ⬜ | | |

### 10. Content (section 15)

| Feature | Status | Kahan | Note |
|---|---|---|---|
| Content database me, console se edit | ✅ | tracks, lessons, problems | Deploy ki zaroorat nahi |
| Starter pack: CS fundamentals (80 sawaal, 6 subjects, Parikshaa-New se) | ✅ | `api/src/content/cs-fundamentals.ts` | `scripts/cs-fundamentals-pack.mjs` se dobara banta hai |
| Starter pack: SQL, 8 problems, approaches ke saath | ✅ | `api/src/content/sql-starter.ts` | Reference queries tests me asli runner par chalti hain |
| Editorial code ka CI quality gate | 🟡 | `content.test.ts` | Sirf SQL pack ke liye. Har editorial ke liye baaki |
| Top 150 problems ke Brute/Better/Optimal editorials | ⬜ | | Content team |
| 300 static hints | ⬜ | | Parikshaa-New ka `problemHints.ts` LeetCode slugs par hai, apne problems banne par jodna |
| 25 companies ka data | ⬜ | | Asli reports chahiye. Parikshaa-New ke company tags hash se bane hain, isliye nahi liye |
| 60 video lessons | ⬜ | | |
| Placement quiz ke 40 sawaal | ⬜ | | |
| Parikshaa-New ki baaki sheets | ❌ | | Ye LeetCode ke links hain, yahan chalne wale problems nahi. Apne problems banne par sheet bana sakte hain |

### 11. Platform, quality, B2B (sections 17, 20)

| Feature | Status | Kahan | Note |
|---|---|---|---|
| RLS har naye table par, learner sirf apna data padhe | ✅ | migrations 0019–0021 | Tests `parikshaa_app` role se chalte hain |
| Ledgers (coins, credits) kabhi negative nahi, double event par ek entry | ✅ | | Concurrency tests |
| Payments: webhook replay, galat signature, double webhook | ✅ | `prep-plus.test.ts` | |
| Hindi strings, naye pages ke | ✅ | `prep-text.ts`, `community-text.ts` | |
| Bundle budget, pages lazy-load | ✅ | `bundle-budget.json` | |
| Account delete par sara prep data | 🟡 | `eraseLearner` | Notes, tutor, votes, address hat-te hain. Plan, cards, coins ke rows reh jaate hain (bina naam ke account se jude) |
| Playwright e2e: onboarding → plan, solve, purchase, redeem | 🟡 | `e2e/tests/practice.spec.ts` | Prep pages ka WCAG AA check dono themes me hai. Click karke poore flows (F1, F12, F13) ka e2e baaki |
| Design system par prep pages, screenshots, visual baselines | ✅ | `e2e/visual/prep.visual.ts`, `docs/screenshots/prep-*` | 19 learner + 7 console screenshots, 17 visual baselines |
| Analytics events (signup, task_done, hint_used, purchase…) | ⬜ | | Metrics (activation, D7) naapne ke liye |
| Roz ke reminders (email/push) | ⬜ | | |
| Contest load test (2,000 ek saath) | ⬜ | | |
| Runner queue + autoscale | ⬜ | | |
| PWA push | ⬜ | | Phase 6 |

---

## Phases (blueprint section 18)

| Phase | Blueprint me | Status | Kya baaki |
|---|---|---|---|
| P0 · Cleanup aur foundation | Parikshaa-New ke retired model, do plan systems, runner shadow mode | ❌ yahan laagu nahi | Base repo badla (neeche faisle dekho). Parikshaa-New me ye kaam abhi bhi pending hain, agar wahan kaam ho |
| P1 · Plans aur payment | Products, entitlements, Razorpay, pricing, billing | 🟡 | Coupons, invoices, passes, trial |
| P2 · Planner v2 | Onboarding, generator, sprints, reschedule, revision, dashboard | 🟡 | Sprint quiz, streak freeze, reminders, placement quiz |
| P3 · Sahayak AI | Hint, review, doubt, credits, contest lock, evals | 🟡 | Evals ka paid run, notes draft, 180 din delete |
| P4 · Coins, store, company v2 | Coins, store, company 30/60/180, titles | ✅ zyaadatar | Company Pass, readiness, contest coins |
| P5 · Lessons aur NoteSpace | Lessons, videos, editorial format, notes, PDF | 🟡 | Video hosting, PDF export, AI draft |
| P6 · Aage | Content, follow-ups, PWA, campus, subscriptions | ⬜ | |

## Flows (blueprint section 9)

| Flow | Status | Note |
|---|---|---|
| F1 Sign up → onboarding → pehla plan | 🟡 | Placement quiz aur target companies baaki |
| F2 Roz ka loop | 🟡 | Reminder email baaki |
| F3 Run aur Submit | ✅ | |
| F4 Sahayak hint ladder | ✅ | Static hint 1 aur coins aadhe ban gaye. Hints ka content likhna baaki |
| F5 Submit ke baad review | 🟡 | Fixed JSON format baaki |
| F6 Chhoota task reschedule | ✅ | App kholne par. Cron aur email baaki |
| F7 Sprint notes + quiz | ⬜ | |
| F8 Spaced revision | ✅ | |
| F9 Company prep | 🟡 | Folder, readiness baaki |
| F10 POTD, streak, coins | ✅ | |
| F11 Contest + rating | ✅ | Contest coins aur priority lane baaki |
| F12 Plus kharidna | ✅ | Coupon aur invoice baaki |
| F13 Coins se redeem | ✅ | |
| F14 Interview experience | ✅ | |
| F15 Note se PDF | ⬜ | |
| F16 Campus licence | 🟡 | Ek-ek grant. Bulk CSV aur college dashboard baaki |

## Faisle (blueprint section 21)

| Sawaal | Faisla | Kab |
|---|---|---|
| Base repo | **Parikshaa-AI-Upgrade** me banaya (blueprint ne Parikshaa-New kaha tha). Parikshaa-New se content aur ideas liye | 28 Sep 2026 |
| Code judge | Apna runner (is repo ka). Fermion nahi | 28 Sep 2026 |
| AI provider | Claude. Model `TUTOR_MODEL` env se badla ja sakta hai | 28 Sep 2026 |
| Naam aur brand | "Parikshaa Prep" kaam chalane ka naam. **Pakka karna baaki** | — |
| Prices | Staff console me khud set karta hai. Blueprint ke numbers (₹3,999/₹6,999…) **pakka karna baaki** | — |
| Videos: kaun, kis bhasha me, hosting kahan | **Baaki** | — |
| Scope: placement prep se aage (college ka TPO OS, company ka talent pool, coaching aur dusre exams) | **Prastaav**, [Master plan v2](#master-plan-v2-taiyaari-se-naukri-tak-ek-bharosemand-platform). Owner ki haan baaki | — |
| Student ke liye core taiyaari, Parikshaa Score aur Pramaan hamesha free; paisa company, college aur coaching se | **Prastaav** (V2-7). Owner ki haan baaki | — |
| Sahayak evals ka size | Blueprint me 200 problems the; owner ne **40 problems × 3 galat programs** chune (har flow me 120 cases, kul 360). Problems apne likhe hain, kisi site se copy nahi | 30 Sep 2026 |

---

## Ruka hua kaam (owner ke intezaar me)

Ye kaam code me taiyaar hain, lekin owner ki taraf se kuch chahiye. Owner "kya pending hai" pooche to sabse pehle ye list batani hai.

| Kaam | Kis cheez ka intezaar | Uske baad kya hoga | Kab se |
|---|---|---|---|
| **Sahayak evals ka paid run** (plan 1a) | Environment me `ANTHROPIC_API_KEY` (cloud environment → Edit → environment variable; `api.anthropic.com` network me allow). Phir owner ki haan | 1) judge-sanity (~$0.10) 2) pilot, 24 cases 3) grading par owner ki manzoori 4) pilot se kharche ka andaaza aur haan 5) poora baseline (360 cases), `report.html`, tracker me scores | 30 Sep 2026 |
| **Master plan v2 par faisla** | Owner ki haan ya na, aur [V2-11](#v2-11-owner-se-kya-chahiye) ki list (naam, budget, content, DigiLocker, pilot partners) | Haan ke baad V2-P0 ki entries upar ki Plan table me (row 10 se), phir build | 1 Oct 2026 |

## Plan: aage kya banega

Naya kaam shuru karne se pehle yahan entry jodo. Kaam ho jaaye to status ✅ karke upar ki table update karo, aur entry ko [Build log](#build-log) me le jao.

Sujhaya gaya kram (sabse zaroori pehle):

| # | Kaam | Blueprint | Kyun | Done kab | Status |
|---|---|---|---|---|---|
| 1a | **Sahayak evals** (shuru: 30 Sep 2026). Teen evals, ek hi case set par: **hint** (rung 1–2 me code ya poora algorithm leak na ho), **review** (planted bug pakde, learner ke code ki complexity sahi bataye, sahi program na likh de), **doubt** ("bas code de do" par bhi solution na de, sawaal ka jawab de). Cases: 40 apne likhe problems × 3 galat solutions (off-by-one, overflow, TLE), har galat solution runner par sach me fail hota hai; 120 doubts; ~20% Hindi. Judge: `claude-sonnet-5-5`, structured output. Runner asli `Sahayak` class chalata hai (PGlite par). Paid run sirf owner ki manzoori ke baad. **Ab tak:** cases owner ne manzoor kiye (30 Sep); 40 problems ke saare galat programs runner par check; runner, grader, judge-sanity aur tests ban gaye. **Baaki:** API key, pilot (24 cases), grading par manzoori, kharche ka andaaza, baseline run | §14, F4, F5 | Launch se pehle safety aur kharcha | Inputs aur grading par owner ki manzoori; baseline run ka `report.html`; targets: hint leak-free 98%, review bug 90%, complexity 95% | 🟡 chal raha |
| 1b | **Static hint 1 + solution par coins aadhe** (shuru: 30 Sep 2026). Admin har problem par ek "pehla hint" likh sake (console). Hint ladder ka rung 1 us problem par wahi hint dikhaye: model call nahi, credits 0. Hint na likha ho to pehle jaisa AI rung 1. Jis learner ne rung 4 (poora solution) le liya, us problem ko solve karne par coins aadhe | §14, F4 | AI ka kharcha bachana, aur solution dekh kar coins kamane par rok | Tests: static hint par model call nahi aur credit nahi katta; hint na ho to AI; rung 4 ke baad solve par aadhe coins; console me hint likhna/badalna | ✅ ban gaya (30 Sep 2026) |
| 2 | Coupons, GST invoices, pricing page ka GST breakup | §16, F12 | Paid launch ke liye zaroori | Test mode me coupon ke saath kharidna, invoice PDF | ⬜ |
| 3 | Roz ke reminders + analytics events | F2, §17 | Retention aur metrics naapna | D7 aur activation dashboard par | ⬜ |
| 4 | Sprint quiz + revision notes, streak freeze | F7, 13.2 | Planner poora | Sprint ke ant me quiz, 70% se kam par revise tasks | ⬜ |
| 5 | Playwright e2e: F1, F3, F12, F13 ke click-through flows | §20 | Regression se bachav | CI me chalein | ⬜ |
| 6 | Company v2: readiness, "list shuru karo", Company Pass | F9 | Company prep poora | Readiness dashboard par | ⬜ |
| 7 | NoteSpace: AI draft, PDF export | F15 | Phase 5 | Topic ke notes ek PDF me | ⬜ |
| 8 | Campus licence: CSV se bulk Plus, college dashboard | F16 | B2B sales | 500 students ek CSV se | ⬜ |
| 9 | Content: 150 editorials, 300 hints, 25 companies, videos | §15 | Log content ke liye aate hain | Har phase ka content target | ⬜ |
| 10 | **V2-P0 Neev**: 1a–5 poore, PWA v1 (A1), achievement cards (C1), public profile (C6), pehla load test (G) | Master plan v2 | Baaki sab isi par khada hai | V2-8 ka gate: D1/D7 naap rahe; 1,000 ka exam start paas | ⬜ owner ki haan baaki |
| 11 | **V2-P1 Saboot**: Pramaan (B1), viva-verified solves (B2), leak-proof paper (B4), Premier League, squads, referral, WhatsApp sawaal | Master plan v2 | Hamara sabse bada fark | 20 college, 10,000 learners, D7 ≥ 25% | ⬜ owner ki haan baaki |
| 12 | **V2-P2 College**: TPO OS (D1–D5, D7; list [V2-12](#v2-12-college-aur-company-end-to-end-feature-list)), handwritten checking beta (D6), mock OA (A5) | Master plan v2 | Distribution ka sasta rasta | 50 college har hafte active; 3 paid pilot | ⬜ owner ki haan baaki |
| 13 | **V2-P3 Company** ([V2-12](#v2-12-college-aur-company-end-to-end-feature-list)): Parikshaa Score (B3), talent pool, hiring challenge, interview room, AI-allowed test (E1–E6) | Master plan v2 | Paisa yahan se | 20 paying companies; Score se 100 hiring | ⬜ owner ki haan baaki |
| 14 | **V2-P4 Aur exams + Bharat**: coaching white-label, OMR scan, GATE, SSC/Bank (F1–F4), awaaz + 11 bhashayein (A7), creators | Master plan v2 | Placement ke bahar ka bazaar | 25 coaching; Hindi/regional ≥ 40% | ⬜ owner ki haan baaki |
| 15 | **V2-P5 Scale + certificate**: 10,000 ka contest, pentest + bug bounty, DigiLocker, Play Store app | Master plan v2 | Badi company aur sarkar ka bharosa | Pentest ke critical/high 0 | ⬜ owner ki haan baaki |
| 16 | **Student master + drive manager** (CL8, CL52; shuru: 1 Oct 2026). College ke students ek baar (roll no., naam, email, phone, branch, batch, CGPA, backlogs) CSV se, dry run ke saath, dobara import par update. Drive: company, role, CTC, JD, eligibility (min CGPA, max backlogs, branches, batches), apply-by; eligible students apne aap nikle, drive me jude, rounds me aage badhein (applied → test → interview → offer/reject → joined), drive ke exam ka test ek click me bheja jaaye, CSV export company ke liye | V2-12 | TPO ka Excel khatam; NIRF ka data yahin se | Tests: import (galat CGPA, duplicate, update), eligibility, stage badalna audit ke saath, test bhejna; console me Students aur Drives page; screenshots | ✅ ban gaya (1 Oct 2026) |
| 17 | **JD se test + role library** (CO6, CO7; shuru: 1 Oct 2026). 8+ role templates (fresher aptitude, Java dev, Python dev, frontend, data analyst, QA, DevOps, BPO/support): skills, sections, time, difficulty. JD chipkao: model skills aur level nikaale (bina model ke role template se). Question bank se har section ke sawaal chune jaayein, kami ho to saaf bataya jaaye; draft exam editor me khule, author badle aur save kare | V2-12 | Recruiter 10 minute me test bheje | Tests: role template se draft, JD se skills (fake model), bank me kami ki report, draft save hokar exam bane; console me "New test from a job" | ✅ ban gaya (1 Oct 2026) |

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
| CL4 | Staff ko CSV se ek saath jodna (department-wise) | ⬜ | Aaj staff ek-ek karke jodte hain |
| CL5 | Console Hindi me | ⬜ | Aaj console sirf English me (ROADMAP §9) |
| CL6 | Department aur campus (ek university, kai college) | ⬜ | Aaj ek organisation = ek unit |

**2. Students ka data**

| ID | Feature | Status | Note |
|---|---|---|---|
| CL7 | Har exam ke liye candidates CSV se, dry run ke saath | ✅ | ROADMAP §5 |
| CL8 | **Student master**: roll no., branch, batch, CGPA, backlogs, phone. Ek baar daalo, har exam aur drive me kaam aaye | ✅ | Console → Placement → Students; `api/src/placement.ts`, `student-import.ts`, migration 0029. CSV dry run ke saath, dobara import par update. Screenshot `pilot-19` |
| CL9 | Student khud register kare (college ka link), TPO manzoor kare | ⬜ | |
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
| CL19 | Har sawaal ka CO (course outcome) aur Bloom level | ⬜ | CO–PO report ke liye (D5) |
| CL20 | Parameterised variants (har candidate ke alag numbers) | ⬜ | Leak-proof paper (B4) |

**4. Exam se pehle**

| ID | Feature | Status | Note |
|---|---|---|---|
| CL21 | Exam window, invitation email, SMS (MSG91) aur WhatsApp; din pehle aur ghanta pehle reminder | ✅ | |
| CL22 | Time badalne par sabko naya time apne aap | ✅ | |
| CL23 | Try test (staff preview), system check candidate ke liye | ✅ | |
| CL24 | **Admit card / hall ticket PDF**: photo, seat, lab, QR | ⬜ | Colleges ki roz ki zaroorat |
| CL25 | Lab aur seat allocation (kaunsa student kaunse lab, kaunsi seat) | ⬜ | |
| CL26 | Candidate ke liye demo test (asli jaisa, bina marks) | ⬜ | Pehli baar CBT dene walon ka dar kam |

**5. Exam ka din**

| ID | Feature | Status | Note |
|---|---|---|---|
| CL27 | NTA jaisa CBT, calculator, palette, 11 bhashayein, keyboard se poora exam | ✅ | |
| CL28 | Autosave, net jaane par bhi kuch na khoye, 2G mode | ✅ | ROADMAP §2, §9 |
| CL29 | Lab mode: sirf lab ke network se, sab ek saath shuru | ✅ | PR #32 |
| CL30 | Identity photo, webcam photos, tab/full-screen events (sirf insaan ke dekhne ke liye) | ✅ | Default off. ROADMAP §14 |
| CL31 | Live sitting: kaun shuru, kahan tak, away/idle, sabko announcement, time badhana, reopen | ✅ | ROADMAP §8 |
| CL32 | **Kai lab ek dashboard par** (centre-wise), har lab ka invigilator alag | ⬜ | |
| CL33 | Invigilator phone se (attendance QR scan, incident note) | ⬜ | |
| CL34 | Candidate-code watermark jo photo me bhi dikhe | ⬜ | B4 |

**6. Checking**

| ID | Feature | Status | Note |
|---|---|---|---|
| CL35 | MCQ/numeric/code apne aap; short answer AI se, rubric ke saath | ✅ | |
| CL36 | Micro-viva: AI follow-up se "khud likha ya nahi" ka saboot | ✅ | |
| CL37 | Written answers ka blind marking queue (J/K, Enter) | ✅ | PR #32 |
| CL38 | Code similarity (MOSS jaisa) | ✅ | |
| CL39 | **Handwritten copy scan karke AI se sujhaya hua marking** | ⬜ | D6 |
| CL40 | Doosra examiner (moderation), farq zyada ho to teesra | ⬜ | |

**7. Result**

| ID | Feature | Status | Note |
|---|---|---|---|
| CL41 | Cut-off, qualified/failed, results table, CSV/Excel | ✅ | |
| CL42 | Analytics: mean, median, histogram, har sawaal ki difficulty | ✅ | |
| CL43 | Scorecard PDF, QR se public verify | ✅ | PR #32 |
| CL44 | Result email/WhatsApp se, candidate apne marks sawaal-wise dekhe | ✅ | |
| CL45 | Recheck: 7 din, 3 sawaal, badlaav ledger me | ✅ | |
| CL46 | Candidates across tests (Insights), Moodle gradebook (LTI 1.3) | ✅ | |
| CL47 | **CO–PO attainment report** (NBA format) | ⬜ | D5 |
| CL48 | Maa-baap ko report (student ki manzoori se) | ⬜ | |

**8. Placement cell (TPO OS)**

| ID | Feature | Status | Note |
|---|---|---|---|
| CL49 | College ki practice site aur Prep (plan, Sahayak, contests) | ✅ | ROADMAP §15, §16 |
| CL50 | Campus licence: CSV se sabko Plus | ⬜ | Tracker plan #8 |
| CL51 | **Readiness heatmap** (branch/batch × topic), kamzor students ki list | ⬜ | D2 |
| CL52 | **Drive manager**: company, JD, eligibility (CGPA, backlogs, branch), apply, rounds, offer | ✅ | Console → Placement → Drives: eligible students apne aap, drive ka test ek click me, rounds (applied → test → interview → offer/join), offer LPA, company ke liye CSV. Student khud apply nahi karta, TPO jodta hai (CL9 baaki). Screenshot `pilot-20` |
| CL53 | Company ke liye college ka portal (drive request, shortlist dekhna) | ⬜ | E3 se juda |
| CL54 | **NIRF / NAAC reports** (placement %, median salary, higher studies) | ⬜ | D4 |
| CL55 | Campus Premier League (college ranking) | ⬜ | C2 |

**9. Paisa**

| ID | Feature | Status | Note |
|---|---|---|---|
| CL56 | Prepaid credits (Razorpay) ya monthly invoice; GST invoice, credit note, TDS | ✅ | ROADMAP §12 |
| CL57 | **Saal ka licence, PO aur NEFT** se payment ka record, quotation PDF | ⬜ | Sarkari aur private colleges card se kam dete hain |
| CL58 | TPO OS free; proctored exam aur handwritten checking paid | ⬜ | V2-7 |

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
| CO7 | **Role library**: Java/Python dev, data analyst, QA, DevOps, BPO, sales, fresher aptitude | ✅ | `api/src/roles.ts`: 9 roles (fresher aptitude, Java, Python, frontend, data analyst, QA, DevOps, support/BPO, campus software). Sales abhi nahi |
| CO8 | SQL exam me (practice me pehle se) | 🟡 | Runner me SQL hai. Exam ke author flow me jaanchna baaki |
| CO9 | Frontend/full-stack task (React, API) browser IDE me | ⬜ | |
| CO10 | **Bolkar ya video jawab** (communication, sales, BPO roles), English speaking score | ⬜ | Mass hiring ki zaroorat |
| CO11 | Take-home project (GitHub repo), rubric se check | ⬜ | |
| CO12 | "AI-allowed" test (prompts ledger me) | ⬜ | E5 |

**3. Candidates bulana**

| ID | Feature | Status | Note |
|---|---|---|---|
| CO13 | CSV bulk invite, email/SMS/WhatsApp, reminders, ATS se apne aap | ✅ | |
| CO14 | **Open link / careers page** se khud apply karke test (eligibility sawaal ke saath) | ⬜ | Off-campus drive |
| CO15 | **Multi-college drive**: 50 college, ek paper, ek samay, lab mode | 🟡 | Lab mode aur ek exam hai; college-wise centre aur report baaki |
| CO16 | Verified talent pool aur Parikshaa Score se search | ⬜ | E1, B3 |

**4. Test aur bharosa**

| ID | Feature | Status | Note |
|---|---|---|---|
| CO17 | Identity photo, webcam, browser events, micro-viva, code similarity | ✅ | |
| CO18 | Ledger, receipt, public verify | ✅ | |
| CO19 | Proxy pakadna: identity + awaaz ka viva, "saath baithe" jode | ⬜ | B5 |
| CO20 | Second-device camera (phone se room ka view) | ⬜ | ROADMAP §14 me "not in it" |
| CO21 | Lockdown browser | ❌ abhi nahi | Install ka jhanjhat; lab mode aur viva pehle. Badi company maange to dobara sochenge |

**5. Shortlist**

| ID | Feature | Status | Note |
|---|---|---|---|
| CO22 | Cut-off, results, report, analytics, export | ✅ | |
| CO23 | **Hiring manager ko shortlist link** (expire hone wala), Shortlist/Reject button, comment | ⬜ | Recruiter ↔ manager ka roz ka kaam |
| CO24 | Candidates ki side-by-side tulna | ⬜ | |
| CO25 | Score ka role benchmark ("is role ke top 20%") | ⬜ | Kaafi data ke baad |

**6. Interview**

| ID | Feature | Status | Note |
|---|---|---|---|
| CO26 | **Interview room**: video + saanjha code editor + whiteboard | ⬜ | E4 |
| CO27 | Interview scheduling (Google/Outlook calendar) | ⬜ | |
| CO28 | Structured scorecard har round ka, panel ke notes | ⬜ | |
| CO29 | AI pehla round (awaaz, Hinglish), report insaan dekhe | ⬜ | A8 ka engine |

**7. Offer aur joining**

| ID | Feature | Status | Note |
|---|---|---|---|
| CO30 | Offer status tracking (offered, accepted, joined) | ⬜ | College ke NIRF data me bhi jaata hai |
| CO31 | DigiLocker se documents verify | ⬜ | |

**8. Paisa aur enterprise**

| ID | Feature | Status | Note |
|---|---|---|---|
| CO32 | Credits, monthly invoice, GST, TDS | ✅ | |
| CO33 | Pay-per-shortlist, saal ka contract | ⬜ | E6 |
| CO34 | Audit log, privacy notice, retention, data Bharat me, SECURITY.md | ✅ | |
| CO35 | DPA template, security questionnaire ka taiyaar jawab, status page, SLA | ⬜ | Procurement ke liye |
| CO36 | Pentest, ISO 27001 | ⬜ | Paisa aur auditor chahiye (ROADMAP "not in here") |

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

---

## Build log

Naya sabse upar.

| Tareekh | PR | Kya bana |
|---|---|---|
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
