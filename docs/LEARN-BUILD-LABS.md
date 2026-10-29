# Build Labs: bana kar seekho, live environment me (plan, 18 Oct 2026)

**Owner ne kya maanga (18 Oct 2026):** students har technology **bana kar** seekhein: projects jo ship hon, aur
specialisation tracks (AI/ML, data, cloud, security). Har learner ka apna **live environment** ho, aur har kadam ki
progress apne aap track ho, taaki seekhna hands-on ho. Ye plan [LEARN-TUF-GAP.md](LEARN-TUF-GAP.md) ke F8/F9
(L19) ka poora roop hai. Abhi sirf plan hai, build Hire ke baad ya owner jab kahe. Tracker me plan row 122.

## 1. Bazaar me ye kaise hota hai (research)

| Kaun | Kaise | Hamare liye seekh |
|---|---|---|
| CodeCrafters | "Build your own Redis/Git…": kai stages, learner apne repo me code `git push` karta hai, tests chalte hain aur nateeja terminal me ([challenge](https://codecrafters.io/challenges/redis), [TechCrunch](https://techcrunch.com/2024/11/19/codecrafters-wants-to-challenge-seasoned-developers-with-hard-to-build-projects)) | Stage + hidden tests ka model; hamara runner ye pehle se kar sakta hai |
| Instruqt | Har task ki "check" script (Bash/Python, environment ke andar) "Check" button par chalti hai; "solve" script "Solve for me" par ([docs](https://docs.labs.instruqt.com/development/tasks/)) | Har step ki check + solve script ka format |
| KodeKloud | Labs submit karne par andar ki scripts apne aap jaanchti hain ([forum](https://kodekloud.com/community/t/evaluate-task-in/492559)) | Same; tareeka gupt hai |
| TryHackMe | Lab machines ek private network par, sirf VPN ya browser wali AttackBox se; free me AttackBox din me ~1 ghanta ([help](https://help.tryhackme.com/en/articles/8991552-networks-explained-vpn-attackbox-and-security-tips)) | Security labs internet se kate hon; free me time ki seema |
| JupyterLite / Pyodide | Python browser me (WebAssembly); sirf static files, server nahi ([devclass](https://devclass.com/2021/07/14/jupyterlite-honey-i-shrunk-the-jupyterlab-environment-into-a-browser), [DuckDB](https://duckdb.org/2024/10/02/pyodide)) | Data/ML basics bina server kharch ke |
| WebContainers (StackBlitz) | Node browser me; **for-profit production ke liye license chahiye**, daam sales se ([webcontainers.io](https://webcontainers.io/enterprise)) | License ke bina nahi; pehle E2 (neeche) se |
| E2B / Vercel Sandbox / Fly Sprites | Firecracker microVM, chhota 2 vCPU env lagbhag $0.10–0.17 ghanta; idle bhi bill hota hai (E2B), pause/resume ([techplained](https://www.techplained.com/best-ai-agent-sandboxes), [morphllm](https://www.morphllm.com/e2b-pricing), [rywalker](https://rywalker.com/research/vercel-sandbox)) | Live lab ka engine kiraye par; idle kharch sabse bada khatra |
| LocalStack | AWS emulator; **March 2026 se free sirf non-commercial**, commercial ~$39+/mahina ([release](https://blog.localstack.cloud/localstack-for-aws-release-2026-03-0/), [InfoQ](https://www.infoq.com/news/2026/02/localstack-aws-community)) | Cloud labs is par nirbhar nahi; open tools (neeche) |

Saboot zyaadatar docs aur blogs se hain; daam aur limits badalte rehte hain, kharidne se pehle vendor se pakka karo.

## 2. Seekhne ka dhaancha

```
Track (jaise "Cloud / DevOps")
 └─ Project (jaise "Apna app Docker me deploy karo")
     └─ Milestone (jaise "Dockerfile", "Compose", "Nginx", "CI")
         └─ Step: lakshya → padho (2–5 min) → karo (env me) → Check → "samjhao" sawaal
```

Har **step** me:
- **Lakshya** ek line me, aur kya seekhoge.
- **Thoda padhna** (apna likha), diagram, kabhi dry-run player.
- **Kaam** environment me: code, command, config.
- **Check** (button): environment ki asli haalat jaanchta hai (file, port par service, test pass, config sahi), sirf text
  nahi. Fail par saaf wajah ("port 8080 par kuch nahi sun raha").
- **Hint ladder**: Sahayak (nudge → kya dekho → lagbhag hal). **"Mere liye kar do"**: solve script, par step "madad se"
  gina jaata hai, Pramaan me nahi.
- **"Samjhao" sawaal** (micro-viva): 1–2 chhote sawaal, mastery model me jaata hai.
- Label: **AI-allowed** ya **AI-free**.

**Project** ke aakhir me: hidden tests bahar se (§4c), chhota viva ("ye design kyun?"), aur portfolio par entry.

## 3. Teen tarah ke environment (kharch ki seedhi)

| | E0 Browser | E1 Runner stages | E2 Live lab (microVM) | E3 Asli cloud (baad me) |
|---|---|---|---|---|
| Kya | Python (Pyodide/JupyterLite), SQL (SQLite/DuckDB WASM), HTML/CSS/JS preview | Multi-file project, har stage par hidden tests (CodeCrafters jaisa) | Poora Linux: terminal, editor, kai processes, ports preview, Docker/k3s, databases | Asli AWS/GCP account, budget ke saath |
| Server kharch | Lagbhag ₹0 (static files) | Hamara runner (gVisor), pehle se | ~$0.10–0.17/ghanta har learner | Har account ka bill |
| Kiske liye | Data basics, ML basics, frontend, SQL | Build-your-own (shell, HTTP server, KV store, interpreter…), backend logic | Full-stack, DevOps, cloud, security, data pipelines | Advanced, colleges, certification ki taiyaari |
| Phone par | Haan (chhota kaam) | Padhna, chhote stages | Computer chahiye | Computer |
| Neev hamare paas | PWA ✅ | Runner + gVisor ✅, Judge0 ✅, code playback ✅ | Naya (§4) | Naya |

**Niyam:** jo E0 ya E1 me ho sakta hai, wahi rahe. E2 tab, jab asli system (network, services, Docker) seekhna ho. E3
sirf zaroorat par.

## 4. Live lab (E2) ka dhaancha

### 4a. Hisse

1. **Lab images** (OCI), CI me bane, version + pin: `base-linux`, `python-data`, `node-web`, `java-spring`, `k8s-lab`
   (k3s), `sec-lab` (bina internet). Har image me ek chhota **lab agent** (checks chalaane ke liye).
2. **Orchestrator** (API me naya service): start, stop, pause/resume, quota, idle timeout, session ki seema, snapshot.
3. **Provider adapter**: ek interface, peeche E2B / Vercel Sandbox / Fly Sprites / baad me apna Firecracker (AWS par).
   Koi lock-in nahi (LEARN-TUF-GAP F7 jaisa).
4. **Browser me workspace**: editor (Monaco, jaisa code workspace me), terminal (xterm.js, WebSocket par), file tree,
   **port preview** (signed, kuch der ke liye URL, sirf usi learner ke liye).
5. **Workspace ka save**: snapshot/tarball object storage me (Supabase Storage/S3, G0 jaisa), "jahan chhoda wahi se".
6. **Event log**: har check, hint, solve, idle, snapshot ka record (§5).

### 4b. Suraksha

- MicroVM ki deewar (har learner ka apna kernel); hamare secrets kabhi env me nahi.
- **Internet**: allowlist proxy se (PyPI, npm, Maven ke mirror/cache); security labs me **bilkul nahi**, sirf apna lab
  network (TryHackMe jaisa).
- CPU/memory ki seema; lagatar 100% CPU + anjaan binary (mining) par apne aap band; bahar scan/mail mana.
- Session ki seema, roz ka quota, abuse report; logs kitne din rakhne hain ye DPDP ke hisaab se.

### 4c. Grade ka bharosa

Learner apne env me kuch bhi badal sakta hai, isliye:
- **Abhyas ke checks** env ke andar (turant jawab).
- **Pramaan wale checks bahar**: workspace ka snapshot ek naye, saaf grader env (ya gVisor runner) me, wahan hidden
  tests; ya bahar se learner ki service ko port par test karna. Saath me playback aur viva.

### 4d. Kharch par lagaam

- 10 min idle → pause (snapshot); free me 2 ghante ka session, roz ka quota; Plus me zyaada.
- Chhote size (1–2 vCPU, 2–4 GB); "warm pool" sirf class ke samay.
- **Moti andaaza:** 1,000 active learner × roz 1 ghanta E2 × $0.10–0.17 ≈ $100–170 roz (₹8,500–14,500 lagbhag).
  Isliye pehle E0/E1, E2 Plus aur colleges ke liye. Colleges per lab-hour dein (Campus B2B).
- Metric: **har poore project ka kharch**.

## 5. Progress kaise track ho

**Events:** `lab_started`, `step_checked` (pass/fail + wajah), `hint_used` (rung), `solved_for_me`, `idle_paused`,
`resumed`, `milestone_done`, `project_done`, `viva_answered`, `pramaan_granted`.

**Learner ko:** project map (milestones %), "aage kya", skills map (LEARN-TUF-GAP F5 mastery), resume button, portfolio.
**Teacher/TPO ko (Campus):** class ka heatmap har step par, kaun kahan atka, similarity + playback (Classes me).
**Company ko (Hire, learner ki marzi se):** sirf Pramaan (kaun sa project, kaunse hidden tests pass, viva), code ka link.

**Playback:** editor ka (G4a-2 pehle se) aur terminal ka (asciinema jaisa), consent aur retention ke saath; review aur
integrity ke liye.

## 6. Tracks aur projects (pehla catalogue; har project apna likha)

| Track | Projects (aasaan → mushkil) | Env | Naukri |
|---|---|---|---|
| **Foundations** | Linux aur terminal; Git andar se; apna shell; HTTP server; key-value store (Redis jaisa); JSON parser; chhota interpreter; mini database; rate limiter; chat server | E1 (+E2 Linux) | Har role ki neev |
| **Web / full-stack** | Static site → REST API + Postgres + tests → login (auth) → file upload → realtime chat → CI ke saath deploy. Node, Python, Java (Spring) teeno | E0, E2 | Junior backend / full-stack |
| **Data** | SQL analytics; pandas se data saaf karna; dashboard; roz chalne wali ETL pipeline; data quality checks; chhota data warehouse | E0, E2 | Data analyst, data engineer (entry) |
| **AI / ML** | Classical ML pipeline (train, eval, overfit dekhna); neural net shuru se (apna likha); embeddings + search; RAG app hamare model gateway se (kharch ki seema); LLM app ke evals; model ko API ki tarah serve karna | E0 (CPU), E2; GPU baad me | ML engineer (entry), AI app developer |
| **Cloud / DevOps** | Docker; Compose; Nginx reverse proxy; CI pipeline; k3s par deploy; Helm; infra as code (OpenTofu, local providers, MinIO); monitoring (Prometheus/Grafana); "server gir gaya" drill | E2 (E3 baad me) | DevOps / cloud (entry) |
| **Security** | **Pehle: ethics aur kanoon** (sirf ijaazat wale system); Linux hardening; hamare apne jaan-boojh kar kamzor app par OWASP top 10; auth/crypto ki buniyaad; log analysis + incident response; secure code review; CTF | E2 (bina internet) | SOC analyst L1, AppSec (entry) |

Har track me 5–8 projects, har project me 3–6 milestones. Cloud labs LocalStack par nirbhar nahi (commercial use paid);
open alternatives (jaise MiniStack, Floci) use karne se pehle jaanch zaroori ([alternatives](https://byteiota.com/ministack-free-localstack-alternative-emerges/)).

## 7. Content kaise banega

- **Lab spec** (YAML/JSON, repo/DB me, version ke saath): steps, padhne ka text, check script, solve script, hints, image,
  timeouts, AI-allowed/free.
- **CI me pakka:** har lab ka reference solution saare checks pass kare, aur khaali env par check fail ho (check sach me
  kuch jaanchta hai). DSA editorials ke `editorial-check` jaisa.
- **AI draft → insaan review** (L2 pipeline). Text, projects aur checks apne; CodeCrafters/KodeKloud/TryHackMe ka kuch
  copy nahi.

## 8. Baaki Parikshaa se jod

- **Learn:** tracks, planner, Sahayak har step par (terminal output sirf learner ki marzi se), mastery model, Pramaan.
- **Campus (Classes):** teacher lab assign kare, lab record, attendance, TPO dashboard; college per lab-hour de.
- **Hire:** company ek lab ko assessment round bana sake (take-home ya timed, proctoring + playback ke saath); Pramaan
  wale projects candidate ki marzi se dikhen.
- **Portfolio:** project GitHub par export (learner ka apna account), demo kuch der ke liye live URL par.

## 9. Kram (phases)

| Phase | Kya | Done kab |
|---|---|---|
| **P0** (naya infra nahi) | E1: multi-file project editor + stage tests runner par; 3 build-your-own projects (shell, HTTP server, KV store). E0: Pyodide/JupyterLite + SQLite/DuckDB WASM me data ke 3 labs. Step/check/progress ka data model | 6 labs live, progress dashboard, CI me reference solutions pass |
| **P1** Live lab MVP | Ek provider (adapter ke peeche), terminal + editor + port preview + checks, idle pause, quota, snapshot. Do tracks: Linux/Docker aur Full-stack API | 50 learner, har poore project ka kharch naapa |
| **P2** Specialisations | Data, AI/ML (CPU), Cloud/DevOps (k3s, OpenTofu), Security (bina internet) | Har track ke pehle 3 projects |
| **P3** Campus + Hire | Classes me lab assign, TPO view; Hire me lab round; project Pramaan (bahar grading + viva) | Ek college, ek company pilot |
| **P4** Scale | Apna Firecracker fleet (AWS) jab sasta pade; GPU labs (AI) | Kharch/ghanta provider se kam |

## 10. Kya naapenge

Lab shuru → poora hone ki dar; pehli safalta tak ka samay; kis step par sabse zyaada hint (atakne ki jagah); har poore
project ka kharch; Pramaan dar; Campus me class completion; Hire me lab round se hire.

## 11. Khatre

| Khatra | Bachaav |
|---|---|
| Kharch bekaabu (idle env) | Idle pause, quota, E0/E1 pehle, per-project kharch ki report |
| Abuse (mining, attack) | Egress allowlist, CPU niyam, apne aap kill, security labs bina internet |
| Sandbox se bahar nikalna | MicroVM (apna kernel), koi secret nahi, provider ki suraksha updates |
| Content mehnga | Lab spec + CI + AI draft + review; pehle 6 labs se seekhna |
| Vendor ke daam/niyam badle | Provider adapter; apna Firecracker ka raasta |
| License (WebContainers, LocalStack) | Inke bina design; license sirf zaroorat par aur daam dekh kar |

## 12. Owner se kya chahiye

1. **Kram:** P0 kab (Hire ke baad, ya pehle chhota P0).
2. **Provider aur budget:** E2 ke liye kaunsa provider (pehle trial) aur mahine ka budget; free vs Plus quota.
3. **Pehle tracks:** mera sujhaav P1 me Linux/Docker + Full-stack API, phir Data aur AI/ML.
4. **Colleges ka daam:** per lab-hour ya per student.
