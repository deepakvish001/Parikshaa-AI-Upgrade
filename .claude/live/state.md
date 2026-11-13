# Live state at the last autosave (the time is in the autosave commit)

- Branch: `claude/learn-v2`, on top of `9587093e015f5b9ecc7fc8d4a8e7ee8b5277bac2`
- Session: `eb426b80-ab54-56ea-8823-565e77e2f8d9`

## Uncommitted changes

```
(none)
```

## Task list (this session)

- [completed] Session row in LEARN-HANDOFF §6 + push
- [completed] Kadam 0a: AE6 code-reading screen in mock
- [completed] Kadam 0b: AE9 interview format guide in mock
- [completed] Kadam 0c: 44-0 user-test script
- [completed] Publish mock preview (owner decisions recorded)
- [completed] K1-0: remove duplicate dependency keys, checks, push
- [completed] K1-1: brand v4.4 tokens, fonts, logo A in packages/brand
- [completed] K1-2: kit components into packages/brand
- [pending] K1-3: Learn shell in packages/web behind learn_v2 flag

## Owner's latest message

learn pura launch karne ke liye kya rah gya hai kaam aur kya ban gya hai aur content bhi batao dekho dsa ke 5000 Questions total jisme se 3000 public 2000 premium aur sabke long detailed editorial about each 7-8K words long and SQL ke around 1000 questions like dsa including long editorial like datawar.io website have skills of all lang and technolgy we need to launch it also most detailed lectures of CN, DBMS, OS for interview and LLD and OOD for interviews in detailed text based interactive lecture hands on leanring and coding aur normally sab lang and technolgy me padhayi to ho but projects bhi hands ho jo pura test cases per chale aur unko proper verified rhe ki cheating na kar paye also dsa and sql questions ager cheating kiya hai plag ya similiar code aaye to usko handle and sab kuch sahi hai to after submit real time me analysis karke verify karo ki ye questions khud se kiya hai ya nhi kaise karoge aur ye bhi dhyan rhe ki sabkw questions diff rhe aur unko code ke hisab se rhe aur ye bhi dhyan rhe ki vo kahi se aur dekh kar answer na kar de to sari lang ke lecture incldung projects in depth, technologys sab including CN, OS, DBMS, LLD, OOD, SQL, Quantitative, Logical + Verbal Aptitude around 5000 questions new preoium on each topics atlerast itna launch karne ke liye kitna time lagega ??

tum pura week dekho ki limit ki vajah se week me kitne kaam kar pa rhe ho max uske hisab se kitne kaam hoga aur uske hisab se total ye sab pura build test content bna kar launch me kitne jayega week approx min aur max dono atleast itna launch kare baki add karte jayenge ?

## Claude's latest messages (newest last)

## Seedha jawab
Sab kuch ek hi platform par ho sakta hai: Learn, colleges/universities, companies (Hire), har language ka compiler, framework labs, Jupyter, VS Code, system design, AI, contests, hackathons aur quizzes. Iska sabse achha tareeka ye hai:

**Ek mazboot core (ek login, ek database, ek API) rakho, aur sirf bhaari kaam alag services me nikaalo.** Bhaari kaam matlab code chalana, dev environments, AI aur live contest.

Hamara maujooda code isi raah par bana hai. Runner alag service hai, Judge0 ka raasta bana hua hai, data har organisation ke hisaab se alag (RLS) rehta hai, aur API ki apni koi state nahi hai. Isliye **dobara likhne ki zaroorat nahi**; ise teen charnon me badhayenge.

