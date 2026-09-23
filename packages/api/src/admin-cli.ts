import { parseArgs } from "node:util";
import { orgId } from "@parikshaa/core";
import { connect, IdentityStore } from "@parikshaa/store";
import { hashPassword } from "./staff-auth.js";

/**
 * Bring an organisation into being with its first owner.
 *
 *   PARIKSHAA_OWNER_PASSWORD=... node dist/admin-cli.js \
 *     --org acme --org-name "Acme Engineering" --email hr@acme.in --name "Asha Rao"
 *
 * Everything after the first owner is done through the API by that owner. The
 * password comes from the environment rather than a flag, so it does not land
 * in shell history or a process listing.
 *
 * Adding an owner to an organisation that already exists — including the
 * `default` organisation that data from before tenancy was moved into — works
 * the same way; the organisation is simply not created again.
 */

const { values } = parseArgs({
  options: {
    org: { type: "string" },
    "org-name": { type: "string" },
    email: { type: "string" },
    name: { type: "string" },
  },
});

const fail = (message: string): never => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

const url = process.env["DATABASE_URL"] ?? fail("DATABASE_URL is not set");
const password = process.env["PARIKSHAA_OWNER_PASSWORD"] ?? fail("PARIKSHAA_OWNER_PASSWORD is not set");
const org = values.org ?? fail("--org is required");
const email = values.email ?? fail("--email is required");
const name = values.name ?? fail("--name is required");

if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(org)) {
  fail("--org must be lowercase letters, digits and hyphens, 2-63 characters");
}

const sql = connect(url, { max: 1 });
try {
  const identity = new IdentityStore(sql);
  const id = orgId(org);

  if ((await identity.getOrganisation(id)) === null) {
    await identity.createOrganisation(id, values["org-name"] ?? fail("--org-name is required for a new organisation"));
    process.stdout.write(`created organisation ${id}\n`);
  }
  if ((await identity.findUserByEmail(email)) !== null) fail(`An account already uses ${email}`);

  const user = await identity.createUser({
    orgId: id,
    email,
    name,
    role: "owner",
    passwordHash: await hashPassword(password),
  });
  process.stdout.write(`created owner ${user.email} (${user.id}) in ${id}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await sql.end();
}
