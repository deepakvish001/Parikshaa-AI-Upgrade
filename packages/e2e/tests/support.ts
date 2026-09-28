import { expect, type APIRequestContext, type Page } from "@playwright/test";

/** Seeding through the API, as an institution's own tooling would. */

export const OWNER = { email: "owner@e2e.test", password: "e2e owner password, long enough" };

/** The owner of the second organisation, which has a privacy notice (ROADMAP §11). */
export const PRIVATE_OWNER = { email: "owner@private.e2e.test", password: OWNER.password };


export async function ownerToken(request: APIRequestContext, account: { email: string; password: string } = OWNER): Promise<string> {
  const res = await request.post("/api/auth/login", { data: account });
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
  options: {
    refs?: readonly string[];
    questions?: readonly object[];
    sections?: readonly object[];
    vivaTriggerRatio?: number;
    owner?: typeof OWNER;
    proctoring?: object;
    /** A title to show; otherwise one made unique per test. */
    title?: string;
    /** Each candidate's name, by position in `refs`. */
    names?: readonly string[];
    durationMs?: number;
    /** When the window opens; now, if not given. It stays open three hours from then. */
    opensAt?: Date;
    /** Offer the on-screen calculator. */
    calculator?: boolean;
    /** The qualifying mark. */
    cutoff?: { percent: number; sections?: Record<string, number> };
  } = {},
): Promise<Sitting> {
  const token = await ownerToken(request, options.owner);
  const headers = { authorization: `Bearer ${token}` };
  const examId = `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const title = options.title ?? `Campus drive ${examId.slice(-6)}`;
  const refs = options.refs ?? ["CS001"];

  const created = await request.post("/api/exams", {
    headers,
    data: {
      id: examId,
      title,
      questions: options.questions ?? [MCQ, SHORT],
      ...(options.sections === undefined ? {} : { sections: options.sections }),
      policy: {
        durationMs: options.durationMs ?? 3_600_000,
        allowRevision: true,
        vivaTriggerRatio: options.vivaTriggerRatio ?? 0.5,
        ...(options.proctoring === undefined ? {} : { proctoring: options.proctoring }),
        ...(options.calculator === undefined ? {} : { calculator: options.calculator }),
        ...(options.cutoff === undefined ? {} : { cutoff: options.cutoff }),
      },
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const now = Date.now();
  const window = await request.put(`/api/exams/${examId}/window`, {
    headers,
    data:
      options.opensAt === undefined
        ? { opensAt: new Date(now - 5 * 60_000).toISOString(), closesAt: new Date(now + 2 * 3_600_000).toISOString() }
        : { opensAt: options.opensAt.toISOString(), closesAt: new Date(options.opensAt.getTime() + 3 * 3_600_000).toISOString() },
  });
  expect(window.status()).toBe(200);
  const csv = ["ref,name,email", ...refs.map((r, i) => `${r},${options.names?.[i] ?? `Candidate ${i + 1}`},${r.toLowerCase()}@college.test`)].join("\n");
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

/**
 * The private organisation's notice. One wording for every spec: specs run
 * side by side, and a different wording saved by one would move the notice to
 * a new version under another candidate's feet.
 */
export async function setPrivacyNotice(request: APIRequestContext, token: string): Promise<void> {
  const saved = await request.put("/api/privacy", {
    headers: { authorization: `Bearer ${token}` },
    data: {
      controllerName: "E2E Private Ltd",
      grievanceName: "Priya Menon",
      grievanceEmail: "privacy@private.e2e.test",
      purpose: "To assess candidates for engineering roles.",
      retentionDays: 90,
    },
  });
  expect(saved.status(), await saved.text()).toBe(200);
}

/** The question on screen: the paper shows one at a time, as a computer-based test does. */
export const onScreen = (page: Page) => page.locator("section.qview");
/** The actions under it: Previous, Clear response, Mark for review & next, Save & next. */
export const actions = (page: Page) => page.locator(".qfoot");

/** Open question `n` from the palette, opening its sheet first where a phone keeps it in one. */
export async function openQuestion(page: Page, n: number): Promise<void> {
  const palette = page.getByRole("navigation", { name: "Questions" });
  // On a phone or tablet the palette is a sheet, opened from the strip under the bar.
  const opener = page.locator(".questions-open");
  // Wait for the paper, then look: isVisible does not wait for anything.
  await expect(palette).toBeAttached();
  if ((await opener.isVisible()) && !(await palette.evaluate((el) => el.classList.contains("open")))) await opener.click();
  await palette.getByRole("button", { name: new RegExp(`^Question ${n}:`) }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`^${n}\\. `) })).toBeVisible();
}

/**
 * Open a link for the first time, as a candidate does: the instructions and
 * system check come first, and the clock starts only with the last button
 * ("I am ready to begin", or "Continue" when a camera check follows).
 * Language-independent, so it serves a sitting read in Hindi too.
 */
export async function beginSitting(page: Page, link: string): Promise<void> {
  await page.goto(local(link));
  await readyToBegin(page);
}

/** On the instructions page: declare, and begin. */
export async function readyToBegin(page: Page): Promise<void> {
  const declare = page.locator(".declare");
  await declare.locator("input[type=checkbox]").check();
  await declare.getByRole("button").click();
}

/**
 * Change the page's language during the test, through the Display menu on
 * the exam bar. Language-independent: it finds the menu by its place, not
 * its name, and closes it again after.
 */
export async function chooseLanguage(page: Page, language: string): Promise<void> {
  const toggle = page.locator(".display-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await page.locator("#pref-language").selectOption(language);
  await page.keyboard.press("Escape");
}

/** Submit, through the summary a CBT shows first. */
export async function submitAttempt(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Submit attempt" }).click();
  await page.getByRole("dialog", { name: "Submit your attempt?" }).getByRole("button", { name: "Yes, submit" }).click();
}
