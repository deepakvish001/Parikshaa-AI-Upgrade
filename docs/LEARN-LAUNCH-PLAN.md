# Learn launch plan: platform, content, judge, AI model, kharch (19 Oct 2026)

**Owner ne kya maanga (19 Oct 2026):** takeUforward (TUF) ke "platform features" page ki 7½ minute ki recording dekh
kar, Learn ka poora platform aur content jaldi launch karne ka detailed plan. Saath me: apna judge (Judge0 se) kaise
banega aur hamare server par kaise chalega, kitni requests par kitna kharch, TUF jaisa branded UI, aur apna open-source
model kis server par chalega aur uska kharch. Senior product manager aur engineer ki tarah research.

**Ye kis par tika hai:** video ke frames (audio nahi suna ja saka: sandbox me speech model download band hai), repo
ka code aur docs, aur 19 Oct 2026 ki web research (links §12 me). Har daam **andaaza** hai, vendor se pakka karna
hai. Hamare code ki saari baatein file ke path ke saath hain.

**Pehle padhein:** [LEARN-TUF-GAP.md](LEARN-TUF-GAP.md) (TUF se tulna, 10 saal ke daav, L1–L20),
[LEARN-BUILD-LABS.md](LEARN-BUILD-LABS.md) (hands-on labs), [ROADMAP-END-TO-END.md](ROADMAP-END-TO-END.md) (poore
platform ka roadmap aur content factory), [OWNER-SETUP.md](OWNER-SETUP.md) (accounts aur secrets).

---

## 0. Saar (2 minute me)

1. **Engine lagbhag taiyaar hai, kami content aur chamak ki hai.** TUF ke 9 me se 7 hisse hamare code me pehle se
   hain: planner, curriculum ka engine, editorial (brute/better/optimal), AI (Sahayak), practice + contests,
   workspace/notes, aur profile ka aadha hissa. **Nahi hain:** aptitude module, LLD aur CS subjects ke lessons, video,
   company tags ka asli data, aur TUF jaisa dark, chamakdaar marketing site.
2. **Judge pehle se bana hai** (gVisor runner + Judge0 adapter + parity suite). Launch ke liye bacha kaam: production
   par chalana, queue ko API se bahar nikalna, autoscale, compile cache, aur asli load test. **Kharch: ek submission
   ka lagbhag ₹0.005–0.01**, kisi bahar ki judge API se 10–50 guna sasta.
3. **AI ke liye apna model abhi mat chalaiye.** Hamare hisaab se Claude Haiku 5.5 (API) par ek hint lagbhag **₹0.03**
   ka padta hai. Apna 27B model GPU par chalana itni requests par **mehnga ya barabar** padta hai, aur quality ka
   jokhim alag. Open-source model wahan lagaiye jahan wo sach me jeet-ta hai: embeddings (search, duplicate jaanch),
   content ki doosri jaanch, aur backup provider. GPU ka faisla 10 lakh+ AI requests/mahina par dobara (§6).
4. **Mahine ka kharch** (AI ke saath, video YouTube par): 2,000 roz ke learners par **~₹31–60k**, 20,000 par
   **~₹1.5–2.5 lakh**, 1 lakh par **~₹6.6–12 lakh**. Ek active learner par ₹7–30/mahina (§5c).
5. **Samay:** Learn par poora dhyaan dein to **private beta ~5 hafte**, **public launch ~8–10 hafte** (§10). Lambi
   kadi content hai (DSA 450, aptitude 5,000 sawaal), code nahi.
6. **Ek faisla aapka:** [CLAUDE.md](../CLAUDE.md) me abhi **Hire v2** pehli priority hai. Learn ko pehle lena hai to
   bolein; main handoff me priority badal dunga. Dono saath chalane ke liye do accounts chahiye.

---

## 1. Video me TUF ne kya dikhaya (frame-by-frame)

Recording `takeuforward.org/#platform-features` ki hai, dark theme me.

