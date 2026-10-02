# Parikshaa: Master plan v3 — ek chhata (umbrella), teen darwaze

**Likha gaya:** 2 Oct 2026 · **Kiske liye:** owner aur jo bhi is repo me build karega · **Status:** prastaav (owner ki haan ke baad har epic [PREP-TRACKER](PREP-TRACKER.md) ki Plan table me row banega, tabhi build shuru hoga)

Ye file batati hai ki **Parikshaa ko bazaar ka sabse achha product banane ke liye kya-kya, kitna aur kis kram me banana hai**: students ke liye free taiyaari (LeetCode / takeUforward jaisa), colleges ke liye exam aur placement ka poora system, aur companies ke liye AI-powered, proctored assessment aur hiring. Saath me **duniya ke best UI/UX** ka plan.

Ye file **direction** hai. **Aaj ka status** hamesha [PREP-TRACKER.md](PREP-TRACKER.md) me rehta hai (wahan har feature ka ✅/🟡/⬜ aur code ka path hai). Dono me farq ho to tracker sahi hai, aur ye file theek karni hai.

---

## Is file ko kaise istemal karein

1. **Kuch naya banana ho**: neeche [§14 Phases](#14-phases-kab-kya-banega) me agla phase dekho, uska koi epic chuno (jaise `M-S5`), aur Claude ko bolo: *"MASTER-PLAN ka epic M-S5 shuru karo"*.
2. **Shuru karne se pehle** (CLAUDE.md ka niyam): tracker ki Plan table me row banti hai: kya, kyun, done kab.
3. **Banne ke baad**: tracker me ✅, code ka path, tests, screenshots; yahan us epic ke saath "→ tracker row N" likh do. Epic ka ID kabhi badalta nahi.
4. **Har epic ki "Done kab" line hi uski kasauti hai.** Jo naapa na ja sake, woh done nahi.
5. Epic ka size: **S** ≈ 1 engineer-hafta · **M** ≈ 2–3 · **L** ≈ 4–6 · **XL** ≈ 8–12. Ye andaaze hain, vaade nahi.

ID ke prefix:

| Prefix | Matlab |
|---|---|
| `M-S` | Student (free taiyaari) |
| `M-C` | College (exam cell + TPO OS) |
| `M-B` | Business / company (assessment + hiring) |
| `M-T` | Trust (saboot, integrity, suraksha) |
| `M-U` | UI/UX |
| `M-F` | Foundation / platform |
| `M-A` | AI |
| `M-K` | Content |
| `M-G` | Growth |

Purane ID (tracker ke `CL..`, `CO..`, `T..`, Master plan v2 ke `V2-A1` jaise, Plan rows) jahan mile, epic ke saath likhe hain, taaki kuch do baar na bane.

---

## 1. Lakshya: ek line me

> **Har student free me taiyaari kare, har taiyaari ka saboot bane, aur college aur company usi saboot par bharosa karein: ek Parikshaa ID, teen darwaze (Student · College · Company), ek integrity ledger.**

Teen darwaze:

| Darwaza | Kiske liye | Ek line me | Paisa |
|---|---|---|---|
| **Parikshaa Learn** (student) | Har student, school ke baad se naukri tak | LeetCode + takeUforward + aptitude + AI tutor, Hindi aur 10 aur bhashaon me, sab free | Optional Plus; core hamesha free |
| **Parikshaa Campus** (college) | Exam cell, TPO, faculty, HoD | Online/offline exams, checking, results, NAAC/NBA/NIRF, placement drives: ek jagah | Proctored exams, checking, accreditation pack (per student per saal); TPO OS free |
| **Parikshaa Hire** (company) | Recruiter, hiring manager, mass hiring | JD se test, proctored + AI-powered assessment, verified talent pool, interview room | Credits, pay-per-shortlist, saal ka contract |

Teeno ke neeche ek hi neev: **integrity ledger** (har attempt ki hash-chain, candidate ko receipt), **micro-viva** (AI follow-up se "kya khud likha"), **11 bhashayein**, **NTA jaisa CBT**, aur **ek Parikshaa ID**.

**North star metric:** har hafte kitne **verified skills** bane (viva-verified solves + proctored test scores + Pramaan). Ye ek number student ki mehnat aur company ka bharosa dono naapta hai.

---

## 2. Aaj hum kahan khade hain (2 Oct 2026)

### 2.1 Code ka size

| Cheez | Ginti |
|---|---|
| Packages | 10: `api`, `core`, `store`, `web`, `console`, `runner`, `verify`, `viva`, `brand`, `e2e` |
| TypeScript source (tests ke bina) | ~98,000 lines (api 38k, console 23k, web 22k, store 10k, core 3k) |
| Test files | 171; `npm run check` me ~1,360 tests |
| e2e | 43 specs × 3 browsers (Chromium, Firefox, WebKit) + 74 visual baselines |
| Database migrations | 60 (har tenant table par RLS) |
| API | 334 paths, OpenAPI `docs/openapi.json` |
| Screenshots | 148 (`docs/screenshots`) |
| Bhashayein | 11 (English, Hindi, Bengali, Gujarati, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil, Telugu) |

### 2.2 Teeno darwaze: kitna bana

Ye ginti tracker ki tables se hai.

| Darwaza | ✅ ban gaya | 🟡 aadha | ⬜ baaki | Kahan dekhein |
|---|---|---|---|---|
| Student (Prep blueprint) | 110 | 9 | 3 | Tracker §1–11, Plan rows 1b–52 |
| College (V2-12 CL1–CL67) | 50 | 5 | 12 | Tracker V2-12 "College ka safar" |
| Company (V2-12 CO1–CO43) | 22 | 5 | 15 (+1 ❌ lockdown browser) | Tracker V2-12 "Company ka safar" |

**Mera andaaza, "bazaar ke best" ke muqable** (judgement hai, naap nahi):

| Darwaza | Andaaza | Kyun |
|---|---|---|
| Exam engine (teeno ke neeche) | **80%** | Ledger, viva, CBT, proctoring, lab mode, results, rechecks, billing, integrations: bahut majboot. Kami: live production, scale proof (50,000 burst), certifications |
| College | **65%** | Exam cell aur TPO ka core bana hai. Kami: multi-campus university, ERP sync, accreditation ka poora suite, academic exam workflow scale par |
| Company | **50%** | Assessment aur shortlist bana hai. Kami: talent pool, naye question types (frontend, data, take-home), native video interview, enterprise (SCIM, SOC 2), self-serve pricing |
| Student | **35%** | Features ka dhaancha (planner, Sahayak, coins, contests, company pages) bahut achha hai. Kami: **content** (sirf 40 DSA problems!), **ek global account**, **SEO**, videos, discuss/solutions, mobile app, live hona |
| UI/UX | **60%** | Design system, dark mode, 11 bhashayein, WCAG AA, visual regression pehle se. Kami: marketing site, public SEO pages, research program, teen products ka ek-saa shell, motion/illustration |
| Platform | **45%** | Code production-grade hai (RLS, sealing, backups drill, gVisor runner, load test 2,000). **Par kahin live nahi** (repo me deploy ka record nahi), autoscale nahi, staging/SLO/on-call nahi |

### 2.3 Jo sach me khaas hai (ise copy karna mushkil hai)

1. **Integrity ledger + bahar se verify** (`packages/core`, `packages/verify`): har attempt ki hash-chain, candidate ka receipt, scorecard QR.
2. **Micro-viva** (`packages/viva`): jawab ke baad AI ke sawaal, "samjha ya copy kiya". "Cheating score" ki jagah samajh ki jaanch.
3. **NTA jaisa CBT** 11 bhashaon me, 2G mode, autosave, keyboard se poora exam.
4. **College ka exam-din**: lab mode, seats + admit card, invigilator phone, live sitting, handwritten checking + moderation, CIA, CO–PO, NIRF.
5. **Prep ka habit loop**: planner, Sahayak (hint ladder, review, doubt, notes), coins, store, contests + rating, company readiness.
6. **Bharat-first business**: GST invoice, TDS, PO/NEFT, Razorpay, WhatsApp/SMS, DPDP retention.

### 2.4 Jo nahi hai (imaandari se)

| Kami | Asar | Plan me kahan |
|---|---|---|
| **Kahin live nahi** (production deploy, domain, monitoring, on-call) | Ek bhi asli user nahi; baaki sab theory | [M-F1](#9-foundation-platform) Phase 0 |
| **Ek global account nahi**: learner har practice site (org) ka alag hai, candidate ka account hi nahi | "Ek chhata" ban hi nahi sakta: student ki taiyaari, college ka exam aur company ka test jud nahi sakte | [M-S1](#51-student-darwaze-ke-epics) Phase 1, sabse bada aur sabse pehla |
| **SEO nahi**: web SPA hai, problem/company/profile pages Google me nahi aate | LeetCode/GFG ka aadha traffic search se aata hai | M-S3 |
| **Content bahut kam**: 40 DSA problems, 8 SQL, 80 CS MCQ, 40 placement quiz; 0 video | Student ek din me khatam kar dega | [§10 Content](#10-content-ka-plan) |
| **AI asli model par nahi chala** (evals ka paid run, JD/handwriting/photo trial: API key ka intezaar) | Quality aur kharcha dono anjaan | M-A3, Phase 0 |
| **Discuss/solutions, video editorials, mobile app store me** nahi | Student retention | M-S11, M-S7, M-S17 |
| **Talent pool, Score, Pramaan** nahi | Company ke paas "student kyun yahan" ka jawab nahi | M-T1–T3, M-B1 |
| **Pentest, ISO 27001, SOC 2** nahi | Badi company aur sarkar nahi khareedegi | M-T6 |

---

## 3. Bazaar ki tasveer: "best" ka matlab kya hai

Har darwaze ke liye ek **benchmark** (jise hum har baar naapenge) aur hamara **jeetne ka tareeka**. Competitors ki baatein public jaankari se hain; launch se pehle har daava dobara jaanchna hai.

### 3.1 Student

| Kaun | Unki taakat (benchmark) | Hum kahan aage jaayenge |
|---|---|---|
| LeetCode | Problem library, editor, contests, company tags, discuss | Hindi/regional, free company data, AI tutor jo solution nahi deta, viva-verified solve |
| takeUforward | Ek structured sheet (A2Z), free video editorials, saaf explanation | Apna personal plan (deadline + roz ke minutes), revision, Sahayak, Pramaan |
| GeeksforGeeks | SEO articles, har topic par content | Saaf UX, bina ads, interactive lessons + quiz |
| Codeforces / CodeChef | Contests, rating, community | Contest + taiyaari + naukri ek jagah; sponsored contest se interview |
| PrepInsta / IndiaBIX | Aptitude aur company pattern | Asli CBT interface, proctored mock OA, readiness % |
| Duolingo (habit ka benchmark) | Streak, leagues, roz ka chhota goal, notification ka hunar | Wahi aadat ka dhaancha, par career ke liye |

**Best ka matlab (student):** pehle din 3 minute me pehla solve; roz 20 minute ki aadat; har topic ka free, saaf content; atakne par turant madad apni bhasha me; aur taiyaari ka saboot jo company maane.

### 3.2 College

| Kaun | Benchmark | Hum kahan aage |
|---|---|---|
| CodeTantra, TCS iON, Mettl (campus) | Online exam scale, lab setup | Ledger + viva, handwritten checking, CIA/CO–PO, sab ek jagah, Hindi console |
| Superset, college ERP | Placement drive management | Drives + students ki asli taiyaari (readiness) + exams ek hi data par |
| NAAC/NBA consultants (Excel) | Accreditation ke data | Data roz ke kaam se apne aap bane, ek click report |

**Best ka matlab (college):** TPO 5 minute me drive bana de; exam cell 1 din me 5,000 students ka exam bina rukawat le; NAAC ke din saari report ek click me.

### 3.3 Company

| Kaun | Benchmark | Hum kahan aage |
|---|---|---|
| HackerRank, HackerEarth, Codility | Coding assessment, question library, interview IDE | Viva se authorship ka saboot, AI-allowed tests, candidate ko receipt, Bharat ki bhashayein |
| Mercer Mettl, iMocha | Enterprise proctoring, role library, mass hiring | Leak-proof paper, proxy pakadna bina "black box", lab mode 50 college ek saath |
| Unstop | Hiring challenges, college reach | Verified talent pool (sirf consent wale), Score se seedha shortlist |

**Best ka matlab (company):** recruiter 10 minute me test bheje; 10,000 candidates ka drive bina fraud ke; shortlist par bharosa; candidate ko bhi achha anubhav (aur saboot).

### 3.4 UI/UX ke benchmark

| Kaam | Benchmark product | Kya seekhna hai |
|---|---|---|
| Student app | Duolingo, LeetCode, Brilliant | Chhota roz ka goal, celebration, saaf progress, tez editor |
| Console | Linear, Stripe Dashboard, Notion | Keyboard-first, tez tables, bulk actions, saaf khaali-states |
| Exam | NTA CBT (pehchaan), Google Forms (saadgi) | Darr kam, har cheez saaf, kabhi kuch na khoye |
| Marketing/docs | Stripe, Vercel | Saaf kahani, live demo, achhe docs |

---

## 4. Sabse bada faisla: Ek Parikshaa ID, teen darwaze

Aaj ka data model teen alag duniya hai:

- **Learner**: `learners` table, har practice site (organisation) ka alag account (`learners_org_email_idx` = org + email).
- **Candidate**: koi account nahi; har exam ka access code (SPEC §2 ka jaan-boojh kar faisla).
- **Student (college)**: `placement` ka student master, college ka record; account nahi.

"Ek chhata" ke liye in teeno ko **ek insaan** se jodna hai, **bina kisi ki privacy tode** aur **bina organisations ki isolation (RLS) tode**.

### 4.1 Naya model (prastaav)

| Cheez | Kya | Kaun dekh sakta hai |
|---|---|---|
| `people` | Ek insaan ka global account: email/phone, passkey/password, Google sign-in, naam, bhasha | Sirf woh insaan (aur operator, support ke liye, audit ke saath) |
| `memberships` | Insaan ↔ organisation: role (learner, student, candidate, staff), college ka roll no. | Woh organisation, apne members ke liye (RLS) |
| `candidate_links` | Exam attempt ↔ insaan, **candidate ki manzoori se** ("is attempt ko apne account me jodo") | Insaan; organisation sirf apne attempts |
| `shares` | Insaan kya kisse share kare (Pramaan, Score, profile) | Insaan tay kare; har share ka consent log (DPDP) |

### 4.2 Niyam

1. **Access code wala exam waise hi chalega**: candidate ko account banana zaroori nahi (SPEC ka faisla bachta hai). Account ho to receipt aur score apne aap usme aa jaate hain.
2. **Organisation sirf apna dekhe**: college ko student ki LeetCode-jaisi practice tabhi dikhe jab student "share with my college" chune.
3. **Flagship site** (`parikshaa.in` jaisa) ek operator organisation hai; college ki apni practice site ab **"campus space"** banti hai flagship ke andar (alag site bhi rakh sakte hain, white-label ke liye).
4. **Migration**: purane per-site learners ko "is email se Parikshaa ID banao/jodo" ka option; koi data apne aap merge nahi hota.
5. **Erase**: ek click me insaan ka sab (har membership me) DPDP ke hisaab se.

**Ye Phase 1 ka pehla aur sabse bada epic hai (M-S1, XL).** Iske bina teen darwaze teen alag product rahenge.

---

## 5. Student darwaza: Parikshaa Learn

**Vision:** Bharat ka sabse achha free coding + aptitude + placement platform, har bhasha me, jo taiyaari ka saboot de.

**Done ka bada paimaana (Phase 3 ke ant tak):** 2,000 problems, 3,000 aptitude/CS sawaal, 300 video, 100 companies ka data; D7 ≥ 30%; pehla solve 3 minute me; Google se 40% naye users.

### 5.1 Student darwaze ke epics

| ID | Epic | Kya banega (detail) | Purane ID | Size | Phase | Done kab |
|---|---|---|---|---|---|---|
| **M-S1** | **Parikshaa ID** | §4 ka model: `people`, `memberships`, `candidate_links`, `shares`; ek login (passkey, Google, email OTP); account switcher (student/staff/candidate roles); purane per-site learners ka migration; erase-everywhere | naya | XL | 1 | Ek insaan ek login se flagship, apne college ka campus space aur apna exam receipt dekhe; RLS tests sab organisations par; migration tests |
| **M-S2** | **Flagship site** | Public home (bina login dekhne layak), explore (tracks, problems, companies, contests), "aaj ka sawaal", sign-up ke baad onboarding (quiz + target) | Tracker §1 | L | 1 | Bina login 5 page dekhe ja sakein; sign-up → pehla solve median ≤ 3 min (analytics se) |
| **M-S3** | **SEO aur public pages** | Problems, companies, editorials, public profiles, contests ke pages server par render (SSR ya build-time prerender); `sitemap.xml`, canonical URLs, structured data (`schema.org` Course/QAPage), Open Graph images | naya | L | 1 | Google Search Console me 2,000+ pages indexed; Lighthouse SEO 100; LCP < 2.0 s (4G) |
| **M-S4** | **Problem library 500 → 2,000** | Apne likhe problems (copy nahi), har ek me tests generator, reference solution CI me, Brute/Better/Optimal editorial, pehla hint, tags, pattern, difficulty calibration (solve-rate se) | Plan 52, content | XL (content) | 1→4 | Phase 1: 500; Phase 4: 2,000; har problem ka CI gate pass |
| **M-S5** | **Editor v2** | Custom input aur kai test cases, failing case ka diff, browser me Python/JS Run (Pyodide/WASM, offline), Vim/Emacs keys, format, font size, language aur (Go, Rust, Kotlin, C#), code ka timeline (purane submissions) | V2-A2 | L | 1 | Run < 300 ms browser me; 9 bhashayein; editor ka keyboard a11y audit |
| **M-S6** | **Sheets / learning paths** | Apni curated sheets (DSA A–Z jaisi, 30-day, SDE sheet, company sheets), progress bar, "next problem", plan me jud jaaye | Plan 52 | M | 1 | 5 sheets live, har sheet ka completion analytics |
| **M-S7** | **Video lessons + editorials** | Host (owner ka faisla), player (speed, resume, progress), signed URL, watermark, subtitles 11 bhashaon me (AI se draft, insaan check), lesson page me video + notes + quiz | Plan 51 | L | 2 | 300 video, watch-progress, 2G par audio-only mode |
| **M-S8** | **Aptitude, reasoning, verbal, CS core** | 3,000 sawaal Hindi + English, topic-wise practice, timed sets, galat ka revision card | V2-A6, CL18 | M + content XL | 1→2 | Har track 300+ sawaal, bilingual |
| **M-S9** | **Mock OA simulator** | 10 company patterns (section, time, negative marking), asli proctoring ke saath, readiness % | V2-A5 | M | 2 | 10 pattern live; result se plan apne aap badle |
| **M-S10** | **Contests v3** | Weekly + biweekly, virtual contest, upsolve, contest ke baad editorial, rating graph, divisions, plagiarism review queue, sponsored contest (top N ko interview) | Plan 34, V2-C5 | M | 2 | 10,000 ek saath (M-F4 ke baad); plagiarism ke saath leaderboard |
| **M-S11** | **Discuss aur solutions** | Solve ke baad hi solutions dekhna/likhna, markdown + code, upvote, report/moderation, editorial ke neeche "community approaches" | naya | L | 2 | Moderation queue; spam < 1%; top problems par 3+ solutions |
| **M-S12** | **Sahayak v3** | Awaaz se doubt (11 bhashayein), "mera code line-by-line samjhao", dry-run visualizer (array/pointer ki animation), model routing se sasta | V2-A7 | L | 3 | Eval targets pass; ₹ per active student budget me |
| **M-S13** | **AI mock interview** | DSA, HR, system design persona; awaaz; Hinglish; report: samajh, communication, galtiyaan; micro-viva engine | V2-A8 | L | 3 | 5 persona; har session ki report; eval set |
| **M-S14** | **Saboot wala resume** | Har line Pramaan se judi, ATS-friendly PDF, Hindi/English, recruiter link par verify | V2-A9 | M | 3 | Recruiter link se har daava verify |
| **M-S15** | **Habit loop v2** | Weekly leagues (Duolingo jaisa), squads (3–5 dost), daily goal, streak repair, WhatsApp roz ka sawaal, notification ka "sahi waqt" | V2-C3, C10 | M | 2 | D7 +5 points (A/B test se) |
| **M-S16** | **Skill graph** | Har topic par mastery (solves + quiz + viva), kamzor jagah, company-wise predicted readiness, "agla sabse faydemand kaam" | naya | M | 2 | Dashboard par graph; plan isi se bane |
| **M-S17** | **Mobile** | Play Store (TWA), offline v2 (submission queue, lessons cache), iOS PWA; baad me native shell sirf agar zaroori | Plan 42, 43 | M | 2 | Play Store par live; 2G par pehla page < 4 s |
| **M-S18** | **Govt aur dusre exams** | GATE CS, SSC/Bank/Railway aptitude, CUET (DPDP under-18 consent ke baad) | V2-F3–F5 | XL | 5 | Har exam ka asli jaisa CBT + 2 full mocks |
| **M-S19** | **Purane Prep pending** | Target role, shared links sambhalna, SQL v2 (table output, schema), account delete par sab prep data, editorial code CI, "Better" tab | Plan 44–49 | M | 1 | Tracker rows 44–49 ✅ |

### 5.2 Student ka "pehla din" (north-star flow)

1. Google se ek problem page par aaya (M-S3) → bina login problem padha, code likha, browser me Run kiya (M-S5).
2. Submit ke liye sign-up (Parikshaa ID, ek tap Google) → submit accepted → +coins, celebration.
3. "Tumhara plan banayein?" → 8 sawaal ka quiz → target company → plan (pehle se bana hai).
4. Kal subah WhatsApp par roz ka sawaal (M-S15) → streak.
5. Hafte ke ant me weekly contest → rating → share card.

**Is flow ka har kadam analytics me naapa jaaye** (funnel pehle se hai: tracker §11).

---

## 6. College darwaza: Parikshaa Campus

**Vision:** Ek college ka poora exam cell aur placement cell ek jagah: paper banane se result tak, student ke pehle saal se placement tak, NAAC/NBA/NIRF ke data ke saath.

**Done ka paimaana (Phase 3):** 100 active colleges (har hafte), 20 paid; ek college ne poora semester online/hybrid chalaya; ek NAAC visit hamari report se.

### 6.1 College darwaze ke epics

| ID | Epic | Kya banega | Purane ID | Size | Phase | Done kab |
|---|---|---|---|---|---|---|
| **M-C1** | **University aur multi-campus** | University → college → department → programme → batch; har level ke admin; reports har level par rollup | CL6 | L | 2 | Ek university ke 5 college ek console me, isolation ke saath |
| **M-C2** | **Students ka data, ek baar** | Self-register + TPO approval, ERP CSV templates (popular ERPs ke liye), API se sync, Parikshaa ID se jodna, APAAR/DigiLocker (sarkari onboarding ke baad) | CL9, CL10 | M | 2 | 5,000 students 10 minute me; duplicate detection |
| **M-C3** | **Academic exam cell** | Exam timetable, hall/seat (pehle se), debarred list (attendance se), PwD (pehle se), hybrid (online + OMR), exam cell ke roles, paper ki chain-of-custody | CL61 | L | 2 | Ek poora semester (sab subjects) ek college me |
| **M-C4** | **Paper setting v2** | Syllabus/CO se AI draft (author manzoor kare), Bloom level, CO tagging, parameterised variants, blueprint (kitne marks kis unit se) ka check, paper review (pehle se) | CL17, CL19, CL20 | L | 2 | 20 asli papers par faculty manzoori ≥ 80% |
| **M-C5** | **Checking v2** | Online written par doosra examiner, bulk scan upload (100 copies ek saath), OCR quality eval (English + Hindi), revaluation workflow, examiner payments ka hisaab | CL64 | M | 2 | 200 asli copiyon par faculty se 90% match |
| **M-C6** | **Accreditation suite** | NAAC SSR/AQAR ke criteria (2, 5) ka data, NBA SAR (CO–PO pehle se), NIRF data capture (higher studies bhi), evidence files ek jagah, ek-click export | CL47, CL54 badhakar | L | 2 | Ek pilot college ki NAAC/NBA files TPO/IQAC manzoor kare |
| **M-C7** | **TPO OS poora** | Company portal (drive request, shortlist dekhna), company CRM (contacts, visits, MoU), verified student profile (student ki manzoori se), offer letters, Campus Premier League | CL53, CL55, CL59, CL66 | L | 2 | Ek poori placement season bina Excel |
| **M-C8** | **Student success** | Early warning (attendance + marks + practice), mentor assignment, maa-baap ko report (student ki manzoori), remedial plan apne aap | CL48 | M | 3 | Pilot me at-risk students ki list faculty ko roz |
| **M-C9** | **Faculty workspace** | Course page, assignments (practice site se), plagiarism, Moodle (LTI pehle se) + Google Classroom | naya | M | 3 | 10 faculty roz istemal karein |
| **M-C10** | **Console poora Hindi + regional** | Pages ke andar ka text bhi, 3 bhashayein pehle (Hindi, Marathi, Tamil) | CL5 | M | 2 | Pilot TPO bina English ke poora kaam kare |
| **M-C11** | **College pricing** | TPO OS free; proctored exams, checking, accreditation pack paid; quotation/PO/NEFT (pehle se) | CL58 | S | 2 | Pricing page + 3 paid pilots |
| **M-C12** | **Batch A/B pending** | Tracker Plan rows 65–66 (aadhe features poore, exam ka bharosa) | Rows 65, 66 | L | 2 | Rows ✅ |

### 6.2 TPO ka "ek din"

Subah dashboard: aaj ki 2 drives, 140 eligible students, 12 ne apply nahi kiya (ek click WhatsApp yaad), readiness heatmap me "DP" kamzor → faculty ko remedial list. Dopahar: company ne shortlist dekhi (portal), interview slots bane (calendar invite pehle se). Shaam: NIRF ke liye data apne aap update.

---

## 7. Company darwaza: Parikshaa Hire

**Vision:** Bharat me hiring ka sabse bharosemand tareeka: sahi test, sahi candidate, bina fraud, aur candidate ko bhi izzat.

**Done ka paimaana (Phase 3–4):** 50 paying companies; 100 hiring Score/Pramaan se; ek 10,000 ka mass drive bina rukawat.

### 7.1 Company darwaze ke epics

| ID | Epic | Kya banega | Purane ID | Size | Phase | Done kab |
|---|---|---|---|---|---|---|
| **M-B1** | **Verified talent pool** | Sirf consent wale students; filter: Score, verified skills, shehar, bhasha, saal; "invite to apply"; student kabhi bhi hat sake | CO16, V2-E1 | L | 3 | Consent log; pehli 10 hiring pool se |
| **M-B2** | **Hiring challenges** | Company free me challenge daale, leaderboard, shortlist par paisa; sponsored weekly contest | V2-E2, C5 | M | 3 | 5 companies ke challenges |
| **M-B3** | **Assessment library v2** | 60 role templates (dev, data, QA, DevOps, BPO, sales, finance, ops), skills taxonomy, har role ka benchmark ("top 20%") | CO7, CO25, CO37 | L | 3 | 60 templates, har ek me 3 difficulty |
| **M-B4** | **Naye question types** | Frontend/full-stack IDE (live preview, tests), data science notebook (JupyterLite), SQL exam me, take-home GitHub repo + rubric, typing/English/voice (BPO), system design whiteboard | CO8–CO11 | XL | 3 | Har type ka e2e + grading eval |
| **M-B5** | **AI-allowed assessment** | Test me diya hua AI assistant; har prompt ledger me; grading AI ka sahi istemal bhi dekhe | CO12, V2-E5 | M | 3 | 3 companies ka pilot |
| **M-B6** | **Integrity v2** | Phone se second camera, awaaz ka viva (proxy), watermark + variants (M-T4), collusion graph (jawab + samay + network) | CO19, CO20, CL34 | L | 3 | Red-team test: 10 me se 9 proxy pakde, galat flag < 2% |
| **M-B7** | **Native interview room** | WebRTC video (India TURN servers), saanjha editor (pehle se), whiteboard, recording sirf dono ki manzoori, transcript, AI notes (insaan manzoor kare), Google/Outlook calendar sync, reschedule | CO26, CO27 badhakar | XL | 3 | 45 min interview 4G par bina ruke; 50 ek saath |
| **M-B8** | **AI pehla round** | Awaaz, Hinglish, role ke sawaal, report insaan dekhe, candidate ko pehle bataya jaaye | CO29 | L | 4 | Eval: hiring manager ki raay se 80% match |
| **M-B9** | **Decision tools** | Side-by-side tulna, fairness report (branch, college, bhasha), funnel (pehle se), hiring manager ka mobile view | CO24, CO40 | M | 3 | Fairness report har drive par |
| **M-B10** | **Integrations v2** | Workday, SuccessFactors, SmartRecruiters, Keka; Naukri/LinkedIn job import (shartein dekh kar) | CO4, CO2 badhakar | L | 4 | Har connector ka test-connection + sandbox run |
| **M-B11** | **Enterprise** | SAML + SCIM, custom roles, IP allowlist, audit export (SIEM), data residency proof, status page, SLA (template pehle se) | CO35 | L | 4 | Ek 5,000+ employee company ki security review pass |
| **M-B12** | **Self-serve kharid** | Pricing page, plans, trial, pay-per-shortlist, usage dashboard, invoice (GST pehle se) | CO33, V2-E6 | M | 3 | Bina sales call pehli 10 companies |
| **M-B13** | **Offer ke baad** | Background verification handoff, DigiLocker documents, joining tracking (pehle se) | CO31, CO43 | M | 4 | 1 BGV partner live |
| **M-B14** | **Batch C/E pending** | Tracker Plan rows 67, 69 | Rows 67, 69 | L | 3 | Rows ✅ |

### 7.2 Recruiter ka "ek din"

JD chipkaya → 2 minute me test draft (pehle se) → library se 2 coding + 10 aptitude → 3 colleges + talent pool se 800 invite → raat tak 600 ne diya → subah shortlist: top 60, har ek ke saath viva ka saboot aur integrity note → hiring manager ne phone par 20 chune → interview room me panel (pehle se) → offer WhatsApp se (pehle se).

---

## 8. Duniya ka best UI/UX: plan

### 8.1 Usool (DESIGN.md ke usool + naye)

1. **Shaant, darane wala nahi** (pehle se): exam me koi cheez shak jaisi na dikhe.
2. **Har screen ka ek kaam**: ek primary button, baaki secondary.
3. **3 click niyam**: roz ka koi bhi kaam 3 click/tap me.
4. **Pehle phone, phir laptop** student ke liye; **pehle keyboard, phir mouse** console ke liye.
5. **Apni bhasha, apna anubhav**: anuvaad nahi, "transcreation": Hindi me bhi wahi garmahat.
6. **Tez = sundar**: har page ka performance budget (pehle se `bundle-budget.json`).
7. **Kuch na khoye**: autosave, offline, undo.
8. **AI saaf dikhe**: jahan AI ne kuch kiya, wahan likha ho "AI ne sujhaya, X ne manzoor kiya" (T3).
9. **Accessible by construction** (pehle se WCAG AA, axe har change par) → aage WCAG 2.2 AA + asli screen reader users ke saath test.

### 8.2 UI/UX epics

| ID | Epic | Kya banega | Size | Phase | Done kab |
|---|---|---|---|---|---|
| **M-U1** | **Design system v3 ("Parikshaa UI")** | Tokens ka audit (pehle se majboot), component library poori: data table (sort, filter, saved views, virtual scroll), combobox, date/time picker (IST), rich text editor, file upload + scan, stepper, charts (dataviz palette), empty states + illustrations, motion system (prefers-reduced-motion), icon set; gallery (`?gallery`) ko poore docs me badalna | L | 1 | Har component: a11y test, dark, 11 bhashayein, visual baseline |
| **M-U2** | **Teen product, ek shell** | Learn / Campus / Hire ke liye ek jaisa navigation, account switcher (Parikshaa ID ke roles), ⌘K har jagah (console me pehle se), notification center, help panel | L | 1 | Teeno me ek user test: "dusre product me jaana" < 5 s |
| **M-U3** | **Student app redesign** | §5.2 ka flow research ke saath; home, problem page, editor, plan, contest, profile; celebration moments; phone par ek haath se | L | 1–2 | SUS ≥ 80; pehla solve median ≤ 3 min |
| **M-U4** | **Console v3** | Table-first workflows, bulk actions, saved views, undo, inline edit, keyboard shortcuts har page par, "aaj kya karna hai" home | L | 2 | Time-to-task: TPO drive < 5 min, recruiter test < 10 min, exam cell exam < 15 min (5 users har ek) |
| **M-U5** | **Exam UX audit** | Phone exam, screen reader users ke saath exam, 2G par, PwD suvidha (pehle se) ka asli test | M | 2 | 10 asli candidates (2 screen-reader users) ke saath test, sab issues band |
| **M-U6** | **Marketing site + help center** | Teen darwazon ki kahani, live demo (`?demo` pehle se), pricing, case studies, docs (API + guides), changelog, status page | M | 1 | Lighthouse 100/100/100/100; demo se signup ka funnel |
| **M-U7** | **Localization v2** | Transcreation review har bhasha me (native speaker), number/date format, script ke hisaab se font loading, Urdu (RTL) baad me | M | 2 | Har bhasha ka native review sign-off |
| **M-U8** | **Performance UX** | Skeletons (pehle se), optimistic UI, prefetch, image CDN, font subset, route-level code split; Core Web Vitals CI me | M | 1 | LCP < 2.0 s, INP < 200 ms, CLS < 0.1 (sasta Android, 4G) |
| **M-U9** | **Research program** | Har sprint 5 user tests (student, TPO, recruiter), SUS + NPS har mahine, privacy-safe self-hosted product analytics (koi third-party script nahi: DESIGN usool), session ke bina heatmaps nahi | ongoing | 1+ | Har epic ke saath research note |
| **M-U10** | **Accessibility certification** | Bahar ka WCAG 2.2 AA audit, VPAT/accessibility statement (sarkari aur badi company ke liye) | M | 4 | Audit report, 0 critical |

### 8.3 UX ke naap (har release me)

| Naap | Target |
|---|---|
| Student: sign-up → pehla accepted | median ≤ 3 min |
| Student: D1 / D7 / D30 | 45% / 30% / 15% |
| TPO: nayi drive bana kar students tak | ≤ 5 min |
| Recruiter: JD se test bhejna | ≤ 10 min |
| Exam cell: naya exam + invite 1,000 | ≤ 15 min |
| SUS score (har darwaza) | ≥ 80 |
| Core Web Vitals (sasta Android, 4G) | LCP < 2.0 s, INP < 200 ms |
| Accessibility | axe 0 violations (pehle se) + WCAG 2.2 AA audit |

---

## 9. Foundation: platform

| ID | Epic | Kya banega | Size | Phase | Done kab |
|---|---|---|---|---|---|
| **M-F1** | **Production go-live** | India region (Mumbai/Hyderabad) cloud, managed Postgres + PgBouncer (pehle se design), object storage (scans, photos, logos), CDN, secrets manager, domains + TLS, email (SES/Postmark), SMS (MSG91 pehle se), WhatsApp (Meta), Razorpay live keys, VAPID keys | L | 0 | Ek asli exam 500 candidates + 1,000 learners live, bina incident |
| **M-F2** | **CI/CD aur environments** | Staging, preview environment har PR par, migration safety (expand/contract), feature flags, one-click rollback | M | 0 | Har merge staging par apne aap; rollback < 5 min |
| **M-F3** | **Observability + SLO** | OTel traces (pehle se pino/Sentry), dashboards, SLOs (API p95 < 200 ms, judge p95 < 2 s, uptime 99.9%), alerts, on-call rota, status page, incident runbook (CERT-In 6 ghante) | M | 0 | SLO dashboard; ek fire-drill |
| **M-F4** | **Scale** | Runner autoscale (Plan 50), Postgres read replica, ledger tables ka partitioning, scoreboard cache, queue backpressure; load tests: 10,000 contest, 50,000 exam start ek ghante me, 100,000 DAU | XL | 2–4 | Load test reports CI/nightly me; targets pass |
| **M-F5** | **Search** | Problems, question bank, candidates, students: Postgres full-text pehle, zaroorat ho to OpenSearch | M | 2 | Search p95 < 150 ms, Hindi bhi |
| **M-F6** | **Data aur analytics** | Self-hosted product analytics (events table pehle se jaisa), warehouse/replica se reports, cohort dashboards | M | 2 | North star + funnels roz apne aap |
| **M-F7** | **Disaster recovery** | Multi-AZ, PITR (drill pehle se), quarterly restore drill, region failover ka plan | M | 3 | RPO ≤ 5 min, RTO ≤ 1 ghanta, drill report |
| **M-F8** | **Cost engineering** | Infra + AI ka kharcha per active user, per exam attempt (ROADMAP §0 cost-run pehle se), budget alerts | S | 1 | Mahine ka cost report |

---

## 10. Content ka plan

Content hi student ko rokta hai. **Code se ye nahi banta**: team, creators aur process chahiye.

| ID | Kya | Aaj | Phase 1 | Phase 2 | Phase 4 | Kaise |
|---|---|---|---|---|---|---|
| **M-K1** | Problem studio (authoring tool) | Console me problem edit | Tests generator, reference solutions CI, editorial 3 tabs, review workflow (author → reviewer → publish) | Creator access | — | Engineering (L) |
| **M-K2** | DSA problems | 40 | 500 | 1,000 | 2,000 | Content team + creators; har ek ka CI gate |
| **M-K3** | Aptitude/reasoning/verbal/CS sawaal | ~120 | 1,500 | 3,000 | 5,000 | Bilingual (Hindi + English) |
| **M-K4** | Video lessons/editorials | 0 | 60 | 300 | 800 | Owner ka faisla: kaun, kis bhasha me (Ruka hua kaam) |
| **M-K5** | Company data | Dhaancha + staff reports | 25 | 60 | 100 | Interview experiences + partners; kabhi nakli nahi |
| **M-K6** | Sheets / paths | 1 track + starter packs | 5 | 12 | 25 | Curators |
| **M-K7** | Creator programme | — | — | Creators publish (moderation), Plus revenue me hissa | 100 creators | V2-C8 |

**Niyam:** koi bhi problem ya editorial bina asli runner par tests chale publish nahi hoga (pehle se SQL/DSA pack me).

---

## 11. AI ka plan (kharche ke saath)

| ID | Epic | Kya | Size | Phase | Done kab |
|---|---|---|---|---|---|
| **M-A1** | Model router + caching | Chhote kaam saste model par, bade kaam bade par; prompt caching; har AI call ka cost tag | M | 1 | ₹ per active student per mahina dashboard |
| **M-A2** | Eval harness sabke liye | Sahayak eval jaisa dhaancha har AI feature ke liye (viva, JD, handwriting, interview, paper draft) | M | 1 | Koi AI feature bina eval pass ke launch nahi |
| **M-A3** | Asli model par pehle runs | Sahayak paid baseline, JD/handwriting/photo trial (API key ka intezaar) | S | 0 | Tracker me scores |
| **M-A4** | Awaaz (ASR/TTS) | Indian bhashaon ke liye (Bhashini ya vendor), Sahayak, mock interview, voice answers | L | 3 | WER targets Hindi + 3 bhasha |
| **M-A5** | Handwriting OCR scale par | English + Hindi, faculty-in-loop | L | 2 | 200 copiyon ka eval |
| **M-A6** | AI governance | "AI ne sujhaya, X ne manzoor kiya" har jagah (T3), training par kabhi user data nahi, model ka India region ka sawaal (ROADMAP) | M | 1 | Policy page + UI har jagah ek jaisa |

**Siddhant:** static pehle (likha hua hint/viva), AI tab jab likha na ho; har feature ka eval; kharcha har student par naapa jaaye. Free rehne ki shart yahi number hai.

---

## 12. Trust: saboot, integrity, suraksha

| ID | Epic | Kya | Purane ID | Size | Phase | Done kab |
|---|---|---|---|---|---|---|
| **M-T1** | **Parikshaa Pramaan** | Verifiable credential (Ed25519 signed), `/p/<id>` page, QR, PDF, LinkedIn "Add to profile", student tay kare kya dikhe | V2-B1 | L | 2 | `packages/verify` se offline verify |
| **M-T2** | **Viva-verified solves** | Accepted ke baad 2 sawaal (pehle likhe hue, phir AI); leaderboard aur Pramaan sirf ✔✔ ginein | V2-B2 | M | 2 | Eval: copy wale 90% fail, asli 95% pass |
| **M-T3** | **Parikshaa Score** | Mahine ka free national proctored test, IRT calibration, har candidate ka alag paper, 12 mahine valid | V2-B3 | XL | 3 | 2 pilot slots; test-retest stable |
| **M-T4** | **Leak-proof paper** | Variants, kram, watermark, leaked photo se candidate dhoondhne ka tool | V2-B4, CL20, CL34 | L | 2 | Photo se 30 s me candidate |
| **M-T5** | **Consent manager (DPDP)** | Parikshaa ID ke saath har share ka consent, export/delete sab jagah, under-18 ke liye maa-baap ki consent | V2-H2 | M | 1 | DPDP checklist + vakeel review |
| **M-T6** | **Certifications** | Pentest (har saal), bug bounty, ISO 27001, SOC 2 Type II, CERT-In process | V2-H3, H4, CO36 | XL (zyaadatar non-code) | 3–4 | Reports; critical/high 0 |
| **M-T7** | **Passkeys** | Staff + learners | V2-H1 | S | 1 | Passkey se login e2e |
| **M-T8** | **Leaderboard ki safai** | Plagiarism, bahut tez solve, viva fail ranking se bahar; appeal | V2-B7 | M | 2 | Top 100 audit me 0 nakli |

---

## 13. Growth aur bazaar me jaana

| ID | Kya | Kis darwaze ke liye | Phase |
|---|---|---|---|
| **M-G1** | SEO (M-S3) + content marketing (blog, YouTube shorts) | Student | 1 |
| **M-G2** | Campus ambassadors (dashboard, coins, certificate) | Student + College | 2 |
| **M-G3** | Referral (dono ko credits/Plus din) | Student | 1 |
| **M-G4** | WhatsApp roz ka sawaal | Student | 2 |
| **M-G5** | Sponsored contests + Campus Premier League | Student + Company + College | 2 |
| **M-G6** | Placement Wrapped (saal ke ant me) | Student | 3 |
| **M-G7** | College sales: free TPO OS → paid exams; pehle 3 pilot colleges, phir state-wise | College | 0–2 |
| **M-G8** | Company sales: self-serve (startups) + enterprise (mass hiring) | Company | 3 |

**Paisa (student hamesha free):** company (credits, shortlist, talent pool), college (exams, checking, accreditation), coaching (white-label, baad me), optional Plus, sponsors. (Master plan v2 §V2-7 jaisa.)

---

## 14. Phases: kab kya banega

Samay ka andaaza ek team ke hisaab se hai jo phase ke saath badhti hai ([§16](#16-team-kitne-log)). Har phase ke ant me **gate**: paas na ho to agla phase nahi.

| Phase | Kab (andaaza) | Kya banega (epics) | Gate |
|---|---|---|---|
| **0 · Live** | 0–6 hafte | M-F1, M-F2, M-F3, M-A3, M-G7 (3 pilot colleges), tracker ke "Ruka hua kaam" ke saare inputs | 1 asli exam (500) + 1,000 learners live; 0 data loss; SLO dashboard |
| **1 · Ek ID + student flagship** | 1.5–5 mahine | M-S1, M-S2, M-S3, M-S4 (500 problems), M-S5, M-S6, M-S8 (pehla hissa), M-S19, M-U1, M-U2, M-U3 (shuru), M-U6, M-U8, M-U9, M-A1, M-A2, M-A6, M-T5, M-T7, M-F8, M-K1, M-G1, M-G3; content Phase 1 targets | 50,000 sign-ups; D7 ≥ 25%; LCP < 2.0 s; 500 problems |
| **2 · Campus poora** (Phase 1 ke saath-saath shuru) | 3–9 mahine | M-C1–M-C7, M-C10–M-C12, M-S7, M-S9, M-S10, M-S11, M-S15, M-S16, M-S17, M-U3, M-U4, M-U5, M-U7, M-T1, M-T2, M-T4, M-T8, M-F4 (pehla hissa), M-F5, M-F6, M-A5, M-G2, M-G4, M-G5 | 100 active colleges; 20 paid; ek poora semester online |
| **3 · Hire + saboot** | 6–12 mahine | M-B1–M-B7, M-B9, M-B12, M-B14, M-T3, M-T6 (pentest, ISO shuru), M-S12, M-S13, M-S14, M-C8, M-C9, M-A4, M-F7, M-G6, M-G8 | 50 paying companies; 100 hiring Score/Pramaan se; Score ka pilot |
| **4 · Scale + certificate** | 10–18 mahine | M-F4 (poora: 10k contest, 50k exam), M-B8, M-B10, M-B11, M-B13, M-T6 (SOC 2 Type II), M-U10, content Phase 4 targets | Load targets pass; certifications; 1 lakh DAU |
| **5 · Bharat aur aur exams** | 12–24 mahine | M-S18, coaching white-label, OMR scan (V2-F1, F2), awaaz har jagah, creators (M-K7) | 25 coaching; Hindi/regional ≥ 40% users |

**Seedha jawab "kitna karna hoga":** aaj se "bazaar ke best" tak lagbhag **18–24 mahine**, ek team ke saath jo 4 se 12 engineers tak badhe. Engineering ka andaaza (sirf code, content alag):

| Phase | Epics | Engineer-hafte (andaaza) |
|---|---|---|
| 0 | 5 | 12–16 |
| 1 | 23 | 70–90 |
| 2 | 32 | 110–140 |
| 3 | 21 | 100–130 |
| 4 | 7 | 60–80 |
| 5 | 4+ | 50–70 |
| **Kul** | **~90** | **~400–530** |

Content (problems, sawaal, video, company data) iske alawa ek alag team ka kaam hai: Phase 1–2 me 3–6 log, Phase 4 tak 8–10 + creators.

---

## 15. Har kaam ki "Definition of Done"

Koi bhi epic ✅ tabhi:

1. **Tests**: unit + API + RLS (agar data hai) + e2e flow; `npm run check` green.
2. **UI**: design system ke components, dark mode, 11 bhashayein (kam se kam English + Hindi poori), axe 0 violations, visual baselines.
3. **Performance**: bundle budget pass; naye page ka LCP target.
4. **Screenshots**: `docs/screenshots` me naye screens.
5. **Docs**: tracker row ✅ + "Kahan"; zaroorat ho to SECURITY.md, OPERATIONS.md, OpenAPI.
6. **Privacy**: naya personal data → seal/retention/erase ka faisla likha hua.
7. **AI ho to**: eval set pass, cost per use naapa, "AI ne sujhaya" UI.
8. **Research** (UI epics): 5 user test ka note.
9. **Naap**: done-criteria ka number dashboard/report me.

---

## 16. Team (kitne log)

| Role | Phase 0–1 | Phase 2–3 | Phase 4–5 |
|---|---|---|---|
| Full-stack engineers | 2–3 | 5–7 | 8–10 |
| Platform/SRE | 1 | 1–2 | 2–3 |
| Product designer (UX + UI) | 1 | 2 | 3 |
| Product manager | owner | 1 | 2 |
| Content (problems, aptitude, editorials) | 2–3 | 5–6 | 8–10 + creators |
| Video | owner ka faisla | 2 | 4 |
| College success / sales | 1 | 3 | 5 |
| Company sales | — | 2 | 4 |
| Support | — | 1 | 3 |

Claude (is repo me) engineering ka bada hissa tez kar sakta hai, par **content, design research, sales, legal aur certifications** me insaan chahiye.

---

## 17. Metrics: kya naapenge

| Kya | Naap | Phase 3 target |
|---|---|---|
| North star | Har hafte naye verified skills | 50,000 / hafta |
| Student | Sign-ups, DAU/MAU, D1/D7/D30, pehla solve time, streak 7+ wale | 5 lakh sign-ups, DAU 50,000 |
| College | Active colleges/hafta, exams/mahina, TPO weekly active, NAAC reports bani | 100 active, 20 paid |
| Company | Paying companies, tests/mahina, shortlist→offer %, repeat rate | 50 paying, 60% repeat |
| Bharosa | Uptime, judge p95, leak cases, galat flag appeals | 99.9%, < 2 s, 0, < 2% |
| UX | SUS, NPS, time-to-task (§8.3) | SUS ≥ 80, NPS ≥ 40 |
| Kharcha | ₹ AI per active student/mahina, ₹ infra per attempt | Budget ke andar |

---

## 18. Khatre aur bachav

| Khatra | Asar | Bachav |
|---|---|---|
| Live jaane me der | Sab theory rahe | Phase 0 sabse pehle; koi naya feature Phase 0 gate se pehle nahi |
| Parikshaa ID migration me galti | Data mix, privacy toote | Expand/contract migration, RLS tests, koi apne aap merge nahi |
| Content ki kami | Students na rukein | Content team + creators; har phase ka content target gate me |
| AI kharcha | Free model toote | Static-first, routing, credits, cost dashboard (M-A1, M-F8) |
| Scope bahut bada | Kuch poora na ho | Phase gates; ek waqt me ek phase ka focus; har epic chhota PR |
| Free Score par cheating | Score ki keemat khatam | Viva, variants, watermark, lab tier, audit (M-T2, T4, T8) |
| DPDP / legal | Jurmana, bharosa | Consent manager, vakeel review, under-18 sabse baad |
| Competitor tez nikle | Market share | Hamari khaas cheezein (ledger, viva, Bharat-first, teen darwaze ek ID) par zor |

---

## 19. Owner se kya chahiye

Ye cheezein code se nahi banti. Inke bina related epic shuru nahi hoga (tracker ka "Ruka hua kaam" bhi dekho):

| # | Kya | Kis epic ke liye | Kab tak |
|---|---|---|---|
| 1 | **Haan/na**: ye v3 plan, teen darwaze, Parikshaa ID | Sab | Phase 0 se pehle |
| 2 | Cloud account (India region), domain, budget | M-F1 | Phase 0 |
| 3 | `ANTHROPIC_API_KEY` + AI ka mahine ka budget | M-A3, sab AI | Phase 0 |
| 4 | Email/SMS/WhatsApp (Meta templates) accounts, Razorpay live, bank details, VAPID keys | M-F1 | Phase 0 |
| 5 | 3 pilot colleges, 2 pilot companies | M-G7 | Phase 0 |
| 6 | Naam aur brand pakka: Parikshaa Learn / Campus / Hire, Pramaan, Score | M-U6 | Phase 1 |
| 7 | Content team / creators; video kaun, kis bhasha me, host kahan | M-K* | Phase 1 |
| 8 | Vakeel: privacy policy, terms, DPA/SLA, DPDP | M-T5 | Phase 1 |
| 9 | Designer (hire ya agency) | M-U* | Phase 1 |
| 10 | Pentest/ISO/SOC 2 ka budget aur auditor | M-T6 | Phase 3 |
| 11 | DigiLocker issuer application, APAAR | M-C2, M-T1 | Phase 2–3 |
| 12 | Play Console account, app ka naam | M-S17 | Phase 2 |

---

## 20. Purane plans se rishta (taaki kuch do baar na bane)

| Purana | Is plan me |
|---|---|
| Tracker Plan rows 42–52 (Prep pending) | M-S17 (42, 43), M-S19 (44–49), M-F4 (50), M-S7 (51), M-K* (52) |
| Tracker Plan rows 65–74 (Batch A–J, college/company) | A → M-C12; B → M-C12 + M-T4; C → M-B14 + M-B9; D → M-C7 + M-C8; E → M-B14 + M-B6 + M-B7; F → M-A*, M-C4, M-B5, M-B8; G → M-B1, M-T3, M-G5; H → M-C11, M-B12; I → M-C2, M-B13, M-B10; J → M-B11, M-T6, M-B4 |
| Master plan v2 (V2-A…I) | Ye v3 usko teen darwazon aur Parikshaa ID ke saath aage badhata hai; V2 ke ID har epic me likhe hain |
| ROADMAP.md §0–16 | Exam engine ka engineering plan; M-F* aur M-T6 usi ke aage |

---

## 21. Agla kadam (aaj se)

1. Owner is plan ko padhe aur [§19](#19-owner-se-kya-chahiye) ke 1–5 par faisla de.
2. **Phase 0** ka pehla epic: **M-F1 Production go-live**. Claude ko bolo: *"MASTER-PLAN ka M-F1 shuru karo, cloud = <jo chuna>"*.
3. Phase 0 ke saath-saath **M-S1 Parikshaa ID** ka design doc (data model, migration, RLS) likha jaa sakta hai, kyunki Phase 1 usi par khada hai.
4. Har hafte tracker ka "Ek nazar me" aur is file ka §2 update ho.

---

## 22. Phase 0 aur Phase 1: kaam ke chhote tukde

Ye pehle do phases ka task-level breakdown hai, taaki seedha build shuru ho sake. Har tukda ek chhota PR ho sakta hai. Baaki phases ka breakdown unke shuru hone se pehle isi tarah likha jaayega.

### M-F1 Production go-live (Phase 0)

1. Cloud aur region chunna (owner): India region, managed Postgres 16, object storage, CDN; kharche ka andaaza (OPERATIONS.md "Sizing" se).
2. Infra as code (Terraform ya cloud ka apna): network, database, PgBouncer, storage buckets, secrets.
3. Docker image (pehle se ek image) ko deploy pipeline se jodna; runner gVisor (`runsc`) ke saath alag node pool par.
4. Domains: `parikshaa.<tld>` (Learn), `campus.` / `hire.` ya ek domain par paths (M-U2 ke saath faisla), TLS.
5. Providers: email (SPF/DKIM/DMARC), MSG91 SMS (DLT templates), Meta WhatsApp (templates: invite, reminder, result, offer, drive), Razorpay live, VAPID keys, bank details.
6. Backups + PITR on; pehla restore drill production par (OPERATIONS.md "The restore drill").
7. `npm run smoke` production par (pehle se), `pilot-report` roz.
8. Legal pages: privacy policy, terms, refund, grievance officer (DPDP) — vakeel ke saath.
9. Pilot: 3 colleges ka ek-ek asli exam, phir 1,000 learners ko invite.

### M-F2 CI/CD (Phase 0)

1. Staging environment, main par merge → staging deploy apne aap.
2. Production deploy manual approval ke saath; one-click rollback.
3. Migration safety: expand/contract niyam CLAUDE.md me; migration ka dry-run staging par.
4. Feature flags (Postgres table + console toggle), naye epics flag ke peeche.
5. PR preview environments (optional, cost dekh kar).

### M-F3 Observability (Phase 0)

1. OpenTelemetry traces API + runner; Sentry (pehle se) production DSN.
2. SLO dashboards: API p95, error rate, judge p95, exam start success, outbox lag.
3. Alerts (pager/WhatsApp) + on-call rota + runbook (incident, CERT-In 6 ghante, data breach).
4. Public status page.

### M-S1 Parikshaa ID (Phase 1)

1. **Design doc** (`docs/IDENTITY.md`): `people`, `memberships`, `candidate_links`, `shares`; RLS policies; sessions; kaun kya padh sakta hai ki table.
2. Migration (expand): naye tables, `learners` aur staff ke saath `person_id` column (nullable).
3. Auth: email OTP + Google + passkey (M-T7) ek `people` login par; purani learner/staff login chalti rahe.
4. Account linking flow: purana per-site learner "Parikshaa ID se jodo" (email verify ke baad); staff ka bhi.
5. Account switcher UI (M-U2): ek insaan ke roles (learner, student of college X, staff of org Y).
6. Candidate receipt "apne account me jodo" (attempt ke baad, candidate ki manzoori se).
7. College ka student master ↔ Parikshaa ID: student invite link se jode (CL9 ke saath).
8. Shares + consent log (M-T5): "college ke saath practice share karo", "company ke saath Pramaan".
9. Erase-everywhere: ek request se har membership me DPDP erase (pehle se per-org erase hai, use jodna).
10. Migration (contract): naye sign-ups sirf Parikshaa ID se; purane flows hatana ek release baad.
11. Tests: RLS har naye table par, linking ke edge cases (do email, merge nahi), e2e: ek login se teeno darwaze.

### M-S2 Flagship site (Phase 1)

1. Operator organisation "parikshaa" ki practice site = flagship; college sites "campus spaces" (M-S1 ke baad).
2. Public home: aaj ka sawaal, tracks, companies, contests, success stories (pehle se), sign-up CTA.
3. Bina login: problem padhna aur browser me Run (M-S5); submit par sign-up.
4. Onboarding: placement quiz + target (pehle se) ko nayi Parikshaa ID ke saath jodna.
5. Analytics funnel me "visitor → sign-up → pehla solve" (pehle se funnel me visitor jodna).

### M-S3 SEO (Phase 1)

1. Faisla: Vite SSR ya build-time prerender (problems/companies roz badalte hain → prerender + revalidate har ghante, ya SSR route-level). STACK.md me "SSR kuch nahi deta" exam client ke liye tha; public content ke liye ye faisla Faisle table me likhna.
2. Public routes: `/problems/:slug`, `/companies/:slug`, `/tracks/:slug`, `/u/:username` (pehle se public profile), `/contests/:slug`.
3. Meta tags, canonical, `sitemap.xml` (har din), `robots.txt`, `schema.org` (QAPage/Course/Person), Open Graph image (achievement card ka server SVG pehle se).
4. Hindi pages ke liye `hreflang`.
5. Lighthouse CI + Search Console.

### M-S5 Editor v2 (Phase 1)

1. Custom input + multiple test cases panel; failing case ka expected vs actual diff.
2. Pyodide (Python) aur JS Web Worker me browser Run; Submit server par hi (judge).
3. Settings: font size, tab size, Vim/Emacs (CodeMirror extensions), theme (dark pehle se).
4. Naye languages runner me: Go, Rust, Kotlin, C# (gVisor image badi hogi; size dekhna).
5. Submissions timeline + purane code se diff.
6. Keyboard a11y audit (editor me Tab ka trap, screen reader announce).

### M-U1 Design system v3 (Phase 1)

1. Component inventory: teeno apps me kaun-sa component kitni baar (script se).
2. Missing components: data table (sort, filter, saved views, virtual), combobox, date-time (IST), rich text, uploader, stepper, chart wrappers.
3. Motion tokens (duration, easing), `prefers-reduced-motion`.
4. Illustration set (empty states, celebration) — designer ke saath.
5. Gallery → docs site (`?gallery` pehle se) har component ke a11y notes ke saath.
6. Visual baselines har component ke liye (light/dark).

### M-U2 Teen product, ek shell (Phase 1)

1. Information architecture: Learn / Campus / Hire ka nav, kaun-sa page kis darwaze me.
2. Shell component: top bar (product switcher, ⌘K, notifications, account switcher), side nav.
3. Notification center (in-app + email/WhatsApp/push preferences ek jagah).
4. Help panel (contextual docs, "kaise karein" videos).
5. User test: 5 users har darwaze ke, "dusre darwaze me jaana" < 5 s.

### M-A1, M-A2 AI router aur evals (Phase 1)

1. Har AI call ke liye `route` + model choice config (pehle se `model_usage` route tag hai).
2. Prompt caching sab system prompts par.
3. Eval harness ko `sahayak-eval` se nikaal kar generic banana (dataset, grader, judge, report).
4. Pehle evals: viva sawaal, JD → skills, handwriting OCR, paper draft.
5. Cost dashboard: ₹ per feature, per active user, per attempt.

### M-K1 Problem studio (Phase 1)

1. Problem editor: statement (markdown + images), constraints, examples.
2. Test generator script (Python) + reference solution; tests runner par generate aur verify.
3. Editorial: Brute / Better / Optimal tabs (Plan row 49), har approach ka code CI me (Plan row 48).
4. Review workflow: draft → review → publish; reviewer ke comments.
5. Bulk import (apne format me) taaki content team tez kaam kare.
