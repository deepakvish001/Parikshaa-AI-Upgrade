import type Anthropic from "@anthropic-ai/sdk";
import { IdentityStore, InvitationStore, LedgerStore, QuestionBank, type SqlExecutor } from "@parikshaa/store";
import { AttemptTokens } from "./auth.js";
import { InviteCodes } from "./invite-codes.js";
import { InvitationService } from "./invitation-service.js";
import { ResultsService } from "./results.js";
import { buildServer } from "./server.js";
import { ExamService } from "./service.js";
import { StaffAuth } from "./staff-auth.js";

/**
 * Build the OpenAPI document from the running route table.
 *
 * Generated from the same schemas the routes validate against, so the published
 * contract cannot describe an endpoint that does not behave that way. Nothing
 * here touches a database or a model: the document comes from route
 * registration, and the dependencies exist only to satisfy the constructor.
 */
export async function specDocument(): Promise<Record<string, unknown>> {
  const unusable: SqlExecutor = {
    query: () => Promise.reject(new Error("the spec generator does not query")),
    exec: () => Promise.reject(new Error("the spec generator does not query")),
    transaction: () => Promise.reject(new Error("the spec generator does not query")),
  };

  const identity = new IdentityStore(unusable);
  const store = new LedgerStore(unusable);
  const service = new ExamService({ store, identity, client: {} as unknown as Anthropic });
  const tokens = new AttemptTokens("x".repeat(40));
  const app = buildServer({
    service,
    invitations: new InvitationService({
      exams: service,
      store,
      invitations: new InvitationStore(unusable),
      codes: new InviteCodes("x".repeat(40)),
      tokens,
      publicUrl: "https://example.invalid",
    }),
    results: new ResultsService({ store, invitations: new InvitationStore(unusable), exams: service }),
    tokens,
    auth: new StaffAuth(identity),
    identity,
    bank: new QuestionBank(unusable),
  });

  await app.ready();
  const document = app.swagger() as Record<string, unknown>;
  await app.close();
  return document;
}
