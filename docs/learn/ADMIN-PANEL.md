# Learn v2: admin panel, poora (19 Oct 2026)

Console (`packages/console`) ke kit ✅ par: page header, figure strip, ⋯ menu, badges, empty/skeleton/banner, drop
zone, settings template, Ctrl+K search, toasts ✅. Pehle se: staff, roles, 2FA (TOTP), audit log, Practice → Tracks/
Problems/Lessons, Plus, Campus cohorts, Sahayak usage aur evals, contests, code similarity.

Database aur API: [ARCHITECTURE.md](ARCHITECTURE.md). Learner flows: [USER-FLOWS.md](USER-FLOWS.md).

---

## 1. Roles aur permissions

| Module | Super admin | Content admin | Editor | Reviewer | Support | Finance | Moderator | Analyst |
|---|---|---|---|---|---|---|---|---|
| Content (problems, quiz, lessons, roadmaps, visuals) | sab | sab | banana, badalna | dekhna | dekhna | — | — | dekhna |
| Publish | ✓ | ✓ | — | ✓ (review se) | — | — | — | — |
| Review queue | ✓ | ✓ | apna | ✓ | — | — | — | — |
| Factory | ✓ | ✓ | dekhna | — | — | — | — | dekhna |
| Media / video | ✓ | ✓ | ✓ | — | — | — | — | — |
| Learners | ✓ | dekhna | — | — | ✓ | dekhna | dekhna | ginti |
| Support tickets, reports | ✓ | ✓ | apne item ke | ✓ | ✓ | — | ✓ | — |
| Commerce (plans, coupons, refunds, invoices) | ✓ | — | — | — | refund maangna | ✓ | — | dekhna |
| Community | ✓ | — | — | — | dekhna | — | ✓ | — |
| Contests | ✓ | ✓ | problems | — | — | — | — | dekhna |
| AI (limits, prompts, evals, kill switch) | ✓ | dekhna | — | — | — | — | — | dekhna |
| Analytics | ✓ | ✓ | apna content | ✓ | — | ✓ | — | ✓ |
| Notifications / campaigns | ✓ | ✓ | — | — | — | — | — | — |
| System (flags, health, staff, audit) | ✓ | — | — | — | — | — | — | — |

**Niyam:** sab staff ke liye 2FA zaroori ✅; admin URL par IP allowlist (optional); 30 min idle par logout; har likhne
wala kaam audit log ✅ me (kaun, kya, kab, pehle/baad); **do insaan ki manzoori** (4-eyes): content delete, ₹5,000 se
bade refund, AI kill switch hatana, role badalna.

## 2. Nav

```
Dashboard
Content ▸ Problems · Aptitude & quiz · Lessons · Q&A · Roadmaps · Sheets · Visuals · Media
Review queue
Factory
Learners ▸ Search · Support · Reports
Commerce ▸ Plans · Coupons · Campus ✅ · Orders · Refunds ✅ · Invoices ✅
Community ▸ Discussions · Experiences · Flags
Contests
AI ▸ Usage ✅ · Limits · Prompts · Evals ✅ · AI courses · Flagged
Analytics
Notifications
System ▸ Health · Flags · Staff ✅ · Audit log ✅ · Settings
```

## 3. Screens

### 3.1 Dashboard

Figure strip: aaj ke signups, DAU, submissions, AC%, AI kharch (₹), judge p95, error rate, review queue, khule
reports, aaj ki kamaai. Neeche: 30 din ke graphs, "dhyan do" list (factory fail, p95 > 5 s, AI kharch limit ke 80% par,
reports > 24 ghante purane).

### 3.2 Content → Problems

- **List:** filter (status, kind DSA/CP/SQL, topic, pattern, mushkil, rating, source, free/plus, reviewer), search,
  columns (title, status chip, acceptance %, reports, "kaam aaya?" %, version, updated). Bulk: review bhejo, retire,
  sheet me jodo, visibility.
- **Problem editor (tabs):**

| Tab | Kya |
|---|---|
| Statement | Markdown + preview, example, constraints (structured), io format (stdin/function), signature har bhasha ki |
| Package | Tests (upload zip / generators se banao), validator, checker (exact/tokens/float/custom), interactor, limits (bhasha-war), "tests dobara banao" |
| Solutions | Reference (4 bhasha), brute, alt, **galat solutions** (WA/TLE expected); har ek ka runner nateeja |
| Editorial | 4 kadam ka editor (outline ke saath), approaches ke anchors, code tabs, `Note` callouts, Hinglish version, live preview (learner jaisa) |
| Visuals | Spec JSON editor + **live sketch preview**, frames list, captions (en/hi), alt text, "trace se dobara banao" |
| Metadata | Patterns, rating/mushkil, prerequisites, related, sheet, free/plus, companies (sirf sach, source ke saath) |
| Checks | Machine checks (runner, doosra model, duplicate, style critic) hare/laal, dobara chalao |
| History | Versions, diff (text + tests ka count), rollback, kisne kab publish kiya |

- **Publish ka niyam:** sab checks hare + review approve; warna button band aur wajah dikhe.

### 3.3 Content → Aptitude & quiz

