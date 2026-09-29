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
  settled number on a white card. What the follow-up questions found sits
  beside it in an amber, left-ruled card, with a stated boundary (SPEC §6.1).
- **Dense where it is used all day, generous where it is read under stress.**
  Console body text is 14px; the candidate app's is 16px, with larger touch
  targets.
- **Nothing observed that is not said.** The typefaces are bundled with the
  app. No font, script or image is fetched from a third party at runtime.
- **Accessible by construction.** Every pair of text and background colours
  meets WCAG 2.1 AA, in both themes. Every control shows a focus ring. The axe
  checks in `packages/e2e/tests/accessibility.spec.ts` run on every change, in
  light and again in dark.

## The mark

प, the first letter of परीक्षा, drawn in white on an ink-indigo tile, with a
saffron bindu above its headline. It is `LogoMark` in
`packages/brand/src/react.tsx`. `Wordmark` sets it beside the name, and takes
an optional product name ("Console"). The mark is decorative wherever the name
is beside it, so screen readers read the name once.

## Tokens (`packages/brand/src/tokens.css`)

Components use tokens, never a literal colour, font size, weight or radius:
`npm run lint:css` (Stylelint, in CI) fails the build on one anywhere but the
tokens file. Dark mode and any later re-theme change only this file.

| Role | Token | Light | Dark | Use |
| --- | --- | --- | --- | --- |
| Canvas · surface | `--bg` · `--surface` | `#f6f7fb` · `#ffffff` | `#0c1020` · `#141a2c` | Page · cards, inputs, the question |
| Text | `--text` | `#131a2e` | `#e8ebf5` | Body and headings |
| Secondary text | `--text-secondary` | `#4f586c` | `#b7bed1` | Descriptions, long helper text |
| Muted text | `--text-muted` | `#5f687c` | `#a1a9bf` | Labels, meta, timestamps, placeholders |
| Disabled | `--text-disabled` · `--disabled-bg` | `#8a93a6` · `#eef0f6` | `#6b748c` · `#1a2136` | Disabled controls, which always say why beside them |
| Primary | `--primary` | `#3346c4` ink indigo | `#8b98fa` | Buttons, links, the current step, focus |
| Accent | `--accent-solid` · `--accent-text` | `#f28c28` · `#a35200` | `#f7a04a` | The bindu, eyebrows, Submit attempt — one saffron action per screen |
| Success | `--success` · `--success-solid` | `#117a57` | `#53c794` · `#2fa874` | Saved, answered, graded, qualified, Save & next |
| Warning | `--warning` | `#9a5800` | `#f1b65c` | Offline, typed but not saved, to grade |
| Danger | `--danger` · `--danger-solid` | `#c23a2b` | `#f2806f` · `#e5604e` | Errors, not answered, not qualified, set aside |
| Review | `--review` · `--review-solid` | `#6b3fd4` | `#b69cff` · `#9c7bf0` | Marked for review, in the exam and Try test only |
| Info | `--info` | `#1f63b8` | `#7fb4f5` | Announcements, tips |
| Chrome | `--chrome` | `#0b1033` | `#10163d` | The exam bar and the console sidebar: ink in both themes |

Every status is a set: text (`--success`), soft (`--success-soft`), border,
**solid** (a fill) and **on-solid** (text on that fill). The solid pair is
separate from the text colour because a colour light enough to read on the
dark surface is too light to carry white text — which is what once made the
exam palette's numbers unreadable in dark (2.1:1). Charts have their own ramps,
`--chart-seq-1…5` and `--chart-cat-1…6`.

`packages/console/src/tokens.test.ts` checks every text and fill pair a
component may use meets WCAG AA in both themes, and that the dark palette is
written once: the system's (`prefers-color-scheme`) and the switch's
(`data-theme="dark"`) blocks are the same list. Any element can carry
`data-theme="dark"` to take the dark palette for itself; the dark code editor
does, inside a light page.

