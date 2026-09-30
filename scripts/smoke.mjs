#!/usr/bin/env node
/**
 * The server check (docs/PILOT.md, step 3): a live server, walked through what
 * a college will do on its first day, before any college does.
 *
 *   npm run smoke -- https://exam.yourdomain.in
 *   SMOKE_EMAIL=you@… SMOKE_PASSWORD=… npm run smoke -- https://exam.yourdomain.in
 *
 * Without an account it checks what anyone can see: the service answers, the
 * pages load with their security headers, and whether sign-up is open. With
 * one (an operator's own test account: an owner in an organisation made with
 * admin-cli, so the check spends no one's credits) it also signs in, writes a
 * two-question exam, sits it as a candidate, has it graded — the written
 * answer by the model — and asks for the results by email, then archives the
 * exam. The attempt stays in that organisation's results, named smoke-….
 *
 * SMOKE_BILLING=on also asks Razorpay for an order of one credit, which checks
 * the keys and the GST supplier without paying: the order lapses by itself.
 * It needs the account's organisation on prepaid credits with its legal name set.
 *
 * Every step prints ✓ or ✗ and why; it exits 1 if any failed. Nothing here
 * needs the database or the server's secrets: only what a browser can reach.
 */

const [base] = process.argv.slice(2);
if (base === undefined || !/^https?:\/\//.test(base)) {
  process.stderr.write("usage: [SMOKE_EMAIL=… SMOKE_PASSWORD=…] npm run smoke -- https://exam.yourdomain.in\n");
  process.exit(2);
}
const root = base.replace(/\/$/, "");
const api = `${root}/api`;
const email = process.env.SMOKE_EMAIL ?? "";
const password = process.env.SMOKE_PASSWORD ?? "";
const code = process.env.SMOKE_CODE ?? "";

let failed = 0;
const say = (line) => process.stdout.write(`${line}\n`);
const pass = (what, detail = "") => say(`✓ ${what}${detail === "" ? "" : ` — ${detail}`}`);
const fail = (what, why) => {
  failed++;
  say(`✗ ${what} — ${why}`);
};
const note = (what) => say(`· ${what}`);

