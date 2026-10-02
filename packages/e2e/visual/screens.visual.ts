import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
// The password hash alone: the whole API would load Fastify into the test runner.
import { hashPassword } from "@parikshaa/api/passwords";
import { seedOrganisation } from "../src/database.js";
import { MCQ, seedSitting, type Sitting } from "../tests/support.js";

/**
 * The console, page by page, held to its committed images: at 1440 in light
 * and dark, and the pages an invigilator opens on a phone at 390 — the
 * redesign plan's bar for the console (Phase C). Everything is seeded in an
 * organisation of its own, so no other check can change what these pages
 * show; what changes from run to run (dates, "2 min ago", the greeting) is
 * set to a fixed wording before each capture. The candidate's pages are in
 * candidate.visual.ts.
 */

const NUMERIC = { id: "q2", kind: "numeric", stem: "A train covers 180 km in 2.5 hours. What is its average speed in km/h?", maxScore: 2, rubric: [], expected: 72, tolerance: 0 };
const DRIVE = "Campus Drive 2026 — Aptitude";
const MIDTERM = "Semester 5 — Data Structures Mid-term";
const PEOPLE = ["Aarav Sharma", "Diya Patel", "Ishaan Reddy", "Ananya Iyer"];

let owner: { email: string; password: string };
let drive: Sitting;

test.describe.configure({ mode: "serial" });

/** Sit one candidate's paper through the API; graded unless told otherwise. */
async function sit(request: APIRequestContext, sitting: Sitting, ref: string, answers: Record<string, string>, finish: boolean) {
  const code = decodeURIComponent(new URL(sitting.links[ref]!).searchParams.get("invite")!);
  const { token, attemptId } = await (await request.post("/api/invitations/redeem", { data: { code } })).json();
  const headers = { authorization: `Bearer ${token}` };
  for (const [questionId, answer] of Object.entries(answers)) {
    expect((await request.post("/api/attempts/me/answers", { headers, data: { questionId, answer } })).status()).toBe(202);
  }
  if (!finish) return;
  expect((await request.post("/api/attempts/me/submit", { headers })).status()).toBe(200);
  expect((await request.post(`/api/attempts/${attemptId}/grade`, { headers: { authorization: `Bearer ${sitting.token}` } })).status()).toBe(200);
}

test.beforeAll(async ({ request }) => {
  owner = await seedOrganisation(hashPassword, "e2e-visual", "Nalanda Institute of Technology");
  drive = await seedSitting(request, { owner, title: DRIVE, questions: [MCQ, NUMERIC], refs: ["CS001", "CS002", "CS003", "CS004"], names: PEOPLE, cutoff: { percent: 50 } });
  await sit(request, drive, "CS001", { q1: "1", q2: "72" }, true);
  await sit(request, drive, "CS002", { q1: "1", q2: "70" }, true);
  await sit(request, drive, "CS003", { q1: "0", q2: "65" }, true);
  await sit(request, drive, "CS004", { q1: "1" }, false); // still answering
  await seedSitting(request, { owner, title: MIDTERM, questions: [MCQ], refs: ["DS101", "DS102"], names: ["Vikram Joshi", "Pooja Bansal"] });
  const headers = { authorization: `Bearer ${drive.token}` };
  for (const [stem, topic, difficulty] of [
    ["Which sorting algorithm is stable?", "Sorting", "easy"],
    ["What is the time complexity of binary search?", "Searching", "medium"],
  ] as const) {
    await request.post("/api/bank", {
      headers,
      data: { question: { kind: "mcq", stem, maxScore: 2, rubric: [], options: ["One", "Two"], correctIndex: 1 }, topic, difficulty, tags: [] },
    });
  }
});

