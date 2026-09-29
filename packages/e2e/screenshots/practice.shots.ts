import { expect, test, type APIRequestContext } from "@playwright/test";
import { OWNER, ownerToken } from "../tests/support.js";
import { CODE_QUESTION, MERGE_INTERVALS, MERGE_SOLUTION, RUN_ORIGINAL } from "./fixtures.js";
import { shoot } from "./shoot.js";

/**
 * A practice site (ROADMAP §15), page by page: an institution's problems,
 * a learner solving one in the workspace, a contest's scoreboard, progress,
 * the leaderboard — and the console page that runs it all.
 */

const SITE = "nit-practice";
const PASSWORD = "practice every single day";

const TWO_SUM = {
  kind: "code",
  stem: [
    "Two Sum",
    "",
    "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`.",
    "",
    "Each input has exactly one solution, and the same element may not be used twice.",
  ].join("\n"),
  maxScore: 10,
  rubric: [],
  language: "python",
  languages: ["python", "java", "cpp", "javascript", "c"],
  signature: { name: "twoSum", params: [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }], returns: "int[]", anyOrder: "top" },
  constraints: "- `2 <= nums.length <= 10^4`\n- Exactly one answer exists.",
  tests: [
    { id: "s1", input: "[2,7,11,15]\n9", expected: "[0,1]", hidden: false, weight: 1, explanation: "`nums[0] + nums[1] == 9`, so the answer is `[0, 1]`." },
    { id: "s2", input: "[3,2,4]\n6", expected: "[1,2]", hidden: false, weight: 1 },
    { id: "h1", input: "[3,3]\n6", expected: "[0,1]", hidden: true, weight: 1 },
    { id: "h2", input: "[-1,-2,-3,-4,-5]\n-8", expected: "[2,4]", hidden: true, weight: 1 },
  ],
  limits: { timeMs: 2000 },
};
const TWO_SUM_SOLUTION = `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for i, n in enumerate(nums):
            if target - n in seen:
                return [seen[target - n], i]
            seen[n] = i
`;

const STABLE = {
  kind: "mcq",
  stem: "Stable sorting\n\nWhich of these sorting algorithms is **stable** as usually implemented?",
  maxScore: 1,
  rubric: [],
  options: ["Quicksort", "Heap sort", "Merge sort", "Selection sort"],
  correctIndex: 2,
};
const SPEED = {
  kind: "numeric",
  stem: "Average speed\n\nA train covers 180 km in 2.5 hours. What is its average speed, in km/h?",
  maxScore: 1,
  rubric: [],
  expected: 72,
  tolerance: 0,
};

const { id: _m, ...MERGE } = MERGE_INTERVALS;
const { id: _r, ...RUNS } = CODE_QUESTION;

const EDITORIALS: Record<string, string> = {
  twoSum: [
    "## Idea",
    "",
    "Walk the array once, remembering each number's index. For each `n`, the partner it needs is `target - n`: if it has been seen, the answer is found.",
    "",
    "```python",
    "seen = {}",
    "for i, n in enumerate(nums):",
    "    if target - n in seen:",
    "        return [seen[target - n], i]",
    "    seen[n] = i",
    "```",
    "",
    "**Time** O(n), **space** O(n).",
  ].join("\n"),
  merge: "Sort by start, then sweep: extend the last merged interval while the next one starts before it ends.\n\n**Time** O(n log n).",
  stable: "Merge sort only takes from the right half when its element is strictly smaller, so equal keys keep their order.",
};

async function learner(request: APIRequestContext, name: string): Promise<string> {
  const email = `${name.toLowerCase().replace(/\s+/g, ".")}@students.nit.test`;
  const res = await request.post(`/api/practice/${SITE}/signup`, { data: { name, email, password: PASSWORD } });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).token as string;
}

async function submit(request: APIRequestContext, token: string, slug: string, answer: string, language?: string, contest?: string) {
  const res = await request.post(`/api/practice/${SITE}/problems/${slug}/submit`, {
    headers: { authorization: `Bearer ${token}` },
    data: { answer, ...(language === undefined ? {} : { language }), ...(contest === undefined ? {} : { contest }) },
  });
  expect(res.status(), await res.text()).toBe(200);
}

