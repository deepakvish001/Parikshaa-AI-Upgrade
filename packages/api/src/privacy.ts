import { createHash } from "node:crypto";
import { canonicalize, orgId as toOrgId, type AttemptId, type ExamEvent, type OrgId } from "@parikshaa/core";
import {
  AppendRefused,
  staffScope,
  TUTOR_KEEP_DAYS,
  type PrepPlusStore,
  type IdentityStore,
  type InvitationStore,
  type LedgerStore,
  type PrivacyDraft,
  type PrivacySettings,
  type PrivacyStore,
  type ProctorStore,
} from "@parikshaa/store";
import { AttemptError, Forbidden, type CandidateAccess, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";

/**
 * The DPDP Act, 2023 (ROADMAP §11): notice and consent before the clock
 * starts, a candidate's own data on request, erasure on request and when the
 * retention period ends.
 *
 * Erasure is crypto-shredding (see `@parikshaa/store` sealing): the attempt's
 * data key is destroyed, so its sealed answers, replies and identity can never
 * be read again, while its chain — and the scores in it — still verify.
 */

/** What Parikshaa collects, stated the same way for every organisation. Part of the notice, so part of its hash. */
export const COLLECTED: readonly string[] = [
  "Your name, email address, phone number and reference (such as a roll number), as the organisation gave them to us.",
  "Your answers, and your replies to any follow-up questions.",
  "When you started, saved, answered and submitted, and whether this page was open — so that invigilators can help.",
  "Your answers and replies are read by an AI model, to score them and to ask follow-up questions. They are not used to train it.",
  "If a test uses the camera — it tells you before it starts — a photo of you and of your photo ID, a photo every few minutes while you answer, and whether you left the tab or full screen. Invigilators look at these; nothing decides anything by itself.",
];

export const RIGHTS: readonly string[] = [
  "See the data held about you: download it from this page once you have finished.",
  "Have it corrected, or erased, by writing to the grievance officer named here. Erasure is permanent; your scores stay, without anything that says who you are or what you wrote.",
  "Withdraw your consent at any time, the same way. Withdrawing does not undo what was done before it.",
  "Complain to the grievance officer, and after that to the Data Protection Board of India.",
];

/** The same, in Hindi (DPDP Act s.5(3): a notice in English or a language of the Eighth Schedule). */
export const NOTICE_HI = {
  collected: [
    "आपका नाम, ईमेल पता, फ़ोन नंबर और संदर्भ (जैसे रोल नंबर), जैसा संस्था ने हमें दिया।",
    "आपके उत्तर, और किसी भी अनुवर्ती प्रश्न पर आपके जवाब।",
    "आपने कब शुरू किया, कब सहेजा, कब उत्तर दिया और कब जमा किया, और क्या यह पेज खुला था — ताकि निरीक्षक आपकी मदद कर सकें।",
    "आपके उत्तर और जवाब एक AI मॉडल पढ़ता है, ताकि उन्हें अंक दे सके और अनुवर्ती प्रश्न पूछ सके। उनसे मॉडल को प्रशिक्षित नहीं किया जाता।",
    "अगर परीक्षा कैमरे का उपयोग करती है — शुरू होने से पहले बताया जाता है — तो आपकी और आपके फ़ोटो पहचान-पत्र की एक फ़ोटो, उत्तर देते समय हर कुछ मिनट में एक फ़ोटो, और क्या आपने टैब या फ़ुल स्क्रीन छोड़ी। निरीक्षक इन्हें देखते हैं; इनमें से कोई भी चीज़ अपने आप कुछ तय नहीं करती।",
  ],
  rights: [
    "अपने बारे में रखा गया डेटा देखें: परीक्षा समाप्त करने के बाद इसे इसी पेज से डाउनलोड करें।",
    "यहाँ दिए गए शिकायत अधिकारी को लिखकर इसे सुधरवाएँ या मिटवाएँ। मिटाना स्थायी है; आपके अंक बने रहते हैं, पर यह नहीं कि आप कौन हैं या आपने क्या लिखा।",
    "अपनी सहमति कभी भी वापस लें, इसी तरह। वापस लेने से पहले जो हो चुका है, वह नहीं बदलता।",
    "शिकायत अधिकारी से शिकायत करें, और उसके बाद भारतीय डेटा संरक्षण बोर्ड से।",
  ],
} as const;

export interface Notice {
  readonly version: number;
  /** SHA-256 of the notice's canonical form: what a consent in the ledger commits to. */
  readonly hash: string;
  readonly controllerName: string;
  readonly purpose: string;
  readonly retentionDays: number;
  readonly grievance: { readonly name: string; readonly email: string };
  readonly collected: readonly string[];
  readonly rights: readonly string[];
  /** The standing parts in other languages; hashed with the rest, so a consent covers whichever was read. */
  readonly translations: { readonly hi: { readonly collected: readonly string[]; readonly rights: readonly string[] } };
}

export function noticeOf(settings: PrivacySettings): Notice {
  const body = {
    version: settings.noticeVersion,
    controllerName: settings.controllerName,
    purpose: settings.purpose,
    retentionDays: settings.retentionDays,
    grievance: { name: settings.grievanceName, email: settings.grievanceEmail },
    collected: COLLECTED,
    rights: RIGHTS,
    translations: { hi: NOTICE_HI },
  };
  return { ...body, hash: createHash("sha256").update(canonicalize(body)).digest("hex") };
}

/** Thrown when an invitation is opened for the first time without agreeing to the current notice. */
export class ConsentRequired extends Error {
  constructor(readonly notice: Notice) {
    super("The privacy notice must be agreed to before the attempt starts");
    this.name = "ConsentRequired";
  }
}

/** A candidate's own data, as they may download it (DPDP s.11). */
export interface CandidateData {
  readonly generatedAt: string;
  readonly organisation: string;
  readonly exam: { readonly id: string; readonly title: string };
  readonly you: { readonly reference: string; readonly name: string; readonly email: string | null; readonly phone: string | null } | null;
  readonly consent: { readonly noticeVersion: number; readonly noticeHash: string; readonly at: number } | null;
  readonly erased: boolean;
  readonly answers: readonly { readonly questionId: string; readonly answer: string; readonly at: number }[];
  readonly followUps: readonly { readonly questionId: string; readonly question: string; readonly reply: string | null; readonly at: number }[];
  readonly timeline: readonly { readonly at: number; readonly event: string }[];
  /** A proctored exam's photos (not the images: ask the grievance officer for those) and what the browser reported. */
  readonly proctoring: {
    readonly photos: readonly { readonly kind: string; readonly takenAt: string; readonly sha256: string }[];
    readonly events: readonly { readonly kind: string; readonly at: string }[];
  } | null;
}

const MIN_TEXT = 2;

export class PrivacyService {
  readonly #o: {
    readonly store: LedgerStore;
    readonly privacy: PrivacyStore;
    readonly invitations: InvitationStore;
    readonly identity: IdentityStore;
    readonly exams: ExamService;
    readonly proctor: ProctorStore | null;
    readonly tutor: PrepPlusStore | null;
    readonly now: () => number;
  };

  constructor(options: {
    store: LedgerStore;
    privacy: PrivacyStore;
    invitations: InvitationStore;
    identity: IdentityStore;
    exams: ExamService;
    proctor?: ProctorStore | null;
    /** Where what Sahayak said is kept: deleted after `TUTOR_KEEP_DAYS`. */
    tutor?: PrepPlusStore | null;
    now?: () => number;
  }) {
    this.#o = { ...options, proctor: options.proctor ?? null, tutor: options.tutor ?? null, now: options.now ?? (() => Date.now()) };
  }

  // --- settings ---------------------------------------------------------------

  async settings(actor: Actor): Promise<{ settings: PrivacySettings | null; notice: Notice | null }> {
    if (!can(actor, "org:manage")) throw new Forbidden("org:manage");
    const settings = await this.#o.privacy.get(staffScope(actor.orgId));
    return { settings, notice: settings === null ? null : noticeOf(settings) };
  }

  async saveSettings(actor: Actor, draft: PrivacyDraft): Promise<{ settings: PrivacySettings; notice: Notice }> {
    if (!can(actor, "org:manage")) throw new Forbidden("org:manage");
    const trimmed = {
      controllerName: draft.controllerName.trim(),
      grievanceName: draft.grievanceName.trim(),
      grievanceEmail: draft.grievanceEmail.trim(),
      purpose: draft.purpose.trim(),
      retentionDays: draft.retentionDays,
    };
    if ([trimmed.controllerName, trimmed.grievanceName, trimmed.purpose].some((t) => t.length < MIN_TEXT)) {
      throw new AttemptError("invalid_privacy", "The organisation, grievance officer and purpose are all needed");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed.grievanceEmail)) {
      throw new AttemptError("invalid_privacy", "The grievance officer needs an email address candidates can write to");
    }
    const settings = await this.#o.privacy.put(staffScope(actor.orgId), trimmed, new Date(this.#o.now()));
    await this.#o.exams.recordAudit(actor, "privacy.saved", actor.orgId, {
      noticeVersion: settings.noticeVersion,
      retentionDays: settings.retentionDays,
    });
    return { settings, notice: noticeOf(settings) };
  }

  /** The notice a candidate of this organisation must agree to, if it has set one. */
  async noticeFor(orgId: OrgId): Promise<Notice | null> {
    const settings = await this.#o.privacy.get(staffScope(orgId));
    return settings === null ? null : noticeOf(settings);
  }

  // --- a candidate's own data ---------------------------------------------------

  async candidateData(access: CandidateAccess): Promise<CandidateData> {
    const scope = staffScope(access.orgId);
    const { opened, erasedAt } = await this.#ledger(access.orgId, access.attemptId);
    const first = opened[0]?.event;
    if (first === undefined || first.type !== "attempt_started") throw new AttemptError("not_found", "No such attempt");
    const [exam, invitation, org] = await Promise.all([
      this.#o.store.loadExam(scope, first.examId),
      this.#o.invitations.byAttempt(scope, access.attemptId),
      this.#o.identity.getOrganisation(access.orgId),
    ]);

    const answers: { questionId: string; answer: string; at: number }[] = [];
    const followUps: { questionId: string; question: string; reply: string | null; at: number; probeId: string }[] = [];
    let consent: CandidateData["consent"] = null;
    for (const { event, timestamp } of opened) {
      if (event.type === "answer_submitted") answers.push({ questionId: event.response.questionId, answer: event.response.answer, at: timestamp });
      if (event.type === "viva_probed") followUps.push({ questionId: event.probe.questionId, question: event.probe.prompt, reply: null, at: timestamp, probeId: event.probe.id });
      if (event.type === "viva_replied") {
        const probe = followUps.find((f) => f.probeId === event.exchange.probeId);
        if (probe !== undefined) probe.reply = event.exchange.reply;
      }
      if (event.type === "consent_given") consent = { noticeVersion: event.noticeVersion, noticeHash: event.noticeHash, at: timestamp };
    }

    return {
      generatedAt: new Date(this.#o.now()).toISOString(),
      organisation: org?.name ?? access.orgId,
      exam: { id: first.examId, title: exam?.title ?? first.examId },
      you:
        invitation === null || erasedAt
          ? null
          : { reference: invitation.candidateRef, name: invitation.name, email: invitation.email ?? null, phone: invitation.phone ?? null },
      consent,
      erased: erasedAt,
      answers,
      followUps: followUps.map(({ probeId: _, ...f }) => f),
      // What happened when, in the words a receipt uses — no scores or verdicts.
      timeline: opened.filter((e) => TIMELINE.has(e.event.type)).map((e) => ({ at: e.timestamp, event: e.event.type })),
      proctoring:
        exam?.policy.proctoring === undefined || this.#o.proctor === null
          ? null
          : {
              photos: (await this.#o.proctor.media(scope, access.attemptId)).map(({ kind, takenAt, sha256 }) => ({ kind, takenAt, sha256 })),
              events: await this.#o.proctor.events(scope, access.attemptId),
            },
    };
  }

  async #ledger(orgId: OrgId, attemptId: AttemptId) {
    const { opened } = await this.#o.store.loadBoth(staffScope(orgId), attemptId);
    return { opened, erasedAt: opened.some((e) => e.event.type === "data_erased") };
  }

  // --- erasure ------------------------------------------------------------------

  /**
   * Erase an attempt's personal data at the candidate's request. A person's
   * decision, like voiding: irreversible, so never an API key's.
   */
  async erase(actor: Actor, attemptId: AttemptId): Promise<{ erased: boolean }> {
    if (!can(actor, "org:manage")) throw new Forbidden("org:manage");
    if (actor.kind !== "user") throw new Forbidden("org:manage");
    const scope = staffScope(actor.orgId);
    let erased: boolean;
    try {
      erased = await this.#o.store.erase(scope, attemptId, "request", {
        decidedBy: { userId: actor.id, name: actor.name },
        guard: closedOnly,
      });
    } catch (error) {
      if (error instanceof AppendRefused) throw new AttemptError("invalid_state", error.message);
      if (error instanceof Error && error.message.startsWith("No such attempt")) throw new AttemptError("not_found", error.message);
      throw error;
    }
    if (erased) await this.#o.exams.recordAudit(actor, "attempt.erased", attemptId, { reason: "request" });
    return { erased };
  }

  /**
   * Erase every closed attempt whose organisation's retention period has run
   * out. Safe to run from every instance at once: an erasure takes the
   * attempt's row lock and happens once.
   */
  async sweep(limit = 100): Promise<number> {
    let count = 0;
    for (const org of await this.#o.identity.organisationIds()) {
      const scope = staffScope(toOrgId(org));
      for (const { attemptId, open } of await this.#o.store.dueForErasure(scope, this.#o.now(), limit)) {
        // Abandoned without being submitted: closed as the next write would
        // have closed it, then erased like any other.
        if (open && !(await this.#o.exams.closeIfExpired(scope.orgId, attemptId))) continue;
        try {
          if (await this.#o.store.erase(scope, attemptId, "retention", { guard: closedOnly })) {
            count += 1;
            await this.#o.store.appendAudit(scope, { actorKind: "system", actorId: null, action: "attempt.erased", target: attemptId, detail: { reason: "retention" } });
          }
        } catch (error) {
          // Reopened since it was found: it is not due any more.
          if (!(error instanceof AppendRefused)) throw error;
        }
      }
    }
    return count;
  }

  /**
   * Delete what Sahayak said more than `TUTOR_KEEP_DAYS` ago, in every
   * organisation (DPDP: kept no longer than it is useful). Idempotent.
   */
  async sweepTutor(): Promise<number> {
    if (this.#o.tutor === null) return 0;
    const before = new Date(this.#o.now() - TUTOR_KEEP_DAYS * 86_400_000);
    let count = 0;
    for (const org of await this.#o.identity.organisationIds()) count += await this.#o.tutor.purgeTutor(toOrgId(org), before);
    return count;
  }
}

const TIMELINE = new Set<ExamEvent["type"]>([
  "attempt_started",
  "consent_given",
  "answer_submitted",
  "viva_probed",
  "viva_replied",
  "time_extended",
  "attempt_submitted",
  "attempt_reopened",
  "attempt_graded",
  "attempt_voided",
  "data_erased",
]);

/** An erasure guard: only an attempt that has closed. One still being sat is the candidate's to finish first. */
function closedOnly(events: readonly ExamEvent[]): string | null {
  let open = true;
  for (const e of events) {
    if (e.type === "attempt_submitted" || e.type === "attempt_graded" || e.type === "attempt_voided") open = false;
    else if (e.type === "attempt_reopened") open = true;
  }
  return open ? "The attempt is still open: it can be erased once it has been submitted" : null;
}
