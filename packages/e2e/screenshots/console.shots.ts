import { fileURLToPath } from "node:url";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { hashPassword } from "@parikshaa/api";
import { seedBilledOrganisation } from "../src/database.js";
import { local, MCQ, SHORT, seedSitting, type Sitting } from "../tests/support.js";
import { FIGURE_SERIES, SALES_CHART, uploadPicture } from "../tests/pictures.js";
import { aptitudePaper, CODE_QUESTION, codeAnswer, MERGE_INTERVALS, RUN_COPIED, RUN_GROUPBY, RUN_OFF_BY_ONE, RUN_ORIGINAL, RUN_WHILE } from "./fixtures.js";
import { shoot, shootPart } from "./shoot.js";

/** The console, page by page, over an organisation seeded the way a real one fills up. */

const SAMPLE = fileURLToPath(new URL("../../../docs/samples/question-paper.docx", import.meta.url));
const NUMERIC = { id: "q3", kind: "numeric", stem: "A train covers 180 km in 2.5 hours. What is its average speed in km/h?", maxScore: 2, rubric: [], expected: 72, tolerance: 0 };
const TITLE = "Campus Drive 2026 — Aptitude and Reasoning";
const PEOPLE = ["Aarav Sharma", "Diya Patel", "Ishaan Reddy", "Ananya Iyer", "Kabir Singh", "Meera Nair", "Rohan Gupta", "Sneha Kulkarni"];
const REFS = PEOPLE.map((_, i) => `CS${String(i + 1).padStart(3, "0")}`);

const ANSWERS: readonly { mcq: string; short: string; numeric: string; reply?: string; code?: string }[] = [
  { mcq: "1", short: "Each step halves the interval that can hold the target, so it must become empty after about log n steps.", numeric: "72", reply: "Merge only takes from the right half when its element is strictly smaller, so equal keys keep their order.", code: RUN_ORIGINAL },
  { mcq: "1", short: "Because the range shrinks every time and cannot shrink forever.", numeric: "72", reply: "I think merge sort keeps things in order because it is recursive.", code: RUN_COPIED },
  { mcq: "0", short: "It stops when low passes high.", numeric: "70", code: RUN_OFF_BY_ONE },
  { mcq: "1", short: "The interval halves each step; an empty interval ends the loop.", numeric: "72", code: RUN_GROUPBY },
  { mcq: "1", short: "Binary search compares with the middle and discards half, so the interval halves until it is empty.", numeric: "72", code: RUN_WHILE },
  { mcq: "0", short: "It searches the whole array.", numeric: "65" },
];

async function signIn(page: Page, account: { email: string; password: string }) {
  await page.goto("/console/");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Account" })).toBeVisible();
}

const nav = (page: Page, name: string) => page.getByRole("navigation", { name: "Account" }).getByRole("button", { name, exact: true }).click();

/** A candidate sits the paper through the API; some reply to a follow-up. */
async function sit(request: APIRequestContext, sitting: Sitting, ref: string, a: (typeof ANSWERS)[number], submit = true, withCode = true) {
  const code = decodeURIComponent(new URL(sitting.links[ref]!).searchParams.get("invite")!);
  const opened = await request.post("/api/invitations/redeem", { data: { code } });
  expect(opened.status(), await opened.text()).toBe(200);
  const { token, attemptId } = await opened.json();
  const headers = { authorization: `Bearer ${token}` };
  const answer = (questionId: string, value: string) => request.post("/api/attempts/me/answers", { headers, data: { questionId, answer: value } });
  expect((await answer("q1", a.mcq)).status()).toBe(202);
  if (a.reply !== undefined) {
    const probe = (await (await request.get("/api/attempts/me/probe?stream=0", { headers })).json()).probe;
    if (probe !== null) await request.post(`/api/attempts/me/probes/${probe.id}/reply`, { headers, data: { reply: a.reply } });
  }
  expect((await answer("q2", a.short)).status()).toBe(202);
  expect((await answer("q3", a.numeric)).status()).toBe(202);
  if (withCode && a.code !== undefined) expect((await answer("q4", codeAnswer(a.code))).status()).toBe(202);
  if (submit) expect((await request.post("/api/attempts/me/submit", { headers })).status()).toBe(200);
  return { attemptId: attemptId as string, token: token as string };
}

