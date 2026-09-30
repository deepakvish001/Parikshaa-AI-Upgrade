import { connect, ReportStore } from "@parikshaa/store";
import { pilotReport, renderReport } from "./pilot-report.js";

/**
 * The pilot report, for the operator (docs/PILOT.md):
 *
 *   DATABASE_URL=… npm run pilot-report -w @parikshaa/api            # to read
 *   DATABASE_URL=… npm run pilot-report -w @parikshaa/api -- --json  # to hand on
 *
 * It names each organisation's owner and their address, so it is for the
 * operator's terminal, not for pasting anywhere public.
 */

const url = process.env["DATABASE_URL"];
const args = process.argv.slice(2);
if (url === undefined || url === "" || args.some((a) => a !== "--json")) {
  process.stderr.write("usage: DATABASE_URL=… pilot-report [--json]\n");
  process.exit(2);
}

const sql = connect(url, { max: 2 });
try {
  const now = Date.now();
  const report = pilotReport(await new ReportStore(sql).organisations(new Date(now)), now);
  process.stdout.write(args.includes("--json") ? `${JSON.stringify(report, null, 2)}\n` : renderReport(report));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