| Samay | Hissa | Kya dikha |
|---|---|---|
| 00:07–00:55 | **Hero** | "One Stop Learning Platform for Tech Interviews", "18,71,170+ learners", do button (Start Learning for free, Explore plus). Daayein ek ghoomta card: Planly, Explore Subjects (DSA 6 sheets, System Design 2, Core 5, Data Engineering 2), "TUFY to help you" (gulaabi mascot, laptop ke saath) |
| 00:58 | **Platform overview** | "One platform. Every placement advantage." 9 tab: Planly, Curriculum, Resources, TUFY, Company & Interview Prep, Aptitude, Practice, Workspace, Profile. Har tab me baayein list, daayein chalta hua demo |
| 01:01–01:17, 00:07 | **Planly** | About you → goals → "Your personalised roadmap is ready" (SDE Interview Preparation, 12 Sep–12 Dec 2026, 6 sprints, 90 din) → weekly sprints, Solve & Practice, Track your time, Progress tracker (Sprints completed 2/6, Est. completion), Missed a day → **Adjust plan / Take a break** |
| 00:59, 01:57–02:28 | **Curriculum** | DSA (Basics→Advanced, 7 sheets), OOPs, LLD, DBMS, OS, CN, SQL ("267 problems, 48 hours"), Data Engineering. Subject khulne par "In-depth learning" ke chips |
| 02:48–03:13 | **Resources** | Har problem par Brute / Better / Optimal editorial; instructor ka video (thumbnail, 12 min); whiteboard video; **dry-run infographic** (Implement Queue using Stack, 8 step frames); complexity analysis; kai bhashaon me code; revision images |
| 03:20–04:14, 07:39 | **TUFY (AI)** | Editor me C++ + Submit; AI doubt ("poora solution turant nahi batata"), hints, code review, editorial ke neeche follow-up sawaal; platform-wide: sprint quiz, sprint notes, notes generation/refinement, practice quizzes, video explainers, module lectures |
| 04:41–05:15 | **Company & Interview Prep** | Global/Indian toggle; company ke naam aur ginti (Amazon 340, Microsoft 207, Google 148…); problem par company tags **last 30/60/90 din + High/Medium/Low**; interview experiences; premium problems |
| 05:28–05:47 | **Aptitude** | Topic video (Successive Percentage Change, 7 min) + Intuition / Approach / Why this works; practice set me 30 sawaal ka palette (correct, incorrect, current, unanswered); timed mock (00:29:42, Submit) |
| 06:08 | **Practice** | Practice portal, Problem of the Day, Contests: "Read the brief, then start the clock", fullscreen, tab badalne par warning, ek hi baar |
| 06:28–06:54 | **Workspace** | Saara code ek jagah, custom lists, downloadable notes |
| 07:01 | **Profile** | "One in all portfolio": featured projects, consistency heatmap (TUF, LeetCode, CodeChef, Codeforces), skills, work experience, education, achievements; certificate |

**Design ki baatein jo dikhi:** kaala-neela background, halki chamak (glow) wale cards, gol pill tabs, ek hi neela
action color, saaf sans-serif font, bada heading aur chhota halka text, aur har jagah ek mascot. Har feature ek
**chalte hue demo** se samjhaya gaya hai, screenshot se nahi.

---

## 2. Hamare paas kya hai, kya banana hai

Status: ✅ code me hai aur tests ke saath · 🟡 aadha · ⬜ nahi. Poori tulna [LEARN-TUF-GAP.md](LEARN-TUF-GAP.md) §2
me hai; yahan launch ke hisaab se.

| TUF ka hissa | Parikshaa | Kahan | Launch ke liye kya karna |
|---|---|---|---|
| Planly | ✅ planner, sprints, freeze, late mail | `api/src/prep-plan.ts`, tracker §2 | Onboarding ka "roadmap ready" card, "Adjust plan / Take a break" ka saaf button, naya design. Apna naam (Planly nahi) |
| Curriculum ka engine | ✅ tracks/modules/lessons | console → Practice → Tracks | Subject home page (DSA, CS core, LLD, SQL, Aptitude) "Explore subjects" jaisa |
| DSA content | 🟡 40 problems | `content/dsa-starter.ts` | **450 tak** content factory se ([ROADMAP-END-TO-END.md](ROADMAP-END-TO-END.md) §4) |
| Editorial brute/better/optimal | ✅ engine, 🟡 content | `web/src/practice/editorial.ts` | Har naye problem ke saath; Brute/Better/Optimal tabs ka naya design |
| Kai bhashaon me code | ✅ Python, JS, C, C++, Java, SQL | `runner/src/languages.ts` | Har editorial me 4 bhasha (C++, Java, Python, JS); Go/Rust/Kotlin baad me |
| Dry-run infographic | ⬜ | — | **Apna dry-run player** (L10): code chalate hue har step ki SVG tasveer khud bane; haath se banayi images ki zaroorat nahi |
| Video | ⬜ | lesson me sirf link | Launch par bina video (§8); baad me YouTube + Plus ke liye Bunny |
| AI (TUFY) | ✅ Sahayak: hint ladder, code review, Hindi/Hinglish, jawab nahi deta | tracker §5 | Mascot + har jagah ek jaisa "Sahayak se poocho"; notes aur quiz banana; **paid eval run pehle** (Ruka hua kaam) |
| CS core (DBMS, OS, CN, OOPs) | 🟡 80 MCQ | `content/cs-fundamentals.ts` | ~300 lessons + 3,000 MCQ (content factory) |
| LLD / system design | ⬜ | — | Lessons + diagram + design sawaal ka track |
| SQL | ✅ runner, 🟡 8 problems | `content/sql-starter.ts` | 50 → 150 problems |
| Aptitude | ⬜ (MCQ/numeric engine ✅) | — | **Naya module:** topic lesson (Intuition/Approach/Why), practice set palette, timed mock, 5,000 sawaal |
| Company problems + tags | 🟡 engine ✅, data ⬜ | company pages | **Sirf sach**: "N learners ne bataya" aur Hire/Campus ka anonymised data, consent ke saath. Banaya hua "last 30 din" kabhi nahi |
| Interview experiences | ✅ | `ExperiencesPage` | Naya design, moderation |
| Practice, POTD, contests | ✅ behtar (Elo, ICPC scoreboard, contest lane) | tracker §9 | Contest ka "brief → clock" page, judge autoscale |
| Workspace, lists, notes | ✅ behtar (SM-2 revision, PDF notes) | tracker §4 | Ek "Workspace" page jahan sab ho |
| Profile / portfolio | 🟡 public profile, cards | tracker §8 | Projects, skills, experience, heatmap (Codeforces/GitHub ki official API se), Pramaan certificate (L11/L17) |
| Marketing site + brand | 🟡 tokens, logo, design system | `packages/brand`, [DESIGN.md](DESIGN.md) | **Naya landing + pricing + legal pages**, dark-first, live demos, mascot (§9) |
| Plus (paid) | ✅ Razorpay, refunds | tracker §6 | Pricing page, free vs Plus ki saaf seema |

