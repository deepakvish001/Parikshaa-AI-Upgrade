# Running a pilot

Everything needed to put Parikshaa in front of its first college: the
decisions to make, the server, the checks before the college is told, the
first exam day, and what to learn afterwards. `OPERATIONS.md` has the detail
behind each step (sizing, backups, billing); this is the order to do them in.

The college's side is in [`pilot/COLLEGE-GUIDE.md`](pilot/COLLEGE-GUIDE.md)
(in Hindi: [`pilot/COLLEGE-GUIDE.hi.md`](pilot/COLLEGE-GUIDE.hi.md)): send it
to them once the server is ready. Both have the same two blanks to fill in
first: the console's address and your contact details.

## 1. Decide first

| Decision | Why it matters | Where it goes |
|---|---|---|
| **The college**, and one person there who owns the pilot | Someone has to answer "is this working?" in a week | — |
| **Price per attempt** (₹, before GST) | Charged once the free attempts are used | `SIGNUP_PRICE_RUPEES` |
| **Free attempts** | Enough for their first real batch; 25 by default | `SIGNUP_TRIAL_CREDITS` |
| **The address** candidates open, e.g. `exam.yourdomain.in` | It is in every invitation; changing it later breaks sent links | `PUBLIC_URL` |
| **Email sender** (SMTP), e.g. Amazon SES in Mumbai | Owners confirm their address, and candidates get their links by email | `SMTP_URL`, `EMAIL_FROM` |
| **Where you hear of new sign-ups**, and get the pilot report each morning | A pilot should not sign up, or stall, unnoticed | `SIGNUP_NOTIFY_EMAIL` |
| **WhatsApp** (optional): a WhatsApp Business number on the Cloud API, with the four templates below approved | Most students read WhatsApp before email; links, reminders and results reach them there | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` |

Set the price from a measurement, not a guess: with a real API key,
`npm run cost-run` (see *Measuring what an attempt costs* in
`OPERATIONS.md`) prints what one attempt costs in model calls. Price well
above it; follow-up questions and grading are the cost.

## 2. The server

For a pilot of a few hundred candidates, one machine is enough (one API
instance served 1,000 candidates in the load test):

- **4 vCPU, 8 GB RAM, 50 GB disk**, Ubuntu 24.04, in an Indian region
  (Mumbai or Hyderabad) — candidates' answers are personal data under DPDP.
- **Docker** with the Compose plugin, and **gVisor** (`runsc`) for the code
  runner: <https://gvisor.dev/docs/user_guide/install/>. The runner refuses
  to start without it. With no code questions in the pilot, it can wait.
- **A domain** pointing at the machine, and HTTPS in front (below).

### The quick way: one command

On a fresh Ubuntu 22.04 or 24.04 machine, with the domain already pointing
at it:

```bash
git clone https://github.com/deepakvish001/Parikshaa-AI-Upgrade.git parikshaa
cd parikshaa && sudo ./scripts/setup-server.sh
```

It asks for the domain, your email, the Anthropic key, the email sender and
the price, and does everything in the rest of this section: Docker, gVisor,
`/etc/parikshaa.env` with fresh secrets, the service, HTTPS through Caddy, a
firewall, a nightly backup (with a first one straight away), and the server
check. Run it again to rebuild and restart after pulling a new version: it
keeps the settings and never makes new secrets. Set `BACKUP_UPLOAD` in
`/etc/parikshaa.env` to copy each backup off the machine. **Copy
`/etc/parikshaa.env` somewhere safe as soon as it is written.**

The steps below are what it does, for doing them by hand.

### Secrets and settings

Keep these in a file only root can read (`/etc/parikshaa.env`, mode 600), and
keep a copy somewhere else — **losing `PARIKSHAA_DATA_KEY` loses every sealed
answer**:

```bash
# Database
POSTGRES_PASSWORD=$(openssl rand -base64 24)
PARIKSHAA_APP_PASSWORD=$(openssl rand -base64 24)

