# Poora platform end-to-end: roadmap, content factory, kharch, samay (18 Oct 2026)

**Owner ne kya poocha (18 Oct 2026):** poora platform (Hire, Campus, Learn + Build Labs) aur poora content (unique
DSA, aptitude, CS subjects, technologies) Claude khud automate karke banaye. Owner se kya chahiye, kaunse
connector/MCP/skills chahiye, kitna samay, kitna kharcha (bill, tokens), aur Claude ka $200 wala plan lekar Opus 5.5
par ultracode chalayein to kitne mahine lagenge.

**Imaandari se pehle teen baatein:**
1. **"Mujhe kuch nahi karna padega" poora mumkin nahi.** Claude company ka KYC, payment, contract, kanooni zimmedari
   ya kisi service ki terms accept nahi kar sakta, aur kharch ki har nayi cheez par aapki saaf haan chahiye. Iske
   alawa baaki lagbhag sab automate ho sakta hai. Aapka kaam: shuru me ek baar ~10–15 ghante, phir hafte me ~30–60
   minute (§2).
2. **Saare samay aur kharch ke aankde andaaze hain**, hamare apne data par (§5a). Anthropic subscription ki limits
   tokens me publish nahi karta; vendor ke daam badalte hain.
3. **Content AI banayega, par har item machine se jaancha jaayega** (§4). Phir bhi 5–10% insaani spot-check zaroori
   hai, warna galat sawaal students tak pahunchenge.

## 1. Kya bacha hai (tracker + plan docs se)

| Hissa | Bacha kaam | Slices (andaaza) |
|---|---|---|
| **Hire** (row 110–120) | H2d baaki, H3 AI screening, H4a–c rounds + offer, H5a–b integrity, H7 operator, H8a–b console, H9a–b candidate web, H6 sawaal drafts, H10 e2e | ~15 |
| **Go-live F1** (row 100–109) | G0–G4 ka bacha hissa, G5 strict proctoring, G6 live video, G7 phone camera, G8 SEB, G9 live | ~8 |
| **Campus F2** (row 95–99) | Classes ka bacha, admission/scholarship test, subject-wise internal test, TPO dashboard | ~6 |
| **UI/UX F3** (row 79) | Ek shell, marketing site, help center, LCP < 2 s | ~5 |
| **Learn features** ([LEARN-TUF-GAP.md](LEARN-TUF-GAP.md) L4–L20) | Mass-recruiter mocks, dry-run player, micro-viva/Pramaan, mastery model, verifiable Pramaan, AI ke saath code, drills, Hinglish, awaaz… | ~23 |
| **Build Labs** ([LEARN-BUILD-LABS.md](LEARN-BUILD-LABS.md) P0–P3) | Runner stages, browser labs, live microVM labs, tracks, Campus/Hire jod | ~14 |
| **Content factory ka code** (§4) | Generator, verifier, review UI, scheduler | ~3 |
| **Launch** (row 81–83) | Rehearsal (load, restore, security review), AI evals, live | ~7 |
| **Kul** | | **~80** (+ Batch A–J me se jo chunein, ~10) |

**Ek slice** = ek focused kaam (migration → store → service → routes → UI → check → docs), lagbhag ek 5-ghante ki
usage window. Example: H2b ek slice tha, H2c ek.

## 2. Aapse kya chahiye (ye Claude nahi kar sakta)

### 2a. Ek baar (shuru me, ~10–15 ghante)

