/** Razorpay Checkout, as its script defines it on `window` (ROADMAP §16: learners buy Plus). */
export interface RazorpayCheckout {
  open(): void;
  on(event: "payment.failed", handler: (response: { error: { description?: string } }) => void): void;
}
export type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayCheckout;

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/** Load Checkout once, when someone first buys: nobody else downloads it. */
export function loadCheckout(): Promise<RazorpayConstructor> {
  const existing = (window as { Razorpay?: RazorpayConstructor }).Razorpay;
  if (existing !== undefined) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.onload = () => {
      const loaded = (window as { Razorpay?: RazorpayConstructor }).Razorpay;
      if (loaded === undefined) reject(new Error("Checkout did not load"));
      else resolve(loaded);
    };
    script.onerror = () => reject(new Error("Checkout could not be reached"));
    document.head.appendChild(script);
  });
}
