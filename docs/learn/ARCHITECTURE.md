# Learn v2: architecture, database, AI, judge (19 Oct 2026)

Maujooda code par: monorepo (`core`, `store`, `api`, `web`, `console`, `runner`, `viva`, `brand`, `e2e`), Postgres
(Supabase, RLS ✅), Fastify + Zod + OpenAPI ✅, outbox ✅, Sahayak ✅, gVisor runner + Judge0 adapter ✅. Learn ka
content Parikshaa ki apni organisation ke practice site me rehta hai, isliye RLS aur `org_id` wahi niyam.

Learner flows: [USER-FLOWS.md](USER-FLOWS.md). Admin: [ADMIN-PANEL.md](ADMIN-PANEL.md). Kharch aur scale:
[../LEARN-LAUNCH-PLAN.md](../LEARN-LAUNCH-PLAN.md) §4–§6.

---

## 1. Naksha

```
                 Learners (web · PWA · Android app)                    Staff (console)
                               │                                             │
            Vercel: static + prerender (landing, problem/lesson pages), WAF, CDN (visual SVGs, versioned)
                               │                                             │
   ┌──────────────────────── API (Fastify, stateless, 2+ machines, autoscale) ────────────────────────┐
   │ auth · learn · problems · submissions · editorials · visuals · aptitude · lessons · roadmaps ·   │
   │ contests · workspace · profile · plus · notifications · admin/*                                  │
   │ Sahayak gateway (AI): modes, routing, cache, fair-use, evals, kill switch                        │
   └───────┬──────────────┬────────────────┬──────────────────┬────────────────┬──────────────────────┘
           │              │                │                  │                │
     Postgres (RLS)   S3 (tests,      judge_jobs ──▶ Judge workers      Outbox ✅ ──▶ email, WhatsApp,
     + pgvector       visuals PNG,     (queue)      (gVisor; Judge0     push
     + replicas       exports, video)               alag VM; net band)
           │
     Factory workers (raat ko): draft (Claude Batch) → package → runner jaanch → doosra model → duplicate →
     editorial + visual spec → sketch render → style critic → review queue
```

Observability: Sentry ✅, PostHog ✅, OpenTelemetry traces/metrics, uptime ✅. Redis padaav B (20k DAU) se (rate
limit, leaderboards); tab tak Postgres.

## 2. Packages

| Package | Kaam | Naya/✅ |
|---|---|---|
| `core` | Domain types, Learn ke models (problem package, editorial steps, visual spec, roadmap) | ✅ + jod |
| `store` | Migrations + stores (RLS) | ✅ + nayi tables (§3) |
| `api` | Routes, services, Sahayak gateway, factory API | ✅ + jod |
| `web` | Learner app (Vite + React 19) + public pages ka prerender | ✅ + Learn v2 shell |
| `console` | Admin panel | ✅ + Learn modules |
| `runner` | gVisor runner + Judge0 adapter; + interactive, testlib, stress, complexity | ✅ + jod |
| `viva` | Micro-viva engine (probe, verdict, rubric) → Pramaan | ✅ |
| `brand` | Tokens, components, fonts | ✅ + Learn tokens |
| **`sketch`** | Visual spec → sketch SVG frames, player component, PNG export | **Naya** |
| **`factory`** | Content pipeline (CLI + workers), style critic, batch runner | **Naya** |

## 3. Database (nayi tables aur badlaav)

Har table me `org_id` (RLS), `created_at`, `updated_at`; ids text (`prefix_` + ulid). Learner ka data learner ki RLS
policy se; content "published" hi learner padh sakta hai.

### 3a. Content (coding)

