import type { OrgId } from "@parikshaa/core";
import { RunnerUnavailable } from "@parikshaa/runner";
import {
  namespaceOf,
  practiceStaff,
  versionDecision,
  type ContentAuthor,
  type ContentNamespace,
  type ContentStore,
  type ContentType,
  type GateProblem,
  type PracticeStore,
  type PrepStore,
  type ProblemDraft,
  type UploadDetail,
  type UploadItemDraft,
  type UploadSummary,
} from "@parikshaa/store";
import { BundleRefused, contentHash, contentTypeOf, readBundle, schemaProblems } from "./content-bundle.js";
import { runGates, type Built, type Run } from "./content-gates.js";
import { project, projectionProblems, type ProblemProjection, type Projection } from "./content-publish.js";
import { DUPLICATE_AT, mainText, ruleProblems, shingles, TextIndex } from "./content-rules.js";
import type { Placement } from "./content/types.js";
import { PracticeError } from "./practice.js";

/**
 * The console's bulk content upload (tracker plan row 141, part B;
 * docs/content/CONTENT-FORMAT.md §11).
 *
 * An upload is read and put through gates 1–2 (schema, rules), the version
 * rule and the duplicate check while the request waits: those are quick, and
 * the report lists every problem at once. Items that pass them wait for the
 * runner's gates, which a worker in this process does one item at a time,
 * outside the request. Many servers may share the work: each takes an item
 * by claiming it in the database, and an item whose server went quiet is
 * taken again after five minutes. Reading an upload's progress wakes the
 * worker too, so a restart does not leave items waiting.
 *
 * An item that passes every gate is kept as a draft. Learn shows nothing of
 * it until a reviewer publishes it: then its projection is written to the
 * practice site (problems, lessons, their quiz and hands-on problems, and
 * their place in a track) and that version is marked published.
 */

export interface ContentActor {
  readonly orgId: OrgId;
  readonly id: string;
  readonly name: string;
}

export interface PublishResult {
  readonly published: readonly { readonly namespace: ContentNamespace; readonly slug: string; readonly version: number }[];
  readonly refused: readonly { readonly namespace: ContentNamespace; readonly slug: string; readonly message: string }[];
}

/** How long a worker may go without reporting on an item before another takes it. */
export const STALE_MS = 5 * 60_000;

/**
 * Whether a track that publishing makes (the manifest declares it and the
 * site has none of that slug) is published at once, with its first item.
 * Waiting on the owner (17 Nov 2026): false leaves it for staff to publish
 * from the Tracks tab.
 */
export const NEW_TRACK_PUBLISHED = true;