**Seedhi baat:** launch ka 70% kaam content aur presentation hai, 30% engine.

---

## 3. Product: launch par kya hoga (scope)

### 3a. Pehle din (MVP, public launch)

- **Landing, pricing, legal** (Terms, Privacy, Refund, Contact: Razorpay ke liye zaroori), help center.
- **Onboarding → roadmap:** 5 sawaal (saal, goal, roz kitna samay, bhasha, kaunsi companies) → plan, sprints.
- **DSA:** 300 problems at launch (450 tak 4 hafte me), editorial 3 approach + 4 bhasha + dry-run player + 3 hints.
- **Aptitude:** quant, reasoning, verbal ke 30 topic, har topic par lesson + 2 practice set; 6 timed mocks;
  1,500 sawaal at launch (5,000 baad me).
- **CS core:** DBMS, OS, CN, OOPs ke lessons (har subject ~40) + 1,200 MCQ; SQL 50 problems.
- **Sahayak:** hint, doubt, code review, follow-up sawaal, notes ka draft; free me roz ki seema.
- **Practice:** POTD, weekly contest, revision, lists, notes, profile.
- **Hindi/Hinglish:** UI aur Sahayak dono me (TUF ke paas ye nahi).

### 3b. Launch ke baad (4–12 hafte)

LLD track, video (YouTube), company tags (asli data aate hi), mass-recruiter mocks (L9), Pramaan (L11), mastery (L16),
Build Labs P0 ([LEARN-BUILD-LABS.md](LEARN-BUILD-LABS.md)).

### 3c. Jaan-boojh kar nahi

- TUF ka content, naam (Planly, TUFY), mascot, design ya copy ki nakal. Apna sab.
- LeetCode/TUF ke company tags scrape karna (unki terms ke khilaaf, aur data galat ho sakta hai).
- 18 saal se chhote learners bina parental consent ke (DPDP). Launch par signup me 18+ ki pushti, ya consent flow.

---

## 4. Apna judge: Judge0 aur hamara runner

### 4a. Abhi kya bana hai (repo)

- **In-house runner** (`packages/runner`): har program gVisor sandbox me, network band, CPU/memory/output ki seema,
  verdict `judge.ts` me (exact, tokens, numbers, unordered, JSON, apna checker).
- **Judge0 adapter** (`runner/src/judge0.ts`, [deploy/judge0/README.md](../deploy/judge0/README.md)): Judge0 sirf
  program chalata hai; sahi-galat ka faisla hamara code karta hai, isliye dono backend par verdict ek jaisa.
  `RUNNER_BACKEND=judge0` se chalu; Judge0 na mile to in-house runner par chala jaata hai.
- **Parity suite** (`npm run parity -w @parikshaa/api`): har reference aur galat program dono par, ek jaisa nikalna
  chahiye.
- **Judge queue** (`api/src/judge-queue.ts`): contest lane (4:1), bheed me 503 + Retry-After.
- **Load test** (`packages/e2e/contest-2000-*.txt`): 2,000 contestants, 3 minute, 0 errors; par ek 4-core machine par
  contest verdict p95 ~22 s (ye test asli judge ki jagah 400 ms ka nakli judge chalata hai).
- **Judge0 image** (`deploy/judge0/compilers/Dockerfile`): Python 3.12, Node 20, GCC 13, Java 21, checksum ke saath.
  **Abhi build nahi hui**, aur Judge0 parity suite par nahi chala (staging VM chahiye).

### 4b. Kaise chalta hai (ek submission ka safar)

```
Browser (editor) ──Run/Submit──▶ API (Fastify)
                                   │ 1. rate limit, code ka size, bhasha
                                   │ 2. queue me daalo (contest / practice lane)
                                   ▼
                          Judge queue (Postgres, SKIP LOCKED)   ◀── abhi har API process ki apni queue hai
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
          Judge worker (gVisor runner)     Judge0 (isolate) — alag VM
          compile → cache → tests          (sirf "is input par chalao")
                    └──────────────┬──────────────┘
                                   ▼
                     verdict: judge.ts (dono ke liye ek)
                                   ▼
                API: submission save, coins/streak, Sahayak ko context
                                   ▼
                     Browser ko result (polling / SSE)
```

