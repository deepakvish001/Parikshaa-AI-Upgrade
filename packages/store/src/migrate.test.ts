import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "./migrate.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

let db: PGlite;
let sql: SqlExecutor;
let dir: string;

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  dir = await mkdtemp(join(tmpdir(), "parikshaa-migrations-"));
});

afterEach(async () => {
  await db.close();
});

const write = (name: string, body: string) => writeFile(join(dir, name), body, "utf8");

describe("migrate", () => {
  it("applies migrations in filename order", async () => {
    await write("0002_second.sql", "ALTER TABLE widgets ADD COLUMN label text;");
    await write("0001_first.sql", "CREATE TABLE widgets (id int primary key);");

    const result = await migrate(sql, dir);

    expect(result.applied).toEqual(["0001_first.sql", "0002_second.sql"]);
    const columns = await sql.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'widgets' ORDER BY column_name`,
    );
    expect(columns.map((c) => c.column_name)).toEqual(["id", "label"]);
  });

  it("is idempotent across runs", async () => {
    await write("0001_first.sql", "CREATE TABLE widgets (id int primary key);");

    expect((await migrate(sql, dir)).applied).toEqual(["0001_first.sql"]);
    const second = await migrate(sql, dir);

    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(["0001_first.sql"]);
  });

  it("applies a later migration added after the first run", async () => {
    await write("0001_first.sql", "CREATE TABLE widgets (id int primary key);");
    await migrate(sql, dir);

    await write("0002_second.sql", "CREATE TABLE gadgets (id int primary key);");
    expect((await migrate(sql, dir)).applied).toEqual(["0002_second.sql"]);
  });

  it("records nothing when a migration fails", async () => {
    await write("0001_broken.sql", "CREATE TABLE widgets (id int primary key); SELECT nonexistent();");

    await expect(migrate(sql, dir)).rejects.toThrow();

    // The whole file runs in one transaction, so a failure halfway leaves
    // neither the partial schema nor a row claiming it was applied.
    const recorded = await sql.query(`SELECT name FROM schema_migrations`);
    expect(recorded).toEqual([]);
    const tables = await sql.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'widgets'`,
    );
    expect(tables).toEqual([]);
  });

  it("applies this repository's own migrations", async () => {
    const { applied } = await migrate(sql);

    expect(applied).toEqual([
      "0001_init.sql",
      "0002_roles.sql",
      "0003_tenancy.sql",
      "0004_resilience.sql",
      "0005_question_bank.sql",
      "0006_invitations.sql",
      "0007_integrations.sql",
      "0008_invigilation.sql",
      "0009_privacy.sql",
      "0010_billing.sql",
      "0011_proctoring.sql",
      "0012_question_media.sql",
      "0013_practice.sql",
      "0014_staff_security.sql",
      "0015_practice_identity.sql",
      "0016_ats.sql",
      "0017_lti.sql",
      "0018_billing_more.sql",
      "0019_prep.sql",
      "0020_prep_plus.sql",
      "0021_prep_community.sql",
      "0022_exam_archive.sql",
      "0023_staff_email_verified.sql",
      "0024_attempt_feedback.sql",
      "0024_static_hint.sql",
      "0025_whatsapp.sql",
      "0026_exam_lab.sql",
      "0027_rechecks.sql",
      "0028_mark_reviews.sql",
      "0029_students_drives.sql",
      "0030_author_usage.sql",
      "0031_seats_attendance.sql",
      "0032_shortlists.sql",
      "0033_bank_transfer.sql",
      "0034_drive_apply.sql",
      "0035_course_outcomes.sql",
      "0036_interviews.sql",
      "0037_answer_scripts.sql",
      "0038_drive_colleges.sql",
      "0039_offers.sql",
      "0040_proxy_checks.sql",
    ]);
    const tables = await sql.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    expect(tables.map((t) => t.tablename)).toEqual(
      expect.arrayContaining([
        "answer_drafts",
        "api_keys",
        "bank_questions",
        "attempts",
        "audit_log",
        "exam_ledger",
        "exam_windows",
        "exams",
        "invitations",
        "model_usage",
        "organisations",
        "outbox",
        "schema_migrations",
        "staff_sessions",
        "staff_users",
        "students",
        "drives",
        "drive_applications",
        "exam_seats",
        "exam_attendance",
        "shortlists",
        "shortlist_decisions",
        "exam_outcomes",
        "interviews",
        "answer_scripts",
        "answer_script_pages",
        "drive_colleges",
        "attempt_origins",
        "identity_checks",
      ]),
    );
  });
});