| # | Kaam | Kyun | Abhi haalat |
|---|---|---|---|
| 1 | **GitHub billing theek** | Iske bina CI ka koi job nahi chalta | Ruka hua (tracker) |
| 2 | **Anthropic API account + billing + key** (GitHub secret aur VM env me; chat me kabhi nahi), mahine ki spend limit | Content factory aur platform ke AI features | Ruka hua |
| 3 | **AWS Mumbai account** + GitHub Actions ke liye OIDC role (taaki deploy Claude workflow se kare, koi key share na ho) | Production VM, Judge0, labs baad me | Ruka hua (DEPLOY-AWS.md) |
| 4 | **Supabase Pro**, **Vercel Pro**, **domain** + DNS | Database, web, URL | Aadha |
| 5 | **Razorpay KYC** (PAN, GST, bank) | Plus aur company credits | Owner ka |
| 6 | **Email (SES production access)**, **WhatsApp Business** verification | Mails aur reminders | Owner ka |
| 7 | **Kanooni**: company, terms + privacy policy ki manzoori, grievance officer (naam + email), DPDP | Har public launch se pehle | Ruka hua |
| 8 | **Merge ka niyam**: ya to aap har PR merge karein, ya likh kar dein ki CI hara + review pass hone par Claude merge kare | Bina iske har slice aap par rukega | Faisla |
| 9 | Faisle jo docs me "Owner se" likhe hain (LEARN-TUF-GAP §6, LEARN-BUILD-LABS §12, Hire ke) | Kram, brand, budget | Baaki |

### 2b. Har hafte (~30–60 minute)

- Claude ke sawaalon ke jawab (ek jagah: tracker ka "Ruka hua kaam").
- Bills bharna aur spend limit dekhna.
- Content ka 5–10% spot-check (ya ek part-time reviewer rakh lein, ~₹15–25k/mahina, andaaza).
- Naye account par session shuru karna jab limit khatam ho (ek prompt paste).

## 3. Connectors, MCP aur skills

| Kya | Kis kaam ke liye | Haalat |
|---|---|---|
| GitHub | Code, PR, CI, Actions | ✅ judaa |
| Supabase | Migrations, logs, advisors | ✅ judaa |
| Vercel | Deploy, logs | ✅ judaa |
| Sentry, PostHog, UptimeRobot | Errors, analytics, uptime | ✅ judaa |
| Notion | Agar aap wahan docs chahein | ✅ judaa (zaroori nahi) |
| **Anthropic API key** (secret) | Content factory (Batch API), Sahayak, screening, AI interview | ⬜ aapse |
| **AWS (OIDC role)** | Deploy aur infra, Terraform pehle se repo me | ⬜ aapse |
| **Cloudflare / DNS connector** (agar domain wahan ho) | DNS records Claude khud badle | ⬜ optional |
| **Claude Code routines** (scheduled triggers) | Raat ko content batch shuru karna, PR dekhna, check-ins | ✅ is session me tool hai; har nayi routine par aapki haan |
| **Repo skills** (Claude banayega): `content-factory`, `steward` (PR ko hara rakhna), `slice-build` (ek slice ka poora kram) | Har account aur session ek hi tareeke se kaam kare | ⬜ main bana sakta hoon |

## 4. Content factory: unique content, machine se jaancha hua

Har item: **AI draft → machine jaanch → duplicate jaanch → 5–10% insaan → live**. Generation **API ke Batch par**
chalega (subscription par nahi): 50% sasta, raat ko apne aap, aur kharch ki seema ke saath.

| Content | Kitna | Kaise banega | Machine jaanch (sabse zaroori) |
|---|---|---|---|
| **DSA problems** | 450 → 1,000 | Statement, constraints, 2+ bhashaon me reference solution, brute force, test generator, edge tests, editorial (brute/better/optimal), 3 hints | Runner par: reference aur brute random tests par barabar; time limit sahi; ek doosra model statement padh kar khud hal kare aur outputs mile (statement saaf hai); embeddings se purane problems se duplicate jaanch |
| **Aptitude** (quant, reasoning, verbal) | 5,000 | Har sawaal ke saath ek chhota Python solver; options me galat jawab "aam galtiyon" se | Solver ka jawab = sahi option; reasoning puzzles brute force se; verbal: do model sahmat + insaan sample |
| **CS subjects** (DBMS, OS, CN, OOPs, SQL, system design) | ~300 lessons + 3,000 MCQ + 50 SQL | Lesson apne shabdon me, diagram, quiz | MCQ: do model alag se hal karein, sahmat hon; SQL runner par |
| **Mass-recruiter mocks** | 4 formats × 3 | Bank se, sahi timing ke saath | Section ka time aur difficulty ka balance |
| **Hinglish** | Sab editorial + hints | Sasta model, glossary ke saath | Shabdavali ki jaanch + sample |
| **Build Labs** | 6 tracks × 5–8 projects | Lab spec: steps, check script, solve script | CI: reference solution saare checks pass, khaali env par fail |