### 4c. Hamare server par: kaunsa backend

| | In-house runner (gVisor) | Judge0 CE (isolate) |
|---|---|---|
| Licence | Hamara code | GPL-3.0; network service ki tarah bina badle chalana theek |
| Linux | cgroup v2 par chalta hai | 1.13.x ko **cgroup v1** chahiye (Ubuntu 22.04 par boot setting badalni padti hai) |
| Privileged container | Nahi | Haan, isliye alag VM |
| Overhead | gVisor syscall par thoda dheema (I/O wale program) | Kam |
| Bhashayein | Jitni hum jodein | 60+ (par hum sirf apni image ki) |
| Hamare paas | Production-ready code + tests | Adapter + setup script; image aur parity baaki |

**Faisla:** Learn launch par **in-house runner primary**, Judge0 doosra backend (aur nayi bhashaon ke liye). Staging
par dono ko parity suite aur load test se naapenge (CPU-second per submission, p95). Jo sasta aur tez nikle, wahi
default. Dono ka verdict ek hi code deta hai, isliye badalna sirf ek setting hai.

### 4d. Launch se pehle judge ka kaam (2 slice)

1. **Queue API se bahar:** Postgres me `judge_jobs` table, `FOR UPDATE SKIP LOCKED`; contest/practice lane wahi.
   Tabhi 2+ API processes aur alag worker machines chal sakti hain. (Tracker: "queue har API process me alag hai".)
2. **Workers ka autoscale:** queue ki lambai par AWS Auto Scaling; **contest pehle se tay hote hain**, to contest se
   15 minute pehle workers badha do (scheduled scaling), baad me ghata do.
3. **Compile cache:** `hash(code + bhasha + flags)` → binary 10 minute tak. "Run" ke baad "Submit" dobara compile nahi
   karta. C++ ke liye `bits/stdc++.h` ka precompiled header (compile ka samay lagbhag aadha).
4. **Java/Python:** saare test ek hi process me (function-style harness), har test par naya JVM nahi.
5. **Submit par pehli galti par ruko** (LeetCode jaisa) taaki CPU bache; practice me poori report Plus me.
6. **Seemaayein:** free me ek Run har 2 second, 300 Run/din; code 64 KB; output 1 MB.
7. **Naap:** queue ki lambai, p50/p95 verdict, CPU-second per bhasha, Grafana/PostHog me; alarm p95 > 5 s par.
8. **Load test asli judge par:** 10,000 roz ke learners ka din + 2,000 ka contest, staging par.

### 4e. Kitna CPU, kitna kharch

**Maan ke chalein** (staging par naapna hai): ek "Run" (2–3 sample test) ≈ 0.8 CPU-second; ek "Submit"
(20–50 test) ≈ 2 CPU-second (C++ compile sabse bhaari, Python halka). Ek learner roz ~8 Run + 4 Submit =
**~14 CPU-second/din**. Shaam ke sabse bhaari ghante me din ka ~15% traffic.

AWS Mumbai `c7i.xlarge` (4 vCPU) ≈ **$0.18/ghanta** (c7i.large ~$0.09 ka do guna; aggregator data, AWS se pakka karein).

| Roz ke learners | CPU-ghante/din | Peak par vCPU (burst ke saath) | Machines | Judge ka kharch/mahina |
|---|---|---|---|---|
| 2,000 | ~8 | ~4 | 1 hamesha + 1 backup | **~$130–260** (₹11–22k) |
| 20,000 | ~80 | ~24 | 2 hamesha, peak par 6 | **~$400–600** (₹34–51k) |
| 1,00,000 | ~400 | ~90 | 6 hamesha, peak par ~23 | **~$1,000–2,200** (₹85k–1.9 lakh) |
| 2,000 ka contest (90 min) | — | ~20 (p95 < 5 s ke liye) | 5 extra, 2 ghante | **~$2/contest** |

**Ek submission ka kharch:** 2 CPU-second ≈ $0.000025 bina khaali samay ke; asli me (40% istemaal) ~$0.00006–0.0001
= **₹0.005–0.01**. Bahar ki judge API per-submission paise leti hain, isliye 10–50 guna mehngi padti hai; apna judge
yahan saaf jeet hai.

**Sasta karne ke raaste:** 1 saal ka Savings Plan (~30–40% kam), extra workers Spot par (~60–70% kam; judge job
dobara chal sakta hai, isliye Spot theek), ARM (`c7g`, ~$0.098/ghanta 4 vCPU) agar sab compilers ARM par ek jaise
chalein (parity suite batayega). Hetzner ab sasta nahi raha: 2026 me unke cloud daam 2–2.7 guna badhe.

---

## 5. Server aur infra: requests par kharch

### 5a. Ek learner ek din me (maan kar)