- **Type:** Inter (variable) for Latin; Noto Sans for every Indian script an
  interface language uses (Devanagari 400–700; Bengali, Tamil, Telugu,
  Gujarati, Kannada, Malayalam, Gurmukhi and Oriya 400 and 600); JetBrains
  Mono for code, roll numbers and hashes. All bundled, each face with its
  `unicode-range`, so a page downloads only the scripts it shows. The scale
  runs 11 · 12 · 13 · 14 · 16 · 18 · 22 · 24 · 28 · 36px, each with a role
  (`.t-display`, `.t-title`, `.t-section`, `.t-card`, `.t-body-lg`, `.t-small`,
  `.t-caption`, `.t-overline`, `.t-figure`, `.t-timer`). Numbers that line up
  use tabular figures; the exam clock is Inter, not monospace.
- **Indian scripts:** under `:lang(hi, mr, bn, ta, te, gu, kn, ml, pa, or)`
  nothing is uppercased or letter-spaced (it pulls conjuncts apart), line
  height is 1.75, and emphasis is weight, never italic.
- **Space:** a 4px grid (`--space-0-5` … `--space-16`).
- **Shape:** radii of 2, 4, 6, 8, 12 and 16px, and full.
- **Depth:** `--shadow-xs` to `--shadow-lg`, plus the bar and accent shadows.
- **Icons:** Lucide at a 1.75 stroke (`--icon-stroke`), which matches Inter at
  14–16px better than the default 2.
- **Focus:** a 2px outline in `--focus-color`, offset 2px — an outline, so
  Windows High Contrast keeps it — and white on the ink bars.
- **Theme:** the candidate app and the practice site follow the computer, with
  light and dark in their Display (Aa) menu; the console has System · Light ·
  Dark beside Search. Each is remembered on the device.

## Components (`packages/brand/src/base.css`)

Plain elements are styled directly, so every screen is on-brand by default.
Variants are classes:

| Component | Markup |
| --- | --- |
| Button | `<button>` (primary), `.secondary`, `.quiet`, `.danger`, `.large`, `.block`, `.crumb` (reads as a link) |
| Field | `.field` > `label` + `input`/`select`/`textarea`; `.grid` lays fields out in columns |
| Card | `.card`; a `.bar` as its first child becomes the card's header |
| Table | `<table>` with `<thead>`: sticky header, row hover |
| Badge | `.pill`; `.ok`, `.attention`, `.bad`, `.info`, `.brand`, or `data-state="in_progress"` and the like. Only `.live` and `in_progress` carry a dot: a dot means "happening now" |
| Figures | `<dl class="figures">` of `div > dt + dd`: a row of headline numbers |
| Messages | `.notice` (muted), `.error`, `.problems` (a list of what is wrong), `.alert` |

The interactive pieces are React components in `packages/brand/src/ui.tsx`,
styled by `ui.css`, so they behave the same on every screen:

| Component | Behaviour |
| --- | --- |
| `Dialog` | Modal. Takes focus, keeps Tab inside, closes on Escape or a click outside, stops the page behind from scrolling, gives focus back. Centred, `full` (Try test) or `top` (Ctrl+K). |
| `Drawer` | A `Dialog` sliding in from the right: the question library. |
| `Tabs` + `TabPanel` | Arrow keys move between tabs, Home and End to the ends; only the chosen tab is in the Tab order. Panels are hidden, not unmounted, so what is typed stays. |
| `Tooltip` | Describes its control (`aria-describedby`), on keyboard focus as well as hover; Escape hides it. Icon-only buttons keep their own name. |
| `ToastProvider` / `useToast` | Short confirmations ("Saved …") in a polite live region, bottom right (full width on a phone); gone after four seconds, errors stay until dismissed. |
| `Menu` | A "⋯" button and its list: arrow keys, Home, End and Escape, focus back to the button, the list kept on screen. Items can carry an icon, be disabled with the reason, or be `danger` — set apart by a rule, last, in the danger colour. |

All of it, with the colours, type and plain components, is on the console's
**Design system** page (Ctrl+K → "Design system", or `/console/?gallery`).

