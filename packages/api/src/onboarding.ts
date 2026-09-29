import { randomBytes } from "node:crypto";
import { examId, orgId, type Exam, type OrgId } from "@parikshaa/core";
import { SAMPLE_EXAM_ID, SAMPLE_TAG, staffScope, type BankDraft, type BillingStore, type IdentityStore, type QuestionBank } from "@parikshaa/store";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, hashPassword, MIN_PASSWORD_LENGTH, WeakPassword, type Actor, type LoginResult, type StaffAuth } from "./staff-auth.js";

/**
 * A new institution's first day (pilot readiness).
 *
 * - **Sign-up.** An institution makes its own account: the organisation, its
 *   first owner and a session, in one step. Off unless the operator turns it
 *   on; when on, every organisation made this way starts prepaid with a few
 *   trial credits, so a stranger's account cannot run up model spend.
 * - **The sample exam.** One click puts a short aptitude paper in the bank and
 *   among the exams, to preview as a candidate would, schedule, and sit. It
 *   does not count as the organisation's own first exam, and one more click
 *   puts it away.
 */

export interface SignupPolicy {
  /** Attempt credits a new organisation starts with. */
  readonly trialCredits: number;
  /** The price per attempt after the trial, in paise before GST. */
  readonly pricePaise: number;
}

