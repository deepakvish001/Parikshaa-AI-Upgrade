# Parikshaa Prep — build tracker

**Parikshaa Prep Blueprint** (28 Sep 2026) ka har feature yahan track hota hai: kya ban gaya, kya aadha hai, kya baaki hai, aur aage kya banana hai. Blueprint ka poora plan (design, flows, data model, pricing) yahan hai: <https://claude.ai/artifact/AGkGV3SkmmsszWzL4EVZuh>. Isi ka engineering version [ROADMAP §16](ROADMAP.md#16-prep-a-practice-site-to-prepare-on) me hai.

Aakhri update: **30 Sep 2026** · Prep ka kaam PR [#27](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/27) aur [#30](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/30) me merge hua

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
| Sahayak AI | 10 | 2 | 6 | 0 |
| Plus aur payment | 5 | 2 | 6 | 0 |
| Coins, store, gamification | 10 | 2 | 3 | 0 |
| Company prep aur community | 8 | 1 | 6 | 0 |
| Contests | 3 | 0 | 2 | 0 |
| Content | 3 | 1 | 5 | 1 |
| Platform, quality, B2B | 6 | 2 | 5 | 0 |
| **Kul** | **62** | **16** | **43** | **1** |

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
| Pehla hint static (admin ka likha), AI ka kharcha bachane ke liye | ⬜ | | Content (300 static hints) ke saath |
| Poora solution dekhne par us problem ke coins aadhe | ⬜ | | |
| Review ka fixed JSON (logic, complexity, quality, edge cases) | 🟡 | | Review Markdown me aata hai, fixed JSON nahi |
| Notes draft mode | ⬜ | | |
| Interview follow-up sawaal | ⬜ | | Phase 6 |
| Chats 180 din baad apne aap delete | ⬜ | | DPDP |
| Evals (200 problems, hint me code leak nahi, review bug pakde) | ⬜ | | Launch se pehle zaroori |
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
| P3 · Sahayak AI | Hint, review, doubt, credits, contest lock, evals | 🟡 | Evals, static hint 1, notes draft, 180 din delete |
| P4 · Coins, store, company v2 | Coins, store, company 30/60/180, titles | ✅ zyaadatar | Company Pass, readiness, contest coins |
| P5 · Lessons aur NoteSpace | Lessons, videos, editorial format, notes, PDF | 🟡 | Video hosting, PDF export, AI draft |
| P6 · Aage | Content, follow-ups, PWA, campus, subscriptions | ⬜ | |

## Flows (blueprint section 9)

| Flow | Status | Note |
|---|---|---|
| F1 Sign up → onboarding → pehla plan | 🟡 | Placement quiz aur target companies baaki |
| F2 Roz ka loop | 🟡 | Reminder email baaki |
| F3 Run aur Submit | ✅ | |
| F4 Sahayak hint ladder | 🟡 | Static hint 1 aur coins aadhe baaki |
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

---

## Plan: aage kya banega

Naya kaam shuru karne se pehle yahan entry jodo. Kaam ho jaaye to status ✅ karke upar ki table update karo, aur entry ko [Build log](#build-log) me le jao.

Sujhaya gaya kram (sabse zaroori pehle):

| # | Kaam | Blueprint | Kyun | Done kab | Status |
|---|---|---|---|---|---|
| 1 | Sahayak evals + static hint 1 + solution par coins aadhe | §14, F4 | Launch se pehle safety aur kharcha | Eval targets pass (98% / 90% / 95%) | ⬜ |
| 2 | Coupons, GST invoices, pricing page ka GST breakup | §16, F12 | Paid launch ke liye zaroori | Test mode me coupon ke saath kharidna, invoice PDF | ⬜ |
| 3 | Roz ke reminders + analytics events | F2, §17 | Retention aur metrics naapna | D7 aur activation dashboard par | ⬜ |
| 4 | Sprint quiz + revision notes, streak freeze | F7, 13.2 | Planner poora | Sprint ke ant me quiz, 70% se kam par revise tasks | ⬜ |
| 5 | Playwright e2e: F1, F3, F12, F13 ke click-through flows | §20 | Regression se bachav | CI me chalein | ⬜ |
| 6 | Company v2: readiness, "list shuru karo", Company Pass | F9 | Company prep poora | Readiness dashboard par | ⬜ |
| 7 | NoteSpace: AI draft, PDF export | F15 | Phase 5 | Topic ke notes ek PDF me | ⬜ |
| 8 | Campus licence: CSV se bulk Plus, college dashboard | F16 | B2B sales | 500 students ek CSV se | ⬜ |
| 9 | Content: 150 editorials, 300 hints, 25 companies, videos | §15 | Log content ke liye aate hain | Har phase ka content target | ⬜ |

## Build log

Naya sabse upar.

| Tareekh | PR | Kya bana |
|---|---|---|
| 30 Sep 2026 | [#33](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/33) | Ye tracker, aur `CLAUDE.md` me rule ki har build ise update kare |
| 29 Sep 2026 | [#30](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/30) `84391f5` | Prep pages design system par; interview rounds me problems ke titles; screenshots, visual baselines, prep pages par axe |
| 29 Sep 2026 | [#27](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/27) `a270c39` | SQL (SQLite) runner language, editorial approach tabs, starter packs (CS fundamentals, SQL), ROADMAP §16 |
| 29 Sep 2026 | #27 `a858ee4` | Companies (30/60/180), interview experiences, coin store, contest rating, titles, achievements; account delete ab prep data bhi hatata hai |
| 28 Sep 2026 | #27 `4452ad8`, `6db65a4` | Plus (Razorpay), credits, Sahayak tutor (hint, review, doubt), learner aur console pages |
| 28 Sep 2026 | #27 `0fe6512`, `c939807` | Tracks, lessons, study plan, focus timer, revision, lists, notes, POTD, coins; learner pages aur console authoring |
| 28 Sep 2026 | — | Blueprint bana: TUF ZENKAI research + poora plan |
