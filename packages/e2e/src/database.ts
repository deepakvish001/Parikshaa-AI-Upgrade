import { orgId } from "@parikshaa/core";
import { BillingStore, connect, IdentityStore, migrate, staffScope } from "@parikshaa/store";

/**
 * The harnesses' database: a real Postgres, migrated as the schema owner and
 * served to the application as the runtime role, as in production.
 *
 *   E2E_OWNER_URL  default postgres://parikshaa_owner@localhost:5432/parikshaa_e2e
 *   E2E_APP_URL    default postgres://parikshaa_app@localhost:5432/parikshaa_e2e
 *
 * The defaults carry no password: a throwaway test cluster uses `trust`
 * authentication on localhost (as CI does), or PGPASSWORD / ~/.pgpass. No
 * credential lives in the repository, even a test one.
 */
export const ownerUrl = process.env["E2E_OWNER_URL"] ?? "postgres://parikshaa_owner@localhost:5432/parikshaa_e2e";
export const appUrl = process.env["E2E_APP_URL"] ?? "postgres://parikshaa_app@localhost:5432/parikshaa_e2e";

export const ORG = "e2e";
export const OWNER_EMAIL = "owner@e2e.test";
export const OWNER_PASSWORD = "e2e owner password, long enough";
export const SECRET = "e2e-secret-".repeat(4);
/** A second organisation, with a privacy notice: its candidates are asked for consent, the first's are not. */
export const PRIVATE_ORG = "e2e-private";
export const PRIVATE_OWNER_EMAIL = "owner@private.e2e.test";

/** The key-encryption key for attempts' data keys: fixed, so a kept database (E2E_RESET=0) still opens. */
export const DATA_KEY = Buffer.alloc(32, 5).toString("base64");

/** Start from nothing: drop everything, migrate, and create the organisation and its owner. */
export async function resetDatabase(hashPassword: (password: string) => Promise<string>): Promise<void> {
  const sql = connect(ownerUrl, { max: 1 });
  try {
    await sql.exec(`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT USAGE ON SCHEMA public TO parikshaa_app;`);
    const executor = sql;
    await migrate(executor);
    const identity = new IdentityStore(executor);
    await identity.createOrganisation(orgId(ORG), "E2E College");
    await identity.createUser({
      orgId: orgId(ORG),
      email: OWNER_EMAIL,
      name: "Asha Rao",
      role: "owner",
      passwordHash: await hashPassword(OWNER_PASSWORD),
    });
    await identity.createOrganisation(orgId(PRIVATE_ORG), "E2E Private Ltd");
    await identity.createUser({
      orgId: orgId(PRIVATE_ORG),
      email: PRIVATE_OWNER_EMAIL,
      name: "Priya Menon",
      role: "owner",
      passwordHash: await hashPassword(OWNER_PASSWORD),
    });

  } finally {
    await sql.end();
  }
}

/**
 * A new organisation on prepaid credits with none yet (ROADMAP §12), and its
 * owner. Plans are the operator's to set, so this goes to the database as the
 * operator's tool does; each run gets its own, since the browsers run side by
 * side and one buying credits must not change what another sees.
 */
export async function seedBilledOrganisation(hashPassword: (password: string) => Promise<string>): Promise<{ email: string; password: string }> {
  const id = `e2e-billed-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const sql = connect(ownerUrl, { max: 1 });
  try {
    const identity = new IdentityStore(sql);
    await identity.createOrganisation(orgId(id), "E2E Billed Ltd");
    const email = `owner@${id}.test`;
    await identity.createUser({ orgId: orgId(id), email, name: "Ravi Kumar", role: "owner", passwordHash: await hashPassword(OWNER_PASSWORD) });
    const billing = new BillingStore(sql);
    await billing.setPlan(staffScope(orgId(id)), "prepaid", 5000);
    await billing.updateBuyer(staffScope(orgId(id)), {
      legalName: "E2E Billed Ltd",
      gstin: null,
      stateCode: "27",
      address: "1 FC Road, Pune",
      billingEmail: "accounts@billed.e2e.test",
    });
    return { email, password: OWNER_PASSWORD };
  } finally {
    await sql.end();
  }
}