| Table | Zaroori columns | Note |
|---|---|---|
| `practice_problems` ✅ (badlaav) | + `kind` (`dsa`/`cp`/`sql`/`interactive`), `rating` (800–3500, CP), `patterns text[]`, `status` (`draft`/`review`/`published`/`retired`), `visibility` (`free`/`plus`), `source` (`factory`/`legacy`/`manual`), `package_version`, `est_minutes` | Maujooda `published` → `status` me |
| `problem_packages` | `problem_id`, `version`, `statement_md`, `constraints jsonb`, `io_format` (`stdin`/`function`), `checker` (`exact`/`tokens`/`float`/`custom`), `checker_src`, `interactor_src`, `validator_src`, `generators jsonb`, `limits jsonb` (bhasha-war TL ms, memory MB), `tests_uri`, `tests_hash`, `tests_count`, `status` | Polygon jaisa; tests S3 me zip |
| `problem_solutions` | `problem_id`, `version`, `role` (`reference`/`brute`/`alt`/`wrong_wa`/`wrong_tle`), `language`, `code`, `last_check jsonb` | Galat solutions **fail hone chahiye** |
| `editorials` | `problem_id`, `version`, `lang` (`en`/`hi`), `body_md`, `outline jsonb` (4 kadam + approaches ke anchors), `word_count`, `status`, `reviewed_by`, `reviewed_at` | Maujooda `practice_problems.editorial` yahan aata hai |
| `visuals` | `id`, `owner_kind` (`problem`/`editorial`/`lesson`/`apt`), `owner_id`, `version`, `spec jsonb`, `frames_uri`, `frame_count`, `alt_text jsonb`, `status` | [VISUAL-STYLE.md](VISUAL-STYLE.md) |
| `problem_relations` | `problem_id`, `related_id`, `kind` (`next`/`variant`/`prereq`) | Related problems |
| `sheets` / `sheet_items` | sheet (A2Z, Placement 150…), step, position, problem/lesson | `prep_tracks/modules/items` ✅ hi use ho sakte hain |

### 3b. Content (quiz, aptitude, lessons)

| Table | Zaroori columns | Note |
|---|---|---|
| `quiz_items` | `domain` (`quant`/`reasoning`/`verbal`/`cs`/`lang`/`design`), `subject`, `topic`, `subtopic`, `difficulty`, `stem_md`, `options jsonb`, `answer`, `answer_kind` (`single`/`multi`/`numeric`), `solution_md`, `shortcut_md`, `time_target_s`, `trap_map jsonb` (option → galti), `passage_id`, `set_id` (DI), `solver_src`, `visual_id`, `status`, `version` | Aptitude + CS MCQ ek jagah |
| `quiz_passages` | RC passage, DI data | |
| `quiz_sets` | practice set: items, order, mushkil | |
| `mocks` | `sections jsonb` (naam, items, samay, negative marking), `pattern_label` ("TCS NQT jaisa") | |
| `quiz_attempts` / `quiz_answers` | learner, set/mock, status, score, percentile / item, choice, sahi, `time_ms`, marked | Exam engine ✅ ka tareeka |
| `prep_lessons` ✅ (badlaav) | + `subject`, `kind` (`lesson`/`case_study`/`course`), `version`, `status`, `visibility`, `lang` | |
| `qa_items` | interview Q&A: `question`, `short_answer`, `deep_answer`, subject/topic | Flashcards (SM-2 ✅) |

### 3c. Roadmaps

| Table | Zaroori columns |
|---|---|
| `roadmaps` | `slug`, `title`, `kind` (`role`/`skill`/`custom`/`ai`), `owner_learner_id` (official me null), `visibility` (`public`/`link`/`private`), `version`, `status` |
| `roadmap_nodes` | `roadmap_id`, `node_key`, `title`, `summary`, `kind` (`topic`/`sub`/`checkpoint`), `x`, `y`, `required bool`, `refs jsonb` (lesson/problem/quiz/lab ids, bahar ke links) |
| `roadmap_edges` | `roadmap_id`, `from_key`, `to_key`, `style` |
| `roadmap_progress` | `learner_id`, `roadmap_id`, `node_key`, `state` (`learning`/`done`/`skip`) |
| `roadmap_assignments` | Campus class / Hire job ko roadmap |
| `pramaan` | `learner_id`, `subject` (node/problem), `evidence` (viva/quiz id), `issued_at`, `verify_code` | Verify page |