## Platform ka dhaancha (layers)
| Layer | Kya | Tech |
|---|---|---|
| 1. Frontend | Learn, console (college), Hire (company), contests | React + Vercel (CDN). Baad me mobile app. |
| 2. Core API | Users, organisations, Learn, Hire, exams, contests, billing | TypeScript (Fastify), ek "modular monolith"; machines badha kar scale |
| 3. Data | Postgres (mukhya), Redis (cache, live leaderboard, queue), S3 (files), search, analytics | Supabase/Postgres → bade scale par Aurora/RDS + replicas; Redis; S3; Typesense ya OpenSearch; ClickHouse |
| 4. Code chalana | Teen star, neeche detail me | gVisor runner, Judge0, Firecracker/Kubernetes |
| 5. AI gateway | Saare AI kaam ek darwaze se: tutor, grading, AI interviewer, report | Claude API + baad me apna open model (vLLM, GPU); kharche ki seema, caching, evals |
| 6. Live | Contest leaderboard, proctoring, notifications | WebSocket/SSE, Redis |
| 7. Platform | Deploy, monitoring, suraksha | Terraform, GitHub Actions, Sentry, OpenTelemetry/Grafana, WAF; data Bharat me (DPDP) |

## Code chalane ke teen star
| Star | Kya chalega | Kahan | Kharcha |
|---|---|---|---|
| **E0: browser** | Python (Pyodide), JS, SQL, React/web projects, **Jupyter-jaisa notebook** (JupyterLite) | Learner ke browser me | Lagbhag ₹0 |
| **E1: judge** | DSA/SQL ke su …

---

Aisi cheezein jodiye jinse teeno ko ek saath fayda ho: student ko seekhna aur naukri, college ko placement aur pehchaan, company ko sahi log jaldi. Jitne zyada student, utni zyada companies aayengi, aur jitni companies, utne zyada college aur student judenge. Yahi sabse bada faayda hai.

## Next-gen features (teeno ka fayda)
| # | Feature | Student ko | College ko | Company ko | Abhi haal |
|---|---|---|---|---|---|
| 1 | **Skill Passport (Pramaan)**: ek verified profile. Har skill proctored test, viva wale project aur contest se saabit | Resume ki jagah saboot | Batch ki asli quality dikhti hai | Fake resume khatam, sahi filter | Certificate verify bana hai; Pramaan plan me |
| 2 | **Ek skill map (sabka saajha)**: jaise "Graphs L3", "SQL joins L2" | Kya kami hai, saaf dikhe | Syllabus industry se mile | JD seedha skills me | Naya |
| 3 | **Company ke asli challenges / ticket labs**: company apne stack ka asli kaam deti hai | Asli kaam ka anubhav | Industry se juda content | Pehle se jaanche hue log | Ticket lab Kadam 3 me |
| 4 | **Campus drive automation**: JD → test → AI interview → offer, kai colleges ek saath | Ek click apply, jaldi result | TPO ka kaam aadha | Ek din me 50 colleges | Placement drives bane hain; AI interview Kadam 3/5 |
| 5 | **Readiness dashboard + accreditation reports**: batch ki taiyaari, kamzor topics, NAAC/NBA ke liye CO-PO report apne aap | Jo kami hai uski practice | **NAAC/NBA ka kaam bachta hai** (bada selling point) | Kaun college kitna taiyaar, pata | Readiness bana; accreditation naya |
| 6 | **AI career copilot**: target role/company se roadmap, mock interview, har galti par feedback | Personal mentor 24x7 | Har student par nazar | Behtar taiyaar candidates | Sahayak + plan bane; AE5/AE9 plan me |
| 7 | **Har candidate ko feedback**: reject hone par bhi rubric ke saath kya kam tha | Seekhne ka mauka | Placement report behtar | Brand achha, fair hiring | Naya |
| 8 | **Inter-college leagues aur hackathons**: college vs college lead …

---

Main ruk raha hoon, kyunki **hafte wali usage limit 91% par hai**, aapki 90% wali seema se upar. Ye ~17 Nov 01:00 UTC (subah ~6:30 IST) par reset hogi.

