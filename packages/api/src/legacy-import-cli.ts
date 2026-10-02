import { orgId } from "@parikshaa/core";
import { connect, IdentityStore, PracticeStore } from "@parikshaa/store";
import { importLegacy, legacyProblem, readLegacy } from "./legacy-import.js";

/**
 * Bring the old app's problems onto a practice site (see legacy-import.ts).
 *
 *   SOURCE_DATABASE_URL=… DATABASE_URL=… node dist/legacy-import-cli.js \
 *     --site learn [--org parikshaa --site-title "Parikshaa Learn"] [--dry-run]
 *
 * The source is only read. With `--org`, a site that does not exist yet is
 * made, closed to learners until its owner opens it in the console, in that
 * organisation (made too if needed; `admin-cli` gives it an owner). Run with
 * `--dry-run` first: it reads and checks every problem, prints the report and
 * writes nothing.
 */
const { values, dryRun } = (() => {
  const args = process.argv.slice(2);
  const value = (flag: string) => {
    const i = args.indexOf(flag);
    const v = i < 0 ? undefined : args[i + 1];
    return v === undefined || v.startsWith("--") ? undefined : v;
  };
  return { values: { site: value("--site"), org: value("--org"), title: value("--site-title") }, dryRun: args.includes("--dry-run") };
})();

const source = process.env["SOURCE_DATABASE_URL"] ?? "";
const target = process.env["DATABASE_URL"] ?? "";
if (source === "" || target === "" || values.site === undefined) {
  process.stderr.write("Usage: SOURCE_DATABASE_URL=… DATABASE_URL=… node dist/legacy-import-cli.js --site <slug> [--org <id> --site-title <title>] [--dry-run]\n");
  process.exit(2);
}
if (values.org !== undefined && !/^[a-z0-9][a-z0-9-]{1,62}$/.test(values.org)) {
  process.stderr.write("--org must be lowercase letters, digits and hyphens, 2-63 characters\n");
  process.exit(2);
}

const from = connect(source, { max: 2 });
const to = connect(target, { max: 2 });
try {
  const practice = new PracticeStore(to);
  let site = await practice.siteBySlug(values.site);
  if (site === null && values.org === undefined) {
    process.stderr.write(`No practice site "${values.site}": make it in the console, or pass --org to make it here.\n`);
    process.exitCode = 2;
  } else {
    if (site === null) {
      const org = orgId(values.org!);
      const title = values.title ?? "Parikshaa Learn";
      if (dryRun) process.stdout.write(`Would make the site "${values.site}" (${title}) for ${org}, closed to learners.\n`);
      else {
        const identity = new IdentityStore(to);
        if ((await identity.getOrganisation(org)) === null) await identity.createOrganisation(org, title);
        site = await practice.saveSite({ orgId: org, slug: values.site, title, welcome: "", open: false });
        process.stdout.write(`Made the site "${values.site}" for ${org}, closed to learners until its owner opens it.\n`);
      }
    }
    const report = site === null ? null : await importLegacy(from, practice, site.orgId, { dryRun });
    if (report === null) {
      // A dry run against a site not made yet: read and check, with nothing on the site to compare against.
      const bundles = await readLegacy(from);
      const imported = bundles.map(legacyProblem);
      process.stdout.write(`Dry run: ${bundles.length} problems would be added, ${imported.filter((p) => p.draft.published).length} published.\n`);
      for (const p of imported) if (p.issues.length > 0) process.stdout.write(`  ${p.draft.slug}: ${p.issues.join("; ")}\n`);
    } else {
      process.stdout.write(
        `${dryRun ? "Dry run: nothing written. " : ""}${report.problems} problems: ${report.added} added, ${report.updated} updated, ${report.published} published.\n`,
      );
      for (const p of report.issues) process.stdout.write(`  ${p.slug}: ${p.issues.join("; ")}\n`);
    }
  }
} finally {
  await from.end();
  await to.end();
}
