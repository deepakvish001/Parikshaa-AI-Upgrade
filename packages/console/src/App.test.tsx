import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.tsx";
import {
  ConsoleClient,
  ConsoleError,
  type AttemptReview,
  type CandidateReport,
  type Dashboard,
  type ExamSummary,
  type LiveRow,
  type LiveView,
  type ResultRow,
  type Results,
  type WhoAmI,
} from "./api.ts";

const exams: ExamSummary[] = [{ id: "exam-1", title: "Algorithms", questionCount: 2 }];
const dashboardView: Dashboard = {
  sittings: [{ examId: "exam-1", title: "Algorithms", opensAt: "2026-10-01T04:30:00.000Z", closesAt: "2026-10-01T07:30:00.000Z", invited: 40, started: 12 }],
  activity: [{ at: "2026-10-01T04:00:00.000Z", actor: "Asha", action: "invitations.imported", target: "exam-1" }],
  setup: { exams: 1, bankQuestions: 0, scheduled: 1, invited: 40, staff: 1, privacyNotice: false },
};

const review: AttemptReview = {
  state: "graded",
  total: 11,
  voidReason: null,
  vivas: [
    {
      probeId: "p1",
      questionId: "q1",
      prompt: "Which quantity decreases each round?",
      rationale: "Answer scored 8/10 (0.80), at or above this exam's viva trigger ratio.",
      reply: "The potential function, bounded below by zero.",
      latencyMs: 14_000,
      verdict: "inconsistent",
      confidence: 0.9,
      reasoning: "The reply names a different quantity from the one in their answer.",
    },
  ],
};

const resultRow = (attemptId: string, ref: string, name: string, total: number | null, state: ResultRow["state"] = "graded"): ResultRow => ({
  attemptId,
  candidateId: `cand-${ref}`,
  ref,
  name,
  email: null,
  state,
  total,
  maxTotal: 10,
  percent: total === null ? null : total * 10,
  startedAt: Date.parse("2026-10-01T04:31:00Z"),
  submittedAt: Date.parse("2026-10-01T05:01:00Z"),
  durationMs: 30 * 60_000,
  scores: {},
  probes: { asked: 0, replied: 0, verdicts: {} },
  voidReason: null,
});

const results: Results = {
  exam: { id: "exam-1", title: "Algorithms" },
  rows: [resultRow("a1", "CS002", "Rohan Das", 4), resultRow("a2", "CS001", "Ananya Iyer", 9), resultRow("a3", "CS010", "Meera Pillai", null, "submitted")],
  analytics: {
    candidates: 3,
    graded: 2,
    setAside: 0,
    meanPercent: 65,
    medianPercent: 65,
    distribution: [0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    questions: [
      { questionId: "q1", stem: "Which sort is stable?", kind: "mcq", maxScore: 5, appeared: 2, facility: 0.5, discrimination: -0.2 },
      { questionId: "q2", stem: "Trace the loop", kind: "short", maxScore: 5, appeared: 2, facility: 0.8, discrimination: null },
    ],
    time: { medianMinutes: 30, p90Minutes: 30 },
    integrity: { candidatesProbed: 1, asked: 1, replied: 1, read: 1, verdicts: { consistent: 0, shallow: 0, inconsistent: 1, inconclusive: 0 } },
  },
};

const proctoringView = {
  policy: { identity: true, snapshotEverySeconds: 60, browserEvents: true },
  identity: {
    selfie: { id: "m-selfie", kind: "selfie", takenAt: "2026-10-01T05:00:00.000Z", sha256: "a".repeat(64) },
    id: { id: "m-id", kind: "id", takenAt: "2026-10-01T05:00:00.000Z", sha256: "b".repeat(64) },
    capturedAt: 1,
    review: null,
    matchesLedger: true,
  },
  snapshots: [{ id: "m-1", kind: "snapshot", takenAt: "2026-10-01T05:01:00.000Z", sha256: "c".repeat(64) }],
  events: [{ kind: "tab_hidden", at: "2026-10-01T05:02:00.000Z" }],
};

const billingSummary = {
  account: {
    mode: "prepaid",
    pricePaise: 5000,
    credits: 12,
    legalName: "Acme Technologies Pvt Ltd",
    gstin: "27AAACR5055K1Z7",
    stateCode: "27",
    address: "1 MG Road, Pune",
    billingEmail: "accounts@acme.test",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
  history: [{ id: "m1", delta: 12, reason: "grant", attemptId: null, paymentId: null, note: "trial", at: "2026-10-01T00:00:00.000Z" }],
  invoices: [{ id: "inv1", number: "PKS/2627/000001", kind: "credits", paymentId: "p1", period: null, totalPaise: 590_000, issuedAt: "2026-10-01T06:00:00.000Z" }],
  checkout: { available: true, keyId: "rzp_test_x" },
  supplier: { legalName: "Parikshaa Assessments Pvt Ltd", stateCode: "29" },
};

const taxInvoice = {
  ...billingSummary.invoices[0]!,
  document: {
    title: "Tax Invoice",
    number: "PKS/2627/000001",
    date: "1 Oct 2026",
    supplier: { legalName: "Parikshaa Assessments Pvt Ltd", gstin: "29AAGCP4401A1ZW", address: "Bengaluru", state: "Karnataka", stateCode: "29" },
    buyer: { legalName: "Acme Technologies Pvt Ltd", gstin: "27AAACR5055K1Z7", address: "Pune", state: "Maharashtra", stateCode: "27" },
    placeOfSupply: { code: "27", state: "Maharashtra" },
    reverseCharge: false,
    lines: [{ description: "Assessment attempt credits (prepaid)", sac: "998399", quantity: 100, ratePaise: 5000, amountPaise: 500_000 }],
    taxablePaise: 500_000,
    taxes: [{ name: "IGST", ratePercent: 18, amountPaise: 90_000 }],
    totalPaise: 590_000,
    totalInWords: "Rupees Five Thousand Nine Hundred Only",
  },
};

const notice = {
  version: 1,
  hash: "ab".repeat(32),
  controllerName: "Acme Technologies Pvt Ltd",
  purpose: "To assess candidates for engineering roles.",
  retentionDays: 90,
  grievance: { name: "Priya Menon", email: "privacy@acme.test" },
  collected: ["Your answers."],
  rights: ["Have it erased."],
};

const report: CandidateReport = {
  exam: { id: "exam-1", title: "Algorithms" },
  candidate: { ref: "CS001", name: "Ananya Iyer", email: "ananya@college.test" },
  result: { ...resultRow("a2", "CS001", "Ananya Iyer", 9) },
  questions: [
    { id: "q1", stem: "Which sort is stable?", kind: "mcq", maxScore: 5, score: 5, answer: "Merge sort", language: null, tests: null },
    { id: "q2", stem: "Sum two numbers", kind: "code", maxScore: 5, score: 4, answer: "print(sum(map(int, input().split())))", language: "python", tests: { passed: 3, total: 4 } },
  ],
  vivas: [
    {
      questionId: "q2",
      prompt: "Why map before sum?",
      reply: "To turn the strings into numbers first.",
      latencyMs: 9000,
      verdict: "consistent",
      confidence: 0.8,
      reasoning: "Matches the code.",
    },
  ],
  voidReason: null,
  voidedBy: null,
  ledger: { head: "ab".repeat(32), length: 9 },
};

const liveRow = (ref: string, patch: Partial<LiveRow> = {}): LiveRow => ({
  invitationId: `inv-${ref}`,
  attemptId: `att-${ref}`,
  ref,
  name: `Candidate ${ref}`,
  state: "in_progress",
  answered: 3,
  questions: 10,
  startedAt: 1_000,
  lastSeenAt: 1_790_000_000_000,
  lastActivityAt: 1_790_000_000_000,
  expiresAt: 1_790_000_000_000 + 30 * 60_000,
  extraMinutes: 0,
  reopened: 0,
  awaitingReply: false,
  proctoring: null,
  flags: { away: false, idle: false, overdue: false, cameraOff: false },
  ...patch,
});

const liveView: LiveView = {
  exam: { id: "exam-1", title: "Algorithms" },
  at: 1_790_000_000_000,
  counts: { invited: 4, notStarted: 1, inProgress: 2, away: 1, idle: 0, cameraOff: 0, identityPending: 0, submitted: 1, graded: 0, void: 0 },
  rows: [
    liveRow("R1"),
    liveRow("R2", { lastSeenAt: 1_790_000_000_000 - 10 * 60_000, flags: { away: true, idle: false, overdue: false, cameraOff: false } }),
    liveRow("R3", { state: "submitted", answered: 10 }),
    liveRow("R4", { state: "not_started", attemptId: null, answered: 0, startedAt: null, lastSeenAt: null }),
  ],
  announcements: [{ id: "n1", message: "Question 2: assume sorted input.", authorName: "Meera", at: "2026-10-01T05:00:00.000Z" }],
};

const bankQuestion = (id: string, stem: string) => ({
  id,
  kind: "mcq" as const,
  stem,
  maxScore: 2,
  rubric: [],
  options: ["a", "b"],
  correctIndex: 0,
});
const bankEntries = [
  { id: "b1", question: bankQuestion("b1", "Train speed problem"), topic: "quant", difficulty: "easy" as const, tags: [], updatedAt: "", archived: false },
  { id: "b2", question: bankQuestion("b2", "Work and time problem"), topic: "quant", difficulty: "easy" as const, tags: [], updatedAt: "", archived: false },
];

const OWNER_PERMISSIONS = [
  "exam:read",
  "exam:read_key",
  "exam:write",
  "attempt:start",
  "attempt:read",
  "attempt:review",
  "attempt:grade",
  "attempt:assess",
  "attempt:void",
  "attempt:extend",
  "usage:read",
  "audit:read",
  "staff:manage",
  "apikey:manage",
  "org:manage",
];

const who = (role: WhoAmI["role"], permissions: string[]): WhoAmI => ({
  kind: "user",
  id: "u1",
  name: "Asha",
  email: "asha@acme.test",
  role,
  organisation: { id: "acme", name: "Acme" },
  permissions,
  mustEnrol2fa: false,
});

function stubClient(overrides: Record<string, unknown> = {}) {
  return {
    me: vi.fn(async () => who("owner", OWNER_PERMISSIONS)),
    signOut: vi.fn(async () => undefined),
    listStaff: vi.fn(async () => [
      { id: "u1", email: "asha@acme.test", name: "Asha", role: "owner", disabled: false },
    ]),
    addStaff: vi.fn(async () => ({})),
    usage: vi.fn(async () => ({
      since: "2026-09-01T00:00:00.000Z",
      totalCostMicroUsd: 22_500,
      routes: [
        {
          route: "probe",
          calls: 3,
          inputTokens: 3000,
          outputTokens: 300,
          cacheReadTokens: 0,
          cacheWrite5mTokens: 0,
          cacheWrite1hTokens: 0,
          costMicroUsd: 22_500,
        },
      ],
      perAttempt: { attempts: 3, p50MicroUsd: 7500, p90MicroUsd: 7500, maxMicroUsd: 7500 },
      inferenceGeos: [{ geo: "global", calls: 3 }],
      monthStartedAt: "2026-09-01T00:00:00.000Z",
      spentThisMonthMicroUsd: 22_500,
      monthlyCapMicroUsd: 50_000_000,
    })),
    listExams: vi.fn(async () => exams),
    dashboard: vi.fn(async () => dashboardView),
    loadExam: vi.fn(async () => ({
      id: "exam-1",
      title: "Algorithms",
      questions: [],
      policy: { durationMs: 1, allowRevision: true, vivaTriggerRatio: 0.5 },
    })),
    saveExam: vi.fn(async () => undefined),
    listAttempts: vi.fn(async () => [
      { id: "attempt-1", candidateId: "cand-1", entries: 7, state: "graded" as const, lastSeenAt: null },
    ]),
    extendTime: vi.fn(async () => ({ expiresAt: 1 })),
    listBank: vi.fn(async () => ({ questions: bankEntries, topics: ["quant", "verbal"] })),
    fileQuestion: vi.fn(async () => bankEntries[0]),
    editQuestion: vi.fn(async () => bankEntries[0]),
    archiveQuestion: vi.fn(async () => undefined),
    importBank: vi.fn(async () => 2),
    importDocx: vi.fn(async (_file: string, dryRun: boolean) => ({
      imported: dryRun ? 0 : 2,
      preview: [
        { question: 1, kind: "mcq", stem: "Which is stable?", marks: 2, note: null },
        { question: 2, kind: "short", stem: "What does the diagram show?", marks: 5, note: "Had a picture or equation, which was not imported; add it in the console." },
      ],
    })),
    cloneExam: vi.fn(async () => undefined),
    getWindow: vi.fn(async () => ({ opensAt: "2026-10-01T04:30:00.000Z", closesAt: "2026-10-01T07:30:00.000Z", hardClose: true })),
    setWindow: vi.fn(async () => undefined),
    importCandidates: vi.fn(async (_exam: string, _csv: string, dryRun: boolean) =>
      dryRun
        ? {
            dryRun: true,
            candidates: 2,
            problems: [],
            warnings: [{ row: 3, message: '"CS002" has no email or phone; hand them their code yourself.' }],
            preview: [],
          }
        : { dryRun: false, invited: 2, warnings: [] },
    ),
    listInvitations: vi.fn(async () => [
      {
        id: "i1",
        candidateRef: "CS001",
        name: "Ananya Iyer",
        email: "a@college.test",
        phone: "919876543210",
        opensAt: "2026-10-01T04:30:00.000Z",
        closesAt: "2026-10-01T07:30:00.000Z",
        attemptId: null,
        attemptState: "not_started",
        revoked: false,
        delivery: {
          email: { status: "sent", purpose: "invite", at: "2026-09-29T00:00:00.000Z", error: null },
          sms: { status: "failed", purpose: "invite", at: "2026-09-29T00:00:00.000Z", error: "MSG91 400: bad number" },
        },
      },
    ]),
    resendInvitation: vi.fn(async () => undefined),
    revokeInvitation: vi.fn(async () => undefined),
    invitationLinks: vi.fn(async () => new Blob(["ref,link"])),
    listWebhooks: vi.fn(async () => [
      { id: "wh_1", url: "https://ats.example.com/hook", events: [], version: 1, description: "", createdAt: "2026-09-01T00:00:00.000Z", disabled: false },
    ]),
    addWebhook: vi.fn(async (url: string) => ({
      webhook: { id: "wh_2", url, events: [], version: 1, description: "", createdAt: "", disabled: false },
      secret: "whsec_c2VjcmV0",
    })),
    webhookSecret: vi.fn(async () => "whsec_c2VjcmV0"),
    rotateWebhook: vi.fn(),
    disableWebhook: vi.fn(async () => undefined),
    testWebhook: vi.fn(async () => undefined),
    webhookDeliveries: vi.fn(async () => [
      { id: "d1", event: "attempt.graded", attemptId: "a1", status: "pending", attempts: 3, error: "HTTP 503", createdAt: "2026-09-01T00:00:00.000Z", sentAt: null },
    ]),
    greenhouse: vi.fn(async () => ({ enabled: false, endpoints: { list_tests: "https://exam.test/api/integrations/greenhouse/list_tests" } })),
    atsConnectors: vi.fn(async () =>
      (["lever", "zoho_recruit", "darwinbox"] as const).map((provider) => ({
        provider,
        label: { lever: "Lever", zoho_recruit: "Zoho Recruit", darwinbox: "Darwinbox" }[provider],
        configured: false,
        enabled: false,
        settings: {},
        credentialsSet: false,
      })),
    ),
    saveAts: vi.fn(async (provider: string) => ({ provider, label: "Lever", configured: true, enabled: true, settings: {}, credentialsSet: true })),
    issueAtsHook: vi.fn(async () => ({ key: "atk.acme.lever.2.x", hookUrl: "https://exam.test/api/integrations/ats/lever/hook/atk.acme.lever.2.x" })),
    disableAts: vi.fn(async () => undefined),
    ltiPlatforms: vi.fn(async () => []),
    registerLti: vi.fn(async (p: object) => ({ ...p, id: "p1", enabled: true, tool: { toolUrl: "t", loginUrl: "l", redirectUrl: "r", jwksUrl: "j", customParameters: "exam=<exam id>" } })),
    updateLti: vi.fn(async () => undefined),
    issueGreenhouseKey: vi.fn(async () => ({ key: "ghk.acme.1.abc", endpoints: {} })),
    disableGreenhouse: vi.fn(async () => undefined),
    live: vi.fn(async () => liveView),
    announce: vi.fn(async () => ({ id: "n2", message: "x", authorName: "Asha", at: "2026-10-01T05:00:00.000Z" })),
    reopen: vi.fn(async () => ({ expiresAt: 1 })),
    results: vi.fn(async () => results),
    similarity: vi.fn(async () => ({
      exam: { id: "exam-1", title: "Algorithms" },
      questions: [
        {
          id: "q-code",
          stem: "Print the longest run.",
          answered: 3,
          pairs: [
            {
              a: { attemptId: "a1", ref: "CS001", name: "Aarav Sharma", language: "python", source: "def longest_run(values):\n    return 1" },
              b: { attemptId: "a2", ref: "CS002", name: "Diya Patel", language: "python", source: "def f(a):\n    return 1" },
              similarity: 0.94,
              shared: 31,
            },
          ],
        },
      ],
    })),
    uploadImage: vi.fn(async () => "b".repeat(64)),
    resultsFile: vi.fn(async () => new Blob(["x"])),
    report: vi.fn(async () => report),
    startAttempt: vi.fn(async () => ({ attemptId: "attempt-2", token: "issued-token" })),
    review: vi.fn(async () => review),
    voidAttempt: vi.fn(async () => ({})),
    grade: vi.fn(async () => ({ total: 11 })),
    assess: vi.fn(async () => ({})),
    privacy: vi.fn(async () => ({ settings: null, notice: null })),
    savePrivacy: vi.fn(async (draft: object) => ({ settings: { ...draft, noticeVersion: 1, updatedAt: "" }, notice })),
    eraseAttempt: vi.fn(async () => ({ erased: true })),
    billing: vi.fn(async () => billingSummary),
    saveBillingDetails: vi.fn(async (d: object) => ({ ...billingSummary.account, ...d })),
    createOrder: vi.fn(async (credits: number) => ({
      orderId: "order_1",
      keyId: "rzp_test_x",
      currency: "INR",
      credits,
      taxablePaise: credits * 5000,
      taxPaise: credits * 900,
      amountPaise: credits * 5900,
      supplierName: "Parikshaa Assessments Pvt Ltd",
    })),
    verifyPayment: vi.fn(async () => ({ credits: 112, invoice: taxInvoice })),
    invoice: vi.fn(async () => taxInvoice),
    proctoring: vi.fn(async () => proctoringView),
    photoUrl: vi.fn(async (_a: string, id: string) => `blob:${id}`),
    reviewIdentity: vi.fn(async () => ({ ok: true })),
    ...overrides,
  } as unknown as ConsoleClient;
}

function renderApp(element: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

describe("signing in", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("asks for an email and password first", () => {
    renderApp(<App />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("signs in, and says only that the pair was not accepted when it is not", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: "invalid_credentials" }), { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    renderApp(<App />);

    await userEvent.type(screen.getByLabelText("Email"), "asha@acme.test");
    await userEvent.type(screen.getByLabelText("Password"), "wrong password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That email and password were not accepted.");
    expect(fetch).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ method: "POST" }));
  });

  it("asks for the authenticator's code when the account has one, and sends it with the password", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "second_factor_required" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "invalid_credentials" }), { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    renderApp(<App />);

    await userEvent.type(screen.getByLabelText("Email"), "asha@acme.test");
    await userEvent.type(screen.getByLabelText("Password"), "correct horse battery staple");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const code = await screen.findByLabelText("Code from your authenticator app");
    expect(screen.queryByRole("alert")).toBeNull();
    await userEvent.type(code, "123456");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That code was not accepted.");
    expect(JSON.parse((fetch.mock.calls[1]![1] as RequestInit).body as string)).toMatchObject({ code: "123456" });
  });

  it("sends a reset link, saying the same whatever the address", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 202 }));
    vi.stubGlobal("fetch", fetch);
    renderApp(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Forgot your password?" }));
    await userEvent.type(screen.getByLabelText("Email"), "asha@acme.test");
    await userEvent.click(screen.getByRole("button", { name: "Send the link" }));

    expect(await screen.findByRole("status")).toHaveTextContent("If asha@acme.test has an account");
    expect(fetch).toHaveBeenCalledWith("/api/auth/password-reset", expect.objectContaining({ method: "POST" }));
  });

  it("opens a reset link on choosing a new password, and clears it from the address bar", async () => {
    window.history.replaceState(null, "", "/console/?reset=abc.def");
    const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    renderApp(<App />);

    expect(window.location.search).toBe("");
    await userEvent.type(screen.getByLabelText("New password"), "a long enough password");
    await userEvent.type(screen.getByLabelText("The same again"), "a long enough password");
    await userEvent.click(screen.getByRole("button", { name: "Set password" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Sign in with your new password");
    expect(JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({
      token: "abc.def",
      password: "a long enough password",
    });
  });

  it("signs in with the session the organisation's provider sent back, and forgets it from the address bar", async () => {
    window.history.replaceState(null, "", "/console/#sso=pks_from_provider");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "staff_auth_required" }), { status: 401 })));
    renderApp(<App />);
    expect(window.location.hash).toBe("");
    expect(sessionStorage.getItem("parikshaa.console.session")).toBe("pks_from_provider");
  });

  it("says why the organisation's sign-in did not work", () => {
    window.history.replaceState(null, "", "/console/?sso_error=not_staff");
    renderApp(<App />);
    expect(screen.getByRole("alert")).toHaveTextContent("not a member of staff here");
  });

  it("goes back to signing in when the session has ended", async () => {
    sessionStorage.setItem("parikshaa.console.session", "pks_expired");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "staff_auth_required" }), { status: 401 })));

    renderApp(<App />);

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(sessionStorage.getItem("parikshaa.console.session")).toBeNull();
  });
});

