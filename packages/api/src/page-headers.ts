/**
 * The security headers every response carries, and the content security
 * policy of the two clients' pages (ROADMAP §11). One source for the API,
 * which serves the clients on a single machine, and for the Vercel build
 * (deploy/vercel/build-output.mjs), which serves them from the CDN.
 */

/**
 * Every response: nothing sniffed into a script, never framed (a framed exam
 * page is a clickjacking target), and no Referer — an invitation code or a
 * reset link in the address must not follow a click to another site. The
 * camera and the microphone are this origin's alone: proctoring takes photos
 * and listens for voices (row 85), and nothing else on the page may.
 */
export function baseHeaders(options: { readonly openerPolicy?: boolean; readonly hsts?: boolean } = {}): Record<string, string> {
  return {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    ...(options.openerPolicy === false ? {} : { "cross-origin-opener-policy": "same-origin" }),
    "permissions-policy": "camera=(self), microphone=(self), geolocation=(), payment=(self)",
    ...(options.hsts === true ? { "strict-transport-security": "max-age=31536000; includeSubDomains" } : {}),
  };
}

/**
 * A page's content security policy: scripts only from this origin, so an
 * injected <script> or inline handler does not run. The console, and a
 * practice site (where learners buy Plus), may load Razorpay's Checkout.
 */
export function pagePolicy(path: string): string {
  const pays = path.startsWith("/console") || path.startsWith("/practice/");
  const razorpay = pays ? " https://*.razorpay.com" : "";
  return [
    "default-src 'self'",
    `script-src 'self'${razorpay}`,
    // React sets style attributes; no stylesheet is fetched from elsewhere.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${razorpay}`,
    "font-src 'self' data:",
    `connect-src 'self'${razorpay}`,
    `frame-src ${pays ? "https://*.razorpay.com" : "'none'"}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
