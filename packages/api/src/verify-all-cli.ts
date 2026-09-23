import { connect, IdentityStore, LedgerStore } from "@parikshaa/store";
import { verifyAll } from "./verify-all.js";

/**
 * `DATABASE_URL=… node dist/verify-all-cli.js` — verify every chain in the
 * database. Exits 1 if any fails. Run as either role: row-level security is
 * satisfied organisation by organisation.
 */
const url = process.env["DATABASE_URL"];
if (url === undefined || url === "") {
  process.stderr.write("DATABASE_URL is not set\n");
  process.exit(2);
}
const sql = connect(url, { max: 4 });
const executor = sql;
try {
  const started = Date.now();
  const report = await verifyAll(new LedgerStore(executor), new IdentityStore(executor));
  process.stdout.write(
    `${report.organisations} organisations, ${report.attempts} attempts, ${report.entries} entries verified in ${((Date.now() - started) / 1000).toFixed(1)}s\n`,
  );
  for (const f of report.failures) process.stdout.write(`FAILED ${f.orgId}/${f.attemptId} at entry ${f.seq}: ${f.reason}\n`);
  process.exitCode = report.failures.length === 0 ? 0 : 1;
} finally {
  await sql.end();
}
