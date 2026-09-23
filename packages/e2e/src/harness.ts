import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Shared by the chaos and load runs: start the real server as its own
 * process — so it can be killed like one — and drive it over HTTP.
 */

export interface Server {
  readonly base: string;
  readonly process: ChildProcess;
  /** Kill it hard: no shutdown hooks, no draining, as a crashed machine would. */
  kill(): Promise<void>;
  stop(): Promise<void>;
}

export async function startServer(options: { port: number; reset: boolean; env?: Record<string, string> }): Promise<Server> {
  const child = spawn(process.execPath, [fileURLToPath(new URL("./server.js", import.meta.url))], {
    env: {
      ...process.env,
      PORT: String(options.port),
      E2E_RESET: options.reset ? "1" : "0",
      RATE_LIMITS: "off",
      ...options.env,
    },
    stdio: ["ignore", "ignore", "inherit"],
  });
  const base = `http://localhost:${options.port}/api`;
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`The server exited with ${child.exitCode}`);
    try {
      if ((await fetch(`${base}/health`)).ok) break;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error("The server did not come up");
    await new Promise((r) => setTimeout(r, 100));
  }
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  return {
    base,
    process: child,
    kill: async () => {
      child.kill("SIGKILL");
      await exited;
    },
    stop: async () => {
      child.kill("SIGTERM");
      await exited;
    },
  };
}

export class Api {
  constructor(
    readonly base: string,
    readonly token: string | null = null,
  ) {}

  as(token: string): Api {
    return new Api(this.base, token);
  }

  async call(method: string, path: string, body?: unknown): Promise<Response> {
    return fetch(`${this.base}${path}`, {
      method,
      headers: {
        ...(this.token === null ? {} : { authorization: `Bearer ${this.token}` }),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.call(method, path, body);
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  }
}

export const QUESTIONS = [
  { id: "q1", kind: "mcq", stem: "Which sort is stable?", maxScore: 4, rubric: [], options: ["Heap sort", "Merge sort"], correctIndex: 1 },
  {
    id: "q2",
    kind: "short",
    stem: "Why does binary search terminate?",
    maxScore: 6,
    rubric: [{ id: "c1", description: "Names the shrinking interval", weight: 1 }],
    expectedPoints: ["the interval halves each step"],
  },
  { id: "q3", kind: "numeric", stem: "log2(1024)?", maxScore: 2, rubric: [], expected: 10, tolerance: 0 },
];

/** An exam open now with `count` candidates invited; returns the owner's API handle and each candidate's code. */
export async function seedCohort(base: string, owner: { email: string; password: string }, examId: string, count: number) {
  const anonymous = new Api(base);
  const { token } = await anonymous.json<{ token: string }>("POST", "/auth/login", owner);
  const api = anonymous.as(token);
  await api.json("POST", "/exams", {
    id: examId,
    title: `Drive ${examId}`,
    questions: QUESTIONS,
    policy: { durationMs: 3 * 3_600_000, allowRevision: true, vivaTriggerRatio: 0.5 },
  });
  const now = Date.now();
  await api.json("PUT", `/exams/${examId}/window`, {
    opensAt: new Date(now - 60_000).toISOString(),
    closesAt: new Date(now + 4 * 3_600_000).toISOString(),
  });
  const refs = Array.from({ length: count }, (_, i) => `R${String(i + 1).padStart(5, "0")}`);
  // In batches, as an institution importing a large cohort would split a sheet.
  for (let i = 0; i < refs.length; i += 500) {
    const csv = ["ref,name,email", ...refs.slice(i, i + 500).map((r) => `${r},Candidate ${r},${r.toLowerCase()}@college.test`)].join("\n");
    await api.json("POST", `/exams/${examId}/invitations/import`, { csv, dryRun: false, channels: [] });
  }
  const links = await (await api.call("GET", `/exams/${examId}/invitations/links.csv`)).text();
  const codes = [...links.matchAll(/\?invite=([^",\r\n]+)/g)].map((m) => decodeURIComponent(m[1]!));
  if (codes.length !== count) throw new Error(`Expected ${count} links, got ${codes.length}`);
  return { api, codes };
}