async function call(method, path, { token, body, raw = false } = {}) {
  const response = await fetch(path.startsWith("http") ? path : `${api}${path}`, {
    method,
    headers: {
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: "manual",
    signal: AbortSignal.timeout(60_000),
  });
  if (raw) return response;
  const text = await response.text();
  let json = null;
  try {
    json = text === "" ? null : JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

/** One step: its failure is reported and the rest still run, unless a later step needs what this one made. */
async function step(what, run) {
  try {
    return await run();
  } catch (error) {
    fail(what, error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

say(`Checking ${root}\n`);

// --- what anyone can reach ---------------------------------------------------

await step("The service answers", async () => {
  const health = await call("GET", "/health");
  if (health.status === 200 && health.json?.ok === true) pass("The service answers", "/api/health");
  else fail("The service answers", `/api/health gave ${health.status}`);
});

for (const [page, name] of [
  [`${root}/`, "The candidates' page"],
  [`${root}/console/`, "The console"],
]) {
  await step(`${name} loads`, async () => {
    const response = await call("GET", page, { raw: true });
    const type = response.headers.get("content-type") ?? "";
    if (response.status !== 200 || !type.startsWith("text/html")) return fail(`${name} loads`, `${page} gave ${response.status} ${type}`);
    const missing = ["content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy"].filter((h) => response.headers.get(h) === null);
    if (root.startsWith("https://") && response.headers.get("strict-transport-security") === null) missing.push("strict-transport-security");
    if (missing.length > 0) fail(`${name} loads`, `missing ${missing.join(", ")}: is something in front of the server dropping headers?`);
    else pass(`${name} loads`, "with its security headers");
  });
}

if (root.startsWith("http://") && !/^http:\/\/(localhost|127\.|\[::1\])/.test(root)) {
  fail("HTTPS", "the address is plain http: candidates' answers and staff passwords would cross the network readable");
}

const signup = await step("Sign-up", async () => {
  const status = await call("GET", "/auth/signup");
  if (status.status !== 200) return fail("Sign-up", `/api/auth/signup gave ${status.status}`);
  if (status.json.open) pass("Institutions can sign themselves up", `${status.json.trialCredits} free attempts each`);
  else note("Sign-up is off (SELF_SIGNUP): colleges cannot make their own account");
  return status.json;
});

// --- signed in: a college's first day, in small --------------------------------

if (email === "" || password === "") {
  note("SMOKE_EMAIL and SMOKE_PASSWORD not set: skipping the sitting, grading and email");
} else {
  const token = await step("Signing in", async () => {
    const login = await call("POST", "/auth/login", { body: { email, password, ...(code === "" ? {} : { code }) } });
    if (login.status === 401 && login.json?.error === "second_factor_required") {
      return fail("Signing in", "this account has a second factor: set SMOKE_CODE to a current code from the authenticator");
    }
    if (login.status !== 200) return fail("Signing in", `${login.status} ${login.json?.error ?? ""}`.trim());
    pass("Signing in");
    return login.json.token;
  });

  if (token !== undefined) {
    const me = (await call("GET", "/auth/me", { token })).json;
    const can = (p) => me?.permissions?.includes(p) === true;
    // Only when asked: it makes a real (unpaid) order in the Razorpay account.
    if (process.env["SMOKE_BILLING"] === "on" && can("org:manage")) {
      await step("Razorpay", async () => {
        const order = await call("POST", "/billing/orders", { token, body: { credits: 1 } });
        if (order.status === 201) {
          const mode = String(order.json.keyId).startsWith("rzp_test_") ? "test keys" : "live keys";
          pass("Razorpay", `an order for 1 credit was created with the ${mode} (₹${(order.json.amountPaise / 100).toFixed(2)}, not paid; it lapses by itself)`);
        } else if (order.json?.error === "billing_not_configured") {
          fail("Razorpay", `${order.json.message}: set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET and PARIKSHAA_SUPPLIER_*`);
        } else if (order.status === 502 || order.status === 503) {
          fail("Razorpay", `${order.status} ${order.json?.message ?? ""}: Razorpay refused or could not be reached; check the keys match the dashboard's mode`);
        } else {
          fail("Razorpay", `${order.status} ${order.json?.message ?? order.json?.error ?? ""}: use an owner in an organisation on prepaid credits, with its legal name set under Billing`);
        }
      });
    }

    if (!can("exam:write") || !can("attempt:start")) {
      fail("The test account", `it cannot write exams and start attempts${me?.emailVerified === false ? " (its email address is not confirmed)" : ""}: use an owner`);
    } else {
      const id = `smoke-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}`;
      const created = await step("Writing an exam", async () => {
        const res = await call("POST", "/exams", {
          token,
          body: {
            id,
            title: `Server check ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
            questions: [
              { id: "q1", kind: "mcq", stem: "Which of these is a prime number?", maxScore: 1, rubric: [], options: ["21", "23", "25"], correctIndex: 1 },
              {
                id: "q2",
                kind: "short",
                stem: "In one or two sentences, why does binary search need a sorted list?",
                maxScore: 4,
                rubric: [{ id: "r1", description: "Says each comparison rules out half the list only because of the order", weight: 1 }],
                expectedPoints: ["comparing with the middle rules out one half", "that is only true when the list is in order"],
              },
            ],
            policy: { durationMs: 10 * 60_000, allowRevision: true, vivaTriggerRatio: 0.99 },
          },
        });
        if (res.status !== 201) return fail("Writing an exam", `${res.status} ${res.json?.message ?? res.json?.error ?? res.text.slice(0, 200)}`);
        pass("Writing an exam", id);
        return true;
      });

      if (created) {
        const attempt = await step("Sitting it as a candidate", async () => {
          const started = await call("POST", `/exams/${id}/attempts`, { token, body: { candidateId: id } });
          if (started.status !== 201) return fail("Sitting it as a candidate", `starting gave ${started.status} ${started.json?.message ?? started.json?.error ?? ""}`);
          const candidate = started.json.token;
          const answers = [
            ["q1", "1"],
            ["q2", "Because each comparison with the middle element tells you which half cannot hold the value, and that is only true when the list is in order."],
          ];
          for (const [questionId, answer] of answers) {
            const saved = await call("POST", "/attempts/me/answers", { token: candidate, body: { questionId, answer } });
            if (saved.status !== 200 && saved.status !== 202) return fail("Sitting it as a candidate", `answering ${questionId} gave ${saved.status}`);
          }
          const submitted = await call("POST", "/attempts/me/submit", { token: candidate });
          if (submitted.status !== 200) return fail("Sitting it as a candidate", `submitting gave ${submitted.status}`);
          pass("Sitting it as a candidate", "started, answered and submitted");
          return started.json.attemptId;
        });

        if (attempt !== undefined) {
          await step("Grading", async () => {
            const began = Date.now();
            const graded = await call("POST", `/attempts/${attempt}/grade`, { token });
            if (graded.status !== 200) {
              return fail("Grading", `${graded.status} ${graded.json?.message ?? graded.json?.error ?? ""}: the written answer is graded by the model; is ANTHROPIC_API_KEY set and within its limits?`);
            }
            pass("Grading", `${graded.json.total} of 5, in ${((Date.now() - began) / 1000).toFixed(1)} s (the written answer by the model)`);
          });
        }

        await step("Email", async () => {
          const mailed = await call("POST", `/exams/${id}/results/email`, { token });
          if (mailed.status === 202) pass("Email", `the results workbook is on its way to ${mailed.json.to}: check it arrives, and not in spam`);
          else if (mailed.status === 409) fail("Email", "email is not set up (SMTP_URL, EMAIL_FROM): invitations and reminders cannot go out");
          else fail("Email", `${mailed.status} ${mailed.json?.error ?? ""}`);
        });

        await step("Tidying up", async () => {
          const archived = await call("PUT", `/exams/${id}/archived`, { token, body: { archived: true } });
          if (archived.status === 200) pass("Tidying up", "the check's exam is archived");
          else fail("Tidying up", `archiving ${id} gave ${archived.status}`);
        });
      }
    }
  }
}

say(failed === 0 ? `\nAll clear.${signup?.open === false ? " (Sign-up is off.)" : ""}` : `\n${failed} check${failed === 1 ? "" : "s"} failed.`);
process.exit(failed === 0 ? 0 : 1);
