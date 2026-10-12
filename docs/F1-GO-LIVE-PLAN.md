# F1 Hire: poora karke live karna (go-live plan)

3 Oct 2026. Owner ne kaha: "F1 complete karke usko live karna hai. Har company ka ek ID aur dashboard, hamari library se sawaal (SDE, coding, DSA, programming, MCQ) ya khud ke, proper proctoring (secure browser, full screen, live video, third eye), Supabase + Vercel par deploy jahan main test kar sakoon, aur Judge0 se LeetCode jaisa coding assessment."

Ye file wahi plan hai: kya pehle se bana hai, kya banana hai, kis kram me, kahan chalega, kitna kharcha, aur "done" kab. **Build owner ki haan ke baad hi shuru hoga.** Tracker me ye [Plan rows 100–109](PREP-TRACKER.md#plan-aage-kya-banega) hain.

---

## 0. Seedhe jawab

| Sawaal | Jawab |
|---|---|
| Kya F1 poora Supabase par chal jaayega? | **Nahi, poora nahi, aur hona bhi nahi chahiye.** Database (Postgres) aur files (photos, recordings) Supabase par. Frontend Vercel par. Lekin **API, workers, code runner (Judge0) aur live video** Supabase ya Vercel par nahi chal sakte (wajah §2.2). Inke liye **Mumbai me ek VM** (pehle se tay: LAUNCH-PLAN §4) aur video ke liye **LiveKit**. |
| Kya ye scale karega? | Haan, 1,000 candidates ek saath ke liye (pehla target). Supabase Pro + Small/Medium compute + pooler, API VM, alag Judge0 VM, LiveKit Cloud. 5,000 ke liye sirf machines badi/zyada: code nahi badalta (§2.4). |
| Har company ka ID? | Haan. Har company ek **organisation** hai (pehle se, RLS se alag-alag). Usko ek **Company ID** (`PKC-XXXXXX`) aur apna dashboard (console). Do raaste: company khud signup kare (bana, row 89), ya **hum operator panel se banayein** (naya, §3). |
| Library se sawaal? | Haan: ek **Parikshaa Library** (sab companies ke liye ek, read-only): aptitude, CS MCQ, programming MCQ, DSA coding, SQL, frontend, SDE role sets. Company dekh kar "Add to my bank" kare, ya khud likhe (editor aur Word/Excel import pehle se). §4. |
| Proctoring? | Paanch level, exam ke hisaab se: Basic → Secure (pehle se) → **Full screen zid** → **Live video + recording** → **Third eye (phone)** → **Safe Exam Browser lockdown**. §6. |
| Judge0? | Haan, lekin **samajh kar**: Judge0 apni alag VM par, **apna banaya compiler image** (naye Python/Java/Node/GCC/Go/Rust), hamare maujooda `CodeRunner` ke peeche ek adapter. gVisor runner fallback rahega. §5. |
| Main test kaise karunga? | **Staging**: `staging.<domain>` (Vercel) + staging DB (Supabase) + staging VM. Har PR ka Vercel preview bhi. Test script §8.4 me. |

---

## 1. Abhi kya bana hai (imaandari se)

F1 ki tracker rows (Plan 84–93):

| Row | Kya | Status | Kya baaki |
|---|---|---|---|
| 84 | 60 role templates | ✅ | — |
| 85 | Proctoring v2: identity photo + ID, webcam snapshots, tab/full screen/copy-paste ka record, screen share ki zid, doosri screen ka pata, awaaz ka signal, proxy pakadna | 🟡 | Asli browsers par jaanch, 10-proxy trial, 11 bhashaon me words. **Live video, recording, third eye, lockdown browser bilkul nahi** |
| 86 / 93 | AI interviewer (chat + code), email, retention | 🟡 | Awaaz, WhatsApp; asli model par eval (key ke baad) |
| 87 | AI-fluency IDE test (prompts ledger me) | 🟡 | AI use ki quality ka score (key ke baad) |
| 88 | Frontend, SQL, take-home sawaal | 🟡 | Frontend sawaal browser me tests ke saath; SQL author flow |
| 89 | Startup self-serve | ✅ | — |
| 90 | Candidate report v2 (page, PDF, share link) | ✅ | — |

Coding me pehle se: CodeMirror editor (Python, JS, C, C++, Java, SQL), LeetCode jaisa "function mode" (signature, sirf function likhna), sample par Run aur hidden par Submit, custom checker, judge queue (contest/practice lane), gVisor sandbox runner, plagiarism similarity. Bank me: MCQ, short, numeric, code, SQL; Word/Excel import; content packs (CS fundamentals, 40 DSA, SQL, 40 placement quiz MCQ).

Deploy: Supabase Mumbai project bana (migrations 0001–0058, sirf 0054/0055 aur 0059–0065 baaki); Vercel abhi juda nahi; VM abhi nahi; uploads abhi Postgres me hain.

**Matlab:** F1 ka 70% code hai, lekin owner ne jo maanga (company ID panel, library, live video, third eye, lockdown, Judge0) wo naya kaam hai, aur deploy abhi shuru hi nahi hua.

---

## 2. Architecture: kya kahan chalega

### 2.1 Tasveer

```
                 Candidate (laptop)        Candidate ka phone (third eye)      Company staff / proctor
                        │                            │                                │
                        ▼                            ▼                                ▼
   ┌──────────────── Vercel (static + CDN) ─────────────────────────────────────────────────┐
   │  app.<domain> (exam + practice)          console.<domain> (company dashboard)          │
   └───────────────┬────────────────────────────────────────────────────────────┬───────────┘
                   │ HTTPS (REST + SSE)                                         │
                   ▼                                                            │
   ┌──────── API VM, AWS Mumbai (Docker) ────────┐      ┌──── LiveKit (video SFU) ────┐
   │ Caddy (TLS) → API (Fastify)                 │◄────►│ camera / screen / phone      │
   │ workers: outbox, reminders, retention,      │token │ tracks; proctor wall;        │
   │          recording sweep                    │      │ Egress → recordings          │
   │ judge queue → Judge0 VM (private network)   │      └──────────────┬───────────────┘
   └───────┬────────────────────────┬────────────┘                     │ S3 API
           │ Postgres (pooler)      │ private IP                       ▼
           ▼                        ▼                      ┌──── Supabase Storage ────┐
   ┌── Supabase Mumbai ──┐   ┌── Judge0 VM (Mumbai) ──┐    │ photos, snapshots,       │
   │ Postgres 16, RLS,   │   │ apna compiler image,   │    │ recordings (private,     │
   │ PITR, backups       │   │ koi internet nahi,     │    │ signed URL se)           │
   └─────────────────────┘   │ koi secret nahi        │    └──────────────────────────┘
                             └────────────────────────┘
```

### 2.2 Supabase/Vercel par kya nahi chalta, aur kyun

| Cheez | Supabase/Vercel par kyun nahi |
|---|---|
| API (Fastify) | Live invigilation SSE stream, heartbeats aur lambi requests. Vercel Functions ki max duration Hobby par 300 s, Pro par 800 s (extended 1,800 s) hai, aur har request ek naya cold function: hamara in-memory judge queue, rate limit, SSE nahi chalega. Supabase Edge Functions Deno hain, Node/Fastify nahi. |
| Code runner / Judge0 | Privileged Docker + cgroups + gVisor chahiye. Kisi serverless platform par ye mumkin nahi; aur candidate ka code us machine par nahi chalna chahiye jahan DB ki chaabi ho. |
| Live video | WebRTC SFU ko UDP ports aur lambe connections chahiye. LiveKit Cloud (ya baad me apna LiveKit). |
| Workers (outbox, reminders) | Lagaatar chalne wala process. |

**Supabase par jo poora chalega:** Postgres (saara data, RLS), Storage (photos, ID, snapshots, recordings), backups/PITR, staging ke liye branch ya alag project. Supabase Auth, Realtime aur Data API **istemal nahi** honge: auth apna hai (staff, candidate link, TOTP, OIDC), live updates SSE se, aur Data API band rahega (SUPABASE.md ka niyam: koi Supabase key table nahi kholti).

### 2.3 Database connection ka zaroori detail

- API VM se Supabase tak **Supavisor pooler** (IPv4). Direct connection Supabase par IPv6 hota hai (IPv4 ke liye add-on lagta hai); pooler se ye jhanjhat nahi.
- **Transaction mode (port 6543)** chalega, kyunki hamari RLS settings `set_config(..., true)` se **transaction ke andar** lagti hain (`store/src/sql.ts`), session par nahi. Iska ek test banana hai: pooler ke peeche do alag organisations ki queries mix na hon (§8 ka gate).
- Migrations direct/session mode se (GitHub Actions → Migrate workflow, bana hua).

### 2.4 Scale: 1,000 candidates ek saath (pehla target)

| Load | Andaza | Kaun uthayega |
|---|---|---|
| Heartbeat + autosave | 1,000 × (1 per 30 s + 1 per 10 s) ≈ 130 req/s | 1 API VM (4 vCPU) aaram se; 2,000 contest ka load test pehle se ek 4-core par paas |
| DB connections | API pool 20–40, workers 5 | Pooler (Pro Small compute par ~200 pooled client connections; Medium par aur) |
| Code runs | 1,000 × ~15 run/submit × 3–10 tests, 90 min me; jhatke me ~30 programs/s | Judge0 VM 8 vCPU (~16 workers); 2 VM tak; p95 < 5 s ka load test |
| Photos/snapshots | 1,000 × 1 per 60 s × ~40 KB | Storage; DB me nahi (F0 ka kaam) |
| Live video | 1,000 × (camera + screen + phone) | LiveKit Cloud; har candidate ~0.5–0.8 Mbps upload |
| Proctor wall | 1 proctor : 25–50 candidates | LiveKit subscribe (sirf chhoti quality) |

5,000 ke liye: Supabase compute Medium/Large, API 2–3 VM (stateless, LB ke peeche), Judge0 3–4 VM, LiveKit Scale plan. Code me badlaav nahi; judge queue per-process hai, isliye har API VM apna hissa bhejega (pehle se aisa bana hai).

---

## 3. Har company ka ID aur dashboard

### 3.1 Jo hai

- Company = `organisation` (kind `company`, row 89). Har table par RLS `parikshaa.org_id` se: ek company doosri ka kuch nahi dekh sakti (tenancy tests pehle se).
- Company khud signup kare: email verify, starter sawaal, role chuno, test bhejo, shortlist (row 89). Credits Razorpay ya PO/NEFT se.
- Operator ke liye sirf CLI (`admin-cli.ts`): org + pehla owner, password env se.
- Staff roles: owner, author, invigilator, reviewer, viewer; TOTP, OIDC (Google/Microsoft) sign-in.

### 3.2 Kya banega (Plan row 101)

1. **Company ID**: har organisation ko ek chhota, padhne layak ID `PKC-7F3K2Q` (Crockford base32, galat padhne wale akshar nahi). Console ke upar dikhe, invoice aur support me yahi. URL slug alag rahega.
2. **Operator panel** (console me sirf Parikshaa staff ke liye; kaun operator hai wo server env ki ek list se, naya setting): companies ki list (ID, naam, plan, credits, pichhla test, candidates is mahine), **"New company"**: naam, owner ka email, plan/credits, notes → company ban jaati hai aur owner ko **invite email** jaata hai (link se password set + TOTP). CLI wala password env me dene ka jhanjhat khatam. Company ko **suspend/resume**, credits dena (audit ke saath).
3. **Company dashboard** (console, Hire path, pehle se hai) me jodna:
   - Team: maujooda roles (owner, author, invigilator, reviewer, viewer) ke naam company ki bhasha me (recruiter, proctor, hiring manager); hiring manager sirf apne tests ke results dekhe (naya scope); invite by email.
   - Company profile: logo, naam (candidate ke exam page aur email par), default proctoring level, recording ki retention (din).
   - Usage: credits, is mahine ke candidates, live minutes (video ka kharcha), recordings ka size.
4. **Tests**: operator hi company bana sake; invite link ek baar; suspend par sign-in aur naye invites band; ek company ka operator data doosri ko nahi; Company ID unique.

---

## 4. Parikshaa Library + apne sawaal

### 4.1 Design

- **Ek global library**, kisi company ki nahi: alag tables `library_questions` (versioned) aur `library_sets` (jaise "SDE-1 OA: 2 DSA + 15 CS MCQ"). RLS: sab staff padh sakein, sirf Parikshaa content team likhe.
- **"Add to my bank" = copy**, link ke saath (`source: library:<id>@v<version>`). Wajah: exam ek baar banne ke baad freeze hota hai (pehle se ka niyam), aur company apni copy badal sake. Library me sudhaar ho to bank me "naya version hai" ka sanket, zabardasti nahi.
- **Leak ka sach**: library ke sawaal kai companies use karengi, to bahar aa sakte hain. Isliye:
  - Do tier: **Open** (practice site par bhi, sasta/free) aur **Hire-only** (practice par kabhi nahi dikhte; har sawaal ki "exposure" ginti; 500 companies me dikhe to retire).
  - Coding sawaalon me **parameterised variants** (naam, numbers, story badle; tests reference program se) taaki har company ko alag shakal mile.
  - Console me saaf likha ho: "Library ke sawaal jaane-pehchane ho sakte hain; kam se kam ek apna sawaal jodiye."
- **Browse UI** (console, Bank → Library tab, pehle se ek library drawer exam editor me hai, usi ko bada karna): filter by type (MCQ, coding, SQL, frontend, written), topic (arrays, DP, OS, DBMS, CN, OOP, aptitude, reasoning, verbal…), difficulty, language, role; preview (candidate jaisa); "Add 10 random medium arrays" jaisa picker; role set ek click me poora section.

### 4.2 Sawaalon ki sankhya (go-live se pehle ka target)

| Type | Abhi (code me) | Go-live target | Kahan se |
|---|---|---|---|
| Aptitude (quant, reasoning, verbal) MCQ | ~0 (placement quiz 40 DSA MCQ hai) | 300 | Content team; AI draft (key ke baad) + insaan ki jaanch |
| CS fundamentals MCQ (OS, DBMS, CN, OOP) | cs-fundamentals pack | 300 | Maujooda pack + naye |
| Programming MCQ (output batao, Java/Python/C++/JS) | 0 | 150 | Naye; har ek ka output runner par chala kar pakka |
| DSA coding (easy/medium/hard) | 40 apne | 150 (50/70/30) | 40 apne + **purane app ke 1,260 problems (row 91)** me se review karke 110 |
| SQL | sql-starter pack | 40 | Maujooda + naye |
| Frontend (HTML/CSS/JS, tests ke saath) | 0 | 20 | Row 88 ke baad |
| SDE role sets | 60 role templates | 60 | Templates ko library sets se jodna |

Har coding sawaal ka niyam (pehle se CI me): reference program har test par asli runner par paas, hidden test kam se kam ek, editorial code bhi runner par. **Content likhna owner/content team ka kaam hai**: hum tooling, import aur jaanch banayenge; galat ya chori ka content nahi daalenge.

### 4.3 Apne sawaal

Pehle se: editor (MCQ, short, numeric, code, SQL), Word/Excel import, AI se JD → test (key ke baad asli). Naya: coding sawaal ka **"LeetCode-style author" wizard** (§5.4): signature, multiple languages ke starter, examples, constraints, reference solution se tests ka expected output apne aap, "sab tests reference par chalao" button.

---

## 5. Coding assessment: Judge0 ke saath, LeetCode jaisa

### 5.1 Judge0: research ka nichod

| | Tathya | Hamare liye matlab |
|---|---|---|
| Version | Judge0 CE ka aakhri release **v1.13.1 (18 Apr 2024)** | Project dheere chal raha hai; hum image khud banayenge aur sambhalenge |
| Suraksha | v1.13.1 se pehle **teen critical sandbox escape** (CVE-2024-28185, CVE-2024-28189 symlink se host par likhna; CVE-2024-29021 SSRF se root) | Sirf ≥ 1.13.1; alag VM; koi secret nahi; bahar ka network band; callbacks band; API token; sirf private IP |
| cgroups | Judge0 (isolate) **cgroup v1** maangta hai; Ubuntu 22.04+ par GRUB me `systemd.unified_cgroup_hierarchy=0` | Judge0 VM ka apna OS setting; hamare API VM par asar nahi |
| Docker | Privileged container, apna Redis + Postgres | Judge0 ka DB hamara Supabase **nahi**; usi VM par chhota Postgres/Redis (sirf queue, data temporary) |
| Licence | GPL-3.0 | Hum use network service ki tarah bina badle chalayenge, apne code se nahi jodenge; isliye hamara code GPL ke neeche nahi aata. Apna compiler image (Dockerfile) bhi GPL ke saath public rakhna theek. Lawyer se ek baar pakka (DPA wali list me) |
| Bhashayein | 60+ (CE), "Extra CE" alag; CE ke kai compiler purane versions ke hain | **Apna compiler image**: Python 3.12, Node 20 LTS, Java 21, GCC 13 (C/C++), Go, Rust, Kotlin, C#, TypeScript, SQLite. Staging par `/languages` se pakka |

**Faisla (sujhaav):** Judge0 **ek backend** ki tarah, maujooda `CodeRunner` interface (`packages/runner/src/client.ts`) ke peeche: `Judge0CodeRunner`. Test cases ka compare, checker, function mode ka result marker, verdict: **sab hamara rahega** (`runner/src/judge.ts`); Judge0 sirf "is program ko is stdin ke saath, in limits me chalao" karega. Isse:
- Exam, practice, contest, classes: kahin code nahi badalta; env `RUNNER_BACKEND=judge0|gvisor`.
- Judge0 down ho to gVisor runner par wapas (same API VM par ya alag).
- Dono backend par ek hi **parity suite**: 40 DSA reference programs + galat programs (eval wale) ke verdict dono par same (staging par roz raat; CI me Judge0 cgroup v1 ki wajah se nahi chalega).

### 5.2 Judge0 VM ka setup (Plan row 103)

- AWS Mumbai `c7i.xlarge` (4 vCPU) → pilot; load test ke baad 2× `c7i.2xlarge` tak. Ubuntu 22.04, cgroup v1 boot flag, Docker.
- `judge0.conf`: `ENABLE_NETWORK=false`, `ALLOW_ENABLE_NETWORK=false`, callbacks band (`ENABLE_CALLBACKS=false`), `AUTHN_TOKEN` (Secrets Manager se), `MAX_QUEUE_SIZE`, `CPU_TIME_LIMIT` hamare limits se, `ENABLE_BATCHED_SUBMISSIONS=true`, `ENABLE_WAIT_RESULT=false` (hum batch + poll karenge).
- Network: security group me sirf API VM se port 2358; bahar jaane ka koi rasta nahi (NAT nahi); metadata service band.
- Apna image: `deploy/judge0/compilers/Dockerfile` (Judge0 ke compilers repo ke pattern par) aur `languages.sql`; GitHub Actions me build → GHCR, version tag.
- Monitoring: queue length, p95 time, fail rate → Better Stack/Sentry; queue lambi ho to Plan row 50 (autoscale) ka pehla hissa.

### 5.3 Adapter ka kaam (Plan row 103)

- `Judge0CodeRunner.run(request)`: har test ke liye ek submission, **batch** me (`/submissions/batch?base64_encoded=true`), phir tokens poll (`/submissions/batch?tokens=…`), backoff ke saath; time/memory limits hamare `Limits` se; compile error ek baar dikhe.
- Language map naam se (startup par `/languages` padh kar), id hardcode nahi.
- Output limit, `stdout` trim, timeouts → hamare `TestStatus` (`time_limit`, `memory_limit`, `runtime_error`, `output_limit`).
- Custom checker (C++/Python) Judge0 me ek alag run; function mode me wrapper code hamara (pehle se), Judge0 ko poora program jaata hai.
- Tests: fake Judge0 HTTP server ke saath unit tests (batch, poll, har status, timeout, down hone par fallback); asli Judge0 ke saath parity suite staging par.

### 5.4 LeetCode jaisa candidate experience (Plan row 104)

| Feature | Abhi | Banana |
|---|---|---|
| Split view: statement (examples, constraints) + editor + console | ✅ | — |
| Function signature mode | ✅ | Har sawaal ke **kai bhashaon** ke starter (Python, Java, C++, JS + Go, Kotlin, C#) |
| Run (sample) / Submit (hidden) | ✅ | **Custom input** box; har test ka **runtime aur memory**; hidden test ka sirf pass/fail |
| Bhashayein | 6 | 10+ (Judge0 image se) + editor highlighting |
| Editor | CodeMirror | Autocomplete, bracket, format, font size, vim/emacs keys (optional), reset to starter |
| Attempt ke andar submissions ki history | aadha | Har submit ka verdict list, purana code dekhna |
| Integrity | paste, tab, similarity | **Code playback** (keystroke timeline, reviewer chala kar dekhe), bade paste ka flag, AI-generated jaisa sanket (sirf sanket) |
| Partial marks | test weights | Test groups (subtask) jaise |
| Author wizard | editor | §4.3: signature → starters apne aap, reference se expected output, "sab tests chalao" |
| Report | ✅ (row 90) | Runtime/memory, playback link |

### 5.5 Done kab

Staging par 1,000 simulated candidates ka coding test: p95 verdict < 5 s, 0 galat verdict parity suite me, Judge0 VM band karne par gVisor par apne aap chalna, 10 bhashaon me har ek ka hello + function test.

---

## 6. Proctoring v3

Har exam me author ek **level** chune (company ka default ho sakta hai). Har signal sirf **sanket** hai: faisla insaan karta hai (pehle se ka niyam, `proctoring.ts`).

| Level | Kya | Abhi |
|---|---|---|
| 0 Basic | Tab, copy/paste, full screen chhodna ka record | ✅ |
| 1 Secure | + identity photo + ID, webcam snapshots, screen share ki zid, doosri screen, awaaz ka signal | ✅ (row 85) |
| 2 Strict | + **full screen ki zid** (bahar gaye to sawaal chhupe), **chehra jaanch browser me** (koi nahi / do chehre / door dekhna) | ⬜ row 105 |
| 3 Live | + **live video** (camera + screen) proctor wall par, **recording**, proctor ka candidate se chat/warning | ⬜ row 106 |
| 4 Live + third eye | + **phone se doosra camera** (side view: screen, haath, desk) | ⬜ row 107 |
| 5 Lockdown | + **Safe Exam Browser** zaroori (doosre apps, screen capture, VM band) | ⬜ row 108 |

### 6.1 Full screen ki zid + chehra jaanch (row 105)

- Exam full screen me hi khule (pehle se coding rail me auto full screen hai); bahar nikalte hi sawaal **blur + overlay** "Full screen me wapas aaiye" (button), ghatna ledger me, ginti dikhe. Author chahe to "N baar ke baad attempt band" (default band nahi: galti se ESC dabna aam hai).
- Chehra jaanch **browser ke andar**, model ka kharcha nahi: MediaPipe Face Detector (WASM, lazy chunk, sirf Strict+ par load). Har 2–3 s ek frame: `no_face` (10 s se zyada), `many_faces`, `face_turned` sanket. Frame kahin nahi jaata, sirf ghatna.
- Phone/kitaab pakadna (object detection) **baad me**: galat sanket zyada aate hain.
- Tests: overlay, ginti, band karne ka niyam; detector ko nakli frames se (unit), asli browser par Chromium/Firefox/Safari.

### 6.2 Live video + recording (row 106)

**Provider:** LiveKit (server, Egress aur SDK sab Apache 2.0). Pehle **LiveKit Cloud**, 1,000+ ek saath hone par apne VM par self-host (code wahi). Provider ek interface (`LiveVideo`) ke peeche, taaki 100ms (Bharat ki company) ya Cloudflare Realtime par jaana ho to sirf adapter badle.

- **Room**: har exam ka ek room (bade exam me 200 candidates ke group). Token hamari API banati hai (LiveKit key sirf API VM par):
  - Candidate token: sirf **publish** (camera 320×240 @ 15 fps simulcast, screen 1–2 fps 720p, mic optional), subscribe nahi.
  - Phone token: sirf publish, identity `<attempt>:phone`.
  - Proctor token: sirf **subscribe**, sirf apne exam ke rooms; sirf invigilator/owner role wale staff.
- **Proctor wall** (console Live page me naya tab): 16/25 ka grid, sirf chhoti quality; click par bada + screen + phone; sanket wale (no face, tab chhoda) upar; "warning bhejo" (candidate ki screen par message, pehle se announcement ka rasta), "flag" (timestamp ke saath ledger me), "attempt rok do" (pehle se invigilation me).
- **Recording**: LiveKit **Egress** har candidate ke track ko **Supabase Storage (S3 compatible)** me, private bucket, org/exam/attempt ke path par. Report v2 me timeline par har sanket ke paas "video dekho (±30 s)" (signed URL, 10 min). Retention: company ki setting (default **30 din**), phir sweep delete (pehle se retention sweep me jodna). Har dekhna audit me.
- **Kharab net**: upload 300 kbps se kam ho to apne aap **snapshot mode** (pehle wala), ghatna ledger me; candidate ko pehle system check me bandwidth test.
- **Privacy / DPDP**: Live level par candidate ko pehle saaf notice + sahmati (kya record hoga, kitne din, kaun dekhega); bina sahmati exam nahi. Ye **pehle ke faisle se alag** hai ("screen kabhi capture nahi hoti"): isliye "Faisle" me entry, aur Basic/Secure par ab bhi kuch record nahi.
- Tests: token ke adhikaar (candidate subscribe nahi kar sakta, proctor doosre exam ka nahi), recording ka path aur retention delete, report me link, kharab net par snapshot mode; asli LiveKit ke saath staging par 50 nakli candidates (headless browsers) ka load.

### 6.3 Third eye: phone se doosra camera (row 107)

Flow (koi app install nahi, sirf browser):

1. System check me "Phone camera" step: laptop par **QR** (aur chhota code), signed, 5 min me expire, **ek baar**, sirf isi attempt ka (ReportLinks jaisa HMAC code).
2. Phone par `app.<domain>/eye/<code>`: piche ka camera (`facingMode: environment`), **Wake Lock** (screen band na ho), battery aur net check.
3. Lagane ki guide: phone ko 1–1.5 m door, 45° side se, landscape; **dikhna chahiye: candidate ka side, laptop ki screen, keyboard aur haath**. Laptop par phone ka live preview, "theek hai" tabhi aage.
4. Kamra dikhana: phone se 360° ghuma kar 10 s ka clip (room scan), report me.
5. Exam ke dauraan: phone ka track LiveKit me (Live level) **ya** har 10–20 s ek photo Storage me (sasta "third eye lite", bina live video ke).
6. Phone ka connection toota: laptop par turant warning, 60 s me wapas na aaya to ghatna `third_eye_lost` (proctor ko upar dikhe); wapas aaya to `third_eye_back`.
7. iPhone Safari: tab background me jaate hi camera rukta hai, isliye guide me "phone ko chhoona nahi", aur rukne par ghatna.

Tests: QR code ek baar/expiry/doosre attempt par mana, phone page ka flow (Playwright mobile emulation), connection tootne ki ghatnaayein, lite mode ki photos; **asli Android aur iPhone par haath se jaanch** (owner ke phone par staging).

### 6.4 Lockdown: Safe Exam Browser (row 108)

**Kyun SEB, apna Electron app nahi (abhi):** SEB free aur open source hai, Windows/macOS/iPad par, aur universities me jaana-pehchana. Apna app banane me code signing (Windows EV cert + Apple developer, har saal), auto-update, antivirus false positive, aur roz ka rakh-rakhaav lagta hai. SEB se shuru; companies ki maang ho to apna "Parikshaa Secure" baad me (Faisle me).

- Exam setting "Safe Exam Browser zaroori". Hum har exam ki **`.seb` config file** banayein: start URL (candidate ka link), quit link, URL filter (sirf hamare domains + LiveKit), screen capture/VM/remote desktop band, doosre apps band.
- **Server par jaanch**: SEB har request me `X-SafeExamBrowser-ConfigKeyHash` header bhejta hai = SHA256(poora URL + Config Key). Hamari API har exam request par ye jaanchegi (Config Key exam ke saath save). Kyunki hamara frontend aur API alag domain par hain, SEB ka **JavaScript API** (`SafeExamBrowser.security.configKey`, SEB 3.0 macOS/iOS, 3.4 Windows se) se page hash lekar API ko bhejega; dono raaste test.
- SEB nahi to: "Safe Exam Browser me kholiye" page + download link + `seb://` link.
- **Linux, Chromebook, Android par SEB nahi**: isliye ye level college lab ya company ke bulaaye exam ke liye; remote me Live + third eye kaafi.
- Tests: hash sahi/galat/missing par API ka jawab, config file ki settings, JS API wala rasta (nakli `SafeExamBrowser` object), asli SEB par Windows aur Mac par haath se.

### 6.5 Row 85 ka baaki

10 nakli proxy attempts ka trial (owner ke saath, staging par) → 9 pakde jaane chahiye (LAUNCH-PLAN F1 ka gate); naye words 11 bhashaon me; Chromium/Firefox/Safari/Edge par asli jaanch.

---

## 7. Row 86–88 ka baaki (F1 ko poora kehne ke liye)

| Row | Kya banega | Kya baad me (go-live ke baad) |
|---|---|---|
| 88 | **Frontend sawaal**: HTML/CSS/JS browser ke sandboxed iframe me, author ke tests (Playwright jaisa nahi, DOM tests JS me) runner/Judge0 par jsdom se; **SQL author flow** (schema + seed + expected query result) | Take-home ka GitHub auto-grade |
| 87 | AI-fluency: prompts ki quality ka rubric (fake model se tested) | Asli model par eval (key ke baad, F6) |
| 86 | Chat + code wala interviewer live ke liye kaafi | **Awaaz aur WhatsApp go-live ke baad** (sujhaav; Faisle me) |

---

## 8. Deploy: Supabase + Vercel + VM, aur staging jahan owner test kare

### 8.1 Environments

| | Staging (owner test) | Production |
|---|---|---|
| Frontend | Vercel: `staging.app.<domain>`, `staging.console.<domain>`; har PR ka preview | Vercel: `app.<domain>`, `console.<domain>` |
| DB | Supabase: alag chhota project `parikshaa-staging` (Mumbai) | `parikshaa-mumbai` (bana hua) |
| Storage | staging project ki buckets | prod buckets |
| API + workers | 1 VM `t3.large`/`m7i.large` (Docker compose) | 1 VM `m7i.xlarge` (baad me 2 + LB) |
| Judge0 | wahi VM ya chhoti `c7i.large` | `c7i.xlarge` (load test ke hisaab se) |
| Video | LiveKit Cloud free (Build) project | LiveKit Cloud Ship |

### 8.2 Kaam (Plan row 100, G0)

1. **Uploads Storage me**: photos, ID, snapshots, scans DB se Supabase Storage (private buckets, signed URL), purane rows ka migration script; `MediaStore` interface (Postgres wala tests ke liye rahe).
2. **Docker image + compose** (`deploy/vm/compose.yml`): Caddy, API, worker; env `/etc/parikshaa.env` (secrets sirf VM aur AWS Secrets Manager me; repo/Terraform state me kabhi nahi).
3. **GitHub Actions `deploy.yml`**: main par image build → GHCR → staging VM par SSM se pull + restart → `npm run smoke`; production "workflow_dispatch" + manzoori (environment protection) + rollback (pichhla tag).
4. **Vercel**: do projects (web, console) GitHub se; `VITE_API_URL` env; preview har PR; production branch `main`.
5. **CORS + cookies**: API ka domain `api.<domain>`; frontend domains ki allow list.
6. **Monitoring**: Sentry (web, console, API), uptime (Better Stack/UptimeRobot) on `/health`, Supabase advisors CI me.
7. **Pooler test** (§2.3) aur Data API band ka test.

### 8.3 Owner se kya chahiye (inke bina deploy nahi)

| # | Kya | Kyun |
|---|---|---|
| 1 | Domain (jaise `parikshaa.in`) aur DNS ka access | HTTPS, email, Vercel |
| 2 | Supabase **Pro** (org par) + staging project ki haan | Backups, PITR, compute; free plan pause hota hai |
| 3 | Vercel Pro team (ya Hobby se shuru) | Commercial use ke liye Pro |
| 4 | AWS account (Mumbai), billing alarm | API VM + Judge0 VM |
| 5 | LiveKit Cloud account (key VM ke env me khud daalein, chat me nahi) | Live video |
| 6 | Email provider (SES/Resend) + sender domain | Invites, results, OTP |
| 7 | Purani keys rotate (sb_secret, jo chat me aayi thi) + GitHub secrets theek | Suraksha |
| 8 | Prices (per candidate, live proctoring ka extra) | Self-serve kharid |
| 9 | Recording ki retention aur privacy notice ki haan (lawyer) | DPDP |

### 8.4 Owner staging par kya test karega (script)

1. Operator panel se company "Test Co" banao → owner email par invite → password + TOTP.
2. Library se "SDE-1 OA" set jodo + ek apna MCQ + ek apna coding sawaal (wizard se).
3. Exam: Live + third eye, 60 min. Apne aap ko invite karo.
4. Laptop par: system check, ID photo, phone QR scan, room scan, full screen, test do; beech me tab badlo, ESC dabao, phone hatao.
5. Doosre laptop par proctor wall: video dikhe, warning bhejo, flag karo.
6. Submit → report v2: score, code playback, sanket timeline, video clips.
7. Hiring manager ko share link.

### 8.5 Kharcha (mahina, andaza; $1 = ₹84; providers ke quote se pakka)

Maan lo pehle 3 mahine: ~2,000 candidates/mahina, aadhe Live level par, 60 min test.

| Cheez | Staging | Production |
|---|---|---|
| Supabase Pro + compute (Small staging, Medium prod) | $25 + ~$15 | $25 + ~$60 |
| Supabase Storage (recordings ~150 MB/candidate Live par, 30 din) | ~$0 | ~150 GB → ~$3 + egress ~$10 |
| Vercel Pro | $20 (ek seat) | (wahi team) |
| API VM | t3.large ~$65 | m7i.xlarge ~$146 |
| Judge0 VM | (API VM par) | c7i.xlarge ~$130 |
| LiveKit Cloud | Build (free) | Ship $50 + extra minutes (1,000 Live × ~120–180 participant-min ≈ 150k min → ~$50–80) + recording egress (alag, quote se) |
| Sentry, uptime | free | ~$26 |
| **Kul (model ke bina)** | **~$125 (≈ ₹10,500)** | **~$500–550 (≈ ₹42,000–46,000)** |

Anthropic (AI interviewer, JD se test) alag: `npm run cost-run` se.

---

## 9. Phases, kram aur "done"

| Phase | Plan row | Kya | Done kab | Owner se |
|---|---|---|---|---|
| **G0 Neev + staging** | 100 | §8.2: Storage, Docker, deploy workflow, Vercel, staging live, pooler aur Data API test | Staging URL par login + ek exam + smoke green; PR preview chal raha | §8.3 ke 1–4, 6, 7 |
| **G1 Company ID + operator panel** | 101 | §3.2 | Operator se company bane, owner invite se aaye, suspend kaam kare; tests + screenshots | — |
| **G2 Parikshaa Library** | 102 | §4.1 tables, browse, add-to-bank, sets, exposure, author wizard ka pehla hissa; content import tooling (purane 1,260 problems ka review queue, row 91) | 300+ sawaal library me (jo maujood packs se ban sakein), baaki content team | Content ki haan, row 91 ka data |
| **G3 Judge0** | 103 | §5.2, §5.3 | Parity suite 0 farq; fallback; staging par 1,000 ka load p95 < 5 s | AWS |
| **G4 LeetCode jaisa IDE** | 104 | §5.4 | Har feature ka test; screenshots | — |
| **G5 Strict proctoring** | 105 | §6.1 | Tests + 4 browsers par jaanch | — |
| **G6 Live video + recording** | 106 | §6.2 | 50 headless candidates staging par; recording delete sweep; report clips | LiveKit account, retention ki haan |
| **G7 Third eye** | 107 | §6.3 | Android + iPhone par owner ki jaanch | Owner ke do phone |
| **G8 SEB lockdown** | 108 | §6.4 | Windows + Mac par asli SEB | Ek Windows aur ek Mac |
| **G9 F1 baaki + rehearsal + live** | 109 | §6.5, §7; 1,000 ka exam load test; 10-proxy trial; security review (OWASP ASVS L2 checklist, token ke adhikaar, Judge0 escape tests); runbook; production deploy | 9/10 proxy pakde; readiness checklist green; 3–5 pehli companies ka asli test bina incident | Prices, pehli companies, lawyer |

**Kram ki wajah:** G0 pehle, kyunki owner bina staging ke kuch test nahi kar sakta, aur Storage ke bina video/recording ka koi matlab nahi. G1–G2 company ko "apna dashboard + sawaal" dete hain (sabse pehle dikhne wala). G3–G4 coding ka bharosa. G5–G8 proctoring ek-ek level. G9 live.

Har phase alag PR, apne tests ke saath (`npm run check`, web/console par `build:clients` + `budget` + `lint:css`, API par `openapi`), tracker update, screenshots PR par.

---

## 10. Khatre aur imaandari

| Khatra | Kya karenge |
|---|---|
| Judge0 ka maintenance dheema, purane CVE | Apna image, sirf ≥ 1.13.1, alag VM, koi secret/network nahi, escape tests (symlink, `/proc`, network) rehearsal me; gVisor fallback |
| Live video ka kharcha bhaage | Level paid add-on; chhoti quality; recording ki retention; usage dashboard; self-host ka rasta khula |
| Galat sanket se candidate ke saath anyay | Har sanket sirf "dekho"; faisla insaan; candidate ko recheck (pehle se) |
| Privacy (DPDP 2023) | Sahmati, kam se kam data, retention, audit, DPA me LiveKit/Supabase/AWS sub-processor, data Mumbai me (LiveKit Cloud region ka chunav pakka karna hai: India region na mile to recording seedha hamare Storage me, aur ye DPA me likhna) |
| SEB har device par nahi | Level 5 sirf lab/on-site; remote ke liye Live + third eye |
| Library ke sawaal leak | Hire-only tier, exposure ginti, variants, "apna sawaal jodo" ka sanket |
| Content ki kami | Tooling hum banayenge; sawaal likhna/review content team; AI draft key ke baad, insaan ki manzoori ke saath |
| Pooler ke peeche RLS | Transaction-local settings (pehle se) + mix na hone ka test |

---

## 11. Owner ke faisle (haan/na chahiye)

1. Ye kram (G0 → G9) theek hai? (Sujhaav: haan)
2. Video provider: **LiveKit Cloud** pehle (sujhaav) ya 100ms?
3. Lockdown: **SEB pehle**, apna Electron app baad me (sujhaav)?
4. Recording retention default **30 din** (sujhaav)?
5. AI interviewer ki awaaz aur WhatsApp **go-live ke baad** (sujhaav)?
6. Library ka **Hire-only tier** practice site par kabhi nahi dikhega (sujhaav: haan)?
7. §8.3 ki list: domain, Supabase Pro, Vercel, AWS, LiveKit, email, key rotation.

---

## Sources (research, 3 Oct 2026)

- Judge0 releases (v1.13.1, Apr 2024): https://github.com/judge0/api/releases ; cgroup v1 / GRUB setting: https://www.hostinger.com/applications/judge0-ce ; licence aur flavours: https://ce.judge0.com/ , https://github.com/judge0/api
- Judge0 sandbox escape CVEs: https://thehackernews.com/2024/04/sandbox-escape-vulnerabilities-in.html , https://www.securityweek.com/critical-vulnerabilities-in-judge0-lead-to-sandbox-escape-host-takeover/
- Supabase pricing, compute, pooler: https://supabase.com/pricing , https://makerkit.dev/blog/saas/supabase-pricing ; Realtime limits: https://supabase.com/docs/guides/realtime/limits
- Vercel function limits: https://vercel.com/docs/functions/limitations
- LiveKit pricing aur licence: https://livekit.com/pricing.md , https://docs.livekit.io/cloud , https://trtc.io/blog/details/livekit-pricing-2026
- Safe Exam Browser Config Key: https://www.safeexambrowser.org/developer/seb-config-key.html , https://safeexambrowser.org/download_en.html
- Doosra camera (phone, QR): https://support.inspera.com/hc/en-us/articles/21452769106973-FAQs-for-candidates-taking-a-proctored-test , https://certification.talview.com/support/solutions/articles/11000123155-how-can-candidates-connect-the-secondary-camera-to-online-proctoring-sessions- , https://support.kryterion.com/en_us/online-proctored-dual-camera-requirement-rJJnB8Jo1l.md
