# Code Studio aur Practice Arenas: har technology ka "LeetCode", bana kar seekho (19 Oct 2026)

**Owner ne kya maanga:** React, Node, SQL, Python, AI/ML ke liye **VS Code jaisa IDE browser me**, jahan task diye
hon; learner **har step par code likhe, run kare, test kare, submit kare** (learning by doing). AI/ML, data science,
MERN, web development, Java, Python, Go, saari technologies, aur system design, LLD, HLD ke liye bhi **LeetCode jaisa
platform**.

Ye doc [../LEARN-BUILD-LABS.md](../LEARN-BUILD-LABS.md) (environments E0–E3, labs ka dhaancha) ka detail hai.
Content ki list: [CONTENT-CATALOG.md](CONTENT-CATALOG.md). Database, AI, judge: [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 0. Teen cheezein, ek hi engine

| Cheez | Kya | Misaal |
|---|---|---|
| **Code Studio** | Browser me VS Code jaisa IDE: files, tabs, terminal, preview, tests | Har jagah jahan code likhna ho |
| **Guided Labs** | Kadam-kadam kaam: har step par likho → run → test → submit, phir agla | "React me todo app, 12 step" |
| **Practice Arenas** | Har technology ka LeetCode: alag-alag problems, hidden tests, rating, contests | "Frontend: modal with focus trap banao" |

Teeno ek hi Studio aur ek hi **grader** system par chalte hain. Farak sirf itna hai ki task kaise diya gaya.

## 1. Code Studio (VS Code jaisa, browser me)

### 1a. Layout

```
Desktop
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Lab: React Todo · Step 3/12 "Item delete karo"     ▶ Run   ✓ Test   ⬆ Submit   ✨ Sahayak  ⚙ │
├──┬───────────────────────┬───────────────────────────────────────┬────────────────────────┤
│📄│ TASK (step 3)          │ App.jsx  TodoItem.jsx ×  styles.css   │ PREVIEW  ⟳  ↗          │
│🔍│ Lakshya: …             │  1 import { useState } from 'react'   │ ┌────────────────────┐ │
│✓ │ Kya karna hai:          │  2 …                                  │ │  My todos          │ │
│⎇ │ 1. … 2. …              │                                       │ │  [ ] Milk  🗑       │ │
│✨│ Checks: ○ ○ ○          │                                       │ └────────────────────┘ │
│  │ 💡 Hint 1 · 2 · 3       │                                       │ CONSOLE · NETWORK      │
├──┴───────────────────────┴───────────────────────────────────────┴────────────────────────┤
│ TERMINAL │ PROBLEMS (2) │ TESTS  ✓ 4  ✗ 1  "delete button removes item: expected 1, got 2"   │
└───────────────────────────────────────────────────────────────────────────────────────────┘
Activity bar (baayein): Files · Search · Tests · Checkpoints (git jaisa) · Sahayak
Phone: Task padho + chhote edit; "Laptop par jaari rakho" (link/QR); data notebooks tablet par chalti hain
```

### 1b. Features (har ek zaroori)

| Hissa | Kya | Kaise (tech) |
|---|---|---|
| Editor | Syntax, autocomplete, multi-cursor, find/replace, fold, bracket match, VS Code keybindings | **CodeMirror 6** ✅ (phone par chalta, halka). Monaco nahi (touch par kamzor, 2–5 MB) |
| IntelliSense | JS/TS ke type hints, errors | TypeScript language service web worker me |
| Python hints | Completion, errors | Jedi (Pyodide me) ya ruff-wasm lint |
| Format/lint | Save par Prettier; ESLint (JS), ruff (Python) | Worker me; "Problems" panel |
| Files | Tree, naya/rename/delete, upload (chhoti files), tabs, split view | Virtual FS (IndexedDB) + server sync |
| Terminal | Commands, output, `npm test` jaisa | xterm.js (MIT); E0 me chhota built-in shell, E2 me asli shell (WebSocket) |
| Preview | Web app live, hot reload; console aur network panel | Alag origin wala sandboxed iframe (§6) |
| Notebook | Data/ML ke liye cells, output, charts | Pyodide (E0), JupyterLite jaisa UI Studio me |
| Tests panel | Har test: ✓/✗, diff (expected vs aapka), log; "sirf ye test chalao" | Grader ka nateeja (§4) |
| Checkpoints | Har step ke shuru ka snapshot; "step reset", "starter se diff", "pichla checkpoint" | S3 snapshot + local |
| Command palette | Ctrl+Shift+P: run, test, format, theme, font | |
| Sahayak | Code select → "samjhao", error → "kyun", hint ladder; solution tabhi jab owner ka niyam kahe | Sahayak gateway ✅ |
| Export | GitHub par push (OAuth), zip download | Portfolio ke liye |
| Autosave | Har 2 s local, har 10 s server | Network jaane par bhi kaam |
| Accessibility | Keyboard se sab, screen reader mode, bada font, high contrast | CodeMirror ka a11y |
| Theme | Light/dark, font size, Hinglish UI | Tokens ✅ |

### 1c. Run, Test, Submit ka farak

| Button | Kahan chalta | Kya | Kitni der |
|---|---|---|---|
| **▶ Run** | Jahan environment hai (browser ya env) | Program chalao, preview/output dekho | Turant (E0) |
| **✓ Test** | Browser me jahan ho sake, warna runner | **Visible** checks, jaldi feedback | 1–5 s |
| **⬆ Submit** | **Hamesha server** (runner/grader) | Visible + **hidden** checks; yahi gina jaata hai | 3–20 s |

Browser ke nateeje par bharosa nahi: asli grade hamesha server deta hai (koi browser me code badal kar pass na kar sake).

## 2. Environments (kaunsi technology kahan chalegi)

E0–E3 ki detail [../LEARN-BUILD-LABS.md](../LEARN-BUILD-LABS.md) §3 me. Technology ke hisaab se:

| Technology | Run (learner) | Grade (Submit) | Tier | Kharch |
|---|---|---|---|---|
| HTML/CSS/JS, React, TypeScript | Browser me bundle (**esbuild-wasm**, MIT) + import map se apne npm mirror ke packages → preview iframe | Runner: Vitest + Testing Library (jsdom) + **Playwright** (asli browser, clicks, keyboard, axe a11y, screenshot) | E0 + E1 | ~₹0 + ~₹0.02/submit |
| JavaScript core (polyfills, utilities) | Browser (worker) | Runner: Node + Vitest | E0 + E1 | ~₹0 |
| Node/Express APIs | Chhote: runner job (server shuru → HTTP tests); bade projects: microVM + terminal | Runner: learner ka server gVisor me, sirf loopback network, supertest jaise HTTP tests, DB ki haalat | E1 / E2 | ₹0.02/submit; E2 ghante ke hisaab se |
| MongoDB (MERN) | **FerretDB** (Apache-2.0, MongoDB jaisa protocol, Postgres par) | Same | E1 / E2 | MongoDB server khud chala kar "as a service" dene me SSPL licence ka jokhim; FerretDB se bachaav |
| SQL | Browser: SQLite (sql.js, MIT) + **Postgres (PGlite)** ✅ turant | Runner: same engine, kai hidden datasets | E0 + E1 | ~₹0 |
| MySQL dialect | Runner (MariaDB container) | Runner | E1 | Kam |
| Python (core) | Browser (Pyodide) ya runner ✅ | Runner: pytest | E0 + E1 | ~₹0 |
| Data science (numpy, pandas, matplotlib, scikit-learn) | **Pyodide notebook browser me** | Runner (CPython, same versions): hidden asserts, DataFrame match (tolerance ke saath), chart ki spec | E0 + E1 | ~₹0 |
| Machine learning (model train) | Chhota data browser me; bada: runner CPU job (60–120 s, 2 vCPU, 4 GB) | Hidden test set par metric (accuracy/F1/RMSE) threshold | E0 / E1 | ₹0.05–0.3/submit |
| Deep learning | "Scratch se" numpy (backprop, attention) browser me; PyTorch CPU runner par | Unit tests + chhote model ka metric | E0 / E1 | Kam; GPU sirf paid advanced labs (quota) |
| GenAI / LLM apps (RAG, agents) | Runner/microVM + **hamara mock LLM** (tay jawab) | Behaviour tests mock ke saath; asli LLM optional, Sahayak gateway se, seemit | E1 / E2 | Mock ₹0 |
| Java core | Runner ✅ | JUnit | E1 | ~₹0.01 |
| Spring Boot | microVM (JDK 21, Maven ka offline mirror) ya runner batch (dependency cache ke saath) | JUnit + HTTP tests | E1 / E2 | Kam |
| Go | Runner (`go test -race`), module mirror | go test | E1 | ~₹0.01 |
| C/C++ | Runner ✅ | Tests | E1 | ~₹0.005 |
| Linux, Git, Docker, Kubernetes, Nginx, CI | **microVM** (Firecracker), asli shell; k3s | Check scripts (Instruqt jaisa: env ki asli haalat) | E2 | $0.10–0.17/ghanta |
| Cloud (AWS jaisa) | Open tools (MinIO, Terraform local providers) microVM me | Check scripts | E2 → E3 baad me | |
| System design (HLD) | Browser: design canvas + simulator (Web Worker) | Simulator ka score + AI rubric (§3.12) | E0 | AI review ka chhota kharch |
| LLD | Runner (Java/Python/C++/TS) | Hidden unit tests + "change request" step + code metrics + AI review | E1 | ~₹0.01 |

**Package mirrors (sab apne, network bandh environments ke liye):** npm (Verdaccio, MIT), PyPI (local index),
Maven (Reposilite, Apache-2.0), Go (Athens, MIT). Sirf allowlist wale packages; tez install, aur bahar se malware nahi.

## 3. Practice Arenas: har technology ka LeetCode

Har arena ka problem page DSA jaisa: statement · Studio · tests · editorial (owner ki kitaab wali soch, us domain ke
hisaab se) · discussion · solutions (AC ke baad) · difficulty · tags · leaderboard · weekly contest.

### 3.1 JavaScript (300 problems + 300 output-predict)

- **Problems:** `debounce`, `throttle`, `curry`, `deepClone` (cycles ke saath), `deepEqual`, `Promise.all/allSettled/any/race`
  polyfill, async pool (concurrency limit), retry with backoff, `EventEmitter`, LRU, memoize, `flatten`, `groupBy`,
  JSON stringify (simplified), `bind/call/apply` polyfill, `Array.prototype.reduce/map` polyfill, cancelable fetch,
  observable-lite, template engine, router-lite, virtual DOM diff-lite.
- **Output predict:** event loop (microtask/macrotask), closures, `this`, hoisting, coercion, prototypes.
- **Grade:** Node runner, Vitest, fake timers (debounce/throttle), edge tests (cycle, `undefined`, `NaN`, symbol keys).

### 3.2 Frontend / React (250)

- **UI components:** accordion, tabs (keyboard), modal (focus trap, Esc, scroll lock), dropdown/autocomplete (debounced
  fetch mock API se, race-condition handling), infinite scroll, data table (sort/filter/paginate), form (validation,
  errors, submit states), star rating, carousel, file uploader (progress), toast system, kanban (drag-drop), nested
  comments, image gallery (lazy load), stepper wizard, date picker (simple), OTP input.
- **Hooks:** `useDebounce`, `useFetch` (cancel), `useLocalStorage`, `usePrevious`, `useIntersectionObserver`.
- **State aur performance:** unnecessary re-renders hatao (render count check), memoization, list virtualization.
- **Accessibility:** "ye component theek karo" (axe errors 0, keyboard se chale).
- **HTML/CSS layout:** "ye layout banao" (flex/grid/responsive), 3 screen sizes par **visual diff** (tolerance ke saath)
  + DOM structure checks.
- **Grade:** Vitest + Testing Library (logic), **Playwright** (asli browser: click, type, Tab/Enter/Esc, network mock),
  axe-core (a11y), screenshot diff (layout), render count (performance).

### 3.3 Backend / Node (200)

- **APIs:** CRUD with validation, pagination/filter/sort, error format, auth (signup/login, bcrypt, JWT + refresh,
  roles), rate limiter middleware, idempotency keys (payment jaisa), file upload (size/type), webhooks (signature
  verify), caching (TTL, invalidation), background job queue, websockets chat, request logging, graceful shutdown.
- **MERN projects:** 10 bade projects, guided labs ke roop me (§5).
- **Grade:** learner ka server gVisor me shuru → hamara HTTP test suite (status, body schema, headers, timing) → DB ki
  haalat jaanch; security tests (SQL injection, missing auth, password plain text = fail).

### 3.4 SQL (300) ✅ plan me

SQLite + Postgres (PGlite) + MySQL; kai hidden datasets (khaali table, NULL, ties, duplicates); window functions, CTE,
recursive, indexing ke sawaal (EXPLAIN se), schema design (constraints tests). [PROBLEM-STANDARD.md](PROBLEM-STANDARD.md) §4b.

### 3.5 Python (300)

Language features (comprehensions, generators, decorators, context managers, dataclasses, typing), OOP, file/JSON/CSV,
regex, `collections`/`itertools`, async (`asyncio` gather/semaphore), testing (pytest likhna: "is function ke test
likho" → hamare mutants pakadne chahiye!).

### 3.6 Data Science (250)

- **Kaam:** data cleaning (missing, duplicates, types), groupby/pivot, merges/joins, time series (resample, rolling),
  feature engineering, outliers, string ops, EDA sawaal ("kaunse city me sabse zyada…"), visualization.
- **Grade:** lautaya gaya DataFrame/Series hidden answer se (dtype, index, float tolerance); chart ke liye figure ki
  jaanch (type, axes labels, data) ya plot spec lautao.
- **Datasets:** apne banaye (synthetic, Bharat ke context: mandi prices, train delays, UPI transactions) ya open licence
  (CC0/CC-BY, attribution ke saath); har dataset ka licence database me.

### 3.7 Machine Learning (200)

- **Scratch se (numpy):** linear/logistic regression (gradient descent), k-means, KNN, decision tree split (Gini/entropy),
  Naive Bayes, PCA, metrics (precision/recall/F1/ROC-AUC), cross-validation, regularisation.
- **scikit-learn:** pipelines, preprocessing, hyperparameter search, imbalance handling, **data leakage dhoondo** wale
  sawaal.
- **Mini-Kaggle:** dataset + hidden test set; metric threshold pass + leaderboard (sirf seekhne ke liye).
- **Grade:** unit tests (scratch), metric on hidden set (sklearn), time/memory seema.

### 3.8 Deep Learning aur GenAI (150)

- **Scratch:** softmax (numerically stable), cross-entropy, backprop (2-layer net), conv forward, batch/layer norm,
  dropout, attention (scaled dot-product, multi-head), positional encoding, BPE tokenizer (mini), embeddings similarity,
  beam search.
- **PyTorch (CPU):** chhote models train karna (MNIST jaisa chhota), training loop, overfitting pakadna.
- **GenAI apps:** prompt templates, RAG (chunking, retrieval, recall@k), evaluation (golden set), tool calling/agents
  (mock tools), guardrails. **Mock LLM** se tay jawab, taaki grading pakki aur kharch ₹0.
- **Grade:** unit tests, metric thresholds, behaviour tests.

### 3.9 Java (200) + Spring Boot (30 labs)

Core, OOP, collections, streams, generics, exceptions, concurrency (`ExecutorService`, `CompletableFuture`, locks),
JVM basics (memory, GC sawaal). Spring: REST, validation, JPA (H2/Postgres), security (JWT), testing. Grade: JUnit +
HTTP tests.

### 3.10 Go (150)

Slices/maps, structs/interfaces, errors, goroutines/channels, `context`, `sync`, HTTP handlers, worker pools. Grade:
`go test -race` (race detector se data race = fail).

### 3.11 DevOps / Linux / Docker / K8s (150 labs)

Linux (files, permissions, processes, systemd, networking commands, bash scripting), Git (branching, rebase, conflicts,
bisect), Docker (Dockerfile, multi-stage, compose, volumes, networks), Nginx (reverse proxy, TLS-lite), CI (pipeline
YAML ki jaanch), Kubernetes (k3s: deployment, service, configmap, probes, rollout). Grade: env ke andar check scripts.

### 3.12 LLD (120) — code se design

| Kaam | Kya | Grade |
|---|---|---|
| **Design katas** (60) | Parking lot, elevator, Splitwise, vending machine (state machine), library, BookMyShow (seat lock, concurrency), rate limiter, LRU, pub-sub, chess move validation, snake & ladder, cab booking matching | Hidden unit tests (Java/Python/C++/TS) |
| **"Change request"** step | Kata ke baad naya requirement (jaise "EV charging spot jodo") | Naye tests + purane tests pass hone chahiye: design badalne layak tha ya nahi, yahi naap |
| **Refactoring katas** (30) | Ganda code → saaf (tests hare rahein) | Tests + metrics: method length, cyclomatic complexity, duplication, coupling |
| **Pattern katas** (30) | Strategy, Observer, Factory, Decorator, State, Command… sahi jagah | Behaviour tests + structure checks |
| AI review | SOLID, naming, extensibility par feedback | **Sirf feedback** (score ka chhota hissa max 20%), kabhi akela pass/fail nahi |

### 3.13 HLD / System Design (150) — "LeetCode for system design"

| Kaam | Kya | Grade |
|---|---|---|
| **Estimation drills** (300) | QPS, storage, bandwidth, servers, cache size (back-of-envelope) | Number, tolerance band ke saath (auto) |
| **Concept sawaal** (500) | Scenario MCQ: consistency, caching, sharding, queues, CAP, idempotency | Auto |
| **Component katas** (60, code) | Token bucket/sliding window rate limiter, consistent hashing ring, bloom filter, snowflake ID, URL shortener (base62, collisions), LRU/LFU, write-ahead log, pub/sub with acks, leader election sim, **Raft-lite** (CodeCrafters jaise stages) | Hidden tests, concurrency tests |
| **Design canvas + simulator** (60) | Requirement card (jaise 50k read QPS, p99 < 200 ms, 99.95%, budget) → canvas par components (client, CDN, LB, API, cache, DB primary/replica, shards, queue, workers, object store, search) + har ek ki capacity → **simulator** traffic chalata hai (spike, cache miss storm, hot key, region down) | Latency, throughput, availability, cost **requirements se** (auto score) |
| AI interviewer | Canvas par follow-up sawaal (trade-offs, failure modes) | Rubric feedback, calibrated (insaan ke 50 sample se) |
| Case studies (30) | URL shortener, WhatsApp, Uber, YouTube, UPI, IRCTC Tatkal, Zomato, Notification system… reference design ke saath (owner ki kitaab ka Twitter wala tareeka) | Padhna + canvas practice |

**Simulator** (hamara, browser me): har component ka model (capacity/s, latency distribution, failure prob, cost/ghanta),
queueing (M/M/c jaisa approximation), cache hit ratio, replication lag; scenario 60 s ka "fast-forward"; nateeja graph
ke saath. Isse design "sirf likha hua" nahi, **chal kar dikhta hai**.

### 3.14 Baaki

CP aur DSA ([PROBLEM-STANDARD.md](PROBLEM-STANDARD.md)), aptitude ([../LEARN-V2.md](../LEARN-V2.md) §3), C/C++ ✅.

## 4. Graders (ek jagah, sab arenas ke liye)

| Grader | Kya jaanchta | Kahan |
|---|---|---|
| `unit` | Jest/Vitest, pytest, JUnit, go test, C++ tests | Runner |
| `http` | Learner ke server par API tests | Runner (gVisor, loopback) |
| `dom` | Playwright: asli browser me clicks, keyboard, network mock | Runner (headless Chromium) |
| `visual` | Screenshot diff (pixelmatch, tolerance), 3 screen sizes | Runner |
| `a11y` | axe-core violations = 0 | Runner |
| `sql` | Result set (order/ties ke niyam ke saath), kai datasets | Runner / browser preview |
| `dataframe` | DataFrame/Series equality (dtype, index, tolerance) | Runner (CPython) |
| `metric` | Hidden test set par metric ≥ threshold | Runner (CPU job) |
| `notebook` | Cell outputs/variables | Runner |
| `script` | Env ki haalat (file, port, process, k8s object) | microVM |
| `simulator` | HLD design requirements | Browser + server dobara chalata (same seed) |
| `metrics` | Code metrics (complexity, duplication) | Runner |
| `ai_rubric` | Design/explanation feedback | Sahayak (sirf feedback/partial) |

**Niyam:** har lab/problem ka **starter fail** aur **solution pass** hona chahiye ("tests ka test"); unit tests par
**mutation score ≥ 90%** (DSA me 95%); hidden data **har learner ke liye seed se thoda alag** (copy mushkil);
code similarity ✅ contests aur Pramaan me.

## 5. Guided Labs (kadam-kadam)

### 5a. Lab package

```yaml
id: lab_react_todo
title: "React: apna Todo app"
track: web-react
level: L1
minutes: 120
env: { tier: E0, kind: react, packages: [react@19, react-dom@19] }
starter: ./starter/          # file tree
outcomes: ["state", "lists aur keys", "events", "localStorage"]
steps:
  - id: s3
    title: "Item delete karo"
    instructions: ./steps/s3.md          # owner ki kitaab wali soch: samjho → plan → likho → jaancho
    focus: src/TodoItem.jsx
    hints: [./hints/s3-1.md, ./hints/s3-2.md, ./hints/s3-3.md]
    checks:
      - { id: c1, grader: dom, visible: true,  spec: ./checks/s3-delete.spec.ts }
      - { id: c2, grader: dom, visible: false, spec: ./checks/s3-delete-edge.spec.ts }  # aakhri item, duplicate naam
    explain: [ "Key ke bina list delete par kya galat hota hai?" ]
    solution_patch: ./solutions/s3.patch
final:
  checks: [ ./checks/final.spec.ts ]
  rubric: ./rubric.md          # AI feedback (sirf salah)
  export: github
```

### 5b. Learner ka safar

1. Lab kholo → environment taiyaar (E0 turant, E2 snapshot se ≤ 10 s) → step 1.
2. **Lakshya + padhna** (2–5 min, sketch visual) → **likho** → ▶ Run → ✓ Test (visible) → ⬆ Submit (hidden).
3. Fail → saaf wajah ("delete ke baad list me 2 items, 1 chahiye") + hint 1/2/3 + Sahayak.
4. Pass → **"samjhao" sawaal** (1–2) → agla step khulta hai; checkpoint save.
5. "Mere liye kar do" → solution patch lagta hai, step "madad se" gina jaata hai (Pramaan me nahi).
6. Aakhir: final checks → AI code review (salah) → **project portfolio me** (GitHub export, live demo link E0 web apps
   ke liye) → Pramaan (viva pass hone par).

### 5c. Author (admin) ka safar

"Author mode" wahi Studio: steps likho, checks jodo, **"Starter par chalao" (fail hona chahiye) aur "Solution par chalao"
(pass)**, mutation report, learner ki tarah preview, version publish. Datasets manager (licence field zaroori), env
images (versions pinned). [ADMIN-PANEL.md](ADMIN-PANEL.md) me "Labs" module.

## 6. Suraksha

- **Preview iframe alag domain par** (`*.parikshaa-usercontent.in` jaisa), `sandbox` attributes, CSP; hamari cookies tak
  pahunch nahi; `postMessage` sirf tay messages.
- **Runner:** gVisor, network band (HTTP grader me sirf loopback), CPU/memory/time/pids seema, read-only base image.
- **microVM:** egress sirf package mirrors tak; koi secret nahi; idle 10 min par pause, 2 ghante par band; crypto-mining
  jaisi CPU ki pehchaan → band + report.
- **Uploads:** size/type seema, scan.
- **GenAI labs:** asli API key kabhi learner ke env me nahi; sirf hamara gateway, quota ke saath.

## 7. Database (jod; [ARCHITECTURE.md](ARCHITECTURE.md) §3 ke saath)

| Table | Kya |
|---|---|
| `labs`, `lab_versions` | Lab ka meta, package URI (S3), status |
| `lab_steps`, `lab_checks` | Steps aur checks (grader, visible, spec URI, weight) |
| `lab_attempts`, `lab_step_results` | Learner ka safar, har step ka nateeja, "madad se" flag |
| `workspaces` | Learner ki files ka snapshot (S3 URI, size, step) |
| `env_sessions` | microVM ke minute (quota aur kharch) |
| `arena_problems` | `practice_problems` ✅ par: `arena` (js/frontend/backend/sql/python/ds/ml/dl/java/go/devops/lld/hld), `grader` config |
| `datasets` | Naam, URI, licence, attribution, size |
| `design_submissions`, `sim_runs` | HLD canvas JSON, simulator nateeja (seed) |

## 8. Kharch aur quota

| Cheez | Kharch | Free | Plus |
|---|---|---|---|
| E0 (browser) | ~₹0 | Unlimited | Unlimited |
| E1 submit (unit/dom/http) | ₹0.005–0.03 har ek | 100/din | 1,000/din (fair use) |
| E1 ML job | ₹0.05–0.3 | 10/din | 100/din |
| E2 microVM | $0.10–0.17/ghanta | 5 ghante/mahina | 40 ghante/mahina |
| GPU | Bahut | — | Advanced labs me seemit |
| AI review/interviewer | ₹0.03–1 | Roz ki seema | Fair use ✅ |

## 9. Kram (build slices; [../LEARN-HANDOFF.md](../LEARN-HANDOFF.md))

1. **Studio core** (E0): editor, files, tabs, terminal (E0 shell), tests panel, checkpoints, autosave.
2. **Web preview** (esbuild-wasm, npm mirror, sandboxed iframe) + `dom`/`a11y`/`visual` graders.
3. **Python/DS notebook** (Pyodide) + `dataframe`/`notebook` graders.
4. **SQL** in Studio (sql.js + PGlite) + `sql` grader v2.
5. **Guided lab engine** (package, steps, checks, hints, explain, solution patch) + author mode.
6. **HTTP grader** (Node/Java/Go servers) + FerretDB.
7. **Arenas UI** (problem list per arena, contests reuse ✅).
8. **ML metric grader** + datasets manager.
9. **LLD graders** (change request, metrics).
10. **HLD**: estimation drills, component katas, canvas + simulator, AI interviewer.
11. **microVM (E2)** + `script` grader (DevOps, Spring, MERN bade projects).
12. **GenAI labs** (mock LLM).
