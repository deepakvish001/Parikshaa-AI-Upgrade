import type { OrgId } from "@parikshaa/core";
import { DEFAULT_PREP_SETTINGS, practiceLearner, practiceStaff, type Learner, type PracticeSite, type PracticeStore, type PrepPlusStore, type PrepProduct, type PrepSettings } from "@parikshaa/store";
import { PracticeError, istDay } from "./practice.js";
import { GatewayUnavailable, type PaymentGateway } from "./razorpay.js";

/**
 * Plus (ROADMAP §16): what a practice site sells its learners, and the credits
 * its tutor spends.
 *
 * A site that has not turned Plus on sells nothing and locks nothing. One that
 * has keeps its problem set and each track's first modules free, and asks for
 * Plus for the rest of its lessons and for a study plan. Plus comes from a
 * payment, from the institution (a campus licence: staff give it to their
 * learners), or from coins.
 *
 * Payment is Razorpay's Checkout, as the console's credits are: an order is
 * made on the server at the product's price, and nothing is given until
 * Checkout's signature, or the webhook's, checks out — a browser can say
 * anything. Confirming twice, or the webhook arriving too, changes nothing.
 */

/** The share of a price that is GST, when the price includes it at 18%. */
export const taxIn = (pricePaise: number): number => Math.round(pricePaise - pricePaise / 1.18);

const monthOf = (ms: number) => istDay(ms).slice(0, 7);

export interface PlusStatus {
  readonly enabled: boolean;
  readonly active: boolean;
  readonly until: string | null;
}

export class PrepPlus {
  readonly #store: PrepPlusStore;
  readonly #practice: PracticeStore;
  readonly #gateway: PaymentGateway | null;
  readonly #now: () => number;

  constructor(options: { store: PrepPlusStore; practice: PracticeStore; gateway?: PaymentGateway | null; now?: () => number }) {
    this.#store = options.store;
    this.#practice = options.practice;
    this.#gateway = options.gateway ?? null;
    this.#now = options.now ?? (() => Date.now());
  }

  get store(): PrepPlusStore {
    return this.#store;
  }

  async settings(orgId: OrgId): Promise<PrepSettings> {
    return this.#store.settings(practiceStaff(orgId));
  }

  /** Whether a learner holds Plus now; with Plus off, everyone is treated as holding it. */
  async status(site: PracticeSite, learner: Learner | null): Promise<PlusStatus> {
    const settings = await this.#store.settings(practiceLearner(site.orgId, null));
    if (!settings.plusEnabled) return { enabled: false, active: true, until: null };
    if (learner === null) return { enabled: true, active: false, until: null };
    const now = this.#now();
    const spans = await this.#store.plus(practiceLearner(site.orgId, learner.id));
    const current = spans.filter((s) => Date.parse(s.startsAt) <= now && Date.parse(s.endsAt) > now);
    // Spans that run on from the current one make one stretch.
    let until = current.length === 0 ? null : Math.max(...current.map((s) => Date.parse(s.endsAt)));
    if (until !== null) {
      for (const s of [...spans].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
        if (Date.parse(s.startsAt) <= until && Date.parse(s.endsAt) > until) until = Date.parse(s.endsAt);
      }
    }
    return { enabled: true, active: until !== null, until: until === null ? null : new Date(until).toISOString() };
  }