test("a practice site: problems, the workspace, a contest, progress and the console", async ({ page, request }) => {
  test.setTimeout(600_000);
  const staff = { authorization: `Bearer ${await ownerToken(request)}` };

  // --- the institution sets it up ---------------------------------------------
  expect(
    (
      await request.put("/api/practice-admin/site", {
        headers: staff,
        data: {
          slug: SITE,
          title: "NIT Trichy Practice Arena",
          welcome: "Sharpen your problem solving before placement season. One problem a day keeps the **streak** alive.",
          open: true,
        },
      })
    ).status(),
  ).toBe(200);
  const published: Record<string, { id: string; slug: string }> = {};
  for (const [key, question, difficulty, tags] of [
    ["twoSum", TWO_SUM, "easy", ["arrays", "hash table"]],
    ["stable", STABLE, "easy", ["sorting"]],
    ["speed", SPEED, "easy", ["aptitude"]],
    ["runs", RUNS, "medium", ["arrays"]],
    ["merge", MERGE, "medium", ["arrays", "sorting"]],
  ] as const) {
    const filed = await request.post("/api/bank", { headers: staff, data: { question, difficulty, tags } });
    expect(filed.status(), await filed.text()).toBe(201);
    const res = await request.post("/api/practice-admin/problems", {
      headers: staff,
      data: {
        bankQuestionId: (await filed.json()).id,
        ...(key === "runs" ? { title: "Longest run of equal neighbours" } : key === "merge" ? { title: "Merge Intervals" } : {}),
        ...(EDITORIALS[key] === undefined ? {} : { editorial: EDITORIALS[key] }),
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    published[key] = await res.json();
  }
  const contest = await request.post("/api/practice-admin/contests", {
    headers: staff,
    data: {
      title: "Weekly Contest 12",
      description: "Three problems, ninety minutes. Ranked by problems solved, then time plus 20 minutes for each wrong try.",
      startsAt: new Date(Date.now() - 25 * 60_000).toISOString(),
      endsAt: new Date(Date.now() + 65 * 60_000).toISOString(),
      problemIds: [published["stable"]!.id, published["runs"]!.id, published["merge"]!.id],
    },
  });
  expect(contest.status(), await contest.text()).toBe(201);
  const weekly = (await contest.json()).slug as string;
  await request.post("/api/practice-admin/contests", {
    headers: staff,
    data: {
      title: "Weekly Contest 13",
      description: "",
      startsAt: new Date(Date.now() + 6 * 86_400_000).toISOString(),
      endsAt: new Date(Date.now() + 6 * 86_400_000 + 90 * 60_000).toISOString(),
      problemIds: [published["twoSum"]!.id, published["speed"]!.id],
    },
  });

  // --- learners at work ---------------------------------------------------------
  const others: [string, (token: string) => Promise<void>][] = [
    [
      "Priya Raman",
      async (t) => {
        await submit(request, t, published["stable"]!.slug, "2", undefined, weekly);
        await submit(request, t, published["runs"]!.slug, RUN_ORIGINAL, "python", weekly);
        await submit(request, t, published["merge"]!.slug, MERGE_SOLUTION, "python", weekly);
        await submit(request, t, published["twoSum"]!.slug, TWO_SUM_SOLUTION, "python");
        await submit(request, t, published["speed"]!.slug, "72");
      },
    ],
    [
      "Karthik Subramanian",
      async (t) => {
        await submit(request, t, published["stable"]!.slug, "0", undefined, weekly);
        await submit(request, t, published["stable"]!.slug, "2", undefined, weekly);
        await submit(request, t, published["runs"]!.slug, RUN_ORIGINAL, "python", weekly);
        await submit(request, t, published["twoSum"]!.slug, TWO_SUM_SOLUTION, "python");
      },
    ],
    [
      "Ananya Iyer",
      async (t) => {
        await submit(request, t, published["stable"]!.slug, "2", undefined, weekly);
        await submit(request, t, published["merge"]!.slug, "class Solution:\n    def merge(self, intervals):\n        return intervals\n", "python", weekly);
        await submit(request, t, published["speed"]!.slug, "70");
      },
    ],
    ["Rohan Mehta", async (t) => void (await submit(request, t, published["speed"]!.slug, "72"))],
  ];
  for (const [name, work] of others) await work(await learner(request, name));

  const asha = await learner(request, "Asha Verma");
  await submit(request, asha, published["stable"]!.slug, "2");
  await submit(request, asha, published["speed"]!.slug, "72");
  await submit(request, asha, published["runs"]!.slug, RUN_ORIGINAL, "python", weekly);
  const comment = (token: string, slug: string, body: string) =>
    request.post(`/api/practice/${SITE}/problems/${slug}/comments`, { headers: { authorization: `Bearer ${token}` }, data: { body } });
  await comment(asha, published["twoSum"]!.slug, "Is it fine to sort the array first? That changes the indices.");
  await request.post("/api/practice-admin/comments", {
    headers: staff,
    data: { problemSlug: published["twoSum"]!.slug, body: "Sorting loses the original indices — keep them alongside, or think about what a lookup table could do in one pass." },
  });

  await page.addInitScript(([key, token]) => localStorage.setItem(key!, token!), [`parikshaa.practice.${SITE}.session`, asha]);

  // --- the problem set ---------------------------------------------------------------
  await page.goto(`/practice/${SITE}`);
  await expect(page.getByRole("link", { name: "1. Two Sum" })).toBeVisible();
  await shoot(page, "practice-01-problems", { fullPage: false });

  // --- solving Two Sum in the workspace ----------------------------------------------
  await page.getByRole("link", { name: "1. Two Sum" }).click();
  const editor = page.locator(".cm-content");
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(TWO_SUM_SOLUTION);
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("region", { name: "Submission results" })).toContainText("4/4 tests passed", { timeout: 30_000 });
  await expect(page.getByText("Solved! The editorial is open now.")).toBeVisible();
  await page.waitForTimeout(400);
  await shoot(page, "practice-02-workspace", { fullPage: false });

  await page.getByRole("tab", { name: "Editorial" }).click();
  await expect(page.getByRole("heading", { name: "Idea" })).toBeVisible();
  await shoot(page, "practice-03-editorial", { fullPage: false });
  await page.getByRole("tab", { name: "Discussion" }).click();
  await expect(page.getByText("Sorting loses the original indices")).toBeVisible();
  await shoot(page, "practice-04-discussion", { fullPage: false });

  // --- a contest ---------------------------------------------------------------------------
  await page.goto(`/practice/${SITE}/contests`);
  await expect(page.getByRole("heading", { name: "Running now" })).toBeVisible();
  await shoot(page, "practice-05-contests", { fullPage: false });
  await page.getByRole("link", { name: "Weekly Contest 12" }).click();
  await expect(page.getByRole("region", { name: "Scoreboard" })).toContainText("Priya Raman");
  await shoot(page, "practice-06-scoreboard");

  // --- progress and the leaderboard ------------------------------------------------------------
  await page.getByRole("link", { name: /Asha Verma/ }).click();
  await expect(page.getByRole("heading", { name: "Asha Verma" })).toBeVisible();
  await shoot(page, "practice-07-progress");
  await page.getByRole("link", { name: "Leaderboard" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Asha Verma" })).toContainText("You");
  await shoot(page, "practice-08-leaderboard", { fullPage: false });

  // --- on a phone: the problems as cards, the scoreboard with rank and name held ---------------
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Problems" }).click();
  await expect(page.getByRole("link", { name: "1. Two Sum" })).toBeVisible();
  await shoot(page, "practice-10-phone-problems", { fullPage: false });
  await page.goto(`/practice/${SITE}/contests`);
  await page.getByRole("link", { name: "Weekly Contest 12" }).click();
  await expect(page.getByRole("region", { name: "Scoreboard" })).toContainText("Priya Raman");
  await shoot(page, "practice-11-phone-scoreboard");
  await page.setViewportSize({ width: 1440, height: 900 });

  // --- prep: tracks, lessons, a plan, the problem of the day, companies, the store, Plus ---------
  const ok = async (res: Promise<import("@playwright/test").APIResponse>, status = 200) => {
    const r = await res;
    expect(r.status(), await r.text()).toBe(status);
    return r.json();
  };
  const learnerHeaders = { authorization: `Bearer ${asha}` };
  const today = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
  const pack = await request.post("/api/practice-admin/starter-packs/cs-fundamentals", { headers: staff });
  expect([200, 201], await pack.text()).toContain(pack.status());
  const lesson = async (title: string, body: string, estMinutes: number) =>
    (await ok(request.post("/api/practice-admin/lessons", { headers: staff, data: { title, body, estMinutes, published: true } }), 201)) as { id: string; slug: string };
  const arrays = await lesson(
    "Arrays and two pointers",
    "An array keeps its items side by side, so reading any one of them costs the same.\n\n## Two pointers\n\nWalk from both ends towards the middle. Each step rules out one item for good, so the walk is linear.\n\n```python\nlo, hi = 0, len(a) - 1\nwhile lo < hi:\n    ...\n```",
    20,
  );
  const sorting = await lesson("Stable sorting", "A sort is **stable** when equal keys keep their order. Merge sort is; heap sort is not.", 15);
  const dsa = (await ok(
    request.post("/api/practice-admin/tracks", {
      headers: staff,
      data: {
        title: "DSA for placements",
        description: "Arrays, sorting and searching: the rounds most campus drives open with.",
        published: true,
        modules: [
          { title: "Arrays", items: [{ lessonId: arrays.id }, { problemId: published["twoSum"]!.id }, { problemId: published["runs"]!.id }] },
          { title: "Sorting", items: [{ lessonId: sorting.id }, { problemId: published["stable"]!.id }, { problemId: published["merge"]!.id }] },
        ],
      },
    }),
    201,
  )) as { slug: string };
  await ok(request.put(`/api/practice-admin/potd/${today}`, { headers: staff, data: { problemId: published["merge"]!.id } }));
  const company = async (name: string, about: string, problems: string[]) => {
    const made = (await ok(request.post("/api/practice-admin/companies", { headers: staff, data: { name, about } }), 201)) as { id: string; slug: string };
    await ok(request.post(`/api/practice-admin/companies/${made.id}/reports`, { headers: staff, data: { problemIds: problems.map((k) => published[k]!.id), reportedOn: today } }), 201).catch(() => undefined);
    return made;
  };
  const infosys = await company("Infosys", "Online test, then two technical rounds and HR.", ["twoSum", "speed", "stable"]);
  await company("TCS", "NQT, then a technical and a managerial round.", ["speed", "merge"]);
  const story = (await ok(
    request.post(`/api/practice/${SITE}/experiences`, {
      headers: learnerHeaders,
      data: {
        company: infosys.slug,
        role: "Systems Engineer",
        interviewed: today.slice(0, 7),
        verdict: "offer",
        rounds: [
          { kind: "Online test", asked: "Aptitude and two coding questions.", problemSlugs: [published["twoSum"]!.slug] },
          { kind: "Technical", asked: "Sorting, and why merge sort is stable.", problemSlugs: [published["stable"]!.slug] },
        ],
        tips: "Say the brute force first, then improve it out loud.",
      },
    }),
    201,
  )) as { id: string };
  await ok(request.post(`/api/practice-admin/experiences/${story.id}/decision`, { headers: staff, data: { status: "published" } }));
  await ok(request.put("/api/practice-admin/plus", { headers: staff, data: { plusEnabled: true, tutorEnabled: true, freeModules: 1, monthlyCredits: 20 } }));
  await ok(request.post("/api/practice-admin/plus/products", { headers: staff, data: { title: "Plus · 3 months", kind: "plus", days: 90, pricePaise: 49_900 } }), 201);
  await ok(request.post("/api/practice-admin/store/items", { headers: staff, data: { title: "Plus for a week", description: "Every track and the tutor, for seven days.", kind: "plus", plusDays: 7, priceCoins: 60 } }), 201);
  await ok(request.post("/api/practice-admin/store/items", { headers: staff, data: { title: "Arena T-shirt", description: "Delivered on campus.", kind: "physical", priceCoins: 500, stock: 40 } }), 201);
  await ok(request.post(`/api/practice/${SITE}/lessons/${arrays.slug}/done`, { headers: learnerHeaders }));
  const me = (await ok(request.get(`/api/practice/${SITE}/me`, { headers: learnerHeaders }))) as { learner?: { id: string }; id?: string };
  await ok(request.post(`/api/practice-admin/learners/${me.learner?.id ?? me.id}/plus`, { headers: staff, data: { days: 30 } }));
  await ok(request.post(`/api/practice/${SITE}/plan`, {
    headers: learnerHeaders,
    data: { track: dsa.slug, level: "intermediate", deadline: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), dailyMinutes: 60, offDays: [0], goal: "Infosys, SDE" },
  }), 201);
  await ok(request.put(`/api/practice/${SITE}/notes/problem/${published["twoSum"]!.slug}`, { headers: learnerHeaders, data: { body: "Keep a map from value to index; look up target − x before adding x." } }));
  await ok(request.put(`/api/practice/${SITE}/lists/Infosys%20prep/${published["twoSum"]!.slug}`, { headers: learnerHeaders }));
  await ok(request.put(`/api/practice/${SITE}/lists/Infosys%20prep/${published["speed"]!.slug}`, { headers: learnerHeaders }));

  const prep = async (path: string, name: string, fullPage = false) => {
    await page.goto(`/practice/${SITE}${path}`);
    await expect(page.locator(".practice-main h1").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    await shoot(page, name, { fullPage });
  };
  await prep("/home", "prep-01-home", true);
  await prep("/tracks", "prep-02-tracks");
  await prep(`/tracks/${dsa.slug}`, "prep-03-track", true);
  await prep(`/lessons/${arrays.slug}`, "prep-04-lesson");
  await prep("/plan", "prep-05-plan", true);
  await prep("/revise", "prep-06-revise");
  await prep("/lists", "prep-07-lists");
  await prep("/notes", "prep-08-notes");
  await prep("/potd", "prep-09-problem-of-the-day");
  await prep("/companies", "prep-10-companies");
  await prep(`/companies/${infosys.slug}`, "prep-11-company", true);
  await prep("/experiences", "prep-12-experiences", true);
  await prep("/store", "prep-13-store");
  await prep("/coins", "prep-14-coins");
  await prep("/plus", "prep-15-plus");
  await prep("/rating", "prep-16-rating");
  await page.setViewportSize({ width: 390, height: 844 });
  await prep("/home", "prep-17-phone-home", true);
  await prep("/plan", "prep-18-phone-plan", true);
  await prep(`/tracks/${dsa.slug}`, "prep-19-phone-track", true);
  await page.setViewportSize({ width: 1440, height: 900 });

  // --- a visitor: signing up -------------------------------------------------------------------
  await page.evaluate((key) => localStorage.removeItem(key), `parikshaa.practice.${SITE}.session`);
  await page.addInitScript((key) => localStorage.removeItem(key), `parikshaa.practice.${SITE}.session`);
  await page.goto(`/practice/${SITE}/signup`);
  await page.getByLabel("Name").fill("Meera Nair");
  await page.getByLabel("Email").fill("meera.nair@students.nit.test");
  await shoot(page, "practice-09-sign-up", { fullPage: false });

  // --- the console ---------------------------------------------------------------------------------
  await page.goto("/console/");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("navigation", { name: "Account" }).getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.getByRole("region", { name: "Practice site" })).toContainText("/practice/nit-practice");
  await shoot(page, "console-24-practice-site", { fullPage: false });
  await page.getByRole("tab", { name: "Problems" }).click();
  await expect(page.getByRole("region", { name: "Published problems" })).toContainText("Merge Intervals");
  await shoot(page, "console-25-practice-problems");
  await page.getByRole("tab", { name: "Contests" }).click();
  await expect(page.getByRole("region", { name: "Contests" })).toContainText("Weekly Contest 12");
  await page.getByRole("tab", { name: "Discussion" }).click();
  await expect(page.getByRole("region", { name: "Discussion" })).toContainText("Is it fine to sort");
  await shoot(page, "console-26-practice-discussion", { fullPage: false });
  // Prep, as the institution runs it.
  for (const [tab, name] of [
    ["Tracks", "console-35-prep-tracks"],
    ["Lessons", "console-36-prep-lessons"],
    ["Problem of the day", "console-37-prep-problem-of-the-day"],
    ["Plus", "console-38-prep-plus"],
    ["Companies", "console-39-prep-companies"],
    ["Experiences", "console-40-prep-experiences"],
    ["Coin store", "console-41-prep-coin-store"],
  ] as const) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    await shoot(page, name);
  }
});
