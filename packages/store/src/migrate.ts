import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { SqlExecutor } from "./sql.js";

/**
 * Migration runner.
 *
 * Deliberately small: migrations are numbered SQL files applied in order and
 * recorded in a table, each inside its own transaction. There is no down path —
 * rolling a schema backwards in a system whose whole point is an append-only
 * record is a way to lose one; a mistake is corrected by a new migration.
 */

export const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations", import.meta.url));

export interface MigrationResult {
  readonly applied: readonly string[];
  readonly skipped: readonly string[];
}

export async function migrate(
  sql: SqlExecutor,
  directory: string = MIGRATIONS_DIR,
): Promise<MigrationResult> {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text        PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

  const done = new Set(
    (await sql.query<{ name: string }>(`SELECT name FROM schema_migrations`)).map((r) => r.name),
  );

  const files = (await readdir(directory)).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    if (done.has(file)) {
      skipped.push(file);
      continue;
    }
    const contents = await readFile(`${directory}/${file}`, "utf8");
    await sql.transaction(async (tx) => {
      await tx.exec(contents);
      await tx.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [file]);
    });
    applied.push(file);
  }

  return { applied, skipped };
}

/** The migrations not yet applied, in the order `migrate` would apply them. Reads only: writes nothing. */
export async function pendingMigrations(sql: SqlExecutor, directory: string = MIGRATIONS_DIR): Promise<readonly string[]> {
  const [table] = await sql.query<{ exists: boolean }>(`SELECT to_regclass('schema_migrations') IS NOT NULL AS exists`);
  const done = new Set(table?.exists === true ? (await sql.query<{ name: string }>(`SELECT name FROM schema_migrations`)).map((r) => r.name) : []);
  return (await readdir(directory)).filter((f) => f.endsWith(".sql") && !done.has(f)).sort();
}