Each app adds its own layout on top:

- **Candidate app** (`packages/web/src/styles.css`): the sitting as a computer-based test — an ink exam bar with the clock as HH:MM:SS, section tabs, one question at a time with its kind and marks, the palette in the five shapes candidates know from JEE and NEET (not visited, not answered, answered, marked, answered and marked, each counted), Previous · Clear response · Mark for review & next · Save & next pinned under the question, and a summary before submitting. Full-screen code opens under the bar so the clock stays in sight; the dark editor darkens the whole workspace. Also the follow-up panel and the receipt.
- **Before the clock** (`components/Instructions.tsx`): an invitation's first opening shows the paper's instructions — who is sitting it, duration, questions, marks, sections, marking, what the palette's shapes mean, how to move — beside a system check (browser, connection, saving on the device, screen, camera) and a declaration. Reading them starts nothing (`POST /invitations/briefing`); the clock starts at "I am ready to begin". The same instructions open from the exam at any time.
- **Tools** (`components/Tools.tsx`): a strip under the exam bar with the save status for the whole paper, Instructions, a scientific calculator where the exam allows one (`policy.calculator`; parsed by `calc.ts`, never `eval`), rough work kept on the device, A−/A+ text size, light and dark, and keyboard shortcuts (A–D, S, N, P, M, `?`). Warnings at 15, 5 and 1 minute; a plain "Time is up" when it is. On a phone the palette is a bottom sheet and a swipe moves between questions.
- **After, and around the paper** (`components/Finished.tsx`, `components/QuestionPaper.tsx`): a submitted attempt opens on "Submitted", when, and how the paper was left — answered, not answered, marked — with "Print or save as PDF" (a print stylesheet, no PDF library) above the record. "Question paper" in the tool strip lists every question's opening line, marks and state, read-only, and goes to any of them. On a wide screen a coding question opens straight into the full-screen workspace, with the paper's numbers down its left side.
- **Console** (`packages/console/src/styles.css`): the sidebar shell and the console kit (see *The console* below), sign-in, review, results, live sitting, proctoring and invoices.
- **Home** (`components/Home.tsx`): where the console opens. A greeting and the day's figures; the sittings around now — a month calendar marking the days with one, beside them day by day, open, scheduled or closed in the last week, with how many of those invited have started; the latest actions in words, for those who may read the audit log; and "Get started", the first steps with a progress bar, until they are all done (`GET /dashboard`).
- **An exam's page** (`components/ExamPage.tsx`): tabs across it — Overview · Questions · Candidates · Live sitting · Results — and down the side where its candidates stand: invited, in progress, completed, to evaluate, and, once it has a qualifying mark, qualified and not qualified, with the test's duration, marks and rules. The Questions tab lists the paper read-only, each question with a preview as the candidate sees it and the right answer marked.
- **Writing an exam** (`components/ExamEditor.tsx`): the title and the paper's questions, marks, time and qualifying mark across the top; then Questions and Settings. Questions are a list — number, kind, stem, marks — each opened to edit or preview, moved up or down, or removed; "Add from bank" slides the question bank in from the right as a library to tick questions from. Settings hold the timing, the qualifying mark (`policy.cutoff`: a share of the paper, and optionally a minimum per section), the candidate's tools and the camera.
- **Try test** (`components/Preview.tsx`): any exam, sat or not, taken as a candidate would — the clock, one question at a time, the palette, Mark for review — in a dialog that sends nothing to the server. At the end it says what the automatically marked questions would have scored.
- **Scorecard** (`components/Results.tsx`): one candidate's page, laid out to print or save as a PDF — the percentage as a ring, Qualified or Not qualified, percentile and rank among the graded, marks by section, each answer with when it was first and last saved, then the follow-ups kept apart as evidence.
- **Ctrl+K** (`components/CommandPalette.tsx`): from anywhere in the console, find an exam, a candidate across every exam by roll number, name or email (`GET /candidates/search`), or a page, and go there with the keyboard.

## The candidate's side