test("every page of the console", async ({ page, browser, request }) => {
  test.setTimeout(600_000);

  // --- signing in ---------------------------------------------------------
  await page.goto("/console/");
  await expect(page.getByRole("heading", { name: "Sign in to the console" })).toBeVisible();
  await page.getByLabel("Email").fill("registrar@nalanda-institute.edu.in");
  await shoot(page, "console-01-sign-in", { fullPage: false });

  // A fictitious institution of its own, so nothing else seeded shows up. It
  // pays per attempt, so its owner buys credits first, through Checkout —
  // stood in for by a script that signs as Razorpay does.
  const org = await seedBilledOrganisation(hashPassword, "Nalanda Institute of Technology");
  await page.addInitScript(() => {
    (window as unknown as { Razorpay: unknown }).Razorpay = class {
      constructor(readonly options: { order_id: string; handler: (r: object) => void }) {}
      on() {}
      async open() {
        const paymentId = `pay_${Date.now()}`;
        const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("fake-key-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${this.options.order_id}|${paymentId}`));
        const signature = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
        this.options.handler({ razorpay_order_id: this.options.order_id, razorpay_payment_id: paymentId, razorpay_signature: signature });
      }
    };
  });
  await signIn(page, org);
  await nav(page, "Billing");
  for (let i = 0; i < 2; i++) {
    const buy = page.getByRole("region", { name: "Buy credits" });
    await buy.getByRole("button", { name: /^Pay ₹/ }).click();
    await expect(buy.getByRole("status")).toContainText("credits added");
  }

  // --- an organisation's worth of exams and candidates ---------------------
  const drive = await seedSitting(request, { owner: org, questions: [MCQ, SHORT, NUMERIC, CODE_QUESTION], title: TITLE, refs: REFS, names: PEOPLE, vivaTriggerRatio: 0.5 });
  const staffHeaders = { authorization: `Bearer ${drive.token}` };
  for (const [i, a] of ANSWERS.entries()) {
    const { attemptId } = await sit(request, drive, REFS[i]!, a);
    const graded = await request.post(`/api/attempts/${attemptId}/grade`, { headers: staffHeaders });
    expect(graded.status(), await graded.text()).toBe(200);
  }
  await sit(request, drive, REFS[6]!, ANSWERS[3]!, false); // still answering

  const midterm = await seedSitting(request, { owner: org,
    questions: [MCQ, SHORT, NUMERIC],
    title: "Semester 5 — Data Structures Mid-term",
    refs: ["DS101", "DS102", "DS103", "DS104", "DS105"],
    names: ["Vikram Joshi", "Pooja Bansal", "Arjun Menon", "Kavya Rao", "Nikhil Verma"],
    vivaTriggerRatio: 0.99,
  });
  for (const [i, ref] of ["DS101", "DS102", "DS103"].entries()) await sit(request, midterm, ref, ANSWERS[i + 2]!, false, false);
  await seedSitting(request, {
    owner: org,
    questions: [CODE_QUESTION, MCQ],
    title: "Java Developer Screening — Round 1",
    refs: ["JV01"],
    names: ["Farhan Qureshi"],
  });
  const chart = await uploadPicture(browser, request, drive.token, SALES_CHART);
  const series = await uploadPicture(browser, request, drive.token, FIGURE_SERIES);
  await seedSitting(request, {
    owner: org,
    questions: aptitudePaper(chart, series),
    title: "Aptitude Mock Test — Quantitative and Reasoning",
    refs: ["AP01"],
    names: ["Harsh Vardhan"],
  });

  await seedSitting(request, { owner: org,
    questions: [MERGE_INTERVALS],
    title: "LeetCode Round — SDE Intern 2026",
    refs: ["LC01"],
    names: ["Ishaan Malhotra"],
  });

  const proctored = await seedSitting(request, { owner: org,
    questions: [SHORT],
    title: "Scholarship Test 2026 (proctored)",
    refs: ["SC001"],
    names: ["Tanvi Deshmukh"],
    proctoring: { identity: true, snapshotEverySeconds: 15, browserEvents: true },
  });

  // Staff, keys, a webhook and the bank, through the API as an institution's tooling would.
  for (const person of [
    { email: "neha.kapoor@e2e.test", name: "Neha Kapoor", role: "author" },
    { email: "suresh.pillai@e2e.test", name: "Suresh Pillai", role: "invigilator" },
    { email: "fatima.sheikh@e2e.test", name: "Fatima Sheikh", role: "reviewer" },
  ]) {
    await request.post("/api/staff", { headers: staffHeaders, data: { ...person, password: "a long first password, changed later" } });
  }
  await request.post("/api/api-keys", { headers: staffHeaders, data: { name: "Placement cell ERP", role: "viewer" } });
  await request.post("/api/api-keys", { headers: staffHeaders, data: { name: "Results sync (nightly)", role: "reviewer" } });
  await request.post("/api/webhooks", {
    headers: staffHeaders,
    data: { url: "https://93.184.216.34/hooks/parikshaa", events: ["attempt.submitted", "attempt.graded"], description: "Placement portal" },
  });

  // --- the pages -----------------------------------------------------------
  await page.reload(); // the session is kept for the tab; what was seeded is fetched afresh
  await nav(page, "Exams");
  await expect(page.getByRole("button", { name: TITLE })).toBeVisible();
  await shoot(page, "console-02-exams");

  await page.getByRole("row").filter({ hasText: "Java Developer Screening" }).getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Edit exam" })).toBeVisible();
  await shoot(page, "console-03-exam-editor");

  await nav(page, "Exams");
  await page.getByRole("row").filter({ hasText: "Aptitude Mock Test" }).getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Edit exam" })).toBeVisible();
  await page.getByText("Passage — The monsoon").first().scrollIntoViewIfNeeded();
  await shoot(page, "console-21-aptitude-editor");

  await nav(page, "Exams");
  await page.getByRole("row").filter({ hasText: "LeetCode Round" }).getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Edit exam" })).toBeVisible();
  await page.getByText("What candidates start from").click();
  await page.getByText("Input and output format, constraints (Markdown)").click();
  await shoot(page, "console-23-function-question");

  await nav(page, "Exams");
  await page.getByRole("button", { name: TITLE }).click();
  await expect(page.getByRole("button", { name: "Live sitting" })).toBeVisible();
  await shoot(page, "console-04-exam-attempts");

  await page.getByRole("button", { name: "Schedule and invite candidates" }).click();
  await page.waitForTimeout(500);
  await shoot(page, "console-05-invite");

  await page.getByRole("button", { name: TITLE }).click();
  await page.getByRole("button", { name: "Results and exports" }).click();
  await expect(page.getByRole("region", { name: "Candidates" })).toBeVisible();
  const similar = page.getByRole("region", { name: "Code similarity" });
  await expect(similar.getByRole("button", { name: "Compare" }).first()).toBeVisible();
  await shoot(page, "console-06-results");
  await similar.getByRole("button", { name: "Compare" }).first().click();
  await expect(similar.getByRole("group", { name: /side by side$/ })).toBeVisible();
  await shootPart(similar, "console-22-code-similarity");

  await page.getByRole("region", { name: "Candidates" }).getByRole("row").filter({ hasText: "Aarav Sharma" }).getByRole("button", { name: "Report" }).click();
  await page.waitForTimeout(800);
  await shoot(page, "console-07-candidate-report");

  await page.getByRole("button", { name: TITLE }).click();
  await page.getByRole("row").filter({ hasText: REFS[1]! }).getByRole("button").first().click();
  await page.waitForTimeout(800);
  await shoot(page, "console-08-review");

  // A live sitting: three answering now.
  await nav(page, "Exams");
  await page.getByRole("button", { name: "Semester 5 — Data Structures Mid-term" }).click();
  await page.getByRole("button", { name: "Live sitting" }).click();
  await page.waitForTimeout(800);
  await shoot(page, "console-09-live");

  // A proctored candidate, in their own browser with Chromium's fake camera.
  const candidate = await browser.newPage();
  await candidate.goto(local(proctored.links["SC001"]!));
  await candidate.getByRole("button", { name: "Allow the camera" }).click();
  await candidate.getByRole("button", { name: "My camera works — start the test" }).click();
  await candidate.getByRole("button", { name: "Take my photo" }).click();
  await candidate.getByRole("button", { name: "Take a photo of my ID" }).click();
  await candidate.getByRole("button", { name: "Send and start answering" }).click();
  await expect(candidate.getByText("Camera on")).toBeVisible();
  await candidate.waitForTimeout(1500);
  await nav(page, "Exams");
  await page.getByRole("button", { name: "Scholarship Test 2026 (proctored)" }).click();
  await page.getByRole("button", { name: "Live sitting" }).click();
  await page.getByRole("row").filter({ hasText: "SC001" }).getByRole("button", { name: "Review SC001" }).click();
  const panel = page.getByRole("region", { name: /^Proctoring for/ });
  await expect(panel.getByRole("img", { name: /^Photo of/ }).first()).toBeVisible();
  await page.waitForTimeout(800);
  await shoot(page, "console-10-proctoring-review");
  await candidate.close();

  // The question bank: a Word paper, read first and shown before anything is added.
  await nav(page, "Question bank");
  const word = page.getByRole("region", { name: "Import from Word" });
  await word.getByLabel("Word file (.docx)").setInputFiles(SAMPLE);
  await word.getByRole("button", { name: /^Add \d+ questions? to the bank$/ }).click();
  await expect(word.getByRole("status")).toBeVisible();
  await word.getByLabel("Word file (.docx)").setInputFiles(SAMPLE);
  await expect(word.getByRole("table", { name: "Questions found" })).toBeVisible();
  await shoot(page, "console-11-question-bank");

  for (const [label, name] of [
    ["Staff", "console-12-staff"],
    ["API keys", "console-13-api-keys"],
    ["Spend", "console-14-spend"],
    ["Audit log", "console-15-audit-log"],
    ["Integrations", "console-16-integrations"],
    ["Privacy", "console-17-privacy"],
    ["Password", "console-19-password"],
  ] as const) {
    await nav(page, label);
    await page.waitForTimeout(700);
    await shoot(page, name);
  }

  // Billing, visited last: the credits bought at the start, and their GST invoice.
  await nav(page, "Billing");
  await expect(page.getByRole("region", { name: "Invoices" })).toBeVisible();
  await shoot(page, "console-18-billing");
  await page.getByRole("region", { name: "Invoices" }).getByRole("button", { name: /^View PKS/ }).first().click();
  await expect(page.getByRole("article", { name: /^Tax invoice PKS/ })).toBeVisible();
  await shoot(page, "console-18b-gst-invoice");
});
