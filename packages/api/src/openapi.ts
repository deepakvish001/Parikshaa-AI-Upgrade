import { Onboarding } from "./onboarding.js";
import type Anthropic from "@anthropic-ai/sdk";
import { BillingStore, FeedbackStore, IdentityStore, LabStore, RecheckStore, MarkingStore, PlacementStore, SeatStore, ShortlistStore, ProctorStore, InvigilationStore, InvitationStore, LedgerStore, PracticeStore, PrepCommunityStore, PrepPlusStore, PrepStore, PrivacyStore, QuestionBank, QuestionMedia, type SqlExecutor } from "@parikshaa/store";
import { LabService } from "./lab.js";
import { RecheckService } from "./rechecks.js";
import { MarkingService } from "./marking.js";
import { PlacementService } from "./placement.js";
import { SeatService } from "./seats.js";
import { ShortlistService } from "./shortlists.js";
import { AttemptTokens } from "./auth.js";
import { InviteCodes } from "./invite-codes.js";
import { InvigilationService } from "./invigilation.js";
import { PrivacyService } from "./privacy.js";
import { BillingService } from "./billing.js";
import { ProctorService } from "./proctoring.js";
import { InvitationService } from "./invitation-service.js";
import { buildIntegrations } from "./integrations.js";
import { ResultsService } from "./results.js";
import { PracticeService } from "./practice.js";
import { PrepService } from "./prep.js";
import { PrepPlus } from "./prep-plus.js";
import { PrepCommunity } from "./prep-community.js";
import { StarterPacks } from "./starter-packs.js";
import { Sahayak } from "./sahayak.js";
import { PracticeIdentity } from "./practice-identity.js";
import { buildServer } from "./server.js";
import { ExamService } from "./service.js";
import { StaffAuth } from "./staff-auth.js";
import { StaffSecrets } from "./staff-secrets.js";
import { StaffSecurity } from "./staff-security.js";

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
  const invitationStore = new InvitationStore(unusable);
  const invitations = new InvitationService({
    exams: service,
    store,
    invitations: invitationStore,
    codes: new InviteCodes("x".repeat(40)),
    tokens,
    publicUrl: "https://example.invalid",
  });
  const { webhooks, greenhouse, ats, lti } = buildIntegrations({
    sql: unusable,
    store,
    invitationStore,
    invitations,
    exams: service,
    secret: "x".repeat(40),
    publicUrl: "https://example.invalid",
  });
  const secrets = new StaffSecrets("x".repeat(40));
  const practice = new PracticeService({ store: new PracticeStore(unusable), bank: new QuestionBank(unusable) });
  const auth = new StaffAuth(identity, { secrets });
  const results = new ResultsService({ store, invitations: invitationStore, exams: service });
  const app = buildServer({
    service,
    invitations,
    results,
    webhooks,
    greenhouse,
    ats,
    lti,
    invigilation: new InvigilationService({ store, invitations: invitationStore, invigilation: new InvigilationStore(unusable), exams: service }),
    privacy: new PrivacyService({ store, privacy: new PrivacyStore(unusable), invitations: invitationStore, identity, exams: service }),
    billing: new BillingService({ store, billing: new BillingStore(unusable), identity, exams: service }),
    proctor: new ProctorService({ store, proctor: new ProctorStore(unusable, null), exams: service }),
    feedback: new FeedbackStore(unusable),
    lab: new LabService({ lab: new LabStore(unusable), invitations: invitationStore, store, exams: service }),
    marking: new MarkingService({ store, marking: new MarkingStore(unusable), exams: service }),
    seats: new SeatService({ seats: new SeatStore(unusable), invitations: invitationStore, store, identity, exams: service, codes: new InviteCodes("x".repeat(40)), secret: "x".repeat(40) }),
    shortlists: new ShortlistService({ store: new ShortlistStore(unusable), results, identity, exams: service, secret: "x".repeat(40), publicUrl: "https://example.invalid" }),
    placement: new PlacementService({ placement: new PlacementStore(unusable), store, exams: service, invitations, results }),
    rechecks: new RecheckService({ store, rechecks: new RecheckStore(unusable), invitations: invitationStore, identity, exams: service, secret: "x".repeat(40), publicUrl: "https://example.invalid" }),
    tokens,
    auth,
    security: new StaffSecurity({ identity, auth, secrets, publicUrl: "https://example.invalid" }),
    onboarding: new Onboarding({ identity, auth, billing: new BillingStore(unusable), bank: new QuestionBank(unusable), exams: service }),
    identity,
    bank: new QuestionBank(unusable),
    media: new QuestionMedia(unusable),
    practice,
    practiceIdentity: new PracticeIdentity({ store: new PracticeStore(unusable), practice, secrets, secret: "x".repeat(40), publicUrl: "https://example.invalid" }),
    prep: new PrepService({ practice: new PracticeStore(unusable), store: new PrepStore(unusable) }),
    starterPacks: new StarterPacks({
      practice: new PracticeStore(unusable),
      prep: new PrepStore(unusable),
      service: new PrepService({ practice: new PracticeStore(unusable), store: new PrepStore(unusable) }),
    }),
    prepCommunity: new PrepCommunity({ practice: new PracticeStore(unusable), prep: new PrepStore(unusable), store: new PrepCommunityStore(unusable) }),
    prepPlus: (() => {
      const plus = new PrepPlus({ store: new PrepPlusStore(unusable), practice: new PracticeStore(unusable) });
      return { plus, tutor: new Sahayak({ client: null, practice: new PracticeStore(unusable), prep: new PrepStore(unusable), plus }) };
    })(),
  });

  await app.ready();
  const document = app.swagger() as Record<string, unknown>;
  await app.close();
  return document;
}