| | Ginti | Kahan |
|---|---|---|
| Page views | ~20 | Vercel (static + CDN) |
| API calls | ~120 | API servers + Postgres |
| Code Run / Submit | 8 / 4 | Judge (§4) |
| AI (hint, doubt, notes) | ~3 | Claude API (§6) |
| AI code review | ~0.3 | Claude API |
| Video (agar ho) | ~10 minute | YouTube (free) ya Bunny |

### 5b. Teen padaav

| | **A: Launch** | **B: Badhat** | **C: Bada** |
|---|---|---|---|
| Roz ke learners (DAU) | 2,000 | 20,000 | 1,00,000 |
| Kul registered (andaaza) | ~20,000 | ~2 lakh | ~10 lakh |
| API calls/mahina | 7.2 million | 72 million | 360 million |
| Peak API req/second | ~20 | ~200 | ~1,000 |
| Run + Submit/mahina | 7.2 lakh | 72 lakh | 3.6 crore |
| AI requests/mahina | ~2 lakh | ~20 lakh | ~1 crore |

### 5c. Mahine ka kharch (USD; ₹ ≈ 85–90)

| Cheez | A | B | C | Note |
|---|---|---|---|---|
| API servers (AWS Mumbai) | $70–130 | $300–500 | $1,500–2,500 | 2 machine (HA) se shuru, CPU par autoscale |
| Database (Supabase Pro + compute) | $40–60 | $150–250 | $800–1,500 | C par read replica; ya RDS |
| Judge (§4e) | $130–260 | $400–600 | $1,000–2,200 | Spot/Savings Plan se kam |
| Web (Vercel Pro) | $20–40 | $50–150 | $300–1,000 | Bandwidth par |
| AI (Haiku 5.5, §6) | $70–100 | $700–1,000 | $3,500–5,000 | Free ki roz ki seema ke saath |
| Video | $0 (YouTube) | $0–2,000 | $0–10,000 | Bunny $0.005–0.03/GB; YouTube free |
| Email, WhatsApp, SMS | $10–50 | $100–300 | $500–1,500 | WhatsApp per message |
| Monitoring, backups, logs | $20–50 | $50–150 | $200–500 | Sentry, PostHog, S3 |
| **Kul (video ke bina)** | **~$360–690 (₹31–60k)** | **~$1,750–2,950 (₹1.5–2.5 lakh)** | **~$7,800–14,200 (₹6.6–12 lakh)** |
| **Ek learner par/mahina** | ~₹15–30 | ~₹8–13 | ~₹7–12 |

**Kahan sabse zyaada jaata hai:** AI aur video. Dono par seema aur sasta raasta pehle se tay rakhein (free me roz ke
hint, video YouTube par).

**Plus ka hisaab:** ek learner par kharch ₹7–30/mahina hai. 3–5% learner ₹199–399/mahina (ya ₹1,999–2,999/saal)
dein to platform faayde me hai. TUF ka daam hum pakka nahi kar paaye; launch se pehle bazaar dekh kar tay karein.

---

## 6. AI: apna open-source model ya API

### 6a. Ek request ka kharch (hamara hisaab)

Ek hint/doubt: ~4,000 token andar (problem, code, baat; ~2,500 har baar wahi, isliye cache) + ~350 token bahar.

| Raasta | Ek request | 1 lakh request | Kab theek |
|---|---|---|---|
| **Claude Haiku 5.5** ($0.10 / $0.50 per million; cache read 0.1x) | **~$0.00035 (₹0.03)**; naya tokenizer ~30% zyaada ginta hai, to ~₹0.04 tak | **~$35–45** | Hint, doubt, notes, quiz: **default** |
| Claude Sonnet 5.5 ($2 / $10) code review | ~$0.01 (₹0.9) | ~$1,000 | Sirf jahan Haiku eval me fail ho; Plus me |
| Hosted open model (DeepSeek V4 Flash $0.14 / $0.28) | ~$0.0003–0.0006 | ~$30–60 | Sasta, par DeepSeek ki apni API China me data bhejti hai: learners ka data **nahi** |
| **Apna model, apna GPU** | GPU ke ghante par (neeche) | — | Bahut zyaada, lagaataar traffic par |

### 6b. Apna model chalayein to: kaunsa, kahan, kitna

**Model (Oct 2026, web research; benchmark zyaadatar company ke apne, khud jaanchein):**

| Model | Size | Licence | Kahan fit | Kis kaam ke liye |
|---|---|---|---|---|
| **Qwen3.8-27B** | 27B dense | Apache 2.0 (release ki taareekh par sources me farak) | 4-bit par 24 GB (L4), FP8 par 48 GB (L40S) | Hint/doubt/review: sabse sahi size |
| Qwen3-8B / chhota | 8B | Apache 2.0 | L4 aaraam se | Sasta, tez; quality kam |
| gpt-oss-20b / 120b | 20B / 120B MoE | Apache 2.0 | 16 GB / 80 GB (H100) | Reasoning theek, coding me naye modelon se peeche |
| DeepSeek V4 Flash | ~284–304B (13B active) | MIT | Kai GPU (167 GB weights) | Bada; khud chalana mehnga |
| Kimi K3 | Bahut bada | Open weights | Kai H100 | Sabse accha open coding model (kai lists me), par hamare liye bada |
| Sarvam 30B / 105B | 30B / 105B | Apache 2.0 | 30B: 1×H100 ya 2×L40S | 22 Bharatiya bhashayein; Hindi wale kaam ke liye jaanchne laayak |
| bge-m3 / multilingual-e5 (embedding) | <1B | Open | **CPU** par bhi | Search, duplicate jaanch, "is jaisa problem" |