### 3d. AI (Sahayak)

| Table | Zaroori columns | Note |
|---|---|---|
| `ai_conversations` | `learner_id`, `context_kind`, `context_id`, `title`, `keep` (`account`/`180d`), `last_at` | Plus: `account` (owner, 19 Oct); free: `180d` ✅ |
| `ai_messages` | `conversation_id`, `role`, `content`, `mode`, `model`, `tokens_in`, `tokens_out`, `cost_micros`, `flags` | `prep_tutor` ✅ yahan migrate |
| `ai_usage_daily` | `learner_id`, `day`, `mode`, `messages`, `tokens`, `cost_micros` | Fair use: Plus 200/din poori speed |
| `ai_courses` | `topic_key` (normalised), `title`, `outline jsonb`, `label` (`ai`/`expert`), `created_by`, `learners_count`, `status` | Ek topic → ek course (dedupe) |
| `ai_course_lessons` | `course_id`, `position`, `body_md`, `model`, `generated_at`, `reports` | Maangne par bane |
| `ai_course_progress` | learner, course, lesson, done | |
| `model_usage` ✅ | kharch ka hisaab | ✅ |

### 3e. Learner ki seekh

| Table | Zaroori columns |
|---|---|
| `practice_submissions` ✅ (badlaav) | + `verdict_detail jsonb` (fail test number, error), `complexity jsonb`, `mistake_category`; **mahine se partition** |
| `counterexamples` | `submission_id`, `input`, `expected`, `got`, `found_in_ms` |
| `mistakes` | `learner_id`, `submission_id`, `category`, `source` (`auto`/`self`) |
| `pattern_drills` / `pattern_drill_answers` | problem, sahi pattern, distractors / learner, choice, ms |
| `viva_sessions` | `viva` ✅ engine ka record; pass → `pramaan` |
| `revision_items` | SM-2 ✅ (`prep_saved`/revision ka maujooda) |
| `content_reports` | learner, item (kind/id/version), kind (`statement`/`test`/`editorial`/`visual`/`ai`), text, status |
| `content_votes` | editorial/lesson "kaam aaya?" |

### 3f. Contests, Plus, video, search

| Table | Note |
|---|---|
| `contests` ✅ + `rated`, `kind`, `virtual_allowed`, `pool` (private problems) | Problems contest tak chhupe |
| `contest_registrations`, `virtual_runs` | |
| `prep_ratings` ✅ | Elo ✅ |
| `prep_plus` ✅, `prep_orders` ✅, `prep_products` ✅, `prep_coupons` ✅ | + `entitlements` view: feature → plan → seema |
| `videos` (phase 2) | `provider`, `provider_id`, `owner`, `duration`, `status`, `drm` |
| `devices`, `video_sessions` (phase 2) | Device ki ginti (2), stream (1), watermark code |
| `search_documents` | `kind`, `ref_id`, `title`, `body tsvector`, `embedding vector(1024)` | FTS + pgvector |

### 3g. Content ka safar (factory/review)

| Table | Zaroori columns |
|---|---|
| `content_batches` | `kind` (`dsa`/`cp`/`apt`/`lesson`/`qa`/`roadmap`), `plan jsonb`, `target_count`, `budget_usd`, `status`, `cost_usd` |
| `content_jobs` | `batch_id`, `item_kind`, `item_id`, `stage` (`draft`/`package`/`runner`/`second_model`/`duplicate`/`editorial`/`visual`/`critic`/`review`/`published`), `status`, `error`, `tokens`, `cost_usd`, `attempts` |
| `content_reviews` | item + version, `reviewer_id`, `decision` (`approve`/`changes`/`reject`), `checklist jsonb`, `comment` |
| `content_versions` | har publish ka snapshot (rollback ke liye) |

