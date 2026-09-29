import { expect, test } from "@playwright/test";
// The password hash alone: the whole API would load Fastify into the test runner.
import { hashPassword } from "@parikshaa/api/passwords";
import { seedBilledOrganisation } from "../src/database.js";
import { beginSitting, MCQ, seedSitting } from "./support.js";

/**
 * ROADMAP §12, in a real browser: an organisation out of credits cannot start
 * an attempt; its owner buys credits through Checkout; the candidate starts.
 *
 * Checkout itself is Razorpay's page, so it is stood in for here by a script
 * that does what Checkout does on success — hand back the ids and the
 * signature, made with the (fake) key secret. The server checks that
 * signature exactly as it checks a real one.
 */

test("an owner out of credits buys more through Checkout, gets a tax invoice, and the candidate can start", async ({ page, browser, request }) => {
  const BILLED_OWNER = await seedBilledOrganisation(hashPassword);
  const sitting = await seedSitting(request, { owner: BILLED_OWNER, questions: [MCQ] });

  // Out of credits: the candidate is told it cannot start yet, and no time is used.
  const candidate = await browser.newPage();
  await beginSitting(candidate, sitting.links["CS001"]!);
  await expect(candidate.getByRole("region", { name: "Cannot start yet" })).toBeVisible();

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
  await page.goto("/console/");
  await page.getByLabel("Email").fill(BILLED_OWNER.email);
  await page.getByLabel("Password").fill(BILLED_OWNER.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Billing" }).click();

  const buy = page.getByRole("region", { name: "Buy credits" });
  // Pune, from a Karnataka supplier: IGST.
  await expect(buy).toContainText("+ IGST 18% ₹900.00 = ₹5,900.00");
  await buy.getByRole("button", { name: "Pay ₹5,900.00 with Razorpay" }).click();
  await expect(buy.getByRole("status")).toContainText(/Paid\. 100 credits added; tax invoice PKS\/\d{4}\/\d{6}/);

  const invoices = page.getByRole("region", { name: "Invoices" });
  await invoices.getByRole("button", { name: /^View PKS/ }).first().click();
  const invoice = page.getByRole("article", { name: /^Tax invoice PKS/ });
  await expect(invoice).toContainText("Place of supply: Maharashtra (27)");
  await expect(invoice).toContainText("Rupees Five Thousand Nine Hundred Only");

  // Now the candidate's link opens the test.
  await candidate.getByRole("button", { name: "Try again" }).click();
  await expect(candidate.getByRole("heading", { name: sitting.title })).toBeVisible();
});