**Server aur daam (andaaze):**

| GPU | Kahan | Daam | 24×7 mahina |
|---|---|---|---|
| L4 24 GB | AWS Mumbai `g6.xlarge` | ~$0.97/ghanta (g6.4xlarge ke Mumbai daam se nikala) | ~$700 |
| L4 24 GB | E2E Networks (Bharat, rupaye me) | ~₹50–70/ghanta (pakka nahi) | ~₹36–50k |
| L40S 48 GB | Modal (serverless, second ke hisaab) | ~$1.95/ghanta, khaali par $0 | Istemaal par |
| L4 | Modal | ~$0.80/ghanta | Istemaal par |
| H100 80 GB | E2E | ~₹175–400/ghanta (sources me farak) | ~₹1.3–2.9 lakh |
| H100 | Modal | ~$3.95/ghanta | Istemaal par |

**Hisaab (padaav C: ~1 crore AI requests/mahina, ~4 req/second, peak par ~15):** Qwen3.8-27B ek L40S par andaazan
~2 req/second sambhalega (vLLM, batching; staging par naapna hai). Peak ke liye ~8 GPU, aam taur par ~3, plus
backup. **~$4,000–6,000/mahina**, upar se engineer ka samay, aur quality ka jokhim. Wahi kaam Haiku 5.5 par
**~$3,500–5,000**. Chhota 8B model L4 par sasta (~$1,500–2,100) hai, par hint ki quality aur "jawab leak na ho" ki
safety kam ho sakti hai.

**Faisla:**

1. **Launch par:** Claude Haiku 5.5 default, Sonnet sirf zaroorat par. Prompt caching aur free me roz ki seema.
2. **Abhi open-source yahan:** (a) embeddings CPU par (pgvector, Supabase me), search aur duplicate jaanch ke liye;
   (b) content factory me "doosra model" jo statement padh kar khud hal kare (hosted API ya Spot GPU par batch);
   (c) **AI provider adapter**, taaki ek setting se model badle, aur Anthropic band ho to backup chale.
3. **Apna GPU tab:** jab (i) AI requests 1 crore/mahina se zyaada aur lagaataar hon, (ii) open model hamare Sahayak
   evals (leak-free 98%, bug pakadna 90%) **pass** kare, aur (iii) GPU ka kharch API se 30%+ kam nikle. Tab pehle
   E2E (Bharat, rupaye me) ya Modal par ek mahine ka pilot.
4. **Kabhi nahi:** learners ka data aisi API ko jo use model training me le, ya jinke server ka desh DPDP me mana ho.

---

## 7. Kul kharch ek nazar me

### 7a. Launch tak ek-baari (andaaza)

| Cheez | Kam | Zyaada |
|---|---|---|
| Claude subscription (build, ~2 mahine) | $400 | $800 |
| Content factory API (DSA 450, aptitude 5,000, CS lessons + MCQ) | $800 | $1,500 |
| AI evals + testing | $200 | $500 |
| Staging + production infra launch tak (~2 mahine) | $300 | $800 |
| Mascot + illustrations (illustrator) | ₹30k | ₹1 lakh |
| Domain, Razorpay, WhatsApp setup | $50 | $200 |
| Content spot-check (insaan, 2 mahine) | ₹0 (khud) | ₹50k |
| **Kul** | **~₹1.8 lakh** | **~₹5 lakh** |

### 7b. Mahine ka (launch ke baad)

Padaav A: ₹31–60k · B: ₹1.5–2.5 lakh · C: ₹6.6–12 lakh (video ke bina; §5c).

---

## 8. Content: kya, kitna, kaise (launch ke liye)

Factory ka tareeka [ROADMAP-END-TO-END.md](ROADMAP-END-TO-END.md) §4 me hai: AI draft → machine jaanch → duplicate
jaanch → 5–10% insaan → live. Launch ka hissa:

| Content | Launch par | 4 hafte baad | Machine jaanch |
|---|---|---|---|
| DSA problems (apna kram, 18 topic) | 300 | 450 | Reference = brute random tests par; time limit; doosra model statement se hal kare |
| Editorial (3 approach × 4 bhasha) | 300 | 450 | Har bhasha ka code runner par sab test pass |
| Dry-run frames | Player khud banata hai | — | Player code chala kar banata hai, galti ki gunjaaish kam |
| Hints (3 seedhi) | 900 | 1,350 | Sahayak eval: hint me jawab leak nahi |
| Aptitude sawaal | 1,500 | 5,000 | Har sawaal ka Python solver = sahi option |
| Aptitude lessons | 30 topic | 45 | Insaan sample |
| CS core lessons | 160 | 300 | Do model sahmat + insaan sample |
| CS MCQ | 1,200 | 3,000 | Do model alag se hal karein |
| SQL problems | 50 | 150 | SQL runner par |
| Video | 0 | 20–40 (YouTube) | — |