**Indexes:** submissions `(learner_id, problem_id, created_at desc)`, `(problem_id, status)`; quiz items `(domain,
topic, difficulty, status)`; roadmap progress `(learner_id, roadmap_id)`; GIN on `patterns`, `tags`; ivfflat/hnsw on
embeddings.

## 4. API (route groups)

Learner (`/practice/:site/...`, maujooda shakal): `me`, `home`, `plan` ✅, `roadmaps` (`/`, `/:slug`, `/:slug/progress`,
`/custom`, `/ai`), `problems` (`/`, `/:slug`), `run`, `submit`, `submissions/:id` (SSE se status), `counterexample`,
`editorials/:problem` (`?step=`), `visuals/:id`, `lessons` ✅, `qa`, `quiz` (`sets`, `mocks`, `attempts`), `contests` ✅,
`workspace` (`code`, `lists`, `notes` ✅, `mistakes`), `profile` ✅, `pramaan/:code` (public verify), `ai` (`conversations`,
`messages` SSE stream, `courses`), `plus` ✅, `settings`, `reports`.

Admin (`/practice-admin/...` ✅ shakal): `content/problems`, `content/packages`, `content/editorials`, `content/visuals`,
`content/quiz`, `content/lessons`, `content/roadmaps`, `review`, `factory`, `learners`, `support`, `commerce` ✅,
`community` ✅, `contests` ✅, `ai` ✅, `analytics`, `notifications`, `system`.

Sab Zod schema, OpenAPI ✅ (`npm run openapi`), rate limit per route, audit log ✅ har admin likhne wale kaam par.

## 5. AI (Sahayak gateway)

| Mode | Model (default) | Context | Niyam |
|---|---|---|---|
| hint ✅ | Haiku 5.5 | problem, code, editorial ka allowed kadam | Leak nahi (eval ✅) |
| doubt ✅ | Haiku 5.5 | problem/lesson + retrieval (pgvector) | Source link |
| review ✅ | Haiku 5.5 → Sonnet 5.5 agar eval me zaroori | code, tests ka nateeja | Fixed JSON ✅ |
| explain (selection) | Haiku 5.5 | chuna hua text + lesson | |
| quiz_me | Haiku 5.5 | topic + bank | Bank se pehle, AI baad me (do model se jaancha) |
| teach_back | Haiku 5.5 | learner ka explanation + editorial | Rubric |
| viva ✅ | `viva` engine | learner ka code | Pramaan |
| course_outline / course_lesson | Sonnet 5.5 / Haiku 5.5 | topic + hamara content + official docs (retrieval) | Dedupe, cache |
| roadmap_gen | Sonnet 5.5 | goal, samay, level + hamari node library | Sirf hamare nodes |
| interview | Sonnet 5.5 | role, problem, transcript | Rubric |
| factory_* | Opus 5.5 (Batch) + Sonnet (doosra model) | style guide, plan | Raat ko |

- **Routing table** config me (admin badal sake); **provider adapter** (Anthropic default; backup provider ek setting).
- **Prompts** repo me versioned (`api/src/sahayak/prompts/*`), har version ka eval score.
- **Prompt caching:** system + problem context cache; response cache AI courses ke liye.
- **Fair use:** `ai_usage_daily` se; free: mode-war roz ki seema; Plus: 200/din poori speed, phir Haiku + chhota
  jawab; abuse (bot jaisa) par rok.
- **Safety:** koshish se pehle poora solution nahi ✅; contest me band ✅; jailbreak par mana; PII redaction (viva ✅
  `redact.ts`); 18 se kam par extra saavdhani.
- **Evals:** maujooda harness ✅ (leak-free 98%, bug pakadna 90%, complexity 95%) + naye modes ke sets; har prompt/model
  badlaav se pehle.
- **Kill switch** har mode ka; mahine ki spend limit; alarm.
- **Chat history:** Plus `keep=account` (jab tak account), free 180 din ✅ (`PrivacyService.sweepTutor` ✅ badlega);
  export aur delete hamesha.

