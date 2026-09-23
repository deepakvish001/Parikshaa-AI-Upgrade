import { expect, type APIRequestContext } from "@playwright/test";

/** Seeding through the API, as an institution's own tooling would. */

export const OWNER = { email: "owner@e2e.test", password: "e2e owner password, long enough" };

export async function ownerToken(request: APIRequestContext): Promise<string> {
  const res = await request.post("/api/auth/login", { data: OWNER });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()).token as string;
}

export interface Sitting {
  readonly examId: string;
  readonly title: string;
  readonly token: string;
  /** Each invited candidate's personal link, by roll number. */
  readonly links: Readonly<Record<string, string>>;
}

export const MCQ = { id: "q1", kind: "mcq", stem: "Which sort is stable?", maxScore: 4, rubric: [], options: ["Heap sort", "Merge sort"], correctIndex: 1 };
export const SHORT = {
  id: "q2",
  kind: "short",
  stem: "Why does binary search terminate?",
  maxScore: 6,
  rubric: [{ id: "c1", description: "Names the shrinking interval", weight: 1 }],
  expectedPoints: ["the interval halves each step"],
};

/** An exam open now, with `refs` invited to it. Each test gets its own, so tests can run side by side. */
export async function seedSitting(
  request: APIRequestContext,
  options: { refs?: readonly string[]; questions?: readonly object[]; vivaTriggerRatio?: number } = {},
): Promise<Sitting> {
  const token = await ownerToken(request);
  const headers = { authorization: `Bearer ${token}` };
  const examId = `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const title = `Campus drive ${examId.slice(-6)}`;
  const refs = options.refs ?? ["CS001"];

  const created = await request.post("/api/exams", {
    headers,
    data: {
      id: examId,
      title,
      questions: options.questions ?? [MCQ, SHORT],
      policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: options.vivaTriggerRatio ?? 0.5 },
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const now = Date.now();
  const window = await request.put(`/api/exams/${examId}/window`, {
    headers,
    data: { opensAt: new Date(now - 5 * 60_000).toISOString(), closesAt: new Date(now + 2 * 3_600_000).toISOString() },
  });
  expect(window.status()).toBe(200);
  const csv = ["ref,name,email", ...refs.map((r, i) => `${r},Candidate ${i + 1},${r.toLowerCase()}@college.test`)].join("\n");
  const imported = await request.post(`/api/exams/${examId}/invitations/import`, { headers, data: { csv, dryRun: false, channels: [] } });
  expect(imported.status(), await imported.text()).toBe(201);

  const linksCsv = await (await request.get(`/api/exams/${examId}/invitations/links.csv`, { headers })).text();
  const links: Record<string, string> = {};
  for (const line of linksCsv.replace(/^\uFEFF/, "").trim().split("\r\n").slice(1)) {
    const ref = line.match(/^"?([^",]*)/)![1]!;
    links[ref] = line.match(/(https?:\/\/[^",]+\?invite=[^",]+)/)![1]!;
  }
  return { examId, title, token, links };
}

/** A link on the server under test, whatever host the server put in it. */
export const local = (link: string) => {
  const url = new URL(link);
  return `${url.pathname}${url.search}`;
};