What a candidate meets, from the link to the receipt, follows one set of
patterns. Each is built once and used everywhere it applies.

**Before the clock.** Every step before the test is a *Gate* page: a plain
bar (the ink is for the exam) aligned to a single column — a card at 30rem,
reading at 45rem, the instructions at 76rem — and the same stepper on each
step: *Your data · Camera · Instructions · Begin*, with only the steps a test
needs. The briefing API says in advance whether a privacy notice or a camera
is coming, so the order is fixed and every button is honest. None of them
starts the clock; only *I am ready to begin* does. Opening a link early
counts down to the opening and lets the candidate in by itself.

**The exam bar.** One 56 px ink bar (52 px on a tablet or phone). It holds
only what changes during the test: the timer pill in the middle and the way
out on the right. Language, text size, theme and low-bandwidth mode live
behind one *Display* (Aa) menu. The timer pill warns from 15 minutes (the
last quarter of a short section) and turns to danger in the last minute,
with one pulse at each. A section with its own time shows it there, under
the section's name.

**The paper.** The tool strip (44 px) shows the save status on the left.
It is the only place a dropped connection shows: a quiet pill, never a
dialog. When the connection returns, it says how many answers went. The
question card has the number, type, marks and negative-marks chips and
*Mark for review*. Options are 56 px cards; keyboard focus is the card's
ring, separate from its being chosen. The footer sticks. The palette's key
shows *Typed, not saved* only while something is, and folds to a line of
shapes after the first minute. Sections sit above the palette as tabs; the
ones already left stay in sight, locked.

**Tools.** Every tool is a *Tool window*: 360 px, docked to the right of the
question, and stacked when several are open. The title bar moves it. Escape
closes the newest, and focus goes back to the tool's button.

**On a phone.** One bar, and a strip with *Questions* and *Tools*. Tools
open a bottom sheet in a 3 × 2 grid, with Display among them, and each tool
opens as a sheet the height of the screen. The palette is a sheet, six
questions to a row, half height or full from its handle. The footer is one
64 px row: Previous (an arrow), "⋯" for Clear response, Mark, and a wide
Save & next. Short labels are always part of the long ones, which remain
the accessible names. A long label wraps to two lines; it is never clipped.

**The end.** The submit summary is a table with a row per section and the
total. Each column is headed by its palette shape. Focus starts on *Keep
working*, and Submit is the same saffron as the bar's button. When time
runs out, a calm full screen (no red) says when the saved answers went in,
then opens the record after five seconds. The receipt names each entry in
words (*Answer saved · question 3*), folded behind *Show all N entries*.

**Every language.** All of the above is in the eleven interface languages
and is checked by eye in Hindi and Tamil (see *Guarding the look*). Indic
scripts get no capitals and no tracking, a 1.75 line height, and emphasis
by weight. Components grow to fit rather than truncate.

## The console

The console follows one kit (`packages/console/src/components/kit.tsx`,
styled in `styles.css` under "the console kit"), so a page reads the same
wherever it sits.

**The page header.** Every page is a `PageFrame`: the title once, a status
chip beside it, one meta line under it, and its actions on the right. A
panel fills those from wherever it is, with `PageStatus`, `PageMeta` and
`PageActions`; the purpose line shows while no meta line does. An exam's
page is headed by the exam — *Campus Drive 2026 — Aptitude* · *Open now* ·
*Open until 1 Oct, 1:00 pm IST · 60 min · 6 marks · qualifies at 50%* —
with its tabs under it, and the breadcrumb above names where it sits. No
card repeats the page's title.

**Figures.** A `FigureStrip` holds up to four headline figures, then a line
of the lesser ones. Four sit in one row, or two by two below 64rem; three
stay in one row. No row leaves a tile on its own. A figure is coloured only
when it asks something of the reader (*To grade 4*), and one that counts
something opens it.

**Tables.** Headers in small uppercase; roll numbers in mono; numbers right
aligned; the row's one visible action, then "⋯" (`RowMenu`) for the rest,
named for the row (*More actions for CS004*). A row with nothing more to
offer keeps the menu's width, so the actions line up. On a phone a table
scrolls sideways inside its card; the page never does.

