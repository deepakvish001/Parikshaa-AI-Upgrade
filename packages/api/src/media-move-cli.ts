import { IdentityStore, ProctorStore, connect, staffScope } from "@parikshaa/store";
import { storageFromEnv } from "./storage.js";

/**
 * Carry proctoring photos kept in Postgres over to Supabase Storage
 * (docs/F1-GO-LIVE-PLAN.md §8.2), once, after storage is first configured:
 *
 *   DATABASE_URL=… SUPABASE_URL=… SUPABASE_SECRET_KEY=… npm run media-move -w @parikshaa/api
 *
 * As the runtime role (parikshaa_app), organisation by organisation. Each
 * photo moves as it was sealed, so no key is needed; one interrupted can be
 * run again, and goes on from where it stopped. New photos already go to
 * storage once the API has the same settings.
 */

const url = process.env["DATABASE_URL"];
if (url === undefined || url === "") {
  process.stderr.write("usage: DATABASE_URL=… SUPABASE_URL=… SUPABASE_SECRET_KEY=… [MEDIA_BUCKET=…] media-move\n");
  process.exit(2);
}

const sql = connect(url, { max: 2 });
try {
  const blobs = storageFromEnv(process.env);
  if (blobs === null) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY: there is nowhere to move the photos to");
  await blobs.ensureBucket();
  // Moving needs no data key: the bytes go as they are, still sealed.
  const proctor = new ProctorStore(sql, null, { blobs });
  let total = 0;
  for (const org of await new IdentityStore(sql).organisationIds()) {
    let moved = 0;
    for (let n = await proctor.moveToBlobs(staffScope(org)); n > 0; n = await proctor.moveToBlobs(staffScope(org))) moved += n;
    if (moved > 0) process.stdout.write(`${org}: ${moved} photos moved\n`);
    total += moved;
  }
  process.stdout.write(`${total} photos moved to storage\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
