# Supabase: the database in Mumbai

Parikshaa's Postgres runs on Supabase (docs/LAUNCH-PLAN.md §4). The API, the
workers and the code runner run on one VM; Supabase holds only the database
(and, later, uploaded files). Parikshaa does its own sign-in, so Supabase Auth
and Supabase's Data API are not used.

## The projects

| Project | Ref | Region | What it is |
|---|---|---|---|
| `parikshaa-mumbai` | `sjjbicutbofkfatnvczk` | ap-south-1 (Mumbai) | **Parikshaa's database.** Every migration in `packages/store/migrations` up to 0058, except 0054 and 0055 (below) |
| `Parikshaa` | `axowhidnctqdmpuqxibx` | ap-southeast-1 (Singapore) | The owner's earlier app. Read only, as the source of the legacy import; never written to |

The organisation is on Supabase's free plan. Before real candidates, move it
to Pro: daily backups and point-in-time recovery come only with a paid plan.

## No Supabase key opens a table

Supabase gives its API roles every privilege on new tables in `public`:
`anon` and `authenticated` (the publishable key) and `service_role` (the
secret key). Parikshaa uses none of them for its tables: the server connects
as `parikshaa_app` and does its own sign-in. Migration 0056 takes every
privilege on every table, sequence and function away from the first two, and
0058 from `service_role`, now and for whatever later migrations make. So a
leaked key, even the secret one, opens no table. The test in
`packages/store/src/migrate.test.ts` sets up the three roles the way Supabase
does and fails if any can touch a table afterwards.

Checked on the live project on 2 Oct 2026: no grant to any of the three, no
table any can read, and Supabase's security advisor reports nothing. The
default grants left in `public` belong to `supabase_admin` and cover only
objects Supabase itself makes; the migrations run as `postgres`, whose
defaults now grant nothing.

The API keys are not used and need not be kept anywhere. Storage uploads,
when they come, will use the secret key from the VM's environment only. Both
projects' secret keys were shared in a chat on 2 Oct 2026 and are to be
rotated (Project Settings → API Keys); until then, 0058 keeps the Mumbai one
away from every table.

## How the schema got there, and how to keep it current

This environment cannot reach the database over Postgres's own protocol, so
the migrations were applied through the Supabase connector, each batch also
writing its rows into `schema_migrations`, exactly as `npm run migrate` does.
The result was compared with a fresh local database table by table (columns,
defaults, constraints, policies, row-level security, grants, indexes): all 114
tables match.

From the VM, keep it current the ordinary way: `DATABASE_URL=… npm run migrate`
applies whatever is missing.

**0054, 0055, 0059, 0060, 0061 and 0062 are not applied yet.** The connector asks for the owner's
approval before any SQL containing `DELETE` or `DROP` and gives up after a
minute; 0054's function deletes a removed learner's study data and 0055 drops
the removed features' tables; 0059, 0060 (the AI interviewer's tables) and 0062
each drop and remake a check constraint to allow new values. Either the owner
approves them when asked, or `npm run migrate` applies them from the VM.
Three tries through the connector on 2 Oct 2026 ran out of the minute before
any approval came, and changed nothing; 0061 only adds a column.

**From GitHub instead:** Actions → *Migrate* → Run workflow. It needs the
repository secret `PARIKSHAA_DATABASE_URL` (below), stops at once with a plain
message if the secret is empty, and with *dry run* ticked (the default) only
lists what it would apply. Untick it to apply. Like any hand-run workflow, it
appears once it is on the default branch.

## The legacy import

The earlier app has 1,260 coding problems with tests, starter code and
reference solutions. `packages/api/src/legacy-import.ts` turns each into a
practice problem (a program that reads standard input, judged by the same
tests) and `legacy-import-cli.ts` runs it. A dry run of the source on
2 Oct 2026 counted:

- 778 with hidden tests and a reference solution: published at once;
- 482 with no tests (4 of them SQL): brought in unpublished, each with its
  reason in the report, for an author to finish;
- Go and TypeScript starter code is left out: the runner does not run either.

Run it again and it updates what it brought before; it never adds a problem
twice and never touches a problem of the site's own.

**To run it**, from GitHub: Actions → *Legacy import* → Run workflow. GitHub
offers a hand-run workflow only once it is on the default branch, so this
works after the pull request that adds it is merged. It needs two repository
secrets (added by the owner on 2 Oct 2026), each the *session pooler*
connection string from the project's **Connect** panel:

- `LEGACY_DATABASE_URL`: the Singapore project;
- `PARIKSHAA_DATABASE_URL`: the Mumbai project.

Run once with *dry run* ticked, read the report, then again without. It makes
the site `learn` in the organisation `parikshaa` if neither exists, closed to
learners; `admin-cli` gives the organisation its owner.

**Learners are not imported yet.** The earlier app's 28 accounts sign in
through Supabase Auth, whose passwords cannot move. They come across once
learners can set a password from an emailed link, with a notice of the move
sent to each (plan row 92 in docs/PREP-TRACKER.md).
