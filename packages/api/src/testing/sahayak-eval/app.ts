import { AsyncLocalStorage } from "node:async_hooks";
import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import type { CodeRunner } from "@parikshaa/runner";
import { PrepPlusStore, QuestionBank, pgliteExecutor, staffScope, type SqlExecutor } from "@parikshaa/store";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "../harness.js";
import type { EvalCase } from "./cases.js";
import { buildTests } from "./validate.js";

/**
 * Sahayak as a learner meets it, for the eval: the real server over an
 * in-process Postgres, one practice site holding the eval's problems, and a
 * fresh learner for every case, so no case sees another's history. Only the
 * model client is wrapped, to record what each case sent and got back.
 */

const SITE = "sahayak-eval";
const S = `/practice/${SITE}`;
const ORG = "org-eval";

/** One call to the model, as the tutor made it. */
export interface Exchange {
  readonly system: string;
  readonly user: string;
  readonly model: string;
  readonly params: { readonly model: string; readonly max_tokens: number; readonly effort: string };
  readonly response?: Anthropic.Message;
  readonly error?: unknown;
}

export interface Answered {
  readonly answer: string;
  readonly exchange: Exchange;
  /** A review's submission verdict, as the tutor was told it. */
  readonly verdict?: { readonly status: string; readonly passed: number; readonly total: number };
}

const calls = new AsyncLocalStorage<Exchange[]>();

/** The client the tutor is given: the real one, with each call recorded against the case that made it. */
function recording(client: Anthropic): Anthropic {
  const create = async (params: Anthropic.MessageCreateParamsNonStreaming) => {
    const system = Array.isArray(params.system) ? params.system.map((b) => b.text).join("\n\n") : (params.system ?? "");
    const first = params.messages[0]?.content;
    const user = typeof first === "string" ? first : JSON.stringify(first);
    const base = { system, user, model: params.model, params: { model: params.model, max_tokens: params.max_tokens, effort: String(params.output_config?.effort ?? "") } };
    try {
      const response = await client.messages.create(params);
      calls.getStore()?.push({ ...base, response });
      return response;
    } catch (error) {
      calls.getStore()?.push({ ...base, error });
      throw error;
    }
  };
  return { messages: { create } } as unknown as Anthropic;
}

export class EvalApp {
  readonly #db: PGlite;
  readonly #sql: SqlExecutor;
  readonly #app: FastifyInstance;
  readonly #owner: string;
  readonly #problems = new Map<string, string>();
  #learners = 0;

  private constructor(db: PGlite, sql: SqlExecutor, app: FastifyInstance, owner: string) {
    this.#db = db;
    this.#sql = sql;
    this.#app = app;
    this.#owner = owner;
  }

  /** A site holding the given cases' problems, each with its tests built from its reference. */
  static async open(client: Anthropic, runner: CodeRunner, cases: readonly EvalCase[]): Promise<EvalApp> {
    const db = await freshDatabase();
    const sql = pgliteExecutor(db);
    const { app, identity } = await wire(sql, { client: recording(client), runner, server: { rateLimits: false } });
    const org = await addOrganisation(identity, ORG, "Sahayak eval");
    await addStaff(identity, org, "owner@eval.test", "owner", "Eval Owner");
    await db.exec(`UPDATE organisations SET monthly_spend_cap_micro_usd = NULL WHERE id = '${ORG}'`);
    await db.exec(`SET ROLE parikshaa_app`);
    const owner = await signIn(app, "owner@eval.test");
    const self = new EvalApp(db, sql, app, owner);
    await self.#ok("PUT", owner, "/practice-admin/site", { slug: SITE, title: "Sahayak eval", welcome: "", open: true }, 200);
    const problems = [...new Map(cases.map((c) => [c.problem.slug, c.problem])).values()];
    for (const p of problems) {
      const tests = await buildTests(p, runner);
      // Into the bank directly: a big test's input is past what one request to /bank may carry.
      const [entry] = await new QuestionBank(sql).add(staffScope(org), [
        {
          question: {
            kind: "code",
            stem: `${p.title}\n\n${p.statement}`,
            maxScore: 1,
            rubric: [],
            language: "python",
            languages: ["python", "cpp", "java"],
            inputFormat: p.inputFormat,
            outputFormat: p.outputFormat,
            constraints: p.constraints,
            tests,
            limits: { timeMs: p.timeMs ?? 2000, memoryMb: 256 },
          },
          topic: p.tags[0] ?? "",
          difficulty: p.difficulty,
          tags: [...p.tags],
        },
      ]);
      const problem = await self.#ok("POST", owner, "/practice-admin/problems", { bankQuestionId: entry!.id, title: p.title, slug: p.slug, editorial: p.editorial });
      self.#problems.set(p.slug, problem.id);
    }
    return self;
  }