# The service's own secrets
ATTEMPT_TOKEN_SECRET=$(openssl rand -base64 36)   # 32+ characters; links, codes and webhook secrets derive from it
PARIKSHAA_DATA_KEY=$(openssl rand -base64 32)      # seals answers; never in the database's backups
RUNNER_TOKEN=$(openssl rand -base64 36)

# The model
ANTHROPIC_API_KEY=...

# Where candidates go, and email
PUBLIC_URL=https://exam.yourdomain.in
SMTP_URL=smtps://USER:PASS@email-smtp.ap-south-1.amazonaws.com
EMAIL_FROM="Parikshaa <no-reply@yourdomain.in>"

# The pilot: institutions sign themselves up
SELF_SIGNUP=on
SIGNUP_PRICE_RUPEES=49
SIGNUP_TRIAL_CREDITS=25
SIGNUP_NOTIFY_EMAIL=you@yourdomain.in

# Behind the reverse proxy below
TRUST_PROXY=true
```

`openssl rand` must be run once and the values written down, not left as
commands in the file.

### SMS and WhatsApp (optional)

**SMS** goes through MSG91 with a DLT-registered template
(`MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`; see `delivery.ts`).

**WhatsApp** goes through Meta's WhatsApp Business Cloud API. A message a
business starts must use a template approved in advance, so before the first
invitation:

1. In Meta's WhatsApp Manager, add a phone number and create a permanent
   access token (a system user's) with `whatsapp_business_messaging`.
2. Create these four templates, category **Utility**, language **English**
   (`en`; set `WHATSAPP_LANGUAGE` if you register them under another code,
   such as `en_US`). The names must match; the wording can be yours as long
   as the numbered variables mean the same.

| Name | Body |
|---|---|
| `parikshaa_invite` | Hello {{1}}, {{2}} has invited you to take the {{3}} test. It opens {{4}} and closes {{5}}. Your personal link, for you alone: {{6}} |
| `parikshaa_reminder` | Hello {{1}}, a reminder: your {{2}} test with {{3}} {{4}}. Your personal link: {{5}} |
| `parikshaa_rescheduled` | Hello {{1}}, the time of your {{2}} test with {{3}} has changed. It now opens {{4}} and closes {{5}}. Your link stays the same: {{6}} |
| `parikshaa_result` | Hello {{1}}, {{2}} has released the results of the {{3}} test. Your marks: {{4}} out of {{5}} ({{6}}%). {{7}} Your record of the test: {{8}} |

3. Set `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` (and, for a partner
   that speaks the same API, such as 360dialog, `WHATSAPP_API_URL`), then
   restart. Invite yourself with **WhatsApp** ticked before inviting anyone
   else: a template that is not approved yet shows on the Candidates tab as
   *not sent*, with Meta's reason.

Staff choose WhatsApp per import, beside email and SMS. Results go by email
and WhatsApp both, where each is set up and the candidate gave an address or
a mobile number.

![Inviting a batch by email, SMS and WhatsApp](screenshots/pilot-01-invite-by-whatsapp.png)
![Sending results: who it will reach, and how](screenshots/pilot-02-send-results.png)

### Start it

Add `API_ADDRESS=127.0.0.1:3000` to `/etc/parikshaa.env`, then:

```bash
git clone https://github.com/deepakvish001/Parikshaa-AI-Upgrade.git parikshaa && cd parikshaa
docker compose --env-file /etc/parikshaa.env up -d --build
docker compose --env-file /etc/parikshaa.env logs -f api   # wait for "listening"; Ctrl-C to stop following
```

The API listens on port 3000, on this machine only. Put HTTPS in front with
Caddy, which fetches and renews the certificate itself (`/etc/caddy/Caddyfile`):

```
exam.yourdomain.in {
    reverse_proxy 127.0.0.1:3000
}
```

Everything then arrives through Caddy, which is what `TRUST_PROXY=true`
assumes. `API_ADDRESS` is what keeps port 3000 closed to the outside: a
firewall rule alone (`ufw deny 3000`) does not, because Docker's published
ports go around ufw. Allow only SSH, 80 and 443 in (`ufw allow OpenSSH`,
`ufw allow 80,443/tcp`, `ufw enable`).

### Backups, before anyone relies on it

`scripts/backup.sh` dumps the database into `/var/backups/parikshaa` and keeps
14 days of dumps; the setup script runs it nightly from cron. Follow *Backups and point-in-time
recovery* in `OPERATIONS.md` for continuous archiving, then do its
**restore drill once** (`scripts/restore-drill.sh`). A backup never restored
is a hope, not a backup. Keep `PARIKSHAA_DATA_KEY` apart from the backups.

## 3. Check it yourself before the college does

**First, the server check**, from any machine with Node 20 and this
repository, after every deploy:

```bash
npm run smoke -- https://exam.yourdomain.in
SMOKE_EMAIL=you@yourdomain.in SMOKE_PASSWORD='…' npm run smoke -- https://exam.yourdomain.in
```

The first line checks what anyone can reach: the service answers, the
candidates' page and the console load with their security headers, HTTPS,
and whether sign-up is open. With an account it also signs in, writes a
two-question exam, sits it as a candidate, has it graded (the written answer
by the model, so the API key is checked), asks for the results by email, and
archives the exam. Use an owner in an organisation you made with
`admin-cli`, so the check spends no one's credits; `SMOKE_CODE` carries a
second-factor code if the account has one. Each step prints ✓ or ✗ and why,
and it exits non-zero if any failed. Check the results email arrives.

Then do the college's whole first day by hand, as them, with an address of
your own:

1. Open `https://exam.yourdomain.in/console/`. The sign-in page shows
   **"Make your institution's account"** — if not, `SELF_SIGNUP` is not on.
