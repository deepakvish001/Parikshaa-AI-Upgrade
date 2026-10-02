import { migrate, pendingMigrations } from "./migrate.js";
import { connect } from "./sql.js";

const url = process.env["DATABASE_URL"];
if (url === undefined || url === "") {
  process.stderr.write("DATABASE_URL is not set\n");
  process.exit(1);
}

const sql = connect(url, { max: 1 });
try {
  // --dry-run: say what would be applied, and change nothing.
  if (process.argv.includes("--dry-run")) {
    const pending = await pendingMigrations(sql);
    for (const name of pending) process.stdout.write(`would apply      ${name}\n`);
    process.stdout.write(`${pending.length} migration(s) to apply (dry run: nothing changed)\n`);
    process.exit(0);
  }
  const { applied, skipped } = await migrate(sql);
  for (const name of skipped) process.stdout.write(`already applied  ${name}\n`);
  for (const name of applied) process.stdout.write(`applied          ${name}\n`);
  process.stdout.write(`${applied.length} migration(s) applied\n`);

  // The runtime role is created NOLOGIN, because a credential does not belong
  // in a migration. Given one here, it is allowed to log in with it — which is
  // how docker-compose runs the API as a role row-level security binds.
  const appPassword = process.env["PARIKSHAA_APP_PASSWORD"];
  if (appPassword !== undefined && appPassword !== "") {
    const [row] = await sql.query<{ stmt: string }>(
      `SELECT format('ALTER ROLE parikshaa_app WITH LOGIN PASSWORD %L', $1::text) AS stmt`,
      [appPassword],
    );
    if (row !== undefined) await sql.exec(row.stmt);
    process.stdout.write("parikshaa_app may log in\n");
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
} finally {
  await sql.end();
}