export interface SignupRequest {
  readonly organisation: string;
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

/** Why a sign-up was refused, each with a message a person can act on. */
export class SignupRefused extends Error {
  constructor(
    readonly code: "invalid" | "email_taken",
    message: string,
  ) {
    super(message);
    this.name = "SignupRefused";
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An organisation's address from its name, with a random tail so two colleges of one name do not collide. */
export function organisationId(name: string, tail = randomBytes(3).toString("hex")): OrgId {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return orgId(`${base.length >= 2 ? base : "org"}-${tail}`);
}

export class Onboarding {
  readonly #o: {
    readonly identity: IdentityStore;
    readonly auth: StaffAuth;
    readonly billing: BillingStore;
    readonly bank: QuestionBank;
    readonly exams: ExamService;
    readonly signup: SignupPolicy | null;
  };

  constructor(options: {
    identity: IdentityStore;
    auth: StaffAuth;
    billing: BillingStore;
    bank: QuestionBank;
    exams: ExamService;
    signup?: SignupPolicy | null;
  }) {
    this.#o = { ...options, signup: options.signup ?? null };
  }

  /** Whether institutions may make their own accounts here, and on what terms. */
  get signup(): SignupPolicy | null {
    return this.#o.signup;
  }

  async signUp(request: SignupRequest): Promise<LoginResult> {
    const policy = this.#o.signup;
    if (policy === null) throw new AttemptError("not_found", "Institutions cannot sign themselves up here");
    const organisation = request.organisation.trim();
    const name = request.name.trim();
    const email = request.email.trim();
    if (organisation.length < 2 || organisation.length > 120) throw new SignupRefused("invalid", "Give your institution's name");
    if (name.length < 1 || name.length > 120) throw new SignupRefused("invalid", "Give your name");
    if (!EMAIL.test(email) || email.length > 320) throw new SignupRefused("invalid", "Give a work email address");
    if (request.password.length < MIN_PASSWORD_LENGTH) throw new SignupRefused("invalid", `A password is at least ${MIN_PASSWORD_LENGTH} characters`);
    // Checked before anything is made, so a taken address leaves nothing behind.
    if ((await this.#o.identity.findUserByEmail(email)) !== null) {
      throw new SignupRefused("email_taken", "An account already uses this email address. Sign in, or reset its password.");
    }

    let passwordHash: string;
    try {
      passwordHash = await hashPassword(request.password);
    } catch (error) {
      if (error instanceof WeakPassword) throw new SignupRefused("invalid", error.message);
      throw error;
    }
    const id = organisationId(organisation);
    await this.#o.identity.createOrganisation(id, organisation);
    const scope = staffScope(id);
    await this.#o.billing.setPlan(scope, "prepaid", policy.pricePaise);
    if (policy.trialCredits > 0) await this.#o.billing.grant(scope, policy.trialCredits, "Trial credits on signing up");
    const user = await this.#o.identity.createUser({ orgId: id, email, name, role: "owner", passwordHash });
    const session = await this.#o.auth.startSession(user);
    await this.#o.exams.recordAudit({ kind: "user", ...user }, "org.created", id, { trialCredits: policy.trialCredits });
    return session;
  }

  /**
   * Put the sample exam in: its questions in the bank, tagged, and the exam
   * built from them. Loading it again brings back one that was put away.
   */
  async loadSample(actor: Actor): Promise<{ examId: string }> {
    if (!can(actor, "exam:write")) throw new Forbidden("exam:write");
    const id = examId(SAMPLE_EXAM_ID);
    const existing = (await this.#o.exams.listExams(actor)).find((e) => e.id === id);
    if (existing !== undefined) {
      if ((existing.archivedAt ?? null) !== null) await this.#o.exams.archiveExam(actor, id, false);
      return { examId: id };
    }
    const filed = await this.#o.bank.add(staffScope(actor.orgId), SAMPLE_QUESTIONS);
    const exam: Exam = {
      id,
      title: "Sample: campus aptitude round",
      questions: filed.map((entry) => entry.question),
      policy: { durationMs: 20 * 60_000, allowRevision: true, vivaTriggerRatio: 0.7, calculator: false, cutoff: { percent: 50 } },
    };
    await this.#o.exams.createExam(actor, exam);
    await this.#o.exams.recordAudit(actor, "sample.loaded", id, {});
    return { examId: id };
  }

  /** Put the sample away: the exam archived, its questions archived in the bank. */
  async removeSample(actor: Actor): Promise<void> {
    if (!can(actor, "exam:write")) throw new Forbidden("exam:write");
    const id = examId(SAMPLE_EXAM_ID);
    const exam = await this.#o.exams.loadExam(actor, id);
    await this.#o.exams.archiveExam(actor, id, true);
    const scope = staffScope(actor.orgId);
    const inExam = new Set<string>(exam.questions.map((q) => q.id));
    for (const entry of await this.#o.bank.list(scope, { tag: SAMPLE_TAG })) {
      if (inExam.has(entry.id)) await this.#o.bank.archive(scope, entry.id);
    }
    await this.#o.exams.recordAudit(actor, "sample.removed", id, {});
  }
}

const tagged = (topic: string, difficulty: BankDraft["difficulty"], question: BankDraft["question"]): BankDraft => ({
  question,
  topic,
  difficulty,
  tags: [SAMPLE_TAG],
});

const TRAIN = {
  id: "sample-trains",
  title: "Rail freight",
  text: "In 2024–25 a railway zone carried 120 million tonnes of freight. Coal was half of it, cement a quarter, and food grain one-eighth; the rest was containers.",
};

/**
 * A campus aptitude round in miniature: every kind of question an institution
 * will write, so the preview shows each — one right option, several with
 * negative marking, a number, a passage shared by two questions, and a short
 * written answer graded against a rubric.
 */
export const SAMPLE_QUESTIONS: readonly BankDraft[] = [
  tagged("Quantitative aptitude", "easy", {
    kind: "mcq",
    stem: "A shopkeeper marks a shirt at ₹800 and gives a 15% discount. What does the customer pay?",
    maxScore: 1,
    rubric: [],
    options: ["₹640", "₹680", "₹700", "₹720"],
    correctIndex: 1,
  }),
  tagged("Quantitative aptitude", "medium", {
    kind: "numeric",
    stem: "A train 150 m long passes a pole in 10 seconds. What is its speed, in km/h?",
    maxScore: 2,
    rubric: [],
    expected: 54,
    tolerance: 0,
    negativeMarks: 0.5,
  }),
  tagged("Logical reasoning", "medium", {
    kind: "mcq",
    stem: "What comes next: 2, 6, 12, 20, 30, …?",
    maxScore: 1,
    rubric: [],
    options: ["40", "42", "44", "48"],
    correctIndex: 1,
  }),
  tagged("Logical reasoning", "medium", {
    kind: "mcq",
    stem: "All engineers in the batch know Python. Some who know Python know SQL. Which of these **must** be true?",
    maxScore: 2,
    rubric: [],
    options: ["Every engineer in the batch knows SQL", "No engineer in the batch knows SQL", "Every engineer in the batch knows Python", "Some engineers in the batch know SQL"],
    correctIndex: 2,
    negativeMarks: 0.5,
  }),
  tagged("Quantitative aptitude", "hard", {
    kind: "mcq",
    stem: "Which of these numbers are divisible by 6? Choose every one.",
    maxScore: 2,
    rubric: [],
    options: ["114", "226", "342", "508"],
    correctIndex: 0,
    correctIndices: [0, 2],
    partialCredit: true,
  }),
  tagged("Data interpretation", "easy", {
    kind: "mcq",
    stem: "How many million tonnes of cement did the zone carry?",
    maxScore: 1,
    rubric: [],
    options: ["15", "30", "45", "60"],
    correctIndex: 1,
    passage: TRAIN,
  }),
  tagged("Data interpretation", "medium", {
    kind: "numeric",
    stem: "How many million tonnes were containers?",
    maxScore: 1,
    rubric: [],
    expected: 15,
    tolerance: 0,
    passage: TRAIN,
  }),
  tagged("Verbal ability", "easy", {
    kind: "mcq",
    stem: "Choose the word closest in meaning to **meticulous**.",
    maxScore: 1,
    rubric: [],
    options: ["Careless", "Thorough", "Hurried", "Generous"],
    correctIndex: 1,
  }),
  tagged("Written communication", "medium", {
    kind: "short",
    stem: "In three or four sentences: your team will miss a deadline by two days. Write the message you would send the client.",
    maxScore: 4,
    rubric: [
      { id: "own", description: "Says plainly that the deadline will be missed and by how long", weight: 2 },
      { id: "why", description: "Gives the reason briefly, without blaming anyone", weight: 1 },
      { id: "next", description: "Says what happens next and when the client will hear again", weight: 1 },
    ],
    expectedPoints: ["The delay and its length", "A short reason", "The new date and the next update"],
  }),
];