async function signIn(page: Page) {
  await page.goto("/console/");
  await page.getByLabel("Email").fill(owner.email);
  await page.getByLabel("Password", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
}

const nav = (page: Page, name: string) => page.getByRole("navigation", { name: "Account" }).getByRole("button", { name, exact: true }).click();

/**
 * Fonts in, nothing moving, and what depends on the clock worded the same
 * every run: the day an exam was made, when its window closes, how long ago
 * someone was seen, the greeting.
 */
async function settle(page: Page) {
  await page.evaluate(() => {
    const set = (selector: string, text: string) => document.querySelectorAll(selector).forEach((el) => (el.textContent = text));
    set(".exam-table td.muted", "1 Oct 2026");
    set(".page-meta > span:not(.home-greeting):not(.editor-facts)", "Open until 1 Oct, 1:00 pm IST · 60 min · 6 marks · qualifies at 50%");
    set(".home-greeting", "Good morning, Ravi.");
    set(".freshness", "Updated just now");
    document.querySelectorAll(".seen-at").forEach((el) => {
      const dot = el.querySelector(".seen-dot");
      el.textContent = "Here now";
      if (dot !== null) el.prepend(dot);
      el.className = "seen-at here";
    });
    document.querySelectorAll(".live-table td.num").forEach((el) => {
      if (/min|Time up/.test(el.textContent ?? "")) el.textContent = "58 min";
    });
  });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(150);
}

/** Pages whose clock-bound parts cannot be worded the same, covered instead. */
// The proxy card prints when attempts were opened: the wall clock, not the seeded one.
const masks = (page: Page) => [page.locator(".home-calendar"), page.locator(".activity"), page.locator(".proxy-time")];

const PAGES: readonly (readonly [string, (page: Page) => Promise<void>])[] = [
  ["home", async () => {}],
  [
    "exams",
    async (page) => {
      await nav(page, "Exams");
      await expect(page.getByRole("button", { name: DRIVE, exact: true })).toBeVisible();
    },
  ],
  [
    "exam-overview",
    async (page) => {
      await nav(page, "Exams");
      await page.getByRole("button", { name: DRIVE, exact: true }).click();
      await expect(page.getByRole("complementary", { name: "Candidates at a glance" }).getByText("Qualified", { exact: true })).toBeVisible();
      await expect(page.getByRole("region", { name: "Attempts" })).toBeVisible();
      // Loaded on its own, after the page: wait for it, so the picture never races it.
      await expect(page.getByRole("region", { name: "Paper review" })).toBeVisible();
    },
  ],
  [
    "results",
    async (page) => {
      await nav(page, "Exams");
      await page.getByRole("button", { name: DRIVE, exact: true }).click();
      await page.getByRole("navigation", { name: "Exam" }).getByRole("button", { name: "Results" }).click();
      await expect(page.getByRole("region", { name: "How the marks fell" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Internal marks" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Course outcomes" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Shortlists for hiring managers" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Handwritten copies" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Signs of a proxy" })).not.toHaveAttribute("aria-busy", "true");
      await page.waitForLoadState("networkidle");
      // The masked times change width with the clock (3:39 pm, 10:39 am): one width, so the mask is the same size each run.
      await page.addStyleTag({ content: ".proxy-time { display: inline-block; width: 16em; }" });
    },
  ],
  [
    "live",
    async (page) => {
      await nav(page, "Exams");
      await page.getByRole("button", { name: DRIVE, exact: true }).click();
      await page.getByRole("navigation", { name: "Exam" }).getByRole("button", { name: "Live sitting" }).click();
      await expect(page.getByRole("region", { name: "Candidates now" }).getByText("CS004")).toBeVisible();
      // Loaded on its own, after the page: wait for it, so the picture never races it.
      await expect(page.getByRole("region", { name: "Lab mode" })).toBeVisible();
    },
  ],
  [
    "editor",
    async (page) => {
      await page.getByRole("button", { name: "New exam" }).click();
      await expect(page.getByRole("heading", { name: "New exam" })).toBeVisible();
    },
  ],
  [
    "bank",
    async (page) => {
      await nav(page, "Question bank");
      await expect(page.getByText("Which sorting algorithm is stable?")).toBeVisible();
    },
  ],
  [
    "staff",
    async (page) => {
      await nav(page, "Staff");
      await expect(page.getByRole("region", { name: "Staff" }).getByText("Ravi Kumar")).toBeVisible();
      await expect(page.getByRole("region", { name: "Departments" }).getByRole("combobox", { name: "Department for Ravi Kumar" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Add staff from a sheet" })).toBeVisible();
    },
  ],
];

/** What an invigilator opens on a phone. */
const ON_A_PHONE = new Set(["exams", "exam-overview", "results", "live"]);

for (const scheme of ["light", "dark"] as const) {
  test.describe(`1440 · ${scheme}`, () => {
    test.use({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });

    test("sign-in", async ({ page }) => {
      await page.goto("/console/");
      await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Make your institution's account" })).toBeVisible();
      await settle(page);
      await expect(page).toHaveScreenshot(`console-sign-in-1440-${scheme}.png`);
    });

    for (const [name, open] of PAGES) {
      test(name, async ({ page }) => {
        await signIn(page);
        await open(page);
        await settle(page);
        await expect(page).toHaveScreenshot(`console-${name}-1440-${scheme}.png`, { fullPage: true, mask: masks(page) });
      });
    }

    test("the design system", async ({ page }) => {
      await signIn(page);
      await page.goto("/console/?gallery");
      await expect(page.getByRole("heading", { name: "Design system" })).toBeVisible();
      await settle(page);
      await expect(page).toHaveScreenshot(`design-system-${scheme}.png`, { fullPage: true });
    });
  });
}

test.describe("390 · light", () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: "light" });

  test("sign-in", async ({ page }) => {
    await page.goto("/console/");
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Make your institution's account" })).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot("console-sign-in-390-light.png");
  });

  for (const [name, open] of PAGES.filter(([n]) => ON_A_PHONE.has(n))) {
    test(name, async ({ page }) => {
      await signIn(page);
      await open(page);
      await settle(page);
      await expect(page).toHaveScreenshot(`console-${name}-390-light.png`, { fullPage: true, mask: masks(page) });
    });
  }
});
