# Supabase: the database in Mumbai

Parikshaa's Postgres runs on Supabase (docs/LAUNCH-PLAN.md §4). The API, the
workers and the code runner run on one VM; Supabase holds only the database
(and, later, uploaded files). Parikshaa does its own sign-in, so Supabase Auth
and Supabase's Data API are not used.

## The projects

| Project | Ref | Region | What it is |
|---|---|---|---|
| `parikshaa-mumbai` | `sjjbicutbofkfatnvczk` | ap-south-1 (Mumbai) | **Parikshaa's database.** Every migration in `packages/store/migrations` up to 0057, except 0054 and 0055 (below) |
| `Parikshaa` | `axowhidnctqdmpuqxibx` | ap-southeast-1 (Singapore) | The owner's earlier app. Read only, as the source of the legacy import; never written to |

The organisation is on Supabase's free plan. Before real candidates, move it
to Pro: daily backups and point-in-time recovery come only with a paid plan.

## Nothing is served to the public key

Supabase gives its API roles, `anon` and `authenticated`, every privilege on
new tables in `public` and serves them to anyone holding the project's
publishable key. Migration 0056 takes every privilege away from both roles,
on every table, sequence and function, now and for whatever later migrations
make. The test in `packages/store/src/migrate.test.ts` sets up those roles
the way Supabase does and fails if either can touch a table afterwards.

Checked on the live project on 2 Oct 2026: no grant to either role, no table
either can read, and Supabase's security advisor reports nothing.

## How the schema got there, and how to keep it current

This environment cannot reach the database over Postgres's own protocol, so
the migrations were applied through the Supabase connector, each batch also
writing its rows into `schema_migrations`, exactly as `npm run migrate` does.
The result was compared with a fresh local database table by table (columns,
defaults, constraints, policies, row-level security, grants, indexes): all 114
tables match.

From the VM, keep it current the ordinary way: `DATABASE_URL=… npm run migrate`
applies whatever is missing.

**0054 and 0055 are not applied yet.** The connector asks for the owner's
approval before any SQL containing `DELETE` or `DROP` and gives up after a
minute; 0054's function deletes a removed learner's study data and 0055 drops
the removed features' tables. Either the owner approves them when asked, or
`npm run migrate` applies both from the VM.

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

**To run it**, from GitHub: Actions → *Legacy import* → Run workflow. It needs
two repository secrets, each the *session pooler* connection string from the
project's **Connect** panel:

- `LEGACY_DATABASE_URL`: the Singapore project;
- `PARIKSHAA_DATABASE_URL`: the Mumbai project.

Run once with *dry run* ticked, read the report, then again without. It makes
the site `learn` in the organisation `parikshaa` if neither exists, closed to
learners; `admin-cli` gives the organisation its owner.

**Learners are not imported yet.** The earlier app's 28 accounts sign in
through Supabase Auth, whose passwords cannot move. They come across once
learners can set a password from an emailed link, with a notice of the move
sent to each (plan row 92 in docs/PREP-TRACKER.md).
