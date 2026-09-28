# Design system

Parikshaa has two faces. The **candidate app** is read for an hour at a time,
under some stress, on a lab machine or a phone. The **console** is a working
tool that examiners and invigilators keep open all day. Both are built on one
design system, `packages/brand`, so they read as one product.

Screenshots of every page are in [`docs/screenshots`](screenshots/). They are
taken from the real app over seeded data, not mocked up; see
[Regenerating the screenshots](#regenerating-the-screenshots).

![The console: results for a campus drive](screenshots/console-06-results.png)

## Principles

- **Calm, not alarming.** Nothing a candidate sees implies suspicion. The
  follow-up question is styled as a question, in the brand's own blue, never in
  warning colours (SPEC §4). Being offline is a quiet amber note, not a red
  error.
- **The grade and the evidence never look alike.** In the console, a score is a
  settled number on a white card. The micro-viva's evidence sits beside it in an
  amber, left-ruled card, with a stated boundary (SPEC §6.1).
- **Dense where it is used all day, generous where it is read under stress.**
  Console body text is 14px; the candidate app's is 16px, with larger touch
  targets.
- **Nothing observed that is not said.** The typefaces are bundled with the
  app. No font, script or image is fetched from a third party at runtime.
- **Accessible by construction.** Every pair of text and background colours
  meets WCAG 2.1 AA. Every control shows a focus ring. The axe checks in
  `packages/e2e/tests/accessibility.spec.ts` run on every change.

## The mark

प, the first letter of परीक्षा, drawn in white on an ink-indigo tile, with a
saffron bindu above its headline. It is `LogoMark` in
`packages/brand/src/react.tsx`. `Wordmark` sets it beside the name, and takes
an optional product name ("Console"). The mark is decorative wherever the name
is beside it, so screen readers read the name once.

## Tokens (`packages/brand/src/tokens.css`)

Components use tokens, never hex values. Dark mode and any later re-theme
change only this file.

| Role | Token | Light | Use |
| --- | --- | --- | --- |
| Primary | `--primary` | `#3346c4` ink indigo | Buttons, links, the current step, focus |
| Accent | `--accent` | `#f28c28` saffron | The bindu, the active nav marker, avatars — sparingly |
| Canvas | `--bg` | `#f6f7fb` | Page background |
| Surface | `--surface` | `#ffffff` | Cards, inputs |
| Text | `--text` / `--text-muted` | `#131a2e` / `#5f687c` | Body / secondary (≥ 4.5:1 on every surface) |
| Success | `--success` | `#117a57` | Saved, graded, verified |
| Warning | `--warning` | `#9a5800` | Evidence, attention, offline |
| Danger | `--danger` | `#c23a2b` | Errors, set aside, failed |
| Chrome | `--chrome` | `#0b1033` | The console sidebar, in both themes |

Status colours are kept apart from the brand colours, so "failed" never looks
like "brand".

- **Type:** Inter (variable, Latin), with Noto Sans Devanagari for Hindi and
  Marathi. The scale runs 12 · 13 · 14 · 16 · 18 · 22 · 28 · 36px.
- **Space:** a 4px grid (`--space-1` … `--space-12`).
- **Shape:** radii of 6, 8, 12 and 16px.
- **Depth:** four shadows, from `--shadow-xs` to `--shadow-lg`.

## Components (`packages/brand/src/base.css`)

Plain elements are styled directly, so every screen is on-brand by default.
Variants are classes:

| Component | Markup |
| --- | --- |
| Button | `<button>` (primary), `.secondary`, `.quiet`, `.danger`, `.large`, `.block`, `.crumb` (reads as a link) |
| Field | `.field` > `label` + `input`/`select`/`textarea`; `.grid` lays fields out in columns |
| Card | `.card`; a `.bar` as its first child becomes the card's header |
| Table | `<table>` with `<thead>`: sticky header, row hover |
| Badge | `.pill`; `.ok`, `.attention`, `.bad`, `.brand`, or `data-state="in_progress"` and the like |
| Figures | `<dl class="figures">` of `div > dt + dd`: a row of headline numbers |
| Messages | `.notice` (muted), `.error`, `.problems` (a list of what is wrong), `.alert` |

Each app adds its own layout on top:

- **Candidate app** (`packages/web/src/styles.css`): the sitting as a computer-based test — an ink exam bar with the clock as HH:MM:SS, section tabs, one question at a time with its kind and marks, the palette in the five shapes candidates know from JEE and NEET (not visited, not answered, answered, marked, answered and marked, each counted), Previous · Clear response · Mark for review & next · Save & next pinned under the question, and a summary before submitting. Full-screen code opens under the bar so the clock stays in sight; the dark editor darkens the whole workspace. Also the follow-up panel and the receipt.
- **Before the clock** (`components/Instructions.tsx`): an invitation's first opening shows the paper's instructions — who is sitting it, duration, questions, marks, sections, marking, what the palette's shapes mean, how to move — beside a system check (browser, connection, saving on the device, screen, camera) and a declaration. Reading them starts nothing (`POST /invitations/briefing`); the clock starts at "I am ready to begin". The same instructions open from the exam at any time.
- **Tools** (`components/Tools.tsx`): a strip under the exam bar with the save status for the whole paper, Instructions, a scientific calculator where the exam allows one (`policy.calculator`; parsed by `calc.ts`, never `eval`), rough work kept on the device, A−/A+ text size, light and dark, and keyboard shortcuts (A–D, S, N, P, M, `?`). Warnings at 15, 5 and 1 minute; a plain "Time is up" when it is. On a phone the palette is a bottom sheet and a swipe moves between questions.
- **After, and around the paper** (`components/Finished.tsx`, `components/QuestionPaper.tsx`): a submitted attempt opens on "Submitted", when, and how the paper was left — answered, not answered, marked — with "Print or save as PDF" (a print stylesheet, no PDF library) above the record. "Question paper" in the tool strip lists every question's opening line, marks and state, read-only, and goes to any of them. On a wide screen a coding question opens straight into the full-screen workspace, with the paper's numbers down its left side.
- **Console** (`packages/console/src/styles.css`): the sidebar shell, the exams overview (totals, filters, search, and each exam's candidates sitting, to grade and graded), sign-in, review, results, live sitting, proctoring and invoices.
- **An exam's page** (`components/ExamPage.tsx`): tabs across it — Overview · Questions · Candidates · Live sitting · Results — and down the side where its candidates stand: invited, in progress, completed, to evaluate, and, once it has a qualifying mark, qualified and not qualified, with the test's duration, marks and rules. The Questions tab lists the paper read-only, each question with a preview as the candidate sees it and the right answer marked.
- **Writing an exam** (`components/ExamEditor.tsx`): the title and the paper's questions, marks, time and qualifying mark across the top; then Questions and Settings. Questions are a list — number, kind, stem, marks — each opened to edit or preview, moved up or down, or removed; "Add from bank" slides the question bank in from the right as a library to tick questions from. Settings hold the timing, the qualifying mark (`policy.cutoff`: a share of the paper, and optionally a minimum per section), the candidate's tools and the camera.
- **Try test** (`components/Preview.tsx`): any exam, sat or not, taken as a candidate would — the clock, one question at a time, the palette, Mark for review — in a dialog that sends nothing to the server. At the end it says what the automatically marked questions would have scored.
- **Scorecard** (`components/Results.tsx`): one candidate's page, laid out to print or save as a PDF — the percentage as a ring, Qualified or Not qualified, percentile and rank among the graded, marks by section, each answer with when it was first and last saved, then the follow-ups kept apart as evidence.
- **Ctrl+K** (`components/CommandPalette.tsx`): from anywhere in the console, find an exam, a candidate across every exam by roll number, name or email (`GET /candidates/search`), or a page, and go there with the keyboard.

## Pages

| | Candidate app | | Console |
| --- | --- | --- | --- |
| 01 | [Access code](screenshots/candidate-01-access-code.png) | 01 | [Sign in](screenshots/console-01-sign-in.png) |
| 02 | [Privacy notice (DPDP)](screenshots/candidate-02-privacy-notice.png) | 02 | [Exams: totals, filters and where candidates stand](screenshots/console-02-exams.png) |
| 03 | [Link opened early](screenshots/candidate-03-not-open-yet.png) | 03 | [Exam editor: the question list, one previewed](screenshots/console-03-exam-editor.png) |
| 04 | [Camera notice](screenshots/candidate-04-camera-notice.png) | 04 | [An exam's page: tabs, attempts, and its candidates down the side](screenshots/console-04-exam-attempts.png) |
| 05 | [Camera check](screenshots/candidate-05-camera-check.png) | 05 | [Schedule and invite](screenshots/console-05-invite.png) |
| 06 | [Identity photos](screenshots/candidate-06-identity.png) | 06 | [Results and exports](screenshots/console-06-results.png) |
| 07 | [One question at a time: the exam bar, the palette, Save & next](screenshots/candidate-07-exam.png) | 07 | [Scorecard: qualified, percentile, sections](screenshots/console-07-candidate-report.png) |
| 08 | [A follow-up question](screenshots/candidate-08-follow-up.png) | 08 | [Review an attempt](screenshots/console-08-review.png) |
| 09 | [In Hindi](screenshots/candidate-09-hindi.png) | 09 | [Live sitting](screenshots/console-09-live.png) |
| 10 | [Leaving a section](screenshots/candidate-10-section-leave.png) | 10 | [Proctoring review](screenshots/console-10-proctoring-review.png) |
| 11 | [A section's own clock](screenshots/candidate-11-section-timer.png) | 11 | [Question bank, Word import](screenshots/console-11-question-bank.png) |
| 12 | [Submitted: the counts, a printable page, and the record verified](screenshots/candidate-12-receipt.png) | 12 | [Staff](screenshots/console-12-staff.png) |
| 13 | [On a phone](screenshots/candidate-13-phone.png) | 13 | [API keys](screenshots/console-13-api-keys.png) |
| 14 | [An aptitude paper: pictures, a passage, negative marks, the palette](screenshots/candidate-14-aptitude.png) | 14 | [Spend](screenshots/console-14-spend.png) |
| 15 | [A coding question, full screen with the paper's numbers down the side](screenshots/candidate-15-coding.png) | 15 | [Audit log](screenshots/console-15-audit-log.png) |
| 16 | [Full screen, after Submit](screenshots/candidate-16-workspace.png) | 16 | [Integrations](screenshots/console-16-integrations.png) |
| 17 | [A wrong answer on a hidden test, dark editor](screenshots/candidate-17-wrong-answer.png) | 17 | [Privacy](screenshots/console-17-privacy.png) |
| 18 | [The summary before submitting](screenshots/candidate-18-submit-summary.png) | 18 | [Billing](screenshots/console-18-billing.png) · [GST invoice](screenshots/console-18b-gst-invoice.png) |
| 19 | [A chart to read, in the paper](screenshots/candidate-19-chart.png) | 19 | [Account: password and two-step sign-in](screenshots/console-19-password.png) |
| 20 | [Instructions and system check, before the clock](screenshots/candidate-20-instructions.png) | 20 | [Sign-in: single sign-on and owners' two-step](screenshots/console-20-sign-in-security.png) |
| 21 | [The calculator](screenshots/candidate-21-calculator.png) | | |
| 22 | [Rough work](screenshots/candidate-22-rough-work.png) | | |
| 23 | [The question paper, read-only](screenshots/candidate-23-question-paper.png) | | |
| | | 21 | [Aptitude exam editor](screenshots/console-21-aptitude-editor.png) |
| | | 22 | [Code similarity](screenshots/console-22-code-similarity.png) |
| | | 23 | [A function question in the editor](screenshots/console-23-function-question.png) |
| | | 24 | [Practice site settings](screenshots/console-24-practice-site.png) |
| | | 25 | [Practice problems, published from the bank](screenshots/console-25-practice-problems.png) |
| | | 26 | [Moderating the discussion](screenshots/console-26-practice-discussion.png) |
| | | 27 | [An exam's questions, previewed as the candidate sees them](screenshots/console-27-exam-questions.png) |
| | | 28 | [Try test: the paper as a candidate, nothing saved](screenshots/console-28-try-test.png) |
| | | 29 | [Adding from the library](screenshots/console-29-library-drawer.png) |
| | | 30 | [Ctrl+K: a candidate found across every exam](screenshots/console-30-search.png) |
| | | 31 | [Settings: the qualifying mark](screenshots/console-31-exam-settings.png) |

A practice site (ROADMAP §15), as a learner sees it at `/practice/<site>`:

| | Page |
| --- | --- |
| 01 | [The problem set, with the learner's progress](screenshots/practice-01-problems.png) |
| 02 | [A problem in the workspace, just solved](screenshots/practice-02-workspace.png) |
| 03 | [The editorial, open after solving](screenshots/practice-03-editorial.png) |
| 04 | [Discussion, with a reply from staff](screenshots/practice-04-discussion.png) |
| 05 | [Contests: running and upcoming](screenshots/practice-05-contests.png) |
| 06 | [A contest's ICPC scoreboard](screenshots/practice-06-scoreboard.png) |
| 07 | [Progress: solved, streak, a year's activity](screenshots/practice-07-progress.png) |
| 08 | [The leaderboard](screenshots/practice-08-leaderboard.png) |
| 09 | [Signing up](screenshots/practice-09-sign-up.png) |

The green camera images are Chromium's fake camera, which stands in for a
webcam when the screenshots are taken.

## Regenerating the screenshots

```sh
npm run build:clients && npm run build -w @parikshaa/e2e
npm run screenshots -w @parikshaa/e2e      # needs Postgres, as the e2e tests do
```

`packages/e2e/screenshots/*.shots.ts` seed each page through the API — a
fictitious institution with candidates, graded attempts, a live sitting, a
proctored candidate, staff, keys and a paid invoice — and capture it in
Chromium at 1440×900 (and 390×844 for the phone). They are not part of the e2e
suite. Code is run in-process by the real runner (`E2E_RUNNER=local`), so the
coding screens show real output from real compilers; that needs `python3`,
`node`, `gcc`, `g++` and a JDK on the machine.