**Video ka faisla (aapka):** (1) **Bina video launch**, dry-run player + editorial se (sabse tez, ₹0). (2) Ek
instructor (aap ya hire) ke chhote 5–10 min video, YouTube par: marketing bhi. (3) AI video: script AI, animation code
se (Manim jaisa), awaaz TTS (Hindi/English); sasta, par "insaan wala bharosa" kam. Sujhav: 1 se launch, phir 2.

---

## 9. Brand aur UI: "branded level"

TUF ka look nakal nahi; apni pehchaan, usi quality par.

**Jo pehle se hai** ([DESIGN.md](DESIGN.md)): प ka logo (ink-indigo tile, saffron bindu), tokens light + dark (dark:
`#0c1020` canvas, `#141a2c` surface, primary `#8b98fa`, saffron accent), Noto fonts (8 lipiyan, bundled), WCAG AA
dono theme me, Stylelint jo literal color rokta hai.

**Kya jodna hai:**

1. **Marketing site, dark-first:** hero (apni baat: "Placement ki poori taiyaari, ek jagah, apni bhasha me"), sirf
   sach wale numbers, **product tour tabs** jisme asli components demo mode me chalein (video/screenshot nahi; tez aur
   SEO ke liye accha), Campus aur Hire se jod ("jo seekha, wahi test, wahi naukri": ye TUF ke paas nahi), pricing,
   FAQ, footer me legal.
2. **Mascot "Sahayak":** apna character, illustrator se (AI se draft, final insaan ka), 6 pose (hint, khushi, soch,
   break, jeet, galti). Trademark search. (Ullu jaisa kuch nahi: Hindi me uska matlab galat jaata hai.)
3. **Chamak ke tokens:** `--glow-primary`, `--glass-surface`, `--border-subtle`, 8/12/16/24 radius, 150–250 ms motion,
   `prefers-reduced-motion` ka samman. Sab `tokens.css` me, taaki Stylelint niyam bana rahe.
4. **Learn shell v2:** ek top bar, left nav (Home, Roadmap, Subjects, Practice, Aptitude, Contests, Workspace,
   Profile), Ctrl+K search, coins aur streak; phone par neeche tab bar.
5. **Workspace v2:** editor tabs, test case panel, Submissions, editorial tabs (Brute/Better/Optimal), dry-run player,
   Sahayak side panel.
6. **Pages:** Landing, Pricing, Subjects, Subject home, Sheet/track, Problem workspace, Editorial, Aptitude topic,
   Aptitude practice/mock, Contest brief + live, Workspace (code, lists, notes), Profile/portfolio, Certificate,
   Company page, Experiences, Settings, Plus checkout.
7. **Gunvatta ki seema:** LCP < 2 s (4G, beech wala Android), landing JS < 150 KB gzip, editor lazy-load, axe dono
   theme me, 390 px phone layout, visual regression baselines (pehle se CI me).

---

## 10. Timeline (Learn par poora dhyaan, ek account, har slice naya session)

| Hafta | Kaam | Done kab |
|---|---|---|
| 0 | Aapka [OWNER-SETUP.md](OWNER-SETUP.md) (GitHub billing, domain, Vercel/Supabase Pro, AWS role, API key, Razorpay form). Priority ka faisla | CI hara, staging chalu |
| 1–2 | Content factory ka code + pehla batch (DSA 50, aptitude 300); judge: queue bahar, compile cache, staging par parity + load test | Batch machine-check pass; judge p95 < 5 s staging par |
| 1–3 | Brand: marketing site, pricing, legal; Learn shell v2; mascot brief illustrator ko | Landing staging par, Lighthouse > 90 |
| 2–4 | Aptitude module; workspace v2 + dry-run player; subject homes; onboarding → roadmap card | Tests + screenshots |
| 2–5 (raat ko) | Content: DSA 300, aptitude 1,500, CS 160 lessons + 1,200 MCQ, SQL 50 | Spot-check 5–10% |
| 4–5 | Profile/portfolio, workspace page, company pages (sach wala data), Sahayak har jagah; Sahayak **paid eval** | Eval targets pass |
| **5** | **Private beta**: 300–500 students (ek-do college) | Feedback, crash-free 99.5% |
| 6–7 | Beta ke fixes, readiness (load 10k DAU, restore, security review), SEO, analytics, Plus pricing | Readiness report |
| **8–10** | **Public launch** | Live, monitoring, on-call |
| 10–14 | DSA 450, aptitude 5,000, LLD, YouTube video, mocks, Pramaan | Lagaataar |

Do accounts ho (ek Learn, ek Hire), to Hire bhi saath chalta hai.