Items list (domain, topic, mushkil, status, galat-jawab dar), item editor (stem, options, answer, hal, shortcut, time
target, trap map, solver code + "chalao", visual), passages/DI sets, **practice set builder** (drag), **mock builder**
(sections, samay, negative marking, pattern label), item ka analytics (kitno ne galat kiya, kaunsa option).

### 3.4 Content → Lessons, Q&A

Subject → topic → lesson; block editor (text, code jo chale, visual, callout, inline sawaal, quiz); Q&A editor (sawaal,
chhota, gehra jawab); versions; Hinglish; preview.

### 3.5 Content → Roadmaps

Graph editor (canvas: node jodo, khinchao, edge, required/optional), node drawer me content jodna (search karke lesson/
problem/quiz/lab), bahar ke links (domain allowlist), publish/version. Custom roadmaps (learners ke): sirf reported
wale dikhte hain, moderation.

### 3.6 Content → Sheets, Visuals, Media

Sheets (A2Z steps, Placement 150…): kram drag se. Visuals: sab visuals ki list, golden frames, fail lint. Media:
images; **video (phase 2):** upload → transcode → DRM status → lesson/problem se jodo; watermark settings; device limit.

### 3.7 Review queue

- "Meri queue" + sab; filter kind/subject/priority; SLA (A2Z 48 ghante).
- Side-by-side: learner jaisa preview | checklist ([EDITORIAL-STYLE.md](EDITORIAL-STYLE.md) §6 ke items, tick) |
  comments (line par).
- Faisla: **Approve** / **Badlaav chahiye** (wajah, editor ko wapas) / **Reject** (wajah).
- Sampling: A2Z 100%, bank 10%, aptitude 10%, lessons 100% (pehle 3 mahine).
- Reviewer ki stats (kitne, kitna samay, baad me reports).

### 3.8 Factory (control room)

- **Naya batch:** kind, topic plan (topics × ginti × mushkil), budget cap ($), model settings, kab chale.
- **Batch page:** stage-war progress (draft → … → review), fail ki wajah ke hisaab se group, "fail wale dobara",
  kharch (live), pause / kill.
- **Item trace:** har stage ka input/output, tokens, runner logs.
- **Settings:** raat ka samay, roz ki API spend limit, duplicate threshold.

### 3.9 Learners

- **Search:** email, phone, handle, id.
- **Learner page:** profile, plan (free/plus, kab tak), activity (streak, solved, last seen), submissions, AI usage
  (ginti aur kharch; **chats ka text sirf flagged ho to, wajah likh kar, audit ke saath**), devices/sessions, payments,
  reports.
- **Actions:** password reset link, sessions band, suspend/ban (wajah), Plus do (din), refund maango (finance ko),
  data export, **account delete (DPDP)**, "learner ki nazar se dekho" (sirf padhna, audit).

### 3.10 Support aur reports

"Galti batao" reports: kind (statement/test/editorial/visual/AI), item link, status (naya → editor ko → theek →
band), learner ko jawab (template). Tickets: email se aaye, assign, jawab, SLA.

### 3.11 Commerce

Plans aur daam (mahina/saal, GST), entitlements (har feature ki free/Plus seema: AI 200/din fair use, custom roadmaps
3/100…), coupons ✅, campus licence ✅, orders, refunds ✅ (4-eyes > ₹5,000), invoices ✅, GST report, MRR/churn.

### 3.12 Community

Discussions (flag wale pehle), experiences ✅ (manzoori), flags ✅, spoiler niyam, ban/mute (wajah), kisi ki post hatao
(audit).

### 3.13 Contests

Banana (private pool se problems, samay, rated, scoring), **scaling pre-warm** (kitne learners ummeed; workers 15 min
pehle), live monitor (submissions/s, queue, p95, errors, tab-switch warnings), plagiarism review ✅ (code similarity),
rating publish, editorial release, virtual allow.

### 3.14 AI

Usage ✅ (mode × model × din, ₹), **limits** (free per mode, Plus fair use 200/din, downgrade model), prompts (version,
A/B, eval score), evals ✅ (chalao, report), **kill switch** har mode, AI courses (popular → review queue → "Expert ne
jaancha"), flagged conversations (learner ne report kiya ya safety ne pakda).

### 3.15 Analytics

Funnel (visit → signup → onboarding → pehla AC → D7 → Plus), retention cohorts, content performance (problem: attempts,
AC%, average tries, "kaam aaya?", editorial kis kadam par chhoda; dry-run frames dekhe), khaali search, aptitude item
analysis, AI ka asar (hint ke baad AC dar), revenue.

### 3.16 Notifications

Templates (email/WhatsApp/push, en/hi), campaigns (segment: goal, saal, inactive 7 din, Plus khatam), schedule, quiet
hours, frequency cap, unsubscribe ✅, nateeja (open, click).

### 3.17 System

Health (API, DB, judge queue/p95, workers, outbox ✅, factory), feature flags (% rollout, "Plus beta", college-war),
maintenance banner, staff ✅ aur roles, audit log ✅ (filter, export), API keys ✅, settings (legal pages ka text,
pricing display, bhashayein).
