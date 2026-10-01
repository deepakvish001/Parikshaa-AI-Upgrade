import { createHash, createHmac } from "node:crypto";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { examId as toExamId, type AttemptId, type OrgId } from "@parikshaa/core";
import type { ProxyStore } from "@parikshaa/store";
import { z } from "zod";
import type { ProctorService } from "./proctoring.js";
import type { ResultsService } from "./results.js";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";

/**
 * Catching a proxy (docs/PREP-TRACKER.md, V2-12 CO30): someone sitting the
 * test for someone else, or one person sitting it for several. Three signs,
 * each a reason for a person to look and never a finding:
 *
 * - The same identity photo, byte for byte, behind two attempts.
 * - Two candidates of the same exam opening it from the same network and the
 *   same browser (not counted for an exam held in a lab, where that is normal).
 * - The model comparing a candidate's selfie with their photo ID and with the
 *   photos taken while they answered: someone else, or another person there.
 */

/** Photos taken while answering that the model is shown, spread across the sitting. */
export const SNAPSHOTS_COMPARED = 6;

const SYSTEM = `You compare photos of an exam candidate for an Indian college or employer, to help an invigilator spot a proxy: someone sitting the test for someone else.
The first photo is the candidate's selfie taken before the test, the second their photo ID, and the rest webcam photos taken while they answered, in order.
Say whether the face on the ID is the person in the selfie, and for each webcam photo whether the person answering is the person in the selfie, and whether anyone else is visible. Answer "unclear" whenever lighting, angle or quality does not let you tell; never guess. You are not deciding anything: an invigilator looks at every photo you flag.`;

const Verdict = z.enum(["same", "different", "unclear"]);
const Reading = z.object({
  idMatchesSelfie: Verdict,
  snapshots: z.array(z.object({ photo: z.number().int(), person: z.enum(["same", "different", "no_face", "unclear"]), otherPeople: z.boolean() })),
  summary: z.string(),
});
export type IdentityReading = z.infer<typeof Reading> & { readonly flags: readonly string[]; readonly snapshotIds: readonly string[] };

export interface ProxyReport {
  readonly lab: boolean;
  readonly sharedOrigins: readonly { readonly candidates: readonly string[]; readonly attempts: number; readonly from: string; readonly to: string }[];
  readonly reusedPhotos: readonly { readonly candidates: readonly string[] }[];
  readonly checks: readonly { readonly attemptId: string; readonly ref: string; readonly flagged: boolean; readonly flags: readonly string[]; readonly summary: string; readonly checkedAt: string }[];
  /** Attempts with identity photos and no check yet. */
  readonly unchecked: number;
}

export class ProxyService {
  readonly #store: ProxyStore;
  readonly #proctor: ProctorService;
  readonly #results: ResultsService;
  readonly #exams: ExamService;
  readonly #key: Buffer;
  readonly #labbed: (orgId: OrgId, examId: string) => Promise<boolean>;
  readonly #now: () => number;

  constructor(options: {
    readonly store: ProxyStore;
    readonly proctor: ProctorService;
    readonly results: ResultsService;
    readonly exams: ExamService;
    readonly secret: string;
    /** Whether the exam is held in a lab, where one network for everyone is expected. */
    readonly labbed?: (orgId: OrgId, examId: string) => Promise<boolean>;
    readonly now?: () => number;
  }) {
    this.#store = options.store;
    this.#proctor = options.proctor;
    this.#results = options.results;
    this.#exams = options.exams;
    this.#key = createHmac("sha256", options.secret).update("parikshaa-origins").digest();
    this.#labbed = options.labbed ?? (async () => false);
    this.#now = options.now ?? (() => Date.now());
  }

