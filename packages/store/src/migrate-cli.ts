import postgres from "postgres";
import { migrate } from "./migrate.js";
import { postgresJsExecutor } from "./sql.js";

const url = process.env["DATABASE_URL"];
if (url === undefined || url === "") {
  process.stderr.write("DATABASE_URL is not set\n");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
try {
  const { applied, skipped } = await migrate(postgresJsExecutor(sql));
  for (const name of skipped) process.stdout.write(`already applied  ${name}\n`);
  for (const name of applied) process.stdout.write(`applied          ${name}\n`);
  process.stdout.write(`${applied.length} migration(s) applied\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
} finally {
  await sql.end();
}