## 6. Judge (detail: [../LEARN-LAUNCH-PLAN.md](../LEARN-LAUNCH-PLAN.md) §4)

- `judge_jobs` table: `id`, `submission_id`, `lane` (`contest`/`practice`/`factory`), `priority`, `status`, `worker`,
  `leased_until`, `attempts`. Worker `FOR UPDATE SKIP LOCKED` se uthata hai; lease khatam to dobara.
- Worker: package tests S3 se (hash se cache), compile cache (`hash(code+lang+flags)`), C++ PCH, ek process me saare
  test (function style), pehli galti par ruko (Submit), interactive (do process + pipe), `testlib.h`.
- **Stress service** (counterexample): chhote random inputs (generator ka `small` mode), learner vs brute, pehla farak;
  10 s ki seema; sirf practice.
- **Complexity analyzer:** generator se n, 2n, 4n, 8n; time ka log-log slope → `O(n)`/`O(n log n)`/`O(n²)`; shor ko
  dhyan me rakh kar ("lagta hai").
- Factory lane raat ko (kam priority), contest lane sabse upar ✅.
- Suraksha: gVisor/isolate, network band, metadata band, alag VM, purge ✅.

## 7. Content factory ([../LEARN-V2.md](../LEARN-V2.md) §3f)

- CLI + workers (`packages/factory`), GitHub Actions/VM par raat ko; `content_batches` → `content_jobs` stage-war.
- Claude **Batch API** (50% sasta), spend limit per batch; har stage idempotent (dobara chale to wahi).
- Runner checks factory lane me; doosra model sirf statement padh kar hal; duplicate: embeddings cosine > 0.92 → ruko.
- Style critic: [EDITORIAL-STYLE.md](EDITORIAL-STYLE.md) §6 ki checklist (machine + model).
- Review queue → publish → `content_versions` snapshot → CDN purge (versioned URLs, isliye zyaadatar purge ki zaroorat
  nahi).

## 8. Speed

- Public content pages (problem, lesson, roadmap) build par **prerender** (react-dom/server), phir hydrate; sitemap.
- Visual SVGs versioned URL par `Cache-Control: immutable`.
- Code splitting: editor (CodeMirror ✅), sketch player, charts lazy.
- API: read-heavy content replica/cache se; submissions write primary par.
- Seemaayein: [USER-FLOWS.md](USER-FLOWS.md) §3.

## 9. Suraksha

| Hissa | Niyam |
|---|---|
| Auth | Sessions ✅, Google ✅, email verify ✅, OTP limits; staff 2FA zaroori ✅, admin IP allowlist, 30 min idle timeout |
| Data | RLS ✅ har table; learner sirf apna; content sirf published |
| Abuse | Rate limit per route/user/IP; Turnstile signup par; scraping (bahut tez page, bot) par rok; fair-use AI |
| Web | CSP, HSTS, security headers, WAF; dependency + secret scan CI ✅ (CodeQL) |
| Judge | §6 |
| Payments | Webhook signature ✅, idempotent orders ✅ |
| Secrets | Secrets Manager ✅; repo/state me kabhi nahi |
| Privacy (DPDP) | Consent, umar (18+ ya parent), export/delete, chat history ki marzi, grievance officer, data Bharat me (Mumbai) |
| Audit | Har admin kaam audit log ✅ me |
| Launch se pehle | Bahar ka pen test, ZAP scan, restore drill |

## 10. Chalana (ops)

- **Environments:** local (PGlite ✅), CI, staging (asli servers, nakli payment), production.
- **Release:** migrations pehle (backward-compatible), feature flags se rollout (%, "Plus beta"), rollback.
- **SLO:** API 99.9%, page p95 < 2 s, verdict p95 < 5 s, AI hint p95 < 6 s; alarm burn-rate par.
- **Backups:** PITR ✅ (Supabase/RDS), S3 versioning, har mahine restore drill.
- **Dashboards:** API latency/errors, judge queue/p95, AI kharch/fair-use, factory progress, Plus revenue.
