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
| **Where you hear of new sign-ups** | A pilot should not sign up unnoticed | `SIGNUP_NOTIFY_EMAIL` |

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

### Start it

```bash
git clone https://github.com/deepakvish001/Parikshaa-AI-Upgrade.git parikshaa && cd parikshaa
set -a && . /etc/parikshaa.env && set +a
docker compose up -d --build
docker compose logs -f api        # wait for "listening"; Ctrl-C to stop following
```

The API listens on port 3000 on the machine. Put HTTPS in front with Caddy,
which fetches and renews the certificate itself (`/etc/caddy/Caddyfile`):

```
exam.yourdomain.in {
    reverse_proxy 127.0.0.1:3000
}
```

Close port 3000 to the outside (`ufw allow 80,443/tcp && ufw deny 3000`), so
everything arrives through Caddy — which is what `TRUST_PROXY=true` assumes.

### Backups, before anyone relies on it

Follow *Backups and point-in-time recovery* in `OPERATIONS.md`, then do its
**restore drill once** (`scripts/restore-drill.sh`). A backup never restored
is a hope, not a backup. Keep `PARIKSHAA_DATA_KEY` apart from the backups.

## 3. Check it yourself before the college does

Do the college's whole first day, as them, with an address of your own:

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
- **Every morning, read the pilot report:**

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
- [ ] Results tab → **Email to me** sends the Excel workbook to your own
      address (or **Download Excel**); forward it to the pilot owner. Home
      says whenever attempts are waiting to be graded.
- [ ] Note every question anyone asked you: each is a gap in the product or
      in the guide.

## 6. What to learn from the pilot

Ask the pilot owner, a week after the first sitting:

1. Would you run your next test on Parikshaa? What would stop you?
2. What took longest: writing the exam, inviting, invigilating, or reading results?
3. Did candidates complain about anything? On phones or on lab machines?
4. Did the follow-up questions tell you anything you did not know?
5. What would you pay per attempt, and who approves that spend?

Write the answers down the same day, next to the questions from exam day.
They decide what gets built next.
