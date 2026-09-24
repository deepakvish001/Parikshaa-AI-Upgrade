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
  await page.getByRole("button", { name: "Sign in" }).click();
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
});