**Words and badges.** One glossary, the same on every page:

| Of | Words |
| --- | --- |
| An attempt (`StateBadge`) | Not started · In progress (the dot) · To grade · Graded · Set aside |
| An outcome (`OutcomeBadge`) | Qualified · Not qualified, with an icon, never colour alone |
| An exam (`PhaseBadge`) | Draft · Scheduled · Open now (the dot) · Closed |
| Other terms | *Roll no.*, *Withdraw* (an invitation), *Scorecard*, *Set aside* (never "void") |

**Empty and loading.** Every list has an `EmptyState` (an icon, one line on
what will appear, and the action that fills it) and `SkeletonRows` while it
loads, in place of a bare "no results" or a spinner. Warnings sit in a
`Banner`, imports in a `DropZone`.

**The pages.**

- **Exams:** filters (All, Open now, To grade, Scheduled, Draft, Closed,
  Archived), search, and a table with each exam's phase and where its
  candidates stand. "⋯" holds Edit (disabled, with the reason, once
  candidates have sat it), Make a copy, Try test, and Archive or Bring back
  from the archive (`PUT /exams/:id/archived`).
- **Live sitting:** a `StatBar` of where everyone stands (not started, in
  progress, away, idle, submitted), in the chart colours with a key, and the
  candidates below with how long since each was seen.
- **Results** and the **Scorecard:** the figure strip, the marks as a
  histogram with the qualifying mark drawn on it, then the candidates. The
  scorecard prints on A4 without the console's chrome.
- **Writing an exam:** two panes, the question list on the left and the
  chosen question on the right, with a bar at the bottom that says what has
  changed. Leaving with unsaved changes asks first (*Leave without saving?*).
- **Question bank:** difficulty as a badge, and Word and spreadsheet imports
  through the drop zone; a Word paper is shown question by question before
  any of it is added.
- **Settings** (Staff, API keys, Spend, Audit log, Integrations, Privacy,
  Billing, Sign-in, Account): each group is a `SettingsGroup`, its title
  and a line on what it does in the left third and its controls in a card
  on the right. A table that needs the width puts the line above it
  (`stacked`), and a group that removes or undoes something is a *Danger
  zone*, last. Secrets shown once are a `SecretField`.

## One word per thing

The same thing has one name on every page of both apps, in the spreadsheet
exports and in the audit log. Stored values ("void", "mcq", "in_progress")
never reach a screen or a spreadsheet as they are.

| Thing | Say | Not |
| --- | --- | --- |
| An attempt that is running | In progress | Sitting now, taking it |
| Submitted, not yet graded | To grade | To evaluate |
| A voided attempt | Set aside | void |
| A candidate's identifier | Roll number (header "Roll no.") | Ref, candidate reference |
| One candidate's page | Scorecard | Report |
| Question types (console) | Multiple choice, Numeric, Written, Coding | mcq, numeric, short, code |
| Question types (candidate) | Single correct, Multiple correct, Numerical answer, Written answer, Coding | (the terms of JEE papers, kept) |
| When a test is open | Window | Sitting window, slot |
| The follow-up | Follow-up question | viva, probe |
| An outcome | Qualified, Not qualified | passed, failed |
| An invitation taken back | Withdraw | Revoke |

