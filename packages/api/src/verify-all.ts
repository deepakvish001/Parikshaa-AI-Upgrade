import { staffScope, type IdentityStore, type LedgerStore } from "@parikshaa/store";

/**
 * Check every stored chain in the database (ROADMAP §10).
 *
 * The step that makes a restore drill a drill: a backup that restores but
 * whose chains no longer verify has not been restored. Also what the chaos
 * test runs after killing the server mid-write. Reports ids only — never an
 * answer or a name — so its output can go in a ticket.
 */
export interface VerifyAllReport {
  readonly organisations: number;
  readonly attempts: number;
  readonly entries: number;
  readonly failures: readonly { readonly orgId: string; readonly attemptId: string; readonly seq: number; readonly reason: string }[];
}

export async function verifyAll(store: LedgerStore, identity: IdentityStore): Promise<VerifyAllReport> {
  const orgs = await identity.organisationIds();
  let attempts = 0;
  let entries = 0;
  const failures: { orgId: string; attemptId: string; seq: number; reason: string }[] = [];
  for (const orgId of orgs) {
    const scope = staffScope(orgId);
    for (const attemptId of await store.attemptIds(scope)) {
      attempts += 1;
      const result = await store.verifyStored(scope, attemptId);
      if (result.ok) entries += result.length;
      else failures.push({ orgId, attemptId, seq: result.seq, reason: result.reason });
    }
  }
  return { organisations: orgs.length, attempts, entries, failures };
}