**Slices ka andaaza:** ~20 (brand/site 3, shell + workspace 3, aptitude 2, subjects + onboarding 2, profile/workspace
page 2, Sahayak surfaces 1, judge 2, content factory 3, launch readiness 2).

---

## 11. Khatre aur bachaav

| Khatra | Bachaav |
|---|---|
| Content me galti | Machine jaanch + spot-check + "galti batao" button + version |
| TUF jaisa dikhne par copyright/trade dress ka jhagda | Apna brand, mascot, naam, copy; layout ke aam pattern theek, nakal nahi |
| Company tags ke jhoothe daave | Sirf asli, consent wala data, source ke saath |
| AI ka bill | Haiku default, cache, free seema, mahine ki API spend limit, alarm |
| AI jawab leak kare | Sahayak evals launch se pehle (Ruka hua kaam) |
| Judge par hamla (sandbox escape) | gVisor/isolate, alag VM, network band, metadata band, Judge0 ≥ 1.13.1 |
| Contest me judge dheema | Scheduled scaling, contest lane, load test |
| 18 se kam umar ke learners (DPDP) | Signup par 18+ pushti ya parental consent |
| GitHub Actions band | Pehla kaam: billing |
| Video ka bill | YouTube free; Bunny sirf Plus me |

---

## 12. Sources (web research, 19 Oct 2026)

Daam badalte hain; budget se pehle vendor ki site par pakka karein.

- Open models: [Hugging Face blog: open-source LLMs 2026](https://huggingface.co/blog/daya-shankar/open-source-llms),
  [unite.ai: best open-source LLMs (Oct 2026)](https://www.unite.ai/best-open-source-llms/),
  [llm-stats open leaderboard](https://llm-stats.com/leaderboards/open-llm-leaderboard),
  [Kilo: open-weight coding models](https://kilo.ai/open-source-models),
  [Northflank: Qwen3.8-27B](https://northflank.com/blog/qwen3-8-27b-performance-benchmarks-gpu-requirements-and-how-to-run-it),
  [Yotta Labs: Qwen3.8-27B hardware](https://www.yottalabs.ai/post/qwen-3-8-27b-specs-hardware-requirements-how-to-run-2026),
  [DeepSeek V4 Flash pricing](https://zenmux.ai/blog/deepseek-v4-flash-api-pricing),
  [Sarvam 30B/105B Apache 2.0](https://www.opensourceforu.com/2026/03/sarvam-releases-30b-and-105b-llms-under-apache-2-0/)
- GPU: [E2E Networks pricing](https://www.e2enetworks.com/pricing.md),
  [E2E H100 pricing](https://www.e2enetworks.com/cloud-terms/gpu/h100-pricing-india),
  [Modal pricing 2026 (BudgetForge)](https://www.budgetforge.dev/tools/modal-pricing-2026),
  [Spheron: Modal per-second](https://www.spheron.network/blog/modal-gpu-pricing-2026-per-second-billing/),
  [AWS g6.4xlarge Mumbai (Cloud Mercato)](https://pcr.cloud-mercato.com/providers/aws/flavors/g6.4xlarge/pricing)
- vLLM: [TrueFoundry vLLM benchmark](https://www.truefoundry.com/blog/vllm-benchmark),
  [vLLM benchmarks](https://www.morphllm.com/vllm-benchmarks)
- CPU servers: [c7i.large Mumbai (Cloud Mercato)](https://pcr.cloud-mercato.com/providers/aws/flavors/c7i.large/pricing),
  [c7g.xlarge Mumbai](https://aws-pricing.com/c7g.xlarge.html),
  [Hetzner June 2026 price increase](https://privatedevops.com/news/hetzner-june-2026-cloud-price-increase-what-to-do)
- Video: [Bunny pricing](https://bunny.net/pricing/),
  [Mux vs Cloudflare Stream vs Bunny Stream](https://apicostcalc.com/es/mux-vs-cloudflare-stream-vs-bunny-stream-cost-calculator.html)
- Judge0 cgroup v1: [Judge0 deployment note (CSDN)](https://aicoding.csdn.net/6a5df20c10ee7a33f28f8570.html),
  [go-judge cgroup v2](https://pkg.go.dev/github.com/criyle/go-judge@v1.9.0)
- Claude daam: Claude API docs (Haiku 5.5: $0.10 / $0.50 per million token jab prompt ≤ 100K; Sonnet 5.5 $2 / $10).

## 13. Owner se kya chahiye

1. **Priority:** Learn pehle, Hire pehle, ya dono (do accounts)?
2. **Video:** bina video launch (sujhav), instructor, ya AI video?
3. **Mascot aur naam:** illustrator ka budget (₹30k–1 lakh); planner aur AI ke apne naam.
4. **Plus ka daam:** ₹199–399/mahina ya saal ka plan; free ki seema (roz kitne hint, Run).
5. **Beta colleges:** 1–2 college jahan 300–500 students private beta karein.
6. [OWNER-SETUP.md](OWNER-SETUP.md) ki list (billing, domain, AWS, API key, Razorpay).
