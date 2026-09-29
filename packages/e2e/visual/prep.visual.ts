import { expect, test, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";
// The password hash alone: the whole API would load Fastify into the test runner.
import { hashPassword } from "@parikshaa/api/passwords";
import { seedOrganisation } from "../src/database.js";

/**
 * A practice site's Prep pages (ROADMAP §16), held to their committed images:
 * a learner's home, the tracks, a track, a study plan, the companies, one
 * company and the coin store, at 1440 in light and dark, and the pages a
 * learner opens on a phone at 390. Seeded in an organisation and a site of
 * their own, with multiple-choice problems only, so nothing depends on the
 * code runner; what the date changes is masked.
 */

const SITE = "visual-prep";
let learnerToken = "";
let trackSlug = "";
let companySlug = "";

test.describe.configure({ mode: "serial" });

async function ok(res: Promise<APIResponse>, status = 200): Promise<Record<string, unknown>> {
  const r = await res;
  expect(r.status(), await r.text()).toBe(status);
  return (await r.json()) as Record<string, unknown>;
}

test.beforeAll(async ({ request }) => {
  const owner = await seedOrganisation(hashPassword, "e2e-prep-visual", "Nalanda Institute of Technology");
  const signedIn = await ok(request.post("/api/auth/login", { data: { email: owner.email, password: owner.password } }));
  const staff = { authorization: `Bearer ${signedIn["token"] as string}` };
  await ok(request.put("/api/practice-admin/site", { headers: staff, data: { slug: SITE, title: "Nalanda Practice", welcome: "", open: true } }));

  const problem = async (stem: string, options: string[], correctIndex: number, difficulty: "easy" | "medium" | "hard", tags: string[]) => {
    const filed = await ok(request.post("/api/bank", { headers: staff, data: { question: { kind: "mcq", stem, maxScore: 1, rubric: [], options, correctIndex }, difficulty, tags } }), 201);
    return (await ok(request.post("/api/practice-admin/problems", { headers: staff, data: { bankQuestionId: filed["id"] } }), 201)) as { id: string; slug: string };
  };
  const stable = await problem("Stable sorting\n\nWhich of these sorts is **stable**?", ["Heap sort", "Merge sort"], 1, "easy", ["sorting"]);
  const search = await problem("Binary search\n\nHow many comparisons does binary search make on 1,024 items, at most?", ["10", "11", "512"], 1, "medium", ["searching"]);
  const graph = await problem("Shortest paths\n\nWhich algorithm finds shortest paths with negative edges?", ["Dijkstra", "Bellman–Ford"], 1, "hard", ["graphs"]);

  const lesson = async (title: string, body: string, estMinutes: number) =>
    (await ok(request.post("/api/practice-admin/lessons", { headers: staff, data: { title, body, estMinutes, published: true } }), 201)) as { id: string; slug: string };
  const sorting = await lesson("Stable sorting", "A sort is **stable** when equal keys keep their order.", 15);
  const searching = await lesson("Searching a sorted array", "Halve the range at every step.", 20);
  const track = await ok(
    request.post("/api/practice-admin/tracks", {
      headers: staff,
      data: {
        title: "DSA for placements",
        description: "Sorting, searching and graphs: the rounds most campus drives open with.",
        published: true,
        modules: [
          { title: "Sorting", items: [{ lessonId: sorting.id }, { problemId: stable.id }] },
          { title: "Searching", items: [{ lessonId: searching.id }, { problemId: search.id }] },
          { title: "Graphs", items: [{ problemId: graph.id }] },
        ],
      },
    }),
    201,
  );
  trackSlug = track["slug"] as string;
  const today = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
  await ok(request.put(`/api/practice-admin/potd/${today}`, { headers: staff, data: { problemId: search.id } }));
  const company = await ok(request.post("/api/practice-admin/companies", { headers: staff, data: { name: "Infosys", about: "Online test, then two technical rounds and HR." } }), 201);
  companySlug = company["slug"] as string;
  await ok(request.post(`/api/practice-admin/companies/${company["id"] as string}/reports`, { headers: staff, data: { problemIds: [stable.id, search.id], reportedOn: today } }), 201);
  await ok(request.post("/api/practice-admin/store/items", { headers: staff, data: { title: "Arena T-shirt", description: "Delivered on campus.", kind: "physical", priceCoins: 500, stock: 40 } }), 201);

  const signedUp = await ok(request.post(`/api/practice/${SITE}/signup`, { data: { name: "Asha Verma", email: "asha@students.prep-visual.test", password: "practice every single day" } }), 201);
  learnerToken = signedUp["token"] as string;
  const learner = { authorization: `Bearer ${learnerToken}` };
  await ok(request.post(`/api/practice/${SITE}/problems/${stable.slug}/submit`, { headers: learner, data: { answer: "1" } }));
  await ok(request.post(`/api/practice/${SITE}/lessons/${sorting.slug}/done`, { headers: learner }));
  // No rest days: the plan's first day is today whatever day of the week the images are taken.
  await ok(
    request.post(`/api/practice/${SITE}/plan`, {
      headers: learner,
      data: { track: trackSlug, level: "intermediate", deadline: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), dailyMinutes: 60, offDays: [], goal: "Infosys, SDE" },
    }),
    201,
  );
  await ok(
    request.post(`/api/practice/${SITE}/experiences`, {
      headers: learner,
      data: { company: companySlug, role: "Systems Engineer", interviewed: today.slice(0, 7), verdict: "offer", rounds: [{ kind: "Technical", asked: "Why is merge sort stable?", problemSlugs: [stable.slug] }], tips: "Think out loud." },
    }),
    201,
  );
});

/** Signed in as the learner, on a page, with its fonts in and nothing moving. */
async function open(page: Page, path: string) {
  await page.addInitScript(([key, token]) => localStorage.setItem(key!, token!), [`parikshaa.practice.${SITE}.session`, learnerToken]);
  await page.goto(`/practice/${SITE}${path}`);
  await expect(page.locator(".practice-main h1").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
}

/** What the date changes: the plan's and the home's dates, when a company last asked, a write-up's month, when the store opens. */
const masks = (page: Page) => [
  page.locator(".prep-head .notice"),
  page.locator(".company-problems .notice"),
  page.locator(".experience header .notice"),
  page.locator(".coin-history .notice"),
  page.locator(".potd-day"),
  page.locator(".store-opens"),
];

const PAGES: readonly (readonly [string, () => string])[] = [
  ["home", () => "/home"],
  ["tracks", () => "/tracks"],
  ["track", () => `/tracks/${trackSlug}`],
  ["plan", () => "/plan"],
  ["companies", () => "/companies"],
  ["company", () => `/companies/${companySlug}`],
  ["store", () => "/store"],
];
const ON_A_PHONE = new Set(["home", "track", "plan"]);

for (const scheme of ["light", "dark"] as const) {
  test.describe(`1440 · ${scheme}`, () => {
    test.use({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
    for (const [name, path] of PAGES) {
      test(name, async ({ page }) => {
        await open(page, path());
        await expect(page).toHaveScreenshot(`prep-${name}-1440-${scheme}.png`, { fullPage: true, mask: masks(page) });
      });
    }
  });
}

test.describe("390 · light", () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: "light" });
  for (const [name, path] of PAGES.filter(([n]) => ON_A_PHONE.has(n))) {
    test(name, async ({ page }) => {
      await open(page, path());
      await expect(page).toHaveScreenshot(`prep-${name}-390-light.png`, { fullPage: true, mask: masks(page) });
    });
  }
});