describe("console", () => {
  it("lists exams", async () => {
    renderApp(<App client={stubClient()} />);
    expect(await screen.findByRole("button", { name: "Algorithms" })).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
  });

  it("filters exams by where they stand, each filter with its count, and leaves the figures to Home", async () => {
    const counts = (inProgress: number, submitted: number, graded: number) => ({ invited: 0, inProgress, submitted, graded, void: 0 });
    const client = stubClient({
      listExams: vi.fn(async () => [
        { id: "live", title: "Campus Drive", questionCount: 20, durationMs: 3_600_000, totalMarks: 80, proctored: true, sectionCount: 2, attempts: counts(3, 1, 0) },
        { id: "done", title: "Mid-term", questionCount: 5, attempts: counts(0, 2, 7) },
        { id: "new", title: "Mock Test", questionCount: 10, attempts: counts(0, 0, 0) },
        { id: "old", title: "Last year's drive", questionCount: 8, attempts: counts(0, 0, 4), archivedAt: "2026-01-01T00:00:00Z" },
      ]),
    });
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Exams" }));
    await screen.findByRole("button", { name: "Campus Drive" });

    // The figures are Home's; here they would only repeat it.
    expect(screen.queryByRole("region", { name: "At a glance" })).not.toBeInTheDocument();
    expect(screen.getByText("60 min · 80 marks")).toBeInTheDocument();
    expect(screen.getByText("Proctored")).toBeInTheDocument();
    const row = (title: string) => screen.getByRole("button", { name: title }).closest("tr")!;
    expect(within(row("Campus Drive")).getByText("Open now")).toBeInTheDocument();
    expect(within(row("Mid-term")).getByText("Closed")).toBeInTheDocument();
    expect(within(row("Mock Test")).getByText("Draft")).toBeInTheDocument();
    // Archived exams are kept out of the way.
    expect(screen.queryByRole("button", { name: "Last year's drive" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "To grade 2" }));
    expect(screen.getByRole("button", { name: "Mid-term" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mock Test" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Draft 1" }));
    expect(screen.getByRole("button", { name: "Mock Test" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Campus Drive" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Archived 1" }));
    expect(screen.getByRole("button", { name: "Last year's drive" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "All 3" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Search exams" }), "mid");
    expect(screen.getByRole("button", { name: "Mid-term" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mock Test" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("searchbox", { name: "Search exams" }), "zzz");
    await userEvent.click(screen.getByRole("button", { name: "Clear the search" }));
    expect(screen.getByRole("button", { name: "Mock Test" })).toBeInTheDocument();
  });

  it("keeps an exam's other actions behind its ⋯, and archives from there", async () => {
    const archiveExam = vi.fn(async () => undefined);
    const client = stubClient({
      listExams: vi.fn(async () => [{ id: "e1", title: "Campus Drive", questionCount: 2, attempts: { invited: 0, inProgress: 0, submitted: 1, graded: 0, void: 0 } }]),
      archiveExam,
    });
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Exams" }));
    await userEvent.click(await screen.findByRole("button", { name: "More actions for Campus Drive" }));
    const menu = screen.getByRole("menu", { name: "More actions for Campus Drive" });
    // Sat, so fixed: Edit says why it cannot be chosen.
    expect(within(menu).getByRole("menuitem", { name: /Edit/ })).toHaveAttribute("aria-disabled", "true");
    expect(within(menu).getByText(/Make a copy to change it/)).toBeInTheDocument();
    // Focus goes to the first item, disabled or not, and the arrows move on from it.
    expect(within(menu).getByRole("menuitem", { name: /Edit/ })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(within(menu).getByRole("menuitem", { name: "Copy to change" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(within(menu).getByRole("menuitem", { name: "Archive" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(archiveExam).toHaveBeenCalledWith("e1", true);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More actions for Campus Drive" })).toHaveFocus();
  });
});

describe("exam editor", () => {
  const openEditor = async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));
    return client;
  };

  it("refuses to save an exam it knows is invalid, and says why", async () => {
    const client = await openEditor();

    // A blank title and a blank mcq option: invalid before it ever reaches the server.
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    const problems = await screen.findByRole("list", { name: "Problems with this exam" });
    expect(within(problems).getByText(/needs a title/i)).toBeInTheDocument();
    expect(client.saveExam).not.toHaveBeenCalled();
  });

  it("saves a well-formed exam", async () => {
    const client = await openEditor();

    await userEvent.type(screen.getByLabelText("Title"), "Mechanics");
    await userEvent.type(screen.getByLabelText("Question"), "Which is stable?");
    await userEvent.type(screen.getByLabelText("Option 1"), "quicksort");
    await userEvent.type(screen.getByLabelText("Option 2"), "mergesort");
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    await waitFor(() => expect(client.saveExam).toHaveBeenCalled());
    const saved = (client.saveExam as unknown as { mock: { calls: [unknown][] } }).mock.calls[0]![0] as {
      title: string;
      questions: { options: string[] }[];
    };
    expect(saved.title).toBe("Mechanics");
    expect(saved.questions[0]?.options).toEqual(["quicksort", "mergesort"]);
  });

  it("saves an mcq with several right options, partial credit, negative marks and a picture", async () => {
    const client = await openEditor();
    await userEvent.type(screen.getByLabelText("Title"), "Aptitude");
    await userEvent.type(screen.getByLabelText("Question"), "Which are prime?");
    await userEvent.type(screen.getByLabelText("Option 1"), "2");
    await userEvent.type(screen.getByLabelText("Option 2"), "4");
    await userEvent.click(screen.getByRole("button", { name: "Add option" }));
    await userEvent.type(screen.getByLabelText("Option 3"), "5");
    await userEvent.click(screen.getByLabelText("More than one option is right"));
    await userEvent.click(screen.getByLabelText("Option 3 is correct"));
    await userEvent.click(screen.getByLabelText("Partial credit for each right option chosen"));
    await userEvent.type(screen.getByLabelText("Negative marks for a wrong answer"), "1");
    await userEvent.upload(screen.getByLabelText("Pictures with the question"), new File(["png"], "number-line.png", { type: "image/png" }));
    expect(await screen.findByLabelText("What picture 1 shows")).toHaveValue("number line");
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    await waitFor(() => expect(client.saveExam).toHaveBeenCalled());
    const saved = (client.saveExam as unknown as { mock: { calls: [{ questions: unknown[] }][] } }).mock.calls[0]![0];
    expect(saved.questions[0]).toMatchObject({
      correctIndex: 0,
      correctIndices: [0, 2],
      partialCredit: true,
      negativeMarks: 1,
      images: [{ media: "b".repeat(64), alt: "number line" }],
    });
  });

  it("gives a question a passage, and the next one the same passage", async () => {
    const client = await openEditor();
    await userEvent.type(screen.getByLabelText("Title"), "Reading");
    await userEvent.type(screen.getByLabelText("Question"), "When does it arrive?");
    await userEvent.type(screen.getByLabelText("Option 1"), "June");
    await userEvent.type(screen.getByLabelText("Option 2"), "July");
    await userEvent.click(screen.getByRole("button", { name: "Add a passage" }));
    await userEvent.type(screen.getByLabelText("Passage title"), "The monsoon");
    await userEvent.type(screen.getByLabelText("Passage"), "The monsoon reaches Kerala in early June.");
    await userEvent.click(screen.getByRole("button", { name: "Add question" }));
    const second = screen.getByRole("region", { name: "Editing question 2" });
    await userEvent.type(within(second).getByLabelText("Question"), "Where does it arrive first?");
    await userEvent.type(within(second).getByLabelText("Option 1"), "Kerala");
    await userEvent.type(within(second).getByLabelText("Option 2"), "Delhi");
    await userEvent.click(within(second).getByRole("button", { name: "Use the passage of the question above" }));
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    await waitFor(() => expect(client.saveExam).toHaveBeenCalled());
    const saved = (client.saveExam as unknown as { mock: { calls: [{ questions: { passage?: unknown }[] }][] } }).mock.calls[0]![0];
    expect(saved.questions[0]!.passage).toMatchObject({ title: "The monsoon", text: "The monsoon reaches Kerala in early June." });
    expect(saved.questions[1]!.passage).toEqual(saved.questions[0]!.passage);
  });

  it("saves a question's Hindi translation, options in the original's order", async () => {
    const client = await openEditor();

    await userEvent.type(screen.getByLabelText("Title"), "Mechanics");
    await userEvent.type(screen.getByLabelText("Question"), "Which is stable?");
    await userEvent.type(screen.getByLabelText("Option 1"), "quicksort");
    await userEvent.type(screen.getByLabelText("Option 2"), "mergesort");
    await userEvent.click(screen.getByText("Translations"));
    await userEvent.selectOptions(screen.getByLabelText("Language to add"), "hi");
    await userEvent.click(screen.getByRole("button", { name: "Add translation" }));
    await userEvent.type(screen.getByLabelText("Question in Hindi"), "कौन सा स्थिर है?");
    await userEvent.type(screen.getByLabelText("Option 1 in Hindi"), "क्विकसॉर्ट");
    await userEvent.type(screen.getByLabelText("Option 2 in Hindi"), "मर्जसॉर्ट");
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    await waitFor(() => expect(client.saveExam).toHaveBeenCalled());
    const saved = (client.saveExam as unknown as { mock: { calls: [{ questions: { translations: unknown }[] }][] } }).mock.calls[0]![0];
    expect(saved.questions[0]!.translations).toEqual({ hi: { stem: "कौन सा स्थिर है?", options: ["क्विकसॉर्ट", "मर्जसॉर्ट"] } });
  });

  it("replaces the fields that do not carry across when the type changes", async () => {
    await openEditor();

    expect(screen.getByLabelText("Option 1")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Type"), "numeric");

    expect(screen.queryByLabelText("Option 1")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Expected value")).toBeInTheDocument();
    expect(screen.getByLabelText("Tolerance (±)")).toBeInTheDocument();
  });

  it("shows the server's objections when it disagrees with the client", async () => {
    const client = stubClient({
      saveExam: vi.fn(async () => {
        throw new ConsoleError(422, "invalid_exam", [
          { path: "questions.0.maxScore", message: "Marks must be greater than zero." },
        ]);
      }),
    });
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));

    await userEvent.type(screen.getByLabelText("Title"), "Mechanics");
    await userEvent.type(screen.getByLabelText("Question"), "Which?");
    await userEvent.type(screen.getByLabelText("Option 1"), "a");
    await userEvent.type(screen.getByLabelText("Option 2"), "b");
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    expect(await screen.findByText(/Marks must be greater than zero/)).toBeInTheDocument();
  });
});

describe("attempts", () => {
  it("issues an access code when an attempt is started", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));

    // Not a card on the overview: one of the exam's other actions.
    await userEvent.click(await screen.findByRole("button", { name: "More actions for Algorithms" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Start an attempt by reference…" }));
    const dialog = screen.getByRole("dialog", { name: "Start an attempt by reference" });
    await userEvent.type(within(dialog).getByLabelText("Candidate reference"), "cand-9");
    await userEvent.click(within(dialog).getByRole("button", { name: "Start" }));

    expect(await screen.findByLabelText("Access code")).toHaveValue("issued-token");
    expect(client.startAttempt).toHaveBeenCalledWith("exam-1", "cand-9");
  });
});

describe("attempt review", () => {
  const openReview = async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await userEvent.click(await screen.findByRole("button", { name: "Review" }));
    return client;
  };

  it("shows the grade and the evidence as separate things", async () => {
    await openReview();

    expect(await screen.findByText("11")).toBeInTheDocument();

    const evidence = screen.getByRole("region", { name: "Provenance evidence" });
    expect(evidence).toHaveTextContent(/not part of the grade and has not changed it/i);
    expect(evidence).toHaveTextContent("Which quantity decreases each round?");
    expect(evidence).toHaveTextContent("14s");
    expect(evidence).toHaveTextContent(/Contradicts or misreads their own answer/);
    expect(evidence).toHaveTextContent(/names a different quantity/);
  });

  it("offers no control that turns a verdict into a mark", async () => {
    await openReview();
    const evidence = await screen.findByRole("region", { name: "Provenance evidence" });

    // SPEC §6.1: adjusting a grade is a decision a person makes and owns, not a
    // button that launders a model's reading into a number. The worst verdict in
    // the fixture must produce no such affordance.
    for (const control of within(evidence).queryAllByRole("button")) {
      expect(control.textContent ?? "").not.toMatch(/mark|score|grade|deduct|penal|adjust|fail|void/i);
    }
    expect(evidence).not.toHaveTextContent(/deduct|penalt/i);
  });

  it("keeps the decision out of the evidence section", async () => {
    await openReview();

    const evidence = await screen.findByRole("region", { name: "Provenance evidence" });
    const decision = screen.getByRole("region", { name: "Decision" });

    // Placing it in the evidence card would make setting an attempt aside look
    // like the verdict's consequence; in the grade card, like a grading action.
    // It is neither (SPEC §6.1).
    expect(within(evidence).queryByRole("button", { name: /set aside/i })).not.toBeInTheDocument();
    expect(within(decision)).toBeTruthy();
    expect(decision).toHaveTextContent(/Nothing above sets this attempt aside on its own/i);
  });

  it("takes two steps and a written reason", async () => {
    const client = await openReview();
    const decision = await screen.findByRole("region", { name: "Decision" });

    // No reason field until the reviewer has said they are deciding.
    expect(screen.queryByLabelText("Reason")).not.toBeInTheDocument();
    await userEvent.click(within(decision).getByRole("button", { name: "Set aside…" }));

    const confirm = screen.getByRole("button", { name: "Set this attempt aside" });
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Reason"), "too short");
    expect(confirm).toBeDisabled();
    expect(screen.getByText(/cannot be defended on appeal/i)).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Reason"));
    await userEvent.type(screen.getByLabelText("Reason"), "Provenance could not be established on review.");
    await userEvent.click(confirm);

    await waitFor(() =>
      expect(client.voidAttempt).toHaveBeenCalledWith(
        "attempt-1",
        "Provenance could not be established on review.",
      ),
    );
  });

  it("shows the recorded reason once an attempt is set aside", async () => {
    const client = stubClient({
      review: vi.fn(async () => ({
        ...review,
        state: "void",
        voidReason: "Could not establish that this work was the candidate's own.",
        voidedBy: { userId: "u1", name: "Asha" },
      })),
    });
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await userEvent.click(await screen.findByRole("button", { name: "Review" }));

    const aside = await screen.findByRole("region", { name: "Set aside" });
    expect(aside).toHaveTextContent(/Could not establish that this work was the candidate's own/);
    expect(aside).toHaveTextContent("set aside by Asha");
    expect(screen.queryByRole("button", { name: "Set aside…" })).not.toBeInTheDocument();
  });

  it("shows the answers and marks beside the evidence, and J and K move between them", async () => {
    await openReview();
    const answers = await screen.findByRole("region", { name: "Answers" });
    const items = await within(answers).findAllByRole("listitem");
    expect(items[1]).toHaveTextContent("4 / 5");
    await userEvent.keyboard("j");
    expect(items[0]).toHaveFocus();
    await userEvent.keyboard("j");
    expect(items[1]).toHaveFocus();
    await userEvent.keyboard("k");
    expect(items[0]).toHaveFocus();
  });

  it("sets an attempt aside only from its own decision, in a dialog", async () => {
    await openReview();
    const decision = await screen.findByRole("region", { name: "Decision" });
    await userEvent.click(within(decision).getByRole("button", { name: "Set aside…" }));
    const dialog = screen.getByRole("dialog", { name: "Set this attempt aside" });
    expect(within(dialog).getByLabelText("Reason")).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(within(decision).getByRole("button", { name: "Set aside…" })).toHaveFocus();
  });

  it("shows the staff-side rationale, which the candidate never sees", async () => {
    await openReview();
    const evidence = await screen.findByRole("region", { name: "Provenance evidence" });

    expect(evidence).toHaveTextContent(/Answer scored 8\/10/);
  });
});

describe("what a role is shown", () => {
  it("shows an invigilator no authoring, no evidence and no administration", async () => {
    const client = stubClient({ me: vi.fn(async () => who("invigilator", ["exam:read", "attempt:start", "attempt:read"])) });
    renderApp(<App client={client} />);

    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    expect(await screen.findByRole("button", { name: "Review" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "More actions for Algorithms" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Start an attempt by reference…" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: /Edit|copy|Archive/ })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    const nav = screen.getByRole("navigation", { name: "Account" });
    for (const tab of ["Staff", "API keys", "Spend", "Audit log"]) {
      expect(within(nav).queryByRole("button", { name: tab })).not.toBeInTheDocument();
    }
    await userEvent.click(within(nav).getByRole("button", { name: "Exams" }));
    expect(screen.queryByRole("button", { name: "New exam" })).not.toBeInTheDocument();
  });

  it("offers a viewer the evidence but no decision", async () => {
    const client = stubClient({
      me: vi.fn(async () => who("viewer", ["exam:read", "attempt:read", "attempt:review"])),
      review: vi.fn(async () => ({ ...review, state: "submitted" })),
    });
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await userEvent.click(await screen.findByRole("button", { name: "Review" }));

    expect(await screen.findByRole("region", { name: "Provenance evidence" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Decision" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Grade attempt" })).not.toBeInTheDocument();
  });

  it("shows the reason a grade was refused", async () => {
    const client = stubClient({
      review: vi.fn(async () => ({ ...review, state: "submitted" })),
      grade: vi.fn(async () => {
        throw new ConsoleError(402, "spend_cap_reached", [], "This organisation's monthly model spend cap has been reached");
      }),
    });
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await userEvent.click(await screen.findByRole("button", { name: "Review" }));
    await userEvent.click(await screen.findByRole("button", { name: "Grade attempt" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/spend cap has been reached/);
  });
});

describe("administration", () => {
  const open = async (tab: string) => {
    const client = stubClient();
    renderApp(<App client={client} />);
    const nav = await screen.findByRole("navigation", { name: "Account" });
    await userEvent.click(await within(nav).findByRole("button", { name: tab }));
    return client;
  };

  it("adds a member of staff", async () => {
    const client = await open("Staff");

    await userEvent.type(await screen.findByLabelText("Name"), "Neha");
    await userEvent.type(screen.getByLabelText("Email"), "neha@acme.test");
    await userEvent.selectOptions(screen.getByLabelText("Role"), "reviewer");
    await userEvent.type(screen.getByLabelText("Initial password"), "an initial passphrase");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(client.addStaff).toHaveBeenCalledWith({
        name: "Neha",
        email: "neha@acme.test",
        role: "reviewer",
        password: "an initial passphrase",
      }),
    );
  });

  it("shows model spend per attempt, which is what pricing is built on", async () => {
    await open("Spend");

    const spend = await screen.findByRole("region", { name: "Model spend" });
    expect(spend).toHaveTextContent("$0.02");
    expect(spend).toHaveTextContent("$0.0075");
    expect(spend).toHaveTextContent(/Cap \$50\.00/);
  });
});

describe("the room, for an invigilator", () => {
  const sitting = vi.fn(async () => [
    { id: "attempt-1", candidateId: "cand-1", entries: 7, state: "graded" as const, lastSeenAt: null },
    {
      id: "attempt-3",
      candidateId: "cand-3",
      entries: 2,
      state: "in_progress" as const,
      lastSeenAt: new Date(Date.now() - 20_000).toISOString(),
    },
  ]);
  const invigilator = () =>
    stubClient({
      listAttempts: sitting,
      me: vi.fn(async () => who("invigilator", ["exam:read", "attempt:start", "attempt:read", "attempt:extend"])),
    });

  it("shows who is here", async () => {
    renderApp(<App client={invigilator()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));

    const row = (await screen.findByText("cand-3")).closest("tr")!;
    expect(row).toHaveTextContent("Here now");
    expect(row).toHaveTextContent("In progress");
    expect((await screen.findByText("cand-1")).closest("tr")).toHaveTextContent("Graded");
  });

  it("grants extra time with a reason", async () => {
    const client = invigilator();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await userEvent.click(await screen.findByRole("button", { name: "More actions for cand-3" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Extra time…" }));

    const form = screen.getByRole("form", { name: "Extra time for cand-3" });
    const grant = within(form).getByRole("button", { name: "Grant extra time" });
    await userEvent.clear(within(form).getByLabelText("Extra minutes"));
    await userEvent.type(within(form).getByLabelText("Extra minutes"), "15");
    await userEvent.type(within(form).getByLabelText("Reason"), "short");
    expect(grant).toBeDisabled();

    await userEvent.type(within(form).getByLabelText("Reason"), " — power cut in hall B");
    await userEvent.click(grant);

    await waitFor(() =>
      expect(client.extendTime).toHaveBeenCalledWith("attempt-3", 15, "short — power cut in hall B"),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("offers extra time only to those who may grant it, and only on open attempts", async () => {
    renderApp(
      <App
        client={stubClient({
          listAttempts: sitting,
          me: vi.fn(async () => who("viewer", ["exam:read", "attempt:read", "attempt:review"])),
        })}
      />,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await screen.findByText("cand-3");

    // Nothing else to do with the row, so no "⋯" at all.
    expect(screen.queryByRole("button", { name: "More actions for cand-3" })).not.toBeInTheDocument();
  });
});

describe("the question bank", () => {
  const openBank = async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    const nav = await screen.findByRole("navigation", { name: "Account" });
    await userEvent.click(await within(nav).findByRole("button", { name: "Question bank" }));
    return client;
  };

  it("lists questions with their topic and difficulty", async () => {
    await openBank();
    const bank = await screen.findByRole("region", { name: "Question bank" });

    expect(await within(bank).findByText("Train speed problem")).toBeInTheDocument();
    expect(within(bank).getAllByText("quant")).not.toHaveLength(0);
    // Types in words, difficulty as a badge; the page's title is not repeated in a card.
    const row = within(bank).getByText("Train speed problem").closest("tr")!;
    expect(within(row).getByText("Multiple choice")).toBeInTheDocument();
    expect(within(row).getByText("Easy")).toHaveClass("pill", "difficulty-easy");
    expect(within(bank).queryByText("Question bank")).toBeNull();
  });

  it("acts on several questions at once", async () => {
    const client = await openBank();
    const bank = await screen.findByRole("region", { name: "Question bank" });
    await userEvent.click(await within(bank).findByLabelText("Choose every question shown"));
    const bulk = within(bank).getByRole("group", { name: "With the chosen questions" });
    expect(bulk).toHaveTextContent("2 chosen");

    await userEvent.click(within(bulk).getByRole("button", { name: "Change topic…" }));
    const dialog = screen.getByRole("dialog", { name: "Change topic" });
    await userEvent.type(within(dialog).getByLabelText("Topic"), "arithmetic");
    await userEvent.click(within(dialog).getByRole("button", { name: "Change topic" }));
    await waitFor(() => expect(client.editQuestion).toHaveBeenCalledTimes(2));
    expect(client.editQuestion).toHaveBeenCalledWith("b1", expect.objectContaining({ topic: "arithmetic", difficulty: "easy" }));

    await userEvent.click(within(bank).getByLabelText("Choose “Work and time problem”"));
    await userEvent.click(within(within(bank).getByRole("group", { name: "With the chosen questions" })).getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(client.archiveQuestion).toHaveBeenCalledWith("b2"));
  });

  it("imports a CSV file and lists every rejected row", async () => {
    const client = await openBank();
    (client.importBank as unknown as { mockRejectedValueOnce: (e: unknown) => void }).mockRejectedValueOnce(
      new ConsoleError(422, "invalid_import", [{ path: "row 3", message: "The answer \"Z\" is not one of the options." }]),
    );

    const file = new File(["kind,question\nmcq,x"], "bank.csv", { type: "text/csv" });
    await userEvent.upload(await screen.findByLabelText("CSV file"), file);

    const problems = await screen.findByRole("list", { name: "Problems with this file" });
    expect(problems).toHaveTextContent("row 3");
    expect(client.importBank).toHaveBeenCalledWith("kind,question\nmcq,x");
  });

  it("reads a Word paper first, shows every question found, and adds them only when asked", async () => {
    const client = await openBank();
    await userEvent.click(await screen.findByRole("tab", { name: "Word document" }));
    const file = new File(["PK fake docx"], "paper.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    await userEvent.upload(await screen.findByLabelText("Word file (.docx)"), file);

    const found = await screen.findByRole("table", { name: "Questions found" });
    expect(within(found).getByText("Which is stable?")).toBeInTheDocument();
    expect(within(found).getByText(/picture or equation, which was not imported/)).toBeInTheDocument();
    expect(client.importDocx).toHaveBeenCalledWith(btoa("PK fake docx"), true);
    expect(client.importDocx).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Add 2 questions to the bank" }));
    expect(await screen.findByText("Imported 2 questions from the document.")).toBeInTheDocument();
    expect(client.importDocx).toHaveBeenLastCalledWith(btoa("PK fake docx"), false);
  });

  it("lists a Word paper's problems by question", async () => {
    const client = await openBank();
    (client.importDocx as unknown as { mockRejectedValueOnce: (e: unknown) => void }).mockRejectedValueOnce(
      new ConsoleError(422, "invalid_import", [{ path: "question 4 (numbered 2)", message: 'No answer: add an "Answer:" line.' }]),
    );
    await userEvent.click(await screen.findByRole("tab", { name: "Word document" }));
    await userEvent.upload(await screen.findByLabelText("Word file (.docx)"), new File(["x"], "paper.docx"));
    const problems = await screen.findByRole("list", { name: "Problems with this document" });
    expect(problems).toHaveTextContent("question 4 (numbered 2)");
    expect(screen.queryByRole("table", { name: "Questions found" })).not.toBeInTheDocument();
  });

  it("files a new question with its topic and tags", async () => {
    const client = await openBank();
    await userEvent.click(await screen.findByRole("button", { name: "New question" }));

    await userEvent.type(screen.getByLabelText("Question"), "Which is stable?");
    await userEvent.type(screen.getByLabelText("Option 1"), "quicksort");
    await userEvent.type(screen.getByLabelText("Option 2"), "mergesort");
    await userEvent.type(screen.getByLabelText("Topic"), "sorting");
    await userEvent.type(screen.getByLabelText("Tags, comma separated"), "dsa, campus");
    await userEvent.click(screen.getByRole("button", { name: "Save to bank" }));

    await waitFor(() =>
      expect(client.fileQuestion).toHaveBeenCalledWith(
        expect.objectContaining({
          question: expect.objectContaining({ stem: "Which is stable?", options: ["quicksort", "mergesort"] }),
          topic: "sorting",
          tags: ["dsa", "campus"],
        }),
      ),
    );
  });
});

describe("exams drawn from the bank", () => {
  it("builds a section that draws per candidate from questions picked in the bank", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));
    await userEvent.type(screen.getByLabelText("Title"), "Aptitude");
    await userEvent.type(screen.getByLabelText("Question"), "Fixed question");
    await userEvent.type(screen.getByLabelText("Option 1"), "a");
    await userEvent.type(screen.getByLabelText("Option 2"), "b");

    await userEvent.click(screen.getByRole("button", { name: "Add a section drawn per candidate" }));
    const section = screen.getByRole("region", { name: "Section 1" });
    await userEvent.type(within(section).getByLabelText("Section title"), "Quant");
    await userEvent.click(within(section).getByRole("button", { name: "Add from bank" }));

    const picker = await screen.findByRole("dialog", { name: "Add from the question bank" });
    await userEvent.click(await within(picker).findByRole("button", { name: "Select all 2" }));
    await userEvent.click(within(picker).getByRole("button", { name: "Add 2 questions" }));
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    await waitFor(() => expect(client.saveExam).toHaveBeenCalled());
    const saved = (client.saveExam as unknown as { mock: { calls: [{ sections: unknown[] }][] } }).mock.calls[0]![0];
    expect(saved.sections).toEqual([
      { id: "s1", title: "Quant", pick: 1, pool: [bankEntries[0]!.question, bankEntries[1]!.question] },
    ]);
  });

  it("gives a section its own time, which makes the test go section by section", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));
    await userEvent.type(screen.getByLabelText("Title"), "Aptitude");
    await userEvent.type(screen.getByLabelText("Question"), "Fixed question");
    await userEvent.type(screen.getByLabelText("Option 1"), "a");
    await userEvent.type(screen.getByLabelText("Option 2"), "b");
    await userEvent.click(screen.getByRole("button", { name: "Add a section drawn per candidate" }));
    const section = screen.getByRole("region", { name: "Section 1" });
    await userEvent.type(within(section).getByLabelText("Section title"), "Quant");
    await userEvent.click(within(section).getByRole("button", { name: "Add from bank" }));
    const picker = await screen.findByRole("dialog", { name: "Add from the question bank" });
    await userEvent.click(await within(picker).findByRole("button", { name: "Select all 2" }));
    await userEvent.click(within(picker).getByRole("button", { name: "Add 2 questions" }));

    await userEvent.type(within(section).getByLabelText("Own time (minutes)"), "15");
    expect(within(section).getByText(/locked once left, and closes when its 15 minutes are up/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    await waitFor(() => expect(client.saveExam).toHaveBeenCalled());
    const saved = (client.saveExam as unknown as { mock: { calls: [{ sections: { durationMs?: number }[] }][] } }).mock.calls[0]![0];
    expect(saved.sections[0]!.durationMs).toBe(15 * 60_000);
  });

  it("copies an exam, which is how a sat exam is changed", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Exams" }));
    await userEvent.click(await screen.findByRole("button", { name: "More actions for Algorithms" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Make a copy" }));

    await waitFor(() => expect(client.cloneExam).toHaveBeenCalledWith("exam-1", expect.stringMatching(/^exam-1-copy-/)));
  });

  it("says plainly that a sat exam cannot be edited", async () => {
    const client = stubClient({
      loadExam: vi.fn(async () => ({
        id: "exam-1",
        title: "Algorithms",
        questions: [],
        policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.5 },
      })),
      saveExam: vi.fn(async () => {
        throw new ConsoleError(409, "exam_frozen");
      }),
    });
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Exams" }));
    await userEvent.click(await screen.findByRole("button", { name: "More actions for Algorithms" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    await userEvent.click(await screen.findByRole("button", { name: "Add question" }));
    await userEvent.type(screen.getAllByLabelText("Question").at(-1)!, "One more");
    await userEvent.type(screen.getAllByLabelText("Option 1").at(-1)!, "a");
    await userEvent.type(screen.getAllByLabelText("Option 2").at(-1)!, "b");
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    expect(await screen.findByRole("list", { name: "Problems with this exam" })).toHaveTextContent(
      /has been sat.*Make a copy/,
    );
  });
});

describe("writing a code question", () => {
  it("sets languages, a visible example and a hidden test, and saves them", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));
    await userEvent.type(screen.getByLabelText("Title"), "Coding round");
    await userEvent.type(screen.getByLabelText("Question"), "Print the sum of two integers.");
    await userEvent.selectOptions(screen.getByLabelText("Type"), "code");

    await userEvent.click(screen.getByLabelText("Java")); // offered by default; take it away
    await userEvent.click(screen.getByLabelText("C"));
    const [example, hidden] = screen.getAllByRole("group", { name: /^Test \d$/ });
    await userEvent.type(within(example!).getByLabelText("Input"), "2 3");
    await userEvent.type(within(example!).getByLabelText("Expected output"), "5");
    await userEvent.type(within(hidden!).getByLabelText("Input"), "-7 2");
    await userEvent.type(within(hidden!).getByLabelText("Expected output"), "-5");
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    await waitFor(() => expect(client.saveExam).toHaveBeenCalled());
    const saved = (client.saveExam as unknown as { mock: { calls: [{ questions: unknown[] }][] } }).mock.calls[0]![0];
    expect(saved.questions[0]).toMatchObject({
      kind: "code",
      language: "python",
      languages: ["python", "c", "cpp"],
      tests: [
        { input: "2 3", expected: "5", hidden: false, weight: 1 },
        { input: "-7 2", expected: "-5", hidden: true, weight: 1 },
      ],
    });
  });

  it("writes a LeetCode-style function question: the signature, checked tests, and the exam's coding settings", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));
    await userEvent.type(screen.getByLabelText("Title"), "LeetCode round");
    await userEvent.type(screen.getByLabelText("Question"), "Return the indices of the two numbers that add up to `target`.");
    await userEvent.selectOptions(screen.getByLabelText("Type"), "code");
    await userEvent.click(screen.getByLabelText(/A function, as on LeetCode/));

    const fn = screen.getByRole("group", { name: "The function" });
    await userEvent.clear(within(fn).getByLabelText("Function name"));
    await userEvent.type(within(fn).getByLabelText("Function name"), "twoSum");
    await userEvent.selectOptions(within(fn).getByLabelText("Returns"), "int[]");
    await userEvent.selectOptions(within(fn).getByLabelText("A returned list may come"), "top");
    await userEvent.click(within(fn).getByRole("button", { name: "Add parameter" }));
    const second = within(fn).getByRole("group", { name: "Parameter 2" });
    await userEvent.clear(within(second).getByLabelText("Name"));
    await userEvent.type(within(second).getByLabelText("Name"), "target");

    // The starter is written from the signature, for each language offered.
    await userEvent.click(within(fn).getByText("What candidates start from"));
    expect(within(fn).getByText(/def twoSum\(self, nums: List\[int\], target: int\) -> List\[int\]:/)).toBeInTheDocument();

    const [example, hidden] = screen.getAllByRole("group", { name: /^Test \d$/ });
    await userEvent.type(within(example!).getByLabelText("Arguments"), "[[2,7,11,15]{enter}9");
    await userEvent.type(within(example!).getByLabelText("Expected return value"), "[[0,1]");
    await userEvent.type(within(example!).getByLabelText(/Explanation shown/), "2 + 7 = 9");
    // A test that does not fit the function is named as it is typed.
    await userEvent.type(within(hidden!).getByLabelText("Arguments"), "[[3,3]");
    expect(within(hidden!).getByRole("list", { name: "Problems with test 2" })).toHaveTextContent(/one line per parameter \(nums, target\)/);
    await userEvent.type(within(hidden!).getByLabelText("Arguments"), "{enter}6");
    await userEvent.type(within(hidden!).getByLabelText("Expected return value"), "[[0,1]");
    expect(within(hidden!).queryByRole("list", { name: "Problems with test 2" })).toBeNull();

    await userEvent.selectOptions(screen.getByLabelText("Submit shows the candidate"), "visible");
    await userEvent.click(screen.getByLabelText("Offer completion in the code editor"));
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    await waitFor(() => expect(client.saveExam).toHaveBeenCalled());
    const saved = (client.saveExam as unknown as { mock: { calls: [{ questions: unknown[]; policy: unknown }][] } }).mock.calls[0]![0];
    expect(saved.policy).toMatchObject({ testFeedback: "visible", codeCompletion: true });
    expect(saved.questions[0]).toMatchObject({
      kind: "code",
      signature: {
        name: "twoSum",
        params: [
          { name: "nums", type: "int[]" },
          { name: "target", type: "int" },
        ],
        returns: "int[]",
        anyOrder: "top",
      },
      tests: [
        { input: "[2,7,11,15]\n9", expected: "[0,1]", hidden: false, explanation: "2 + 7 = 9" },
        { input: "[3,3]\n6", expected: "[0,1]", hidden: true },
      ],
    });
    expect(saved.questions[0]).not.toHaveProperty("starter");
  });

  it("gives a whole-program question a checker for many right answers", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));
    await userEvent.type(screen.getByLabelText("Title"), "Coding round");
    await userEvent.type(screen.getByLabelText("Question"), "Print any two numbers that sum to n.");
    await userEvent.selectOptions(screen.getByLabelText("Type"), "code");
    await userEvent.selectOptions(screen.getByLabelText("Output is judged"), "custom");
    expect((screen.getByLabelText("Checker program (Python 3)") as HTMLTextAreaElement).value).toContain("sys.exit(0)");
    await userEvent.selectOptions(screen.getByLabelText("Output is judged"), "numbers");
    expect(screen.getByLabelText("Tolerance")).toHaveValue(0.000001);
  });

  it("will not save a question whose every test is visible", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));
    await userEvent.type(screen.getByLabelText("Title"), "Coding round");
    await userEvent.type(screen.getByLabelText("Question"), "Anything.");
    await userEvent.selectOptions(screen.getByLabelText("Type"), "code");
    // The new question's second test starts hidden; make it visible too.
    await userEvent.click(screen.getAllByLabelText("Hidden from candidates")[1]!);
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    expect(await screen.findByRole("list", { name: "Problems with this exam" })).toHaveTextContent(/print the answers/);
    expect(client.saveExam).not.toHaveBeenCalled();
  });
});

describe("scheduling and inviting a cohort", () => {
  const open = async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await userEvent.click(await screen.findByRole("button", { name: "Candidates" }));
    return client;
  };

  it("checks a list first, shows what it found, and invites only when told to", async () => {
    const client = await open();
    const file = new File(["ref,name\nCS001,A\nCS002,B"], "cohort.csv", { type: "text/csv" });

    await userEvent.upload(await screen.findByLabelText("Candidate list (CSV)"), file);

    const preview = await screen.findByRole("group", { name: "Import preview" });
    expect(preview).toHaveTextContent("2 candidates ready to invite");
    expect(preview).toHaveTextContent(/row 3.*no email or phone/);
    // The row as the sheet has it, beside what is wrong with it.
    const flagged = within(preview).getByText(/no email or phone/).closest("tr")!;
    expect(flagged).toHaveClass("warning");
    expect(flagged).toHaveTextContent("CS002 · B");
    expect(client.importCandidates).toHaveBeenCalledWith("exam-1", "ref,name\nCS001,A\nCS002,B", true, ["email", "sms"]);
    expect(client.importCandidates).toHaveBeenCalledTimes(1);

    await userEvent.click(within(preview).getByRole("button", { name: "Invite 2 and send their links" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Invited 2");
    expect(client.importCandidates).toHaveBeenLastCalledWith("exam-1", "ref,name\nCS001,A\nCS002,B", false, ["email", "sms"]);
  });

  it("schedules on India's clock, whatever the computer's own zone", async () => {
    const client = await open();
    const opens = await screen.findByLabelText("Opens (IST)");
    // 04:30 UTC is 10:00 in India, and is shown so.
    expect(opens).toHaveValue("2026-10-01T10:00");
    await userEvent.clear(opens);
    await userEvent.type(opens, "2026-10-01T10:00");
    const closes = screen.getByLabelText("Closes (IST)");
    await userEvent.clear(closes);
    await userEvent.type(closes, "2026-10-01T13:00");
    await userEvent.click(screen.getByRole("button", { name: /^(Schedule|Reschedule)$/ }));
    await waitFor(() =>
      expect(client.setWindow).toHaveBeenCalledWith("exam-1", { opensAt: "2026-10-01T04:30:00.000Z", closesAt: "2026-10-01T07:30:00.000Z", hardClose: true }),
    );
  });

  it("shows each candidate's delivery, including what failed and why", async () => {
    await open();
    const table = await screen.findByRole("region", { name: "Invited candidates" });

    const row = (await within(table).findByText("CS001")).closest("tr")!;
    expect(within(row).getByRole("img", { name: "Email sent" })).toBeInTheDocument();
    const sms = within(row).getByRole("img", { name: "SMS failed: MSG91 400: bad number" });
    // What went wrong is in a tooltip, on hover and on focus.
    expect(within(row).getByRole("tooltip", { hidden: true })).toHaveTextContent("bad number");
    expect(sms).toHaveAttribute("tabindex", "0");
  });

  it("resends and revokes a candidate who has not started", async () => {
    const client = await open();
    const table = await screen.findByRole("region", { name: "Invited candidates" });

    await userEvent.click(await within(table).findByRole("button", { name: "More actions for CS001" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Resend the link" }));
    await userEvent.click(within(table).getByRole("button", { name: "More actions for CS001" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Withdraw the invitation" }));

    await waitFor(() => expect(client.resendInvitation).toHaveBeenCalledWith("i1", ["email", "sms"]));
    expect(client.revokeInvitation).toHaveBeenCalledWith("i1");
  });
});

describe("results and exports", () => {
  const open = async (client = stubClient()) => {
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await userEvent.click(await screen.findByRole("button", { name: "Results" }));
    return client;
  };
  const refs = (table: HTMLElement) => within(table).getAllByRole("row").slice(1).map((r) => r.querySelector("td")?.textContent);

  it("shows code answers alike enough to look at, as evidence, side by side on request", async () => {
    await open();
    const card = await screen.findByRole("region", { name: "Code similarity" });
    expect(card).toHaveClass("evidence");
    expect(card).toHaveTextContent("Nothing here changes a mark.");
    const row = within(card).getByRole("row", { name: /CS001 · Aarav Sharma and CS002 · Diya Patel/ });
    expect(row).toHaveTextContent("94%");
    await userEvent.click(within(row).getByRole("button", { name: "Compare" }));
    const compare = within(card).getByRole("group", { name: "CS001 and CS002, side by side" });
    expect(compare).toHaveTextContent("def longest_run(values):");
    expect(compare).toHaveTextContent("def f(a):");
  });

  it("lists candidates best first, and sorts and filters them", async () => {
    await open();
    const table = await screen.findByRole("region", { name: "Candidates" });

    await within(table).findByText("CS001");
    expect(refs(table)).toEqual(["CS001", "CS002", "CS010"]);

    await userEvent.click(within(table).getByRole("button", { name: "Roll no." }));
    expect(refs(table)).toEqual(["CS001", "CS002", "CS010"]);
    await userEvent.click(within(table).getByRole("button", { name: /^Roll no\./ }));
    expect(refs(table)).toEqual(["CS010", "CS002", "CS001"]);

    await userEvent.type(within(table).getByLabelText("Find a candidate"), "rohan");
    expect(refs(table)).toEqual(["CS002"]);
    await userEvent.clear(within(table).getByLabelText("Find a candidate"));
    await userEvent.selectOptions(within(table).getByLabelText("Show"), "submitted");
    expect(refs(table)).toEqual(["CS010"]);
  });

  it("shows the cohort's figures, and flags a question that does not separate", async () => {
    await open();
    // No card repeats the page's title: the figures, then the chart.
    const figures = await screen.findByRole("region", { name: "At a glance" });
    expect(within(figures).getByText("Mean").previousSibling).toHaveTextContent("65%");
    const chart = screen.getByRole("region", { name: "How the marks fell" });
    expect(within(chart).getByLabelText("90–100%: 1")).toBeInTheDocument();
    // Bands no one reached, below the lowest mark, are left out.
    expect(within(chart).queryByLabelText("0–10%: 0")).toBeNull();
    // The downloads are the page's own actions.
    const header = screen.getByRole("heading", { level: 1 }).closest("header")!;
    expect(within(header).getByRole("button", { name: "Download Excel" })).toBeEnabled();

    const questions = screen.getByRole("region", { name: "Questions" });
    expect(within(questions).getByText("Which sort is stable?").closest("tr")).toHaveTextContent(/worth a second look/);
    expect(within(questions).getByText("Trace the loop").closest("tr")).not.toHaveTextContent(/second look/);
  });

  it("draws the qualifying mark on the chart", async () => {
    await open(stubClient({ results: vi.fn(async () => ({ ...results, exam: { ...results.exam, cutoff: { percent: 50 } } })) }));
    const chart = await screen.findByRole("region", { name: "How the marks fell" });
    expect(chart).toHaveTextContent("Qualifies at 50%");
    // The band the mark falls in is kept, even if no one scored in it.
    expect(within(chart).getByLabelText("50–60%: 0")).toBeInTheDocument();
  });

  it("keeps the follow-up figures apart, as evidence about no one in particular", async () => {
    await open();
    const evidence = await screen.findByRole("region", { name: "Follow-up evidence" });
    expect(evidence).toHaveTextContent("1 asked of 1 candidate");
    expect(evidence).toHaveTextContent("1 inconsistent");
    expect(evidence).not.toHaveTextContent(/CS00|Ananya|Rohan/);
  });

  it("downloads the spreadsheet", async () => {
    const client = await open();
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    await userEvent.click(await screen.findByRole("button", { name: "Download Excel" }));
    await waitFor(() => expect(client.resultsFile).toHaveBeenCalledWith("exam-1", "xlsx"));
  });

  it("opens a candidate's report, with the code as written and the follow-up set apart", async () => {
    const client = await open();
    const table = await screen.findByRole("region", { name: "Candidates" });
    await userEvent.click(within((await within(table).findByText("CS001")).closest("tr")!).getByRole("button", { name: "Scorecard" }));

    expect(client.report).toHaveBeenCalledWith("a2");
    expect(await screen.findByText("9 / 10")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "90%" })).toBeInTheDocument();
    expect(screen.getByLabelText("Code in python")).toHaveTextContent("print(sum(map(int, input().split())))");
    const answers = screen.getByRole("region", { name: "Answers" });
    expect(answers).toHaveTextContent("Tests passed 3 of 4");
    expect(answers).not.toHaveTextContent("Why map before sum?");
    const evidence = screen.getByRole("region", { name: "Follow-up evidence" });
    expect(evidence).toHaveTextContent("About question 2");
    expect(evidence).toHaveTextContent("did not change the marks");
    expect(screen.getByText(/Record: 9 entries, head abababab/)).toBeInTheDocument();

    const print = vi.fn();
    vi.stubGlobal("print", print);
    await userEvent.click(screen.getByRole("button", { name: "Print or save as PDF" }));
    expect(print).toHaveBeenCalled();
  });

  it("is not offered to an invigilator", async () => {
    renderApp(<App client={stubClient({ me: vi.fn(async () => who("invigilator", ["exam:read", "attempt:start", "attempt:read", "attempt:extend"])) })} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await screen.findByRole("button", { name: "Candidates" });
    expect(screen.queryByRole("button", { name: "Results" })).toBeNull();
  });
});

describe("integrations", () => {
  const open = async (client = stubClient()) => {
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Integrations" }));
    return client;
  };

  it("adds a webhook and shows its signing secret", async () => {
    const client = await open();
    const form = await screen.findByRole("region", { name: "Add a webhook" });
    await userEvent.type(within(form).getByLabelText("Address (https)"), "https://hr.example.com/in");
    await userEvent.click(within(form).getByLabelText("attempt.graded"));
    await userEvent.click(within(form).getByRole("button", { name: "Add" }));

    expect(client.addWebhook).toHaveBeenCalledWith("https://hr.example.com/in", ["attempt.graded"], "");
    expect(await screen.findByRole("status", { name: /Signing secret/ })).toHaveTextContent("whsec_c2VjcmV0");
  });

  it("says why an address was refused", async () => {
    await open(stubClient({ addWebhook: vi.fn(async () => Promise.reject(new ConsoleError(422, "unsafe_url", [], "Only https URLs are allowed"))) }));
    const form = await screen.findByRole("region", { name: "Add a webhook" });
    await userEvent.type(within(form).getByLabelText("Address (https)"), "https://10.0.0.1/x");
    await userEvent.click(within(form).getByRole("button", { name: "Add" }));
    expect(await within(form).findByText(/cannot be used: Only https URLs are allowed/)).toBeInTheDocument();
  });

  it("shows a hook's deliveries, with what went wrong", async () => {
    await open();
    const hooks = await screen.findByRole("region", { name: "Webhooks" });
    await userEvent.click(await within(hooks).findByRole("button", { name: "Log" }));
    const log = await within(hooks).findByRole("table", { name: "Deliveries to https://ats.example.com/hook" });
    expect(log).toHaveTextContent("attempt.graded");
    expect(log).toHaveTextContent("after 3 tries");
    expect(log).toHaveTextContent("HTTP 503");
  });

  it("turns Greenhouse on and shows the key once", async () => {
    const client = await open();
    const greenhouse = await screen.findByRole("region", { name: "Greenhouse" });
    expect(greenhouse).toHaveTextContent("list_tests");
    await userEvent.click(within(greenhouse).getByRole("button", { name: "Turn on and issue a key" }));
    expect(client.issueGreenhouseKey).toHaveBeenCalled();
    expect(await within(greenhouse).findByRole("status", { name: "Your Greenhouse key" })).toHaveTextContent("ghk.acme.1.abc");
  });

  it("sets up Lever with a stage-to-exam map and its secrets", async () => {
    const client = await open();
    const lever = await screen.findByRole("region", { name: "Lever" });
    await userEvent.click(within(lever).getByRole("button", { name: "Set up Lever" }));
    await userEvent.type(within(lever).getByLabelText("Stage → exam"), "stage-assess = algorithms");
    await userEvent.type(within(lever).getByLabelText("Lever API key"), "k");
    await userEvent.type(within(lever).getByLabelText("Webhook signature token"), "s");
    await userEvent.click(within(lever).getByRole("button", { name: "Save and turn on" }));
    await waitFor(() =>
      expect(client.saveAts).toHaveBeenCalledWith("lever", { stageExams: { "stage-assess": "algorithms" } }, { apiKey: "k", signatureToken: "s" }),
    );
    expect(screen.getByRole("region", { name: "Zoho Recruit" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Darwinbox" })).toBeInTheDocument();
  });

  it("registers a Moodle site from its address, client ID and deployment", async () => {
    const client = await open();
    const moodle = await screen.findByRole("region", { name: "Moodle (LTI 1.3)" });
    await userEvent.type(within(moodle).getByLabelText("Moodle site address"), "https://lms.college.ac.in/");
    await userEvent.type(within(moodle).getByLabelText("Client ID"), "abc123");
    await userEvent.type(within(moodle).getByLabelText("Deployment ID"), "4");
    await userEvent.click(within(moodle).getByRole("button", { name: "Register" }));
    await waitFor(() =>
      expect(client.registerLti).toHaveBeenCalledWith({
        name: "lms.college.ac.in",
        issuer: "https://lms.college.ac.in",
        clientId: "abc123",
        deploymentIds: ["4"],
        authLoginUrl: "https://lms.college.ac.in/mod/lti/auth.php",
        authTokenUrl: "https://lms.college.ac.in/mod/lti/token.php",
        jwksUrl: "https://lms.college.ac.in/mod/lti/certs.php",
      }),
    );
  });

  it("is not offered to anyone but the owner", async () => {
    renderApp(<App client={stubClient({ me: vi.fn(async () => who("author", ["exam:read", "exam:read_key", "exam:write", "attempt:start", "attempt:read"])) })} />);
    await screen.findByRole("button", { name: "Algorithms" });
    expect(screen.queryByRole("button", { name: "Integrations" })).toBeNull();
  });

  it("opens a candidate's report from a ?report= link", async () => {
    window.history.replaceState(null, "", "/console/?report=a2");
    const client = stubClient();
    renderApp(<App client={client} />);
    expect(await screen.findByText("9 / 10")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "90%" })).toBeInTheDocument();
    expect(client.report).toHaveBeenCalledWith("a2");
    expect(window.location.search).toBe("");
  });
});

describe("the live sitting", () => {
  const open = async (client = stubClient()) => {
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await userEvent.click(await screen.findByRole("button", { name: "Live sitting" }));
    return client;
  };

  it("shows the room at a glance, and who has gone away", async () => {
    await open();
    const summary = await screen.findByRole("region", { name: "The sitting now" });
    // One bar of where everyone stands, with its counts beneath.
    const bar = within(summary).getByRole("region", { name: "Candidates by where they stand" });
    expect(within(bar).getByText("Away").previousSibling).toHaveTextContent("1");
    expect(summary).toHaveTextContent(/Updated (just now|\d+ s ago)/);
    const table = screen.getByRole("region", { name: "Candidates now" });
    const r2 = within(table).getByText("R2").closest("tr")!;
    expect(r2).toHaveTextContent("10 min ago");
    expect(within(r2).getByText("Away")).toBeInTheDocument();
    // Whoever needs someone is listed first.
    expect(within(table).getAllByRole("row")[1]).toBe(r2);
    expect(within(table).getByText("R1").closest("tr")).toHaveTextContent("Here now");
    expect(within(within(table).getByText("R1").closest("tr")!).getByLabelText("3 of 10 answered")).toBeInTheDocument();
  });

  it("narrows to the candidates who need attention", async () => {
    await open();
    const table = await screen.findByRole("region", { name: "Candidates now" });
    await userEvent.selectOptions(within(table).getByLabelText("Show"), "attention");
    expect(within(table).queryByText("R1")).toBeNull();
    expect(within(table).getByText("R2")).toBeInTheDocument();
  });

  it("tells the room something, and shows what it was told", async () => {
    const client = await open();
    expect(await screen.findByRole("region", { name: "Told to the room" })).toHaveTextContent("assume sorted input");
    await userEvent.click(screen.getByRole("button", { name: "Announce" }));
    const dialog = screen.getByRole("dialog", { name: "Tell the room" });
    expect(within(dialog).getByLabelText("Tell everyone sitting this exam")).toHaveFocus();
    await userEvent.type(within(dialog).getByLabelText("Tell everyone sitting this exam"), "Ten minutes left.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Send to everyone" }));
    await waitFor(() => expect(client.announce).toHaveBeenCalledWith("exam-1", "Ten minutes left."));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("reopens a submitted attempt with minutes and a reason", async () => {
    const client = await open();
    const table = await screen.findByRole("region", { name: "Candidates now" });
    await userEvent.click(within(within(table).getByText("R3").closest("tr")!).getByRole("button", { name: "More actions for R3" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Reopen…" }));
    const form = screen.getByRole("form", { name: "Reopen R3" });
    await userEvent.clear(within(form).getByLabelText("Minutes from now"));
    await userEvent.type(within(form).getByLabelText("Minutes from now"), "20");
    await userEvent.type(within(form).getByLabelText(/Reason/), "Laptop crashed and submitted.");
    await userEvent.click(within(form).getByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(client.reopen).toHaveBeenCalledWith("att-R3", 20, "Laptop crashed and submitted."));
  });

  it("offers no interventions to someone who can only watch", async () => {
    await open(stubClient({ me: vi.fn(async () => who("viewer", ["exam:read", "attempt:read", "attempt:review"])) }));
    await screen.findByRole("region", { name: "Candidates now" });
    expect(screen.queryByRole("button", { name: "Announce" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^More actions for R/ })).toBeNull();
  });
});

describe("privacy (ROADMAP §11)", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("lets an owner set the notice and retention, and shows what candidates will see", async () => {
    let saved = false;
    const client = stubClient({
      privacy: vi.fn(async () => (saved ? { settings: { ...notice, grievanceName: "Priya Menon", grievanceEmail: "privacy@acme.test", noticeVersion: 1, updatedAt: "" }, notice } : { settings: null, notice: null })),
    });
    vi.mocked(client.savePrivacy).mockImplementation(async () => {
      saved = true;
      return { settings: { controllerName: "", grievanceName: "", grievanceEmail: "", purpose: "", retentionDays: 90, noticeVersion: 1, updatedAt: "" }, notice };
    });
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Privacy" }));

    expect(await screen.findByText(/Not set yet/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Organisation responsible for the data"), "Acme Technologies Pvt Ltd");
    await userEvent.type(screen.getByLabelText("Grievance officer"), "Priya Menon");
    await userEvent.type(screen.getByLabelText("Grievance officer's email"), "privacy@acme.test");
    await userEvent.type(screen.getByLabelText("Why the data is collected"), "To assess candidates for engineering roles.");
    await userEvent.clear(screen.getByLabelText("Erase personal data after (days)"));
    await userEvent.type(screen.getByLabelText("Erase personal data after (days)"), "90");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(client.savePrivacy).toHaveBeenCalledWith({
      controllerName: "Acme Technologies Pvt Ltd",
      grievanceName: "Priya Menon",
      grievanceEmail: "privacy@acme.test",
      purpose: "To assess candidates for engineering roles.",
      retentionDays: 90,
    });
    const preview = await screen.findByRole("region", { name: "What candidates see" });
    expect(preview).toHaveTextContent("Kept for 90 days after the attempt closes, then erased.");
  });

  it("erases a candidate's data only once their reference is typed back", async () => {
    window.history.replaceState(null, "", "/console/?report=a2");
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Erase personal data…" }));

    const erase = screen.getByRole("button", { name: "Erase permanently" });
    await userEvent.type(screen.getByLabelText("Type CS001 to confirm"), "CS00");
    expect(erase).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Type CS001 to confirm"), "1");
    await userEvent.click(erase);

    expect(client.eraseAttempt).toHaveBeenCalledWith("a2");
  });

  it("is not offered to someone who does not manage the organisation", async () => {
    window.history.replaceState(null, "", "/console/?report=a2");
    renderApp(<App client={stubClient({ me: vi.fn(async () => who("reviewer", ["exam:read", "attempt:read", "attempt:review"])) })} />);
    expect(await screen.findByText("9 / 10")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "90%" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Erase personal data…" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Privacy" })).toBeNull();
  });
});

describe("billing (ROADMAP §12)", () => {
  afterEach(() => {
    delete (window as { Razorpay?: unknown }).Razorpay;
  });

  const openBilling = async (client = stubClient()) => {
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Billing" }));
    await screen.findByRole("region", { name: "Plan and balance" });
    return client;
  };

  it("shows the balance and prices a purchase with the GST it will carry", async () => {
    await openBilling();
    expect(within(screen.getByRole("region", { name: "Plan and balance" })).getByText("12")).toBeInTheDocument();
    const buy = screen.getByRole("region", { name: "Buy credits" });
    // Pune to a Karnataka supplier: IGST.
    expect(buy).toHaveTextContent("100 × ₹50.00 = ₹5,000.00 + IGST 18% ₹900.00 = ₹5,900.00");
  });

  it("pays through Razorpay Checkout, and has the server check the payment before saying it is paid", async () => {
    const opened: Record<string, unknown>[] = [];
    (window as { Razorpay?: unknown }).Razorpay = class {
      constructor(readonly options: Record<string, unknown>) {
        opened.push(options);
      }
      on() {}
      open() {
        (this.options["handler"] as (r: object) => void)({ razorpay_payment_id: "pay_1", razorpay_order_id: "order_1", razorpay_signature: "sig" });
      }
    };
    const client = await openBilling();
    await userEvent.click(screen.getByRole("button", { name: /^Pay ₹5,900.00 with Razorpay$/ }));

    expect(await screen.findByText(/Paid\. 100 credits added; tax invoice PKS\/2627\/000001/)).toBeInTheDocument();
    expect(client.createOrder).toHaveBeenCalledWith(100);
    expect(opened[0]).toMatchObject({ key: "rzp_test_x", order_id: "order_1", amount: 590_000, currency: "INR" });
    expect(client.verifyPayment).toHaveBeenCalledWith("order_1", "pay_1", "sig");
  });

  it("keeps the details a tax invoice carries", async () => {
    const client = await openBilling();
    await userEvent.clear(screen.getByLabelText("GSTIN (if registered)"));
    await userEvent.selectOptions(screen.getByLabelText("State"), "29");
    await userEvent.click(screen.getByRole("button", { name: "Save details" }));
    expect(client.saveBillingDetails).toHaveBeenCalledWith(expect.objectContaining({ gstin: null, stateCode: "29", legalName: "Acme Technologies Pvt Ltd" }));
  });

  it("shows a tax invoice as issued, ready to print", async () => {
    await openBilling();
    await userEvent.click(screen.getByRole("button", { name: "View PKS/2627/000001" }));
    const invoice = await screen.findByRole("article", { name: "Tax invoice PKS/2627/000001" });
    expect(invoice).toHaveTextContent("Place of supply: Maharashtra (27)");
    expect(invoice).toHaveTextContent("IGST @ 18%");
    expect(invoice).toHaveTextContent("Rupees Five Thousand Nine Hundred Only");
    expect(within(invoice).getByRole("button", { name: "Print or save as PDF" })).toBeInTheDocument();
  });
});

describe("proctoring (ROADMAP §14)", () => {
  it("is off by default in the editor, and saved with what the author turns on", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));
    await userEvent.click(screen.getByRole("tab", { name: "Settings" }));
    expect(screen.getByText(/Off: the test uses no camera/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Use the candidate's camera" }));
    await userEvent.clear(screen.getByLabelText("Every (seconds)"));
    await userEvent.type(screen.getByLabelText("Every (seconds)"), "120");
    await userEvent.click(screen.getByRole("checkbox", { name: /Record leaving the tab/ }));
    await userEvent.type(screen.getByLabelText("Title"), "Watched");
    await userEvent.type(screen.getByLabelText("Question"), "Which is stable?");
    await userEvent.type(screen.getByLabelText("Option 1"), "quicksort");
    await userEvent.type(screen.getByLabelText("Option 2"), "mergesort");
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    await waitFor(() => expect(client.saveExam).toHaveBeenCalled());
    const saved = (client.saveExam as unknown as { mock: { calls: [{ policy: object }][] } }).mock.calls[0]![0];
    expect(saved.policy).toMatchObject({ proctoring: { identity: true, snapshotEverySeconds: 120, browserEvents: false } });
  });

  it("shows the identity check and the camera on the live sitting, and records a decision with its reason", async () => {
    const proctored = {
      ...liveView,
      counts: { ...liveView.counts, cameraOff: 1, identityPending: 1 },
      rows: [
        liveRow("R1", {
          proctoring: { identity: "pending" as const, snapshots: 4, lastSnapshotAt: 1, events: { tab_hidden: 2 } },
          flags: { away: false, idle: false, overdue: false, cameraOff: true },
        }),
      ],
    };
    const client = stubClient({ live: vi.fn(async () => proctored) });
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await userEvent.click(await screen.findByRole("button", { name: "Live sitting" }));

    const row = (await screen.findByText("R1")).closest("tr")!;
    expect(row).toHaveTextContent("Camera off");
    expect(row).toHaveTextContent("ID to check");
    expect(row).toHaveTextContent("2 browser events");
    await userEvent.click(within(row).getByRole("button", { name: "Review R1" }));

    const panel = await screen.findByRole("region", { name: "Proctoring for Candidate R1" });
    expect(await within(panel).findByRole("img", { name: "Photo of Candidate R1" })).toHaveAttribute("src", "blob:m-selfie");
    expect(within(panel).getByRole("img", { name: "Photo ID held by Candidate R1" })).toHaveAttribute("src", "blob:m-id");
    expect(panel).toHaveTextContent("Left the tab");
    const confirm = within(panel).getByRole("button", { name: "Confirm identity" });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(panel).getByLabelText(/What you compared/), "Face matches the college ID");
    await userEvent.click(confirm);
    expect(client.reviewIdentity).toHaveBeenCalledWith("att-R1", "verified", "Face matches the college ID");

    // Each webcam photo opens large, with the ones either side a button away.
    await userEvent.click(within(panel).getAllByRole("button", { name: /^Open the webcam photo/ })[0]!);
    const lightbox = screen.getByRole("dialog", { name: /^Webcam photo 1 of/ });
    expect(within(lightbox).getByRole("button", { name: /Earlier/ })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /^Webcam photo/ })).toBeNull();
    // Escape closed the photo, not the review behind it.
    expect(screen.getByRole("region", { name: "Proctoring for Candidate R1" })).toBeInTheDocument();
  });

  it("appears in the candidate's report as observations", async () => {
    window.history.replaceState(null, "", "/console/?report=a2");
    const client = stubClient({
      report: vi.fn(async () => ({
        ...report,
        proctoring: { identity: "verified", identityReason: "Face matches", identityDecidedBy: "Meera", snapshots: 12, events: { tab_hidden: 1 } },
      })),
    });
    renderApp(<App client={client} />);
    const section = await screen.findByRole("region", { name: "Proctoring" });
    expect(section).toHaveTextContent("ID confirmed by Meera — Face matches");
    expect(section).toHaveTextContent("12 webcam photos · tab hidden ×1");
    window.history.replaceState(null, "", "/");
  });
});

describe("the exam page (HackerRank for Work's test page)", () => {
  const paper = {
    id: "exam-1",
    title: "Algorithms",
    questions: [
      { id: "q1", kind: "mcq", stem: "Which sort is stable?", maxScore: 2, rubric: [], options: ["Merge sort", "Heap sort"], correctIndex: 0 },
      { id: "q2", kind: "numeric", stem: "What is 6 × 7?", maxScore: 3, rubric: [], expected: 42, tolerance: 0 },
      { id: "q3", kind: "short", stem: "Explain stability.", maxScore: 5, rubric: [], expectedPoints: ["equal keys keep their order"] },
    ],
    policy: { durationMs: 45 * 60_000, allowRevision: true, vivaTriggerRatio: 0.5, cutoff: { percent: 60 } },
  };
  const withCutoff: Results = {
    ...results,
    rows: results.rows.map((r) => ({ ...r, outcome: r.percent === null ? null : r.percent >= 60 ? "qualified" : "failed" })),
    analytics: { ...results.analytics, qualified: 1, failed: 1 },
  };
  const summary: ExamSummary[] = [
    {
      id: "exam-1",
      title: "Algorithms",
      questionCount: 3,
      durationMs: 45 * 60_000,
      totalMarks: 10,
      cutoffPercent: 60,
      window: { opensAt: "2020-10-01T04:30:00.000Z", closesAt: "2099-10-01T07:30:00.000Z" },
      attempts: { invited: 12, inProgress: 2, submitted: 1, graded: 2, void: 0 },
    },
  ];
  const client = (overrides: Record<string, unknown> = {}) =>
    stubClient({ listExams: vi.fn(async () => summary), loadExam: vi.fn(async () => paper), results: vi.fn(async () => withCutoff), ...overrides });

  it("opens on the overview, with tabs and where the candidates stand down the side", async () => {
    renderApp(<App client={client()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));

    const tabs = screen.getByRole("navigation", { name: "Exam" });
    expect(within(tabs).getAllByRole("button").map((b) => b.textContent)).toEqual(["Overview", "Questions", "Candidates", "Live sitting", "Results"]);
    expect(within(tabs).getByRole("button", { name: "Overview" })).toHaveAttribute("aria-current", "page");

    // The header: where it is in its life, one line of facts, and what to do.
    const title = screen.getByRole("heading", { level: 1, name: "Algorithms" });
    const header = title.closest("header")!;
    expect(within(header).getByText("Open now")).toBeInTheDocument();
    expect(within(header).getByText(/^Open until .* IST · 45 min · 10 marks · qualifies at 60%$/)).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Try test" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Invite" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "More actions for Algorithms" })).toBeInTheDocument();
    // One to grade: the next step says so.
    expect(screen.getByRole("region", { name: "Next step" })).toHaveTextContent("1 answer sheet to grade");

    const side = screen.getByRole("complementary", { name: "Candidates at a glance" });
    const count = (label: string) => within(side).getByText(label).nextElementSibling?.textContent;
    expect(count("Invited")).toBe("12");
    expect(count("In progress")).toBe("2");
    expect(count("Submitted")).toBe("3");
    expect(count("To grade")).toBe("1");
    await waitFor(() => expect(count("Qualified")).toBe("1"));
    expect(count("Not qualified")).toBe("1");
    expect(within(side).getByText("45 min")).toBeInTheDocument();
    expect(within(side).getByText("60%")).toBeInTheDocument();
  });

  it("lists the questions read-only, with a preview as the candidate sees it", async () => {
    renderApp(<App client={client()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await userEvent.click(within(screen.getByRole("navigation", { name: "Exam" })).getByRole("button", { name: "Questions" }));

    await userEvent.click(await screen.findByRole("button", { name: "Preview question 1" }));
    expect(screen.getByRole("radio", { name: /Merge sort/ })).toBeChecked();
    expect(screen.getByText("Correct")).toBeInTheDocument();
    // Candidates have sat it, so it is copied to change, not edited.
    expect(screen.getByRole("button", { name: "Copy to change" })).toBeInTheDocument();
  });

  it("tries the test as a candidate, saving nothing, and says what the automatic questions would score", async () => {
    const stub = client();
    renderApp(<App client={stub} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await userEvent.click(within(screen.getByRole("navigation", { name: "Exam" })).getByRole("button", { name: "Questions" }));
    await userEvent.click(await screen.findByRole("button", { name: "Try test" }));

    const dialog = screen.getByRole("dialog", { name: "Try test" });
    expect(within(dialog).getByText("Nothing you do here is saved")).toBeInTheDocument();
    expect(within(dialog).getByRole("timer")).toHaveTextContent("00:45:00");
    await userEvent.click(within(dialog).getByRole("radio", { name: /Merge sort/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: /Save & next/ }));
    await userEvent.type(within(dialog).getByLabelText("Your answer"), "41");
    await userEvent.click(within(dialog).getByRole("button", { name: /Mark for review & next/ }));
    expect(within(dialog).getByRole("button", { name: "Question 2: answered marked" })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Finish preview" }));

    expect(within(dialog).getByText(/2 of 5 marks on the 2 questions marked automatically/)).toBeInTheDocument();
    expect(within(dialog).getByText("Graded later")).toBeInTheDocument();
    expect(stub.startAttempt).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Try test" })).toBeNull();
  });

  it("marks who qualified in the results, and filters by it", async () => {
    renderApp(<App client={client()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await userEvent.click(within(screen.getByRole("navigation", { name: "Exam" })).getByRole("button", { name: "Results" }));

    const table = await screen.findByRole("region", { name: "Candidates" });
    expect(within((await within(table).findByText("CS001")).closest("tr")!).getByText("Qualified")).toBeInTheDocument();
    expect(within(within(table).getByText("CS002").closest("tr")!).getByText("Not qualified")).toBeInTheDocument();
    await userEvent.selectOptions(within(table).getByRole("combobox", { name: "Show" }), "qualified");
    expect(within(table).queryByText("CS002")).toBeNull();
    expect(within(table).getByText("CS001")).toBeInTheDocument();
  });
});

describe("the exam editor's question list", () => {
  it("reorders questions, and saves the order", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));
    await userEvent.type(screen.getByLabelText("Title"), "Order");
    await userEvent.type(screen.getByLabelText("Question"), "First?");
    await userEvent.type(screen.getByLabelText("Option 1"), "a");
    await userEvent.type(screen.getByLabelText("Option 2"), "b");
    await userEvent.click(screen.getByRole("button", { name: "Add question" }));
    const second = screen.getByRole("region", { name: "Editing question 2" });
    await userEvent.type(within(second).getByLabelText("Question"), "Second?");
    await userEvent.type(within(second).getByLabelText("Option 1"), "c");
    await userEvent.type(within(second).getByLabelText("Option 2"), "d");

    await userEvent.click(screen.getByRole("button", { name: "Move question 2 up" }));
    expect(within(screen.getByRole("region", { name: "Question 1" })).getByRole("button", { name: "Second?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    await waitFor(() => expect(client.saveExam).toHaveBeenCalled());
    const saved = (client.saveExam as unknown as { mock: { calls: [{ questions: { stem: string }[] }][] } }).mock.calls[0]![0];
    expect(saved.questions.map((q) => q.stem)).toEqual(["Second?", "First?"]);
  });

  it("opens a saved exam as a list to scan, and a question to edit", async () => {
    const client = stubClient({
      loadExam: vi.fn(async () => ({
        id: "exam-1",
        title: "Algorithms",
        questions: [{ id: "q1", kind: "mcq", stem: "Which sort is stable?", maxScore: 2, rubric: [], options: ["Merge sort", "Heap sort"], correctIndex: 0 }],
        policy: { durationMs: 60_000, allowRevision: true, vivaTriggerRatio: 0.5 },
      })),
    });
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Exams" }));
    await userEvent.click(await screen.findByRole("button", { name: "More actions for Algorithms" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));

    const item = await screen.findByRole("region", { name: "Question 1" });
    expect(within(item).getByText("Multiple choice")).toBeInTheDocument();
    expect(screen.queryByLabelText("Option 1")).toBeNull();
    expect(screen.getByText(/Choose a question from the list to edit it here/)).toBeInTheDocument();
    // Chosen from the list, it opens beside it.
    await userEvent.click(within(item).getByRole("button", { name: "Which sort is stable?" }));
    expect(within(item).getByRole("button", { name: "Which sort is stable?" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("region", { name: "Editing question 1" })).getByLabelText("Option 1")).toHaveValue("Merge sort");
  });

  it("says when there are unsaved changes, and asks before they are left behind", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));
    expect(screen.getByText("Not saved yet")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Title"), "Draft");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    await userEvent.click(within(screen.getByRole("navigation", { name: "Account" })).getByRole("button", { name: "Home" }));
    const ask = screen.getByRole("dialog", { name: "Leave without saving?" });
    await userEvent.click(within(ask).getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Draft");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Leave without saving?" })).getByRole("button", { name: "Leave without saving" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Exams" })).toBeInTheDocument();
  });

  it("orders questions by dragging, as well as with the buttons", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));
    await userEvent.type(screen.getByLabelText("Question"), "First?");
    await userEvent.click(screen.getByRole("button", { name: "Add question" }));
    await userEvent.type(within(screen.getByRole("region", { name: "Editing question 2" })).getByLabelText("Question"), "Second?");
    const rows = screen.getAllByRole("region", { name: /^Question \d$/ });
    const handle = rows[1]!.querySelector(".drag-handle")!;
    fireEvent.dragStart(handle, { dataTransfer: { setData: () => undefined, effectAllowed: "" } });
    fireEvent.dragOver(rows[0]!.closest("li")!);
    fireEvent.drop(rows[0]!.closest("li")!);
    expect(within(screen.getByRole("region", { name: "Question 1" })).getByRole("button", { name: "Second?" })).toBeInTheDocument();
  });

  it("saves a qualifying mark, overall and for a section", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));
    await userEvent.type(screen.getByLabelText("Title"), "Drive");
    await userEvent.type(screen.getByLabelText("Question"), "Which?");
    await userEvent.type(screen.getByLabelText("Option 1"), "a");
    await userEvent.type(screen.getByLabelText("Option 2"), "b");
    await userEvent.click(screen.getByRole("button", { name: "Add a section drawn per candidate" }));
    await userEvent.type(within(screen.getByRole("region", { name: "Section 1" })).getByLabelText("Section title"), "Quant");

    await userEvent.click(screen.getByRole("tab", { name: "Settings" }));
    expect(screen.getByText(/results show marks only/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Set a qualifying mark"));
    await userEvent.clear(screen.getByLabelText("Qualifying mark (% of the paper)"));
    await userEvent.type(screen.getByLabelText("Qualifying mark (% of the paper)"), "55");
    await userEvent.type(screen.getByLabelText("Minimum in Quant (%)"), "40");
    // The whole exam's cut-off shows in the head.
    expect(within(screen.getByLabelText("This paper")).getByText("qualifies at 55%")).toBeInTheDocument();

    // A section's minimum goes with the section.
    await userEvent.click(screen.getByRole("tab", { name: "Questions" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove section" }));
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));
    await waitFor(() => expect(client.saveExam).toHaveBeenCalled());
    const saved = (client.saveExam as unknown as { mock: { calls: [{ policy: { cutoff?: unknown } }][] } }).mock.calls[0]![0];
    expect(saved.policy.cutoff).toEqual({ percent: 55 });
  });
});

describe("Ctrl+K", () => {
  it("finds a candidate across exams and opens their scorecard", async () => {
    const client = stubClient({
      searchCandidates: vi.fn(async () => [
        {
          invitationId: "i1",
          examId: "exam-1",
          examTitle: "Algorithms",
          candidateRef: "CS001",
          name: "Ananya Iyer",
          email: "a@college.test",
          attemptId: "a2",
          attemptState: "graded",
        },
      ]),
    });
    renderApp(<App client={client} />);
    await screen.findByRole("button", { name: "Algorithms" });

    await userEvent.keyboard("{Control>}k{/Control}");
    const search = screen.getByRole("combobox", { name: "Search exams, candidates and pages" });
    expect(search).toHaveFocus();
    await userEvent.type(search, "anan");
    expect(await screen.findByRole("option", { name: /Ananya Iyer/ })).toBeInTheDocument();
    expect(client.searchCandidates).toHaveBeenCalledWith("anan");
    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(await screen.findByText("9 / 10")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Search" })).toBeNull();
  });

  it("goes to an exam or a page from the keyboard", async () => {
    renderApp(<App client={stubClient()} />);
    await screen.findByRole("button", { name: "Algorithms" });
    await userEvent.click(screen.getByRole("button", { name: /Search/ }));
    await userEvent.type(screen.getByRole("combobox"), "audit");
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { name: "Audit log" })).toBeInTheDocument();
  });
});

describe("the scorecard", () => {
  it("shows the verdict, each section, where the candidate stands, and when answers were saved", async () => {
    const client = stubClient({
      report: vi.fn(async () => ({
        ...report,
        result: {
          ...report.result,
          outcome: "qualified",
          sections: [
            { id: "", title: "General", score: 5, max: 5, percent: 100 },
            { id: "quant", title: "Quant", score: 4, max: 5, percent: 80 },
          ],
        },
        questions: report.questions.map((q, i) => ({ ...q, firstSavedMs: (i + 1) * 90_000, lastSavedMs: (i + 1) * 200_000, saves: i + 1 })),
        standing: { percentile: 92, rank: 3, graded: 40, meanPercent: 61.5 },
      })),
    });
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await userEvent.click(within(screen.getByRole("navigation", { name: "Exam" })).getByRole("button", { name: "Results" }));
    const table = await screen.findByRole("region", { name: "Candidates" });
    await userEvent.click(within((await within(table).findByText("CS001")).closest("tr")!).getByRole("button", { name: "Scorecard" }));

    const card = await screen.findByRole("region", { name: "Scorecard" });
    expect(within(card).getByText("Qualified")).toBeInTheDocument();
    expect(within(card).getByText("92nd")).toBeInTheDocument();
    expect(within(card).getByText("3 of 40")).toBeInTheDocument();
    const sections = screen.getByRole("region", { name: "Sections" });
    expect(within(sections).getByText("Quant")).toBeInTheDocument();
    expect(within(sections).getByText("80%")).toBeInTheDocument();
    expect(screen.getByText(/First saved at 1:30 \(minutes/)).toBeInTheDocument();
    expect(screen.getByText(/First saved at 3:00, last at 6:40 · saved 2 times/)).toBeInTheDocument();
  });
});

describe("home", () => {
  it("opens on the sittings, the latest activity and what is left to set up", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);

    expect(await screen.findByRole("heading", { name: "Home" })).toBeInTheDocument();
    const sittings = await screen.findByRole("region", { name: "Sittings" });
    expect(within(sittings).getByRole("button", { name: "Algorithms" })).toBeInTheDocument();
    expect(within(sittings).getByText("12 of 40 started")).toBeInTheDocument();
    expect(within(sittings).getByRole("button", { name: "Next month" })).toBeInTheDocument();

    const activity = screen.getByRole("region", { name: "Recent activity" });
    expect(activity).toHaveTextContent("Asha invited candidates");

    const setup = screen.getByRole("region", { name: "Get started" });
    expect(within(setup).getByText("3 of 6 done")).toBeInTheDocument();
    expect(within(setup).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
    await userEvent.click(within(setup).getByRole("button", { name: "Add questions to the bank" }));
    expect(await screen.findByRole("heading", { name: "Question bank" })).toBeInTheDocument();
  });

  it("goes from a sitting to its exam, and says so when an exam is saved", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    expect(await screen.findByRole("navigation", { name: "Exam" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Home" }));
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));
    await userEvent.type(screen.getByLabelText("Title"), "Mechanics");
    await userEvent.type(screen.getByLabelText("Question"), "Which?");
    await userEvent.type(screen.getByLabelText("Option 1"), "a");
    await userEvent.type(screen.getByLabelText("Option 2"), "b");
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));
    expect(await within(screen.getByRole("region", { name: "Notifications" })).findByText("Saved “Mechanics”")).toBeInTheDocument();
  });

  it("hides the first steps once they are done, and the activity from those who may not read the audit log", async () => {
    const client = stubClient({
      dashboard: vi.fn(async () => ({
        ...dashboardView,
        activity: null,
        setup: { exams: 3, bankQuestions: 20, scheduled: 2, invited: 90, staff: 4, privacyNotice: true },
      })),
    });
    renderApp(<App client={client} />);
    await screen.findByRole("region", { name: "Sittings" });
    expect(screen.queryByRole("region", { name: "Get started" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Recent activity" })).toBeNull();
  });
});

describe("the design system page", () => {
  it("is found from Ctrl+K and shows the shared pieces live", async () => {
    renderApp(<App client={stubClient()} />);
    await screen.findByRole("region", { name: "Sittings" });
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.type(screen.getByRole("combobox"), "design");
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { name: "Design system" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open a dialog" }));
    expect(screen.getByRole("dialog", { name: "Submit your attempt?" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Show a toast" }));
    expect(screen.getByRole("region", { name: "Notifications" })).toHaveTextContent("Saved “Campus drive 2026”");
  });
});

describe("the theme", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
  });

  it("follows the computer until someone chooses, then remembers the choice", async () => {
    renderApp(<App client={stubClient()} />);
    const theme = await screen.findByRole("group", { name: "Theme" });
    expect(within(theme).getByRole("button", { name: "Match the computer" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).not.toHaveAttribute("data-theme");

    await userEvent.click(within(theme).getByRole("button", { name: "Dark" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("parikshaa.console.theme")).toBe("dark");

    await userEvent.click(within(theme).getByRole("button", { name: "Match the computer" }));
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(localStorage.getItem("parikshaa.console.theme")).toBeNull();
  });
});