Mera 10 Nov wala check-in aaj, 3 din der se, chala. 5 ghante wali limit abhi 14% hai, par hafte wali bhar gayi hai. Isliye K2-8 aptitude ka agent maine shuru **nahi** kiya.

**Abhi ka haal (sab save hai):**
- #93 ka merge `main` par hai. Uske baad CI, CodeQL, Vercel deploy aur API (VPS) deploy, chaaron hare hain, aur staging up to date hai.
- Branch `claude/learn-v2` `main` ke barabar hai. Koi adhoora kaam nahi bacha.
- K2-8 ka poora plan aur aapka faisla (aptitude screen + ~60 sawaal wala starter pack) handoff §5 aur tracker ke "Faisle" me likha hai.

**Aage do raaste:**
1. **Doosre account se abhi:** naya session kholiye aur kahiye: "docs/HANDOFF.md aur LEARN-HANDOFF §5 padh kar K2-8 aptitude continue karo." Sab kuch wahan likha hai.
2. **Isi account se:** 17 Nov ke reset ke baad "continue" likhiye, main wahin se shuru karunga.

Aapke pichhle sawaal (agla platform, teeno ke liye features) par mera sujhaav upar ke jawab me hai. Unme se kya banana hai, ye aap bataiye. Tracker me main tabhi jodunga.

---

**Short jawab:** jo content aapne bataya, wo poora ek akele account se banane me **~1.5–2 saal** lagenge. Isliye launch thoda chhota rakhiye, aur baaki launch ke baad har hafte judta rahe.
- **1 account:** launch **~22–30 hafte**.
- **3 accounts + 2–3 log content jaanchne ke liye:** launch **~10–14 hafte**.

Hisaab neeche hai.

## 1. Meri raftaar (is hafte ke data se naapi)
- Ek 5 ghante ki window lagbhag **12–14%** hafte ki limit khaati hai, yani ek hafte me **~7–8 windows** milti hain.
- Ek platform tukda (jaise K2-7 SQL) CI fixes milakar **1.5–2 windows** leta hai, yani **~3–4 tukde/hafta**.
- Content: ek DSA problem jisme 7–8K shabd ka editorial, 3–4 languages me solution, aur jaanche hue test cases (generator + brute force se) hon, lagbhag **~10–14 problems ek window me** banti hai, yani **~80–110 problems/hafta**, agar sirf yahi kaam ho.

Ye andaaze hain; asli raftaar content ki kathinaai se upar-neeche hogi.

## 2. Kya ban gaya, kya baaki (platform)
- **Ban gaya:** K2-0 se K2-7 (Aaj, plan, sheet, workspace + asli judge, revision, POTD, Sahayak, SQL), K2-8 ka pehla hissa, aur staging live.
- **Baaki:**

  | Kaam | Andaaza |
  |---|---|
  | K2-8 aptitude, K2-9 contests, K2-10 profile, K2-11 Plus, K2-12 community | ~2 hafte |
  | Kadam 3–5 (Studio/projects, labs, AI interview, AI report) | ~6–8 hafte |
  | Anti-cheat v2 | ~2–3 hafte |
  | Launch ki taiyaari | ~1–2 hafte |
  | **Platform kul (1 account)** | **~12–16 hafte** |

- **Content:** abhi sirf starter packs hain (DSA, SQL, CS fundamentals ke 80 MCQ). Bada content abhi bana hi nahi.

## 3. Aapka maanga poora content: kitna samay (1 account)
| Content | Kitna | Andaaza |
|---|---|---|
| DSA | 5,000 (3,000 public + 2,000 premium), har ek ka 7–8K shabd ka editorial, yani **~3.7 crore shabd** | ~45–60 hafte |
| SQL | 1,000 + lambe editorial + har sawaal ka dataset | ~5–7 hafte |
| Aptitude (quant, logical, verbal) | 5,000 + samjhaav + variants | ~2–3 hafte |
| CN, OS, DBMS, LLD, OOD | Interview-level, interact …

---