2. Make an account. You are signed in and the tour starts; the **"Confirm your
   email address"** banner is at the top.
3. The confirmation email arrives (check spam), and so does the
   **"New institution"** notice at `SIGNUP_NOTIFY_EMAIL`. Open the link: the
   banner goes.
4. **Load the sample exam**, then **Try it as a candidate**.
5. Schedule the sample for the next hour (the exam's Candidates tab), invite
   yourself with a two-line spreadsheet, and open the link from the email **on
   a phone**. Sit it; answer the written question properly, so a follow-up
   question is likely.
6. Back in the console: the exam's **Results** tab says one attempt is to
   grade. **Grade all**, then open the scorecard and read the report.
7. The home page shows the credits you have left.
8. Delete nothing — put the sample away from Home, and note the organisation's
   id in the audit log's first line, to remove it later if you wish.

If any step fails, fix it before the college sees it. `docker compose logs api`
says what the server saw, a line per request, with no answers or addresses in
it.

## 4. The college's first days

- Send them [`pilot/COLLEGE-GUIDE.md`](pilot/COLLEGE-GUIDE.md) (or its text
  in an email) and the console's address.
- **Every morning, read the pilot report.** It arrives by email at
  `SIGNUP_NOTIFY_EMAIL` soon after 8 am IST (the subject says how many
  organisations need you); to see it at any other time:

  ```bash
  docker compose exec api npm run -s pilot-report -w @parikshaa/api
  ```

  It lists each organisation (owner, exams, candidates invited and started,
  attempts graded and waiting, credits left, the next sitting), those that
  need something from you first. A line starting `!` is for today:

  | It says | Do |
  |---|---|
  | The owner has not confirmed their email after N days | Call them: the email is probably in spam |
  | Only N attempts left, or a sitting with more candidates than credits | `billing grant`, below, before the sitting |
  | N messages could not be sent | The exam's Candidates tab names the address and the reason |
  | N messages overdue | The API is not sending: `docker compose ps`, then `docker compose logs api` |

  Lines starting `·` are worth knowing (attempts to grade, no exam yet, a
  quiet week), not urgent. `-- --json` prints the same as JSON. The report
  names owners and their addresses: keep it to your own terminal.
- When the "New institution" notice arrives, check the owner confirmed their
  email within the day; if not, call them — the email may be in spam.
- **More free attempts** for a pilot that needs them, without a payment:

  ```bash
  docker compose exec api npm run billing -w @parikshaa/api -- show <org id>
  docker compose exec api npm run billing -w @parikshaa/api -- grant <org id> 100 "pilot batch"
  ```

  The organisation's id is in the notice email.
- Before their first real sitting, ask them to run it as you did in step 3:
  a two-person trial with their own staff, a week ahead.

## 5. Exam day

### The day before

- [ ] The exam's window is set, and candidates are invited — the exam's
      Candidates tab shows, for each, whether the email was sent or failed.
      **Download links** there too, as a fallback to hand out. Invite at
      least a day ahead: each candidate is reminded the day before and an
      hour before the window opens.
- [ ] Credits cover the batch: Home warns at five left, and the pilot report
      flags a sitting with more candidates than credits. `billing show` to be sure.
- [ ] The model provider's rate limit covers the batch's follow-ups and
      grading (see *Sizing* in `OPERATIONS.md`).
- [ ] Last night's backup exists.
- [ ] You and their pilot owner have each other's phone numbers.

### An hour before

- [ ] `https://exam.yourdomain.in/api/health` answers.
- [ ] Someone opens a test invitation on a phone and on a lab machine.
- [ ] The invigilators are signed in and have the exam's **Live** tab open.

### A sitting in a lab

On the exam's **Live** tab, **Lab mode → Change**, from a machine in the lab:

- **Networks**: **Add it** puts this machine's public address in the list;
  add the college's full range if its labs leave by more than one. Outside
  them, a candidate's link says the test is for the exam room, and a
  candidate who carries on from outside is stopped, until the window closes.
  A list that leaves out the address of whoever saves it is refused.
- **Candidates wait for the invigilator**: opening a link shows "Waiting for
  the invigilator" until **Start the test for everyone**; each candidate's
  own clock starts as they begin. Turning waiting off and on again holds the
  next batch.

It checks where requests come from, as the college's router presents them:
behind Caddy this needs `TRUST_PROXY=true` (setup-server.sh sets it), and a
VPN into the college satisfies it. It keeps an honest room honest; it does
not prove anyone is in it. Both changes are audited.

| Setting it, from the lab | What a candidate sees until the start | The start button |
|---|---|---|
| ![Lab mode settings](screenshots/pilot-03-lab-mode-settings.png) | ![Waiting for the invigilator](screenshots/pilot-04-candidate-waiting.png) | ![Start the test for everyone](screenshots/pilot-05-lab-start-for-everyone.png) |

Opened anywhere else, the link says so: ![Exam room only](screenshots/pilot-06-candidate-exam-room-only.png)

### During

The **Live** tab shows every candidate, where they are in the test, and when
their page last checked in.
What to do when:

| It happens | Do |
|---|---|
| A candidate's connection drops | Nothing is lost: answers are saved as they type. They reopen the same link, on any device, and carry on. |
| A candidate lost their link | Candidates tab → the candidate's ⋯ → **Resend the link**; or give them the access code to type at the site's address. |
| The college moves the test to another day or time | Candidates tab → change the times → **Reschedule**. Everyone invited who has not begun moves with it, is told the new time, and is reminded for it; links stay the same. Do it as early as possible. |
| A candidate needs more time (a fault at one desk) | Live → the candidate's ⋯ → **Extra time…**, with the reason. It is recorded. |
| The whole hall lost time (a power cut) | Live → **Extra time for everyone**: the same minutes, with one reason, for everyone still sitting. Each is recorded. |
| A candidate submitted too early by mistake | Live → the candidate's ⋯ → **Reopen…**, for a few minutes, with the reason. |
| Everyone needs to know something | Live → **Announce** → **Send to everyone**: it appears on every open page. |
| "No attempts left" when a candidate starts | `billing grant` as above; they try again at once. |
| Follow-up questions stop appearing | The model is slow or unreachable. The test carries on; answers are saved. Tell no one — follow-ups are extra evidence, not the test. |
| The site does not answer | `docker compose ps`, then `docker compose restart api`. Attempts continue where they were: the clock is kept on the server. |

### After

- [ ] Results tab → **Grade all**: every submitted attempt, a few at a
      time, with progress as it goes. Multiple-choice and numeric answers are
      marked at once; written answers are read by the model, a few seconds
      each. Any it cannot grade are named, to open one by one.
- [ ] Read a few reports end to end, follow-ups included.
- [ ] When the college is ready, Results tab → **Send results to candidates…**:
      each graded candidate gets their marks by email, and by WhatsApp where
      it is set up and they gave a mobile number (and,
      if the exam has a qualifying mark and the college wants it said,
      whether they reached it), with a link to their record. Nobody is sent
      theirs twice, so it can be pressed again after grading the rest.
- [ ] Before releasing, read the written answers: Results tab → **Written
      answers → Start marking** shows each graded answer to a written or code
      question, one after another and without names, with the rubric and the
      mark the model gave. Enter keeps or saves the mark and moves on; J and K
      move without saving. A changed mark goes into the record with who
      changed it; the card counts how many a person has read.

      ![Marking written answers](screenshots/pilot-12-marking-by-hand.png)
- [ ] From then, each candidate's own link shows **Your result**: marks
      question by question, and **Download scorecard (PDF)**. The scorecard
      carries a QR code and a link that anyone — an employer — can open to see
      the result as it stands in the record, or that it was withdrawn.
- [ ] For a week after the release, a candidate may **ask for a recheck** of
      up to three questions, saying why. Requests appear on the Results tab
      under **Rechecks asked for**, with the answer each is about. Answer with
      the mark as it should stand and a reply: a changed mark goes into the
      attempt's record with who changed it and why, the candidate's receipt
      shows it, and they are emailed the reply.

| The candidate's result, and a recheck | Answering it | The scorecard, and what its code opens |
|---|---|---|
| ![Your result](screenshots/pilot-07-candidate-result-and-recheck.png) | ![Rechecks asked for](screenshots/pilot-08-recheck-in-the-console.png) | ![Scorecard PDF](screenshots/pilot-10-scorecard-pdf.png) ![Scorecard check](screenshots/pilot-11-scorecard-check.png) |
- [ ] Results tab → **Email to me** sends the Excel workbook to your own
      address (or **Download Excel**); forward it to the pilot owner. Home
      says whenever attempts are waiting to be graded.
- [ ] Note every question anyone asked you: each is a gap in the product or
      in the guide.

### Across tests: Insights

**Insights** in the console's sidebar is for a placement cell running a term
of drives:

- **Candidates across tests** lines up every candidate by roll number with
  their percentage in each graded test (the latest twelve), their average,
  and the change from their first to their latest. Search by a roll-number
  prefix (such as a branch's, `CS`) or a name; **Download CSV** takes it away.
  The same roll number in two tests is taken to be the same student.
- **Question quality** reads the questions of recent tests with eight or more
  graded papers, and lists those worth a second look before they are used
  again: almost everyone got it, very few did, or strong candidates did no
  better than weak ones.

| Candidates across tests | Question quality |
|---|---|
| ![Candidates across tests](screenshots/pilot-13-candidates-across-tests.png) | ![Question quality](screenshots/pilot-14-question-quality.png) |

## 6. What to learn from the pilot

Candidates are asked two things after submitting: how the test went (1 to
5) and anything that got in the way. Answering is optional and the college
sees it without names: the exam's **Results** tab shows the ratings and every
comment, and the pilot report shows each organisation's average (and flags a
poor one). Read the comments before the conversation below — a pattern in
them (phones, the lab network, the follow-up question) is the first thing to
ask about.

Ask the pilot owner, a week after the first sitting:

1. Would you run your next test on Parikshaa? What would stop you?
2. What took longest: writing the exam, inviting, invigilating, or reading results?
3. Did candidates complain about anything? On phones or on lab machines?
4. Did the follow-up questions tell you anything you did not know?
5. What would you pay per attempt, and who approves that spend?

Write the answers down the same day, next to the questions from exam day.
They decide what gets built next.
