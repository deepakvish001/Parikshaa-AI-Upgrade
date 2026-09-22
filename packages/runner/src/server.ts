import { timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { execute, MAX_LIMITS, type RunRequest, type SandboxOptions, type Slot } from "./execute.js";
import { LANGUAGES } from "./languages.js";

/**
 * The runner's HTTP face. One route, behind a shared token, reachable only on
 * the internal network the API shares with it.
 *
 * Runs are bounded two ways. Each slot is one uid and runs one program at a
 * time, so a run never shares a uid with another; and the queue in front of
 * the slots has a ceiling, past which the runner answers 503 rather than
 * accumulating work it will not finish in time.
 */

const runBody = z.object({
  language: z.enum(LANGUAGES),
  source: z.string().max(256 * 1024),
  tests: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        input: z.string().max(1024 * 1024),
        expected: z.string().max(1024 * 1024),
      }),
    )
    .max(100),
  limits: z
    .object({
      timeMs: z.number().int().positive().max(MAX_LIMITS.timeMs).optional(),
      memoryMb: z.number().int().positive().max(MAX_LIMITS.memoryMb).optional(),
    })
    .optional(),
});

export interface RunnerServerOptions {
  readonly token: string;
  readonly workRoot: string;
  /** One per concurrent run. Empty when not root: then runs share the runner's own uid, one at a time. */
  readonly slots: readonly Slot[];
  /** Most requests allowed to wait for a slot. */
  readonly maxQueue?: number;
  readonly run?: (request: RunRequest, options: SandboxOptions) => ReturnType<typeof execute>;
}

export function buildRunnerServer(options: RunnerServerOptions): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 110 * 1024 * 1024 });
  const run = options.run ?? execute;
  const maxQueue = options.maxQueue ?? 200;

  const free: (Slot | null)[] = options.slots.length > 0 ? [...options.slots] : [null];
  const waiting: ((slot: Slot | null) => void)[] = [];
  const acquire = (): Promise<Slot | null> => {
    const slot = free.pop();
    if (slot !== undefined) return Promise.resolve(slot);
    return new Promise((resolve) => waiting.push(resolve));
  };
  const release = (slot: Slot | null) => {
    const next = waiting.shift();
    if (next !== undefined) next(slot);
    else free.push(slot);
  };

  const expected = Buffer.from(`Bearer ${options.token}`);
  const authorised = (header: string | undefined): boolean => {
    if (header === undefined) return false;
    const given = Buffer.from(header);
    return given.length === expected.length && timingSafeEqual(given, expected);
  };

  app.get("/health", async () => ({ ok: true, free: free.length, waiting: waiting.length }));

  app.post("/run", async (request, reply) => {
    if (!authorised(request.headers.authorization)) return reply.code(401).send({ error: "unauthorised" });
    const parsed = runBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", message: parsed.error.message });
    if (waiting.length >= maxQueue) return reply.code(503).send({ error: "busy" });

    const slot = await acquire();
    try {
      return reply.send(await run(parsed.data as RunRequest, { workRoot: options.workRoot, slot }));
    } finally {
      release(slot);
    }
  });

  return app;
}