**Unique kaise:** apne kram aur apni kahaniyon se; LeetCode/TUF/GfG ka koi statement nahi. Duplicate jaanch hamare
bank se. Bahar ki sites se tulna ke liye bas spot-check web search.

## 5. Samay, tokens aur kharch

### 5a. Hamara asli data

| | Number |
|---|---|
| Is session (27 Sep – 18 Oct) | 173 commits, ~120 tasks; Claude Code ka API daam par andaaza **~$957** |
| Usme sabse bada hissa | ~2.85 arab **cache-read** tokens (session ka context ~5–10 lakh tokens ho gaya tha) |
| Ek 5-ghante window me | Session 3 ne H2c ke 5 kadam + review kiye, limit 91% par ruki |
| Ek din bhari ultracode (6 agents + 3 critics) | Account 1 ki **hafte** ki limit 98% |

**Seekh:** lamba session mehnga hota hai, kyunki har kadam poora context dobara padhta hai. **Har slice naye session
me** (handoff se shuru) chalane se usage 2–4 guna kam ho sakta hai. Ultracode (multi-agent) ko design aur review ke
liye rakho, roz ke build ke liye nahi.

### 5b. Tokens (andaaza)

| Kaam | Output tokens | API daam par (Opus 5.5) |
|---|---|---|
| Platform build, ~80 slices, naye sessions me | ~10–20 million | ~$2,000–4,500 |
| Wahi, har slice ultracode se | ~2–3 guna | ~$5,000–10,000 |
| Content factory (§4, sab, batch ke saath) | ~60–120 million | ~$1,500–3,000 |

Daam: Opus 5.5 $4 / $20 per million input/output, cache read $0.20; Sonnet 5.5 $2 / $10; Haiku 5.5 $0.10 / $0.50;
Batch API 50% kam. (Claude API docs, 6 Oct 2026 ki copy.)

### 5c. $200 wale plan par kitne mahine

Anthropic subscription ki limit tokens me nahi batata. 5 ghante ki window aur hafte ki seema hoti hai, aur Opus
jaldi khatam karta hai. Hamare data par andaaza:

| Tareeka | Slices/hafta (andaaza) | ~80 slices me |
|---|---|---|
| Ek account, naye session har slice, ultracode sirf design/review | 8–12 | **~2–2.5 mahine** |
| Ek account, har slice ultracode | 3–5 | **~4–6 mahine** |
| Do accounts (alag hisson par, jaise ek Hire, ek Content/Labs) | 15–20 | **~1–1.5 mahine** |

Subscription ka kharch: **$200 × 2–6 mahine ≈ $400–1,200**. Ye API par seedha bharne (~$2,000–10,000) se kaafi sasta
hai, par limit ki wajah se samay lagta hai. Content factory alag se **API par** (~$1,500–3,000 ek baar).

### 5d. Platform chalane ka mahine ka kharch (andaaza; vendor se pakka karna)

| Cheez | Pilot (kuch college, kuch hazaar learner) | Badhne par (~10,000 active) |
|---|---|---|
| AWS (API VM, Judge0 VM, backups) | ~$150–300 | ~$400–900 |
| Supabase Pro + compute | ~$25–100 | ~$100–400 |
| Vercel Pro | ~$20–50 | ~$50–150 |
| Email, WhatsApp, SMS | ~$10–50 | ~$100–400 (kitne message) |
| Monitoring (Sentry, uptime) | ~$0–50 | ~$50–150 |
| **AI features** (Sahayak, screening, AI interview) | ~$100–300 | **~$500–4,000** (model chunav par) |
| Live labs (microVM) | — | $0.10–0.17/learner-ghanta; quota se |
| **Kul** | **~$300–850 (₹25k–75k)** | **~$1,200–6,000+ (₹1–5 lakh)** |

