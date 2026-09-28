import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay (ROADMAP §12): orders, and the two signatures that say a payment
 * happened.
 *
 * The browser's Checkout returns `razorpay_signature` =
 * HMAC-SHA256(`order_id|payment_id`, key secret); Razorpay's webhook carries
 * `X-Razorpay-Signature` = HMAC-SHA256(raw body, webhook secret). Nothing is
 * credited without one of them checking out: a browser can say anything.
 */

export interface PaymentGateway {
  /** Public: goes to the browser for Checkout. */
  readonly keyId: string;
  createOrder(order: { readonly amountPaise: number; readonly receipt: string; readonly notes: Readonly<Record<string, string>> }): Promise<{ readonly id: string }>;
  /** Checkout's signature over `order_id|payment_id`. */
  verifyPayment(orderId: string, paymentId: string, signature: string): boolean;
  /** The webhook's signature over its raw body. */
  verifyWebhook(rawBody: string, signature: string): boolean;
  /** Refund part or all of a captured payment. */
  refund(paymentId: string, amountPaise: number, notes: Readonly<Record<string, string>>): Promise<{ readonly id: string }>;
}

/** The gateway is down or refused the order; the customer can try again. */
export class GatewayUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GatewayUnavailable";
  }
}

const hmac = (secret: string, payload: string) => createHmac("sha256", secret).update(payload).digest("hex");

/** Compare hex signatures in constant time. */
function sameSignature(expected: string, given: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(given, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export class RazorpayGateway implements PaymentGateway {
  readonly keyId: string;
  readonly #keySecret: string;
  readonly #webhookSecret: string;
  readonly #fetch: typeof fetch;

  constructor(options: { keyId: string; keySecret: string; webhookSecret: string; fetch?: typeof fetch }) {
    this.keyId = options.keyId;
    this.#keySecret = options.keySecret;
    this.#webhookSecret = options.webhookSecret;
    this.#fetch = options.fetch ?? fetch;
  }

  async createOrder(order: { amountPaise: number; receipt: string; notes: Readonly<Record<string, string>> }): Promise<{ id: string }> {
    let response: Response;
    try {
      response = await this.#fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`${this.keyId}:${this.#keySecret}`).toString("base64")}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ amount: order.amountPaise, currency: "INR", receipt: order.receipt, notes: order.notes }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new GatewayUnavailable(`Razorpay could not be reached: ${error instanceof Error ? error.name : "error"}`);
    }
    if (!response.ok) throw new GatewayUnavailable(`Razorpay refused the order: HTTP ${response.status}`);
    const body = (await response.json()) as { id?: unknown };
    if (typeof body.id !== "string") throw new GatewayUnavailable("Razorpay's reply had no order id");
    return { id: body.id };
  }

  verifyPayment(orderId: string, paymentId: string, signature: string): boolean {
    return sameSignature(hmac(this.#keySecret, `${orderId}|${paymentId}`), signature);
  }

  verifyWebhook(rawBody: string, signature: string): boolean {
    return sameSignature(hmac(this.#webhookSecret, rawBody), signature);
  }

  /** `POST /v1/payments/:id/refund`, at normal speed, with our refund's id in its notes. */
  async refund(paymentId: string, amountPaise: number, notes: Readonly<Record<string, string>>): Promise<{ id: string }> {
    let response: Response;
    try {
      response = await this.#fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`${this.keyId}:${this.#keySecret}`).toString("base64")}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ amount: amountPaise, speed: "normal", notes }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new GatewayUnavailable(`Razorpay could not be reached: ${error instanceof Error ? error.name : "error"}`);
    }
    const body = (await response.json().catch(() => ({}))) as { id?: unknown; error?: { description?: string } };
    if (!response.ok || typeof body.id !== "string") {
      throw new GatewayUnavailable(`Razorpay refused the refund: ${body.error?.description ?? `HTTP ${response.status}`}`);
    }
    return { id: body.id };
  }
}

/**
 * Razorpay without Razorpay, for tests and the browser harnesses: orders are
 * numbered locally, and `sign` / `signWebhook` produce what Checkout and the
 * webhook would, with the same algorithms as the real gateway.
 */
export class FakeRazorpay implements PaymentGateway {
  readonly keyId = "rzp_test_fake";
  readonly orders: { id: string; amountPaise: number; receipt: string; notes: Readonly<Record<string, string>> }[] = [];
  unavailable = false;
  readonly #real: RazorpayGateway;

  constructor(readonly keySecret = "fake-key-secret", readonly webhookSecret = "fake-webhook-secret") {
    this.#real = new RazorpayGateway({ keyId: this.keyId, keySecret, webhookSecret });
  }

  async createOrder(order: { amountPaise: number; receipt: string; notes: Readonly<Record<string, string>> }): Promise<{ id: string }> {
    if (this.unavailable) throw new GatewayUnavailable("Razorpay could not be reached: fake outage");
    const id = `order_fake${String(this.orders.length + 1).padStart(6, "0")}`;
    this.orders.push({ id, ...order });
    return { id };
  }

  readonly refunds: { id: string; paymentId: string; amountPaise: number; notes: Readonly<Record<string, string>> }[] = [];
  refuseRefunds = false;

  async refund(paymentId: string, amountPaise: number, notes: Readonly<Record<string, string>>): Promise<{ id: string }> {
    if (this.unavailable || this.refuseRefunds) throw new GatewayUnavailable("Razorpay refused the refund: fake refusal");
    const id = `rfnd_fake${String(this.refunds.length + 1).padStart(6, "0")}`;
    this.refunds.push({ id, paymentId, amountPaise, notes });
    return { id };
  }

  verifyPayment(orderId: string, paymentId: string, signature: string): boolean {
    return this.#real.verifyPayment(orderId, paymentId, signature);
  }

  verifyWebhook(rawBody: string, signature: string): boolean {
    return this.#real.verifyWebhook(rawBody, signature);
  }

  sign(orderId: string, paymentId: string): string {
    return hmac(this.keySecret, `${orderId}|${paymentId}`);
  }

  signWebhook(rawBody: string): string {
    return hmac(this.webhookSecret, rawBody);
  }
}