const PLACEHOLDER_SLUG = "(no slug)";
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export class ContentUploads {
  readonly #store: ContentStore;
  readonly #practice: PracticeStore;
  readonly #prep: PrepStore;
  readonly #run: Run | null;
  readonly #now: () => number;
  readonly #staleMs: number;
  readonly #onError: (error: unknown) => void;
  readonly #working = new Map<OrgId, Promise<void>>();

  constructor(options: {
    store: ContentStore;
    practice: PracticeStore;
    prep: PrepStore;
    /** The runner, through the judge's queue; null when none is configured. */
    run: Run | null;
    now?: () => number;
    staleMs?: number;
    /** An error the worker could not put in any item's report (the database went away). */
    onError?: (error: unknown) => void;
  }) {
    this.#store = options.store;
    this.#practice = options.practice;
    this.#prep = options.prep;
    this.#run = options.run;
    this.#now = options.now ?? (() => Date.now());
    this.#staleMs = options.staleMs ?? STALE_MS;
    this.#onError = options.onError ?? (() => undefined);
  }

  #at = () => new Date(this.#now());

  // --- taking an upload in --------------------------------------------------------------------

  /** Read a bundle, check what can be checked at once, record it, and start the runner's gates. */
  async upload(actor: ContentActor, file: { readonly name: string; readonly bytes: Uint8Array }): Promise<UploadDetail> {
    let bundle;
    try {
      bundle = readBundle(file.bytes);
    } catch (error) {
      if (error instanceof BundleRefused) throw new PracticeError(error.code === "too_large" ? "too_large" : "invalid", error.message);
      throw error;
    }
    const manifest = isObject(bundle.manifest) ? bundle.manifest : null;
    const problems: GateProblem[] = [...bundle.problems];
    if (manifest === null) problems.push({ gate: "manifest", message: "The bundle has no manifest: give bundle_id, version, title, author, created_on, licence and originality" });
    if (bundle.items.length === 0) problems.push({ gate: "manifest", message: "The bundle has no items" });
    const tracks = new Set(Array.isArray(manifest?.tracks) ? manifest.tracks.flatMap((t) => (isObject(t) && typeof t.slug === "string" ? [t.slug] : [])) : []);

    // Gates 1 and 2, item by item.
    const drafts = bundle.items.map((b): UploadItemDraft & { warnings: string[]; text?: ReturnType<typeof shingles> } => {
      const type = contentTypeOf(b.item);
      const it = isObject(b.item) ? b.item : {};
      const slug = typeof it.slug === "string" && it.slug.length > 0 ? it.slug.slice(0, 200) : PLACEHOLDER_SLUG;
      const base = {
        namespace: type === null ? ("problem" as const) : namespaceOf(type),
        slug,
        type: type ?? (typeof it.schema === "string" ? it.schema.slice(0, 40) : "(unknown)"),
        version: typeof it.version === "number" && Number.isInteger(it.version) && it.version >= 1 ? it.version : 0,
        hash: contentHash(b.item),
        title: typeof it.title === "string" ? it.title.slice(0, 200) : "",
        item: null,
      };
      const errors: GateProblem[] = [...b.problems];
      const warnings: string[] = [];
      if (type === null) errors.push({ gate: "schema", message: `${b.file}: "schema" must name a content type (parikshaa.content/dsa-problem@1, sql-problem, mcq, lesson, project or system-design)` });
      else {
        for (const m of schemaProblems(type, b.item)) errors.push({ gate: "schema", message: m });
        if (errors.length === 0) {
          const rules = ruleProblems(type, b.item);
          errors.push(...rules.errors.map((message) => ({ gate: "rules", message })));
          warnings.push(...rules.warnings);
          for (const p of (it.placement as Placement[] | undefined) ?? []) if (!tracks.has(p.track)) errors.push({ gate: "rules", message: `placement: the track ${p.track} is not declared in the manifest's tracks` });
        }
      }
      if (errors.length > 0) return { ...base, status: "failed", problems: errors, warnings };
      return { ...base, status: "pending", item: b.item, problems: [], warnings, text: shingles(mainText(it)) };
    });

    // A slug once per bundle, and a title once per type.
    const seen = new Map<string, number>();
    const titles = new Map<string, number>();
    drafts.forEach((d, i) => {
      if (d.slug === PLACEHOLDER_SLUG) return;
      const key = `${d.namespace}:${d.slug}`;
      const first = seen.get(key);
      if (first !== undefined) {
        fail(d, "duplicate", `the slug ${d.slug} is used twice in this bundle (also item ${first + 1})`);
        return;
      }
      seen.set(key, i);
      const title = `${d.type}:${d.title.toLowerCase()}`;
      const same = titles.get(title);
      if (same !== undefined && d.title !== "") fail(d, "duplicate", `the same title as item ${same + 1} (${drafts[same]!.slug})`);
      else titles.set(title, i);
    });

    // Gate 11: text against the rest of the bundle and what the site has.
    const index = new TextIndex();
    if (manifest !== null) await this.#indexSite(actor.orgId, index);
    for (const [i, d] of drafts.entries()) {
      if (d.text === undefined || d.status !== "pending") continue;
      const doc = { label: `item ${i + 1} (${d.slug})`, key: `${d.namespace}:${d.slug}`, shingles: d.text };
      const close = index.closest(doc);
      if (close !== null) {
        const share = `${Math.round(close.similarity * 100)}%`;
        if (close.similarity >= DUPLICATE_AT) fail(d, "duplicate", `the text is ${share} the same as ${close.label}: a copy is not taken`);
        else d.warnings.push(`the text is ${share} like ${close.label}: check it is not a duplicate`);
      }
      index.add(doc);
    }

    // The version rule, against what is kept: a skip needs no runner.
    const standing = await this.#store.standing(
      actor.orgId,
      drafts.filter((d) => d.status === "pending").map((d) => ({ namespace: d.namespace, slug: d.slug })),
    );
    for (const d of drafts) {
      if (d.status !== "pending") continue;
      const now = standing.get(`${d.namespace}:${d.slug}`);
      if (now === undefined) continue;
      if ("foreign" in now) {
        fail(d, "version", now.foreign);
        continue;
      }
      const decision = versionDecision(now, d);
      if (decision.action === "skip") Object.assign(d, { status: "skipped", item: null, warnings: [...d.warnings, `version ${d.version} with the same content is kept already: nothing to check`] });
      else if (decision.action === "refuse") fail(d, "version", decision.reason);
    }
    // A bundle-level problem stops every item: nothing goes to the runner.
    if (problems.length > 0) for (const d of drafts) if (d.status === "pending") fail(d, "manifest", "the bundle's manifest has problems (above); fix them and upload again");

    const id = await this.#store.createUpload(
      actor.orgId,
      {
        bundleId: typeof manifest?.bundle_id === "string" ? manifest.bundle_id.slice(0, 80) : "(no bundle_id)",
        bundleVersion: typeof manifest?.version === "number" && Number.isInteger(manifest.version) && manifest.version >= 1 ? manifest.version : 1,
        title: typeof manifest?.title === "string" && manifest.title.trim() !== "" ? manifest.title.trim().slice(0, 200) : file.name.slice(0, 200) || "Upload",
        fileName: file.name.slice(0, 200) || "upload",
        bytes: file.bytes.length,
        manifest: manifest ?? {},
        problems,
        createdBy: { id: actor.id, name: actor.name },
        items: drafts.map(({ text: _, ...d }) => d),
      },
      this.#at(),
    );
    this.kick(actor.orgId);
    return (await this.#store.upload(actor.orgId, id))!;
  }

  async #indexSite(orgId: OrgId, index: TextIndex): Promise<void> {
    const scope = practiceStaff(orgId);
    const [problems, lessons] = await Promise.all([this.#practice.problems(scope), this.#prep.lessons(scope)]);
    for (const p of problems) index.add({ label: `the site's problem ${p.slug}`, key: `problem:${p.slug}`, shingles: shingles(`${p.title}\n${p.question.stem}`) });
    for (const l of lessons) index.add({ label: `the site's lesson ${l.slug}`, key: `lesson:${l.slug}`, shingles: shingles(`${l.title}\n${l.body}`) });
  }

  // --- reading -----------------------------------------------------------------------------------

  async list(orgId: OrgId): Promise<readonly UploadSummary[]> {
    return this.#store.uploads(orgId);
  }

  /** An upload with every item's report. While it is still checking, the worker is woken, in case a restart stopped it. */
  async detail(orgId: OrgId, id: string): Promise<UploadDetail> {
    const found = await this.#store.upload(orgId, id);
    if (found === null) throw new PracticeError("not_found", "No such upload");
    if (found.state === "checking") this.kick(orgId);
    return found;
  }

  // --- the worker ---------------------------------------------------------------------------------

  /** Start working through the organisation's waiting items, unless a worker in this process already is. */
  kick(orgId: OrgId): void {
    if (this.#working.has(orgId)) return;
    const work = this.#work(orgId)
      .catch((error: unknown) => this.#onError(error))
      .finally(() => this.#working.delete(orgId));
    this.#working.set(orgId, work);
  }

  /** Until this process's worker for the organisation has nothing left (tests, and a clean shutdown). */
  async idle(orgId: OrgId): Promise<void> {
    while (this.#working.has(orgId)) await this.#working.get(orgId);
  }

  async #work(orgId: OrgId): Promise<void> {
    for (;;) {
      const claim = await this.#store.claimNext(orgId, this.#staleMs, this.#at());
      if (claim === null) return;
      const type = claim.type as ContentType;
      let result: { problems: GateProblem[]; warnings: string[]; built: Built };
      try {
        result = await runGates(type, claim.item, this.#run);
      } catch (error) {
        if (error instanceof RunnerUnavailable) {
          // The runner is down or full: the item waits for the next look at the upload.
          await this.#store.releaseItem(orgId, claim);
          return;
        }
        result = { problems: [{ gate: "internal", message: `The check stopped with an error: ${(error as Error).message}` }], warnings: [], built: {} };
      }
      if (result.problems.length === 0) {
        const projection = project(type, claim.item, result.built);
        result.problems.push(...projectionProblems(projection));
        if (projection.kind === "none") result.warnings.push(`not published to Learn: ${projection.reason}`);
      }
      const title = isObject(claim.item) && typeof claim.item.title === "string" ? claim.item.title : claim.slug;
      await this.#store.finishItem(
        orgId,
        claim,
        {
          problems: result.problems,
          warnings: result.warnings,
          draft:
            result.problems.length > 0
              ? null
              : { namespace: claim.namespace, slug: claim.slug, type, title, version: claim.version, hash: claim.hash, item: claim.item, built: result.built, uploadId: claim.uploadId, warnings: result.warnings },
        },
        this.#at(),
      );
    }
  }

  // --- publishing ---------------------------------------------------------------------------------

  /**
   * Publish an upload's drafts: the items named, or every item of it that
   * passed. Each is published as the version this upload brought; one that a
   * later upload has changed since is refused (publish it from that upload).
   */
  async publish(actor: ContentActor, uploadId: string, only?: readonly { readonly namespace: ContentNamespace; readonly slug: string }[]): Promise<PublishResult> {
    const upload = await this.#store.upload(actor.orgId, uploadId);
    if (upload === null) throw new PracticeError("not_found", "No such upload");
    const wanted =
      only === undefined
        ? upload.items.filter((i) => i.status === "passed")
        : only.map((k) => upload.items.find((i) => i.namespace === k.namespace && i.slug === k.slug) ?? { ...k, status: "missing" as const, version: 0, hash: "" });
    const published: { namespace: ContentNamespace; slug: string; version: number }[] = [];
    const refused: { namespace: ContentNamespace; slug: string; message: string }[] = [];
    const site = new SiteWriter(actor.orgId, this.#practice, this.#prep);
    for (const want of wanted) {
      const refuse = (message: string) => refused.push({ namespace: want.namespace, slug: want.slug, message });
      if (want.status !== "passed") {
        refuse(want.status === "missing" ? "This upload has no such item" : `Only an item that passed its checks can be published; this one is ${want.status}`);
        continue;
      }
      const kept = await this.#store.item(actor.orgId, want.namespace, want.slug);
      if (kept === null || kept.version !== want.version || kept.hash !== want.hash) {
        refuse("A later upload has changed this item since; publish it from that upload");
        continue;
      }
      if (kept.state === "published") {
        refuse(`Version ${kept.version} is published already`);
        continue;
      }
      const projection = project(kept.type, kept.item, kept.built as Built);
      if (projection.kind === "none") {
        refuse(projection.reason);
        continue;
      }
      try {
        const where = await site.write(projection, kept, upload.manifest);
        if (await this.#store.markPublished(actor.orgId, { namespace: kept.namespace, slug: kept.slug, version: kept.version, hash: kept.hash }, where, { id: actor.id, name: actor.name }, this.#at())) {
          published.push({ namespace: kept.namespace, slug: kept.slug, version: kept.version });
        } else refuse("A later upload changed this item while it was being published; publish it again from that upload");
      } catch (error) {
        if (error instanceof PracticeError) refuse(error.message);
        else throw error;
      }
    }
    await site.saveTracks();
    return { published, refused };
  }
}

function fail(d: { status: string; problems: readonly GateProblem[]; item: unknown }, gate: string, message: string): void {
  Object.assign(d, { status: "failed", item: null, problems: [...d.problems, { gate, message }] });
}

/**
 * Writes projections to the practice site for one publish: problems and
 * lessons as they are published, then each track touched, once, at the end.
 */
class SiteWriter {
  readonly #orgId: OrgId;
  readonly #practice: PracticeStore;
  readonly #prep: PrepStore;
  #problems: Map<string, { id: string; position: number }> | null = null;
  #next = 0;
  #tracks: Map<string, { id: string | null; slug: string; title: string; description: string; position: number; published: boolean; modules: { title: string; items: ({ problemId: string } | { lessonId: string })[] }[] }> | null = null;
  readonly #touched = new Set<string>();

  constructor(orgId: OrgId, practice: PracticeStore, prep: PrepStore) {
    this.#orgId = orgId;
    this.#practice = practice;
    this.#prep = prep;
  }

  async #problemsBySlug() {
    if (this.#problems === null) {
      const all = await this.#practice.problems(practiceStaff(this.#orgId));
      this.#problems = new Map(all.map((p) => [p.slug, { id: p.id, position: p.position }]));
      this.#next = Math.max(-1, ...all.map((p) => p.position)) + 1;
    }
    return this.#problems;
  }

  /** Write one problem: over the one it was published as before, or as a new one. */
  async #problem(p: ProblemProjection, id: string | null): Promise<string> {
    const bySlug = await this.#problemsBySlug();
    const current = id === null ? undefined : [...bySlug.values()].find((x) => x.id === id);
    const draft: ProblemDraft = { slug: p.slug, title: p.title, question: p.question, difficulty: p.difficulty, tags: p.tags, editorial: p.editorial, hint: p.hint, fromBank: null, position: current?.position ?? this.#next, published: true };
    try {
      if (current !== undefined && id !== null) {
        const saved = await this.#practice.updateProblem(this.#orgId, id, draft);
        if (saved !== null) return saved.id;
      }
      const added = await this.#practice.addProblem(this.#orgId, draft);
      this.#next++;
      bySlug.set(p.slug, { id: added.id, position: added.position });
      return added.id;
    } catch (error) {
      if ((error as Error).name === "SlugTaken") throw new PracticeError("slug_taken", `The problem address ${p.slug} is used by another problem on the site`);
      throw error;
    }
  }

  async write(projection: Exclude<Projection, { kind: "none" }>, kept: { readonly problemId: string | null; readonly lessonId: string | null; readonly children: Readonly<Record<string, string>>; readonly item: unknown; readonly uploadId: string }, manifest: unknown) {
    const placement = ((kept.item as { placement?: Placement[] }).placement ?? []) as Placement[];
    if (projection.kind === "problem") {
      const problemId = await this.#problem(projection.problem, kept.problemId);
      await this.#place(placement, manifest, [{ problemId }]);
      return { problemId };
    }
    const l = projection.lesson;
    let lesson;
    try {
      lesson = await this.#prep.saveLesson(this.#orgId, kept.lessonId, { slug: l.slug, title: l.title, body: l.body, videoUrl: l.videoUrl, estMinutes: l.estMinutes, published: true });
      if (lesson === null) lesson = await this.#prep.saveLesson(this.#orgId, null, { slug: l.slug, title: l.title, body: l.body, videoUrl: l.videoUrl, estMinutes: l.estMinutes, published: true });
    } catch (error) {
      if ((error as Error).name === "PrepSlugTaken") throw new PracticeError("slug_taken", `The lesson address ${l.slug} is used by another lesson on the site`);
      throw error;
    }
    const children: Record<string, string> = {};
    for (const p of [...projection.quiz, ...projection.handsOn]) children[p.slug] = await this.#problem(p, kept.children[p.slug] ?? null);
    await this.#prep.setLessonQuiz(this.#orgId, lesson!.id, projection.quiz.map((q) => children[q.slug]!));
    await this.#place(placement, manifest, [{ lessonId: lesson!.id }, ...projection.handsOn.map((h) => ({ problemId: children[h.slug]! }))]);
    return { lessonId: lesson!.id, children };
  }

  /** Put an item (and what follows it: a lesson's hands-on tasks) in each track and module its placement names. */
  async #place(placement: readonly Placement[], manifest: unknown, entries: readonly ({ problemId: string } | { lessonId: string })[]) {
    if (placement.length === 0) return;
    if (this.#tracks === null) {
      const tracks = await this.#prep.tracks(practiceStaff(this.#orgId));
      this.#tracks = new Map(
        tracks.map((t) => [
          t.slug,
          {
            id: t.id,
            slug: t.slug,
            title: t.title,
            description: t.description,
            position: t.position,
            published: t.published,
            modules: t.modules.map((m) => ({ title: m.title, items: m.items.map((i) => (i.problemId !== null ? { problemId: i.problemId } : { lessonId: i.lessonId! })) })),
          },
        ]),
      );
    }
    const declared = isObject(manifest) && Array.isArray(manifest.tracks) ? (manifest.tracks as { slug: string; title: string; description: string; modules: string[] }[]) : [];
    const same = (a: { problemId: string } | { lessonId: string }, b: { problemId: string } | { lessonId: string }) =>
      "problemId" in a ? "problemId" in b && a.problemId === b.problemId : "lessonId" in b && a.lessonId === b.lessonId;
    for (const p of placement) {
      const spec = declared.find((t) => t.slug === p.track);
      let track = this.#tracks.get(p.track);
      if (track === undefined) {
        if (spec === undefined) continue;
        track = { id: null, slug: spec.slug, title: spec.title, description: spec.description, position: this.#tracks.size, published: NEW_TRACK_PUBLISHED, modules: [] };
        this.#tracks.set(p.track, track);
      }
      // The manifest's modules, in its order, before any it does not name.
      for (const [i, title] of (spec?.modules ?? []).entries()) {
        if (!track.modules.some((m) => m.title === title)) track.modules.splice(Math.min(i, track.modules.length), 0, { title, items: [] });
      }
      let module = track.modules.find((m) => m.title === p.module);
      if (module === undefined) {
        module = { title: p.module, items: [] };
        track.modules.push(module);
      }
      // Moved within the track by a new version: out of where it was.
      for (const m of track.modules) m.items = m.items.filter((x) => !entries.some((e) => same(e, x)));
      module.items.splice(Math.min(p.position, module.items.length), 0, ...entries);
      this.#touched.add(p.track);
    }
  }

  async saveTracks() {
    for (const slug of this.#touched) {
      const t = this.#tracks!.get(slug)!;
      try {
        await this.#prep.saveTrack(this.#orgId, t.id, { slug: t.slug, title: t.title, description: t.description, position: t.position, published: t.published, modules: t.modules });
      } catch (error) {
        if ((error as Error).name === "PrepSlugTaken") throw new PracticeError("slug_taken", `The track address ${t.slug} is taken`);
        throw error;
      }
    }
  }
}