Repo me production budget alert $1,200/mahina par pehle se set hai (DEPLOY-AWS.md).
**AI ka bill sabse bada palda hai.** Sahayak ke hints Haiku 5.5 par (Opus se ~40 guna sasta) eval pass hone par
chalayein, aur Opus sirf mushkil review aur interview ke liye. Isse AI kharch 5–10 guna gir sakta hai.
($ → ₹ lagbhag 85–90 maan kar.)

### 5e. Abhi poora platform taiyaar karne ka ek-baari kharch (andaaza)

| | Kam se kam | Zyaada |
|---|---|---|
| Claude subscription (build) | $400 (2 mahine) | $1,200 (6 mahine) |
| Content factory (API) | $1,500 | $3,000 |
| AI evals + testing (API) | $200 | $500 |
| Infra launch tak (staging + prod, ~3 mahine) | $600 | $1,500 |
| Domain, Razorpay, WhatsApp setup | $50 | $200 |
| Content spot-check (insaan, 3 mahine) | $0 (khud) | $1,000 |
| **Kul** | **~$2,750 (~₹2.4 lakh)** | **~$7,400 (~₹6.5 lakh)** |

## 6. Roadmap (hafte ke hisaab se, ek account, naye sessions)

| Hafta | Kya | Done kab |
|---|---|---|
| **0–1** | Aapka §2a checklist; PR #66 merge; content factory ka code (§4) aur repo skills | CI hara, API key laga, pehla batch (50 DSA) jaancha hua |
| **1–4** | **Hire poora** (H2d → H10) | Ek company: job → apply → screen → test → interview → offer, e2e |
| **2–8** (saath-saath, raat ko) | Content: DSA 150 → 450, aptitude 1,500 → 5,000, CS lessons + MCQ | Har batch machine-check pass + spot-check |
| **4–7** | **Go-live**: G5–G9, staging → production, rehearsal (load, restore, security), AI evals | Soft launch: Hire + Learn beta |
| **7–10** | **Learn upgrades**: mass-recruiter mocks (L9), aptitude track, micro-viva/Pramaan (L11), mastery (L16), verifiable Pramaan (L17) | Learn public |
| **10–13** | **Campus**: admission test, internal test, TPO dashboard; Build Labs P0 (runner + browser labs) | Ek college pilot |
| **13–20** | Build Labs P1–P2 (live labs, tracks), AI ke saath code (L15), dry-run (L10), drills (L13), Hinglish, F3 marketing site | v1.0 |
| **20+** | Labs P3, awaaz (L20), Batch A–J me se zaroori, scale | Lagataar |

Do accounts ho to hafte 1–13 lagbhag aadhe samay me.

## 7. Automation kaise chalega (aapka kaam kam se kam)

1. **Har slice naya session**: aap ek prompt paste karte hain ([RESUME-PROMPT.md](RESUME-PROMPT.md)); handoff se kaam
   uthta hai, commit/push har kadam, limit par apne aap save.
2. **Raat ko content factory**: GitHub Actions (ya VM) par schedule; API key secret me; spend limit; subah report.
3. **PR ko hara rakhna**: Claude CI dekhe, fix kare; merge aapke niyam (§2a-8) ke hisaab se.
4. **Hafte ki report**: kya bana, kitna kharcha, kya aap par ruka (tracker ka "Ruka hua kaam").

## 8. Khatre

| Khatra | Bachaav |
|---|---|
| AI content me galti | Machine jaanch (§4) + spot-check; galti report button; har sawaal ka version |
| AI bill bekaabu | API spend limit, sasta model jahan eval pass, quota |
| Subscription limit beech me | Naye session, handoff, do accounts; ultracode kam |
| Vendor daam/niyam badle | Adapter (model, judge, labs provider); kharch ki mahine ki report |
| Kanooni (DPDP, copyright, brand) | Apna content, notice, grievance officer, "jaisa format" bina logo |
| CI band (billing) | Pehla kaam: billing theek |

## 9. Sabse pehle (agle 7 din)

1. Aap: GitHub billing, Anthropic API key (secret), grievance officer, merge ka niyam.
2. Claude: H2d poora (agla kadam handoff me), phir content factory ka code + pehla 50 DSA batch.