  /** Where an attempt was opened from, kept only as hashes. Never stops a candidate. */
  async recordOrigin(orgId: OrgId, examId: string, attemptId: string, ref: string, ip: string, userAgent: string): Promise<void> {
    const network = createHmac("sha256", this.#key).update(ip).digest("hex").slice(0, 16);
    const device = createHash("sha256").update(userAgent).digest("hex").slice(0, 16);
    await this.#store.recordOrigin(orgId, { attemptId, examId, candidateRef: ref, network, device, at: new Date(this.#now()) });
  }

  async report(actor: Actor, examId: string): Promise<ProxyReport> {
    if (!can(actor, "attempt:read")) throw new Forbidden("attempt:read");
    const [{ rows }, origins, reused, checks, lab] = await Promise.all([
      this.#results.results(actor, toExamId(examId)),
      this.#store.origins(actor.orgId, examId),
      this.#store.reusedPhotos(actor.orgId),
      this.#store.checks<IdentityReading>(actor.orgId, examId),
      this.#labbed(actor.orgId, examId),
    ]);
    const refOf = new Map(rows.map((r) => [r.attemptId, r.ref]));

    const byOrigin = new Map<string, typeof origins[number][]>();
    for (const o of origins) byOrigin.set(`${o.network}|${o.device}`, [...(byOrigin.get(`${o.network}|${o.device}`) ?? []), o]);
    const sharedOrigins = lab
      ? []
      : [...byOrigin.values()]
          .map((list) => ({ list, candidates: [...new Set(list.map((o) => o.candidateRef))].sort() }))
          .filter(({ candidates }) => candidates.length > 1)
          .map(({ list, candidates }) => ({
            candidates,
            attempts: new Set(list.map((o) => o.attemptId)).size,
            from: list.reduce((a, o) => (o.firstAt < a ? o.firstAt : a), list[0]!.firstAt),
            to: list.reduce((a, o) => (o.lastAt > a ? o.lastAt : a), list[0]!.lastAt),
          }));

    const reusedPhotos = reused
      .map((r) => ({ candidates: [...new Set(r.attempts.map((a) => refOf.get(a)).filter((ref): ref is string => ref !== undefined))].sort(), touches: r.attempts.some((a) => refOf.has(a)) }))
      .filter((r) => r.touches && r.candidates.length > 1)
      .map(({ candidates }) => ({ candidates }));

    const checked = new Set(checks.map((c) => c.attemptId));
    let unchecked = 0;
    for (const r of rows) {
      if (checked.has(r.attemptId)) continue;
      const view = await this.#proctor.view(actor, r.attemptId as AttemptId).catch(() => null);
      if (view?.identity.selfie !== null && view?.identity.selfie !== undefined) unchecked++;
    }
    return {
      lab,
      sharedOrigins,
      reusedPhotos,
      checks: checks
        .map((c) => ({ attemptId: c.attemptId, ref: refOf.get(c.attemptId) ?? "", flagged: c.flagged, flags: c.result.flags, summary: c.result.summary, checkedAt: c.checkedAt }))
        .sort((a, b) => Number(b.flagged) - Number(a.flagged) || a.ref.localeCompare(b.ref)),
      unchecked,
    };
  }

  /** The model compares one attempt's photos. Counted against the month's spend cap; a person decides. */
  async check(actor: Actor, attemptId: string): Promise<{ readonly flagged: boolean; readonly flags: readonly string[]; readonly summary: string }> {
    if (!can(actor, "attempt:read")) throw new Forbidden("attempt:read");
    const view = await this.#proctor.view(actor, attemptId as AttemptId);
    const { selfie, id } = view.identity;
    if (selfie === null) throw new AttemptError("invalid_state", "This attempt has no identity photos to compare");
    const spread = view.snapshots.length <= SNAPSHOTS_COMPARED ? view.snapshots : Array.from({ length: SNAPSHOTS_COMPARED }, (_, i) => view.snapshots[Math.floor((i * view.snapshots.length) / SNAPSHOTS_COMPARED)]!);
    const photos = await Promise.all([selfie, ...(id === null ? [] : [id]), ...spread].map((m) => this.#proctor.photo(actor, attemptId as AttemptId, m.id)));
    const examId = view.examId;
    const reading = await this.#exams.authoring(
      actor,
      async (client, model) => {
        const response = await client.messages.parse({
          model,
          max_tokens: 2048,
          output_config: { effort: "low", format: zodOutputFormat(Reading) },
          system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: `Selfie, then ${id === null ? "no ID photo (none was taken)" : "the photo ID"}, then ${spread.length} webcam photos numbered 1 to ${spread.length}.` },
                ...photos.map((p) => ({ type: "image" as const, source: { type: "base64" as const, media_type: p.type as "image/jpeg" | "image/png", data: p.image.toString("base64") } })),
              ],
            },
          ],
        });
        return { result: response.stop_reason === "refusal" ? null : (response.parsed_output ?? null), usage: response.usage };
      },
      { permission: "attempt:read", route: "assess" },
    );
    if (reading === null) throw new AttemptError("invalid_state", "The photos could not be compared: look at them yourself");
    const flags = [
      ...(id !== null && reading.idMatchesSelfie === "different" ? ["The ID photo does not look like the selfie"] : []),
      ...reading.snapshots.filter((s) => s.person === "different").map((s) => `Someone else answering in photo ${s.photo}`),
      ...reading.snapshots.filter((s) => s.otherPeople).map((s) => `Another person in photo ${s.photo}`),
    ];
    const result: IdentityReading = { ...reading, summary: reading.summary.slice(0, 1000), flags, snapshotIds: spread.map((s) => s.id) };
    await this.#store.saveCheck(actor.orgId, examId, { attemptId, result, flagged: flags.length > 0, checkedBy: actor.name, checkedAt: new Date(this.#now()).toISOString() });
    await this.#exams.recordAudit(actor, "attempt.identity_compared", attemptId, { flagged: flags.length > 0 });
    return { flagged: flags.length > 0, flags, summary: result.summary };
  }

  /** Compare every attempt of the exam with identity photos and no check yet, up to a limit. */
  async checkAll(actor: Actor, examId: string, limit: number): Promise<{ readonly checked: number; readonly flagged: number }> {
    if (!can(actor, "attempt:read")) throw new Forbidden("attempt:read");
    const [{ rows }, checks] = await Promise.all([this.#results.results(actor, toExamId(examId)), this.#store.checks(actor.orgId, examId)]);
    const done = new Set(checks.map((c) => c.attemptId));
    let checked = 0;
    let flagged = 0;
    for (const r of rows) {
      if (checked >= limit || done.has(r.attemptId)) continue;
      const view = await this.#proctor.view(actor, r.attemptId as AttemptId).catch(() => null);
      if (view === null || view.identity.selfie === null) continue;
      const outcome = await this.check(actor, r.attemptId);
      checked++;
      if (outcome.flagged) flagged++;
    }
    return { checked, flagged };
  }
}