  async close(): Promise<void> {
    await this.#app.close();
    await this.#db.close();
  }

  async #call(method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object, remoteAddress = "127.0.0.1") {
    const headers = token === null ? {} : bearer(token);
    return this.#app.inject({ method, url, headers, remoteAddress, ...(payload === undefined ? {} : { payload }) });
  }

  async #ok(method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object, status = method === "POST" ? 201 : 200, remoteAddress?: string) {
    const res = await this.#call(method, token, url, payload, remoteAddress);
    if (res.statusCode !== status) throw new Error(`${method} ${url}: ${res.statusCode} ${res.payload.slice(0, 300)}`);
    return res.json();
  }

  /** Runs one case as a new learner would, and returns the tutor's answer with the call behind it. */
  async ask(c: EvalCase): Promise<Answered> {
    const n = ++this.#learners;
    // Sign-ups are limited per address; each learner comes from its own.
    const address = `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
    const { token, learner } = await this.#ok("POST", null, `${S}/signup`, { name: `Learner ${n}`, email: `learner${n}.${Date.now()}@eval.test`, password: "a long enough password" }, 201, address);
    const exchanges: Exchange[] = [];
    return calls.run(exchanges, async () => {
      let verdict: Answered["verdict"];
      let res;
      const slug = c.problem.slug;
      if (c.flow === "hint") {
        // The rungs below this one were given earlier; the tutor climbs from there.
        const plus = new PrepPlusStore(this.#sql);
        for (let level = 1; level < c.rung; level++) {
          await plus.addTutor(ORG as never, learner.id, { mode: "hint", problemId: this.#problems.get(slug)!, lessonId: null, hintLevel: level, question: "", answer: `(rung ${level}, given earlier)`, credits: 0, model: "earlier" }, new Date());
        }
        res = await this.#call("POST", token, `${S}/problems/${slug}/tutor/hint`, { code: c.bug.source, language: c.bug.language, replyIn: c.replyIn });
      } else if (c.flow === "review") {
        const submitted = await this.#ok("POST", token, `${S}/problems/${slug}/submit`, { answer: c.bug.source, language: c.bug.language }, 200);
        verdict = { status: submitted.status, passed: submitted.passed, total: submitted.total };
        res = await this.#call("POST", token, `${S}/problems/${slug}/tutor/review`, { replyIn: c.replyIn });
      } else {
        res = await this.#call("POST", token, `${S}/tutor/doubt`, { problem: slug, question: c.doubt.text, replyIn: c.replyIn });
      }
      const exchange = exchanges.at(-1);
      if (res.statusCode !== 200) {
        // A model error comes back as a 503; hand the original on, so a rate limit is retried as one.
        if (exchange?.error !== undefined) throw exchange.error;
        throw new Error(`the tutor answered ${res.statusCode}: ${res.payload.slice(0, 300)}`);
      }
      if (exchanges.length !== 1 || exchange === undefined) throw new Error(`expected one model call, saw ${exchanges.length}`);
      return { answer: (res.json() as { answer: string }).answer, exchange, ...(verdict === undefined ? {} : { verdict }) };
    });
  }
}