  /** This month's free credits, given the first time the learner's balance is read in the month. */
  async #monthly(site: PracticeSite, learner: Learner): Promise<void> {
    const settings = await this.#store.settings(practiceLearner(site.orgId, null));
    if (settings.monthlyCredits <= 0) return;
    await this.#store.credit(site.orgId, learner.id, { delta: settings.monthlyCredits, reason: "monthly", key: `monthly:${monthOf(this.#now())}` }, new Date(this.#now()));
  }

  async credits(site: PracticeSite, learner: Learner) {
    await this.#monthly(site, learner);
    const { balance, history } = await this.#store.credits(practiceLearner(site.orgId, learner.id), 50);
    return { balance, history };
  }

  /** Take credits for a tutor's answer; refused when there are not enough. */
  async spend(site: PracticeSite, learner: Learner, amount: number, key: string): Promise<void> {
    await this.#monthly(site, learner);
    if (amount <= 0) return;
    if (!(await this.#store.spend(site.orgId, learner.id, amount, key, new Date(this.#now())))) {
      throw new PracticeError("no_credits", "Not enough credits for that. Buy more, or wait for next month's.");
    }
  }

  async refund(site: PracticeSite, learner: Learner, amount: number, key: string): Promise<void> {
    if (amount > 0) await this.#store.credit(site.orgId, learner.id, { delta: amount, reason: "refund", key: `refund:${key}` }, new Date(this.#now()));
  }

  // --- the learner's side of buying ------------------------------------------------------------

  async overview(site: PracticeSite, learner: Learner | null) {
    const [settings, products, status] = await Promise.all([
      this.#store.settings(practiceLearner(site.orgId, null)),
      this.#store.products(practiceLearner(site.orgId, null)),
      this.status(site, learner),
    ]);
    return {
      enabled: settings.plusEnabled,
      active: status.active,
      until: status.until,
      freeModules: settings.freeModules,
      monthlyCredits: settings.monthlyCredits,
      tutor: settings.tutorEnabled,
      checkout: this.#gateway !== null,
      products: products.map((p) => ({ id: p.id, title: p.title, kind: p.kind, days: p.days, credits: p.credits, pricePaise: p.pricePaise })),
    };
  }

  #gatewayOrRefuse(): PaymentGateway {
    if (this.#gateway === null) throw new PracticeError("not_configured", "Payments are not set up on this server");
    return this.#gateway;
  }

  async checkout(site: PracticeSite, learner: Learner, productId: string) {
    const gateway = this.#gatewayOrRefuse();
    const settings = await this.#store.settings(practiceLearner(site.orgId, null));
    const product = (await this.#store.products(practiceLearner(site.orgId, null))).find((p) => p.id === productId);
    if (product === undefined) throw new PracticeError("not_found", "No such plan");
    if (product.kind === "plus" && !settings.plusEnabled) throw new PracticeError("not_found", "No such plan");
    let order: { id: string };
    try {
      order = await gateway.createOrder({
        amountPaise: product.pricePaise,
        receipt: `prep-${learner.id.slice(0, 20)}-${this.#now()}`.slice(0, 40),
        notes: { kind: "prep", orgId: site.orgId, learnerId: learner.id, productId: product.id },
      });
    } catch (error) {
      if (error instanceof GatewayUnavailable) throw new PracticeError("unavailable", "Payments are not reachable just now. Try again in a minute.");
      throw error;
    }
    await this.#store.createOrder(site.orgId, {
      learnerId: learner.id,
      productId: product.id,
      title: product.title,
      days: product.days,
      credits: product.credits,
      amountPaise: product.pricePaise,
      taxPaise: taxIn(product.pricePaise),
      gatewayOrderId: order.id,
    });
    return { keyId: gateway.keyId, orderId: order.id, amountPaise: product.pricePaise, title: product.title, learner: { name: learner.name, email: learner.email } };
  }

  /** Checkout came back: believed only if its signature checks out. */
  async confirm(site: PracticeSite, learner: Learner, input: { orderId: string; paymentId: string; signature: string }) {
    const gateway = this.#gatewayOrRefuse();
    if (!gateway.verifyPayment(input.orderId, input.paymentId, input.signature)) throw new PracticeError("payment_invalid", "That payment could not be verified");
    const mine = (await this.#store.orders(practiceLearner(site.orgId, learner.id))).find((o) => o.gatewayOrderId === input.orderId);
    if (mine === undefined) throw new PracticeError("not_found", "No such order");
    const paid = await this.#store.markPaid(site.orgId, input.orderId, input.paymentId, new Date(this.#now()));
    if (paid === null) throw new PracticeError("not_found", "No such order");
    return { order: paid.order, plus: await this.status(site, learner) };
  }

  /** Razorpay's webhook, for a practice order: pays one whose browser never came back. */
  async webhook(rawBody: string, signature: string): Promise<{ handled: boolean }> {
    const gateway = this.#gatewayOrRefuse();
    if (!gateway.verifyWebhook(rawBody, signature)) throw new PracticeError("payment_invalid", "The webhook's signature does not check out");
    const event = JSON.parse(rawBody) as {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string; notes?: Record<string, string> } }; order?: { entity?: { id?: string; notes?: Record<string, string> } } };
    };
    if (event.event !== "order.paid" && event.event !== "payment.captured") return { handled: false };
    const payment = event.payload?.payment?.entity;
    const order = event.payload?.order?.entity;
    const notes = order?.notes ?? payment?.notes ?? {};
    const orderId = order?.id ?? payment?.order_id;
    if (notes["kind"] !== "prep" || notes["orgId"] === undefined || orderId === undefined || payment?.id === undefined) return { handled: false };
    const paid = await this.#store.markPaid(notes["orgId"] as OrgId, orderId, payment.id, new Date(this.#now()));
    return { handled: paid !== null };
  }

  async orders(site: PracticeSite, learner: Learner) {
    return (await this.#store.orders(practiceLearner(site.orgId, learner.id))).map(({ id, title, days, credits, amountPaise, taxPaise, status, createdAt, paidAt }) => ({
      id,
      title,
      days,
      credits,
      amountPaise,
      taxPaise,
      status,
      createdAt,
      paidAt,
    }));
  }

  // --- staff ----------------------------------------------------------------------------------------

  async saveSettings(orgId: OrgId, input: Partial<PrepSettings>): Promise<PrepSettings> {
    const current = await this.settings(orgId);
    const next = { ...DEFAULT_PREP_SETTINGS, ...current, ...input };
    if (!Number.isInteger(next.freeModules) || next.freeModules < 0 || next.freeModules > 60) throw new PracticeError("invalid", "Free modules are 0 to 60");
    if (!Number.isInteger(next.monthlyCredits) || next.monthlyCredits < 0 || next.monthlyCredits > 100_000) throw new PracticeError("invalid", "Monthly credits are 0 to 100,000");
    await this.#store.saveSettings(orgId, next);
    return next;
  }

  async staffProducts(orgId: OrgId): Promise<readonly PrepProduct[]> {
    return this.#store.products(practiceStaff(orgId));
  }

  async saveProduct(orgId: OrgId, id: string | null, input: Omit<PrepProduct, "id" | "position"> & { position?: number | undefined }): Promise<PrepProduct> {
    const title = input.title.trim();
    if (title.length < 1 || title.length > 120) throw new PracticeError("invalid", "A plan's name is 1 to 120 characters");
    if (!Number.isInteger(input.pricePaise) || input.pricePaise < 100 || input.pricePaise > 100_000_000) throw new PracticeError("invalid", "A price is ₹1 to ₹10,00,000");
    if (input.kind === "plus" && (!Number.isInteger(input.days) || input.days < 1 || input.days > 1100)) throw new PracticeError("invalid", "Plus lasts 1 to 1,100 days");
    if (input.kind === "credits" && (!Number.isInteger(input.credits) || input.credits < 1 || input.days !== 0)) throw new PracticeError("invalid", "A credits pack has credits and no days");
    if (!Number.isInteger(input.credits) || input.credits < 0 || input.credits > 1_000_000) throw new PracticeError("invalid", "Credits are 0 to 1,000,000");
    const existing = await this.#store.products(practiceStaff(orgId));
    const saved = await this.#store.saveProduct(orgId, id, {
      title,
      kind: input.kind,
      days: input.kind === "plus" ? input.days : 0,
      credits: input.credits,
      pricePaise: input.pricePaise,
      active: input.active,
      position: input.position ?? (id === null ? existing.length : (existing.find((p) => p.id === id)?.position ?? 0)),
    });
    if (saved === null) throw new PracticeError("not_found", "No such plan");
    return saved;
  }

  /** Give a learner Plus: a campus licence, a scholarship, a prize. */
  async grant(orgId: OrgId, learnerId: string, days: number, grantedBy: string): Promise<{ readonly until: string }> {
    if (!Number.isInteger(days) || days < 1 || days > 1100) throw new PracticeError("invalid", "Plus is given for 1 to 1,100 days");
    const learner = await this.#practice.learnerById(orgId, learnerId);
    if (learner === null) throw new PracticeError("not_found", "No such learner");
    const now = this.#now();
    const spans = await this.#store.plus(practiceStaff(orgId), learnerId);
    const from = Math.max(now, ...spans.map((s) => Date.parse(s.endsAt)));
    const until = new Date(from + days * 86_400_000);
    // Each grant is its own: two on the same day are two grants, not one made twice.
    await this.#store.grantPlus(orgId, learnerId, { startsAt: new Date(from), endsAt: until, source: "grant", ref: `${grantedBy}:${crypto.randomUUID()}` });
    return { until: until.toISOString() };
  }

  async staffOrders(orgId: OrgId) {
    return this.#store.orders(practiceStaff(orgId));
  }
}