The results spreadsheet (CSV and Excel) heads its first column "Roll no." and
writes states and outcomes in these words. Every action the API can record has
its words in the audit log (`describeAction` in the console's `Home.tsx`), and
`components/actions.test.ts` reads the API's source to fail on one that has
none. A candidate's receipt names each entry in words too ("Answer saved ·
question 3", "Follow-up question answered").

## The practice site

A learner's site (`/practice/<site>`) is the exam's workspace with progress
around it, on the same tokens and components.

- **The bar** is the exam's structure on a light surface: the name, the site,
  the menu, the learner and Display, within the page's width on every page, so
  the bar and the page start and end at the same edges. The menu scrolls rather
  than overlapping when the row is short.
- **Problems:** topic chips with their counts, filters that say what they
  filter, a header over every column. On a phone each problem is a two-line
  card and the progress one line.
- **The workspace** is the exam's `CodeAnswer`, so a learner practises on what
  they will be tested on. Its editorial and discussion read at 45rem, and code
  blocks there have a Copy button (`Markdown`'s `copy`; exam questions have
  none).
- **Contests:** Live, Upcoming or Ended as a chip, a dot only on Live. The
  scoreboard has three states from tokens (first to solve on the success fill,
  solved, tried), each cell said in words to a screen reader, and rank and name
  stay put while the problems scroll on a phone.
- **Progress:** the year as a heatmap on the sequential chart ramp, the last 16
  weeks on a phone, with the days and counts also said in words. The
  leaderboard's top three wear accent rank chips, not medals, and the learner's
  own row stays in sight.

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
| | | 32 | [Home: sittings, activity, first steps](screenshots/console-32-home.png) |
| | | 33 | [The design system page](screenshots/console-33-design-system.png) |
| | | 34 | [A drawer and a toast](screenshots/console-34-drawer-and-toast.png) |

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
| 10 | [On a phone: the problems as cards](screenshots/practice-10-phone-problems.png) |
| 11 | [On a phone: the scoreboard, rank and name held](screenshots/practice-11-phone-scoreboard.png) |

The green camera images are Chromium's fake camera, which stands in for a
webcam when the screenshots are taken.

## Guarding the look and the weight

Three checks in CI keep the detail from drifting:

- **Visual regression** (`packages/e2e/visual`): every page a candidate
  meets, compared pixel by pixel with the images committed in
  `visual/__screenshots__`. That is the access code, the privacy notice, a
  link opened early, the instructions, a question, the submit summary and
  the record, each on a laptop (1440) and a phone (390), in light and dark,
  and in English, Hindi and Tamil: 84 images. The console has 25 more
  (`visual/screens.visual.ts`), seeded in an organisation of their own: sign-in,
  home, exams, an exam's overview, live sitting, results, the editor, the
  question bank and staff at 1440 in light and dark; sign-in, exams, an
  exam's overview, results and live sitting on a phone; and the design
  system in both themes.
  Only what changes from run to run is masked: the clocks, the dates, the
  hashes and the measured connection. At most 100 pixels may differ, with a
  tight per-pixel tolerance, so a shift of colour or a new control is
  caught, not only a broken layout. A change to how any of them looks fails
  until the images are updated on purpose: run
  `npm run visual:update -w @parikshaa/e2e`, then review and commit the
  images with the change.
- **Lighthouse** (`packages/e2e/perf`): its mobile run — a mid-range phone
  on slow 4G — on the candidate's access page and the console's sign-in.
  Performance must stay at 85 or above, accessibility at 100, best practices
  at 95.
- **Bundle budget** (`bundle-budget.json`, `npm run budget`): every built
  JavaScript and CSS file against a gzipped cap; a file with no budget fails
  too. The candidate's entry is about 136 KB of script (with React 19) and
  18 KB of style: English and Hindi come with the page, and the other nine
  languages load when chosen. The console is about 174 KB of script and
  17 KB of style; its practice admin loads when opened.

Two more checks keep the pages usable without a mouse or a screen:

- **Keyboard** (`packages/e2e/tests/keyboard.spec.ts`): a candidate sits a
  whole paper with the keyboard alone (the declaration, the A–D and S
  shortcuts, a follow-up reply, a written answer, the submit summary), and an
  examiner signs in, reaches an exam and works its "⋯" menu. At every Tab
  stop the test checks the focus can be seen.
- **Screen reader** (the same file): the exam's landmarks, the question as a
  heading with a named group of options, a palette that says each question's
  state in words, and a clock read out as time left.

axe runs on every page in both themes (`accessibility.spec.ts`, and the
practice site in `practice.spec.ts`). The browser tests run in Chromium,
Firefox and WebKit in CI.

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
