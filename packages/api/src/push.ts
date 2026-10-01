import webpush from "web-push";
import type { PushSubscriptionRecord } from "@parikshaa/store";

/**
 * Push notifications (Prep blueprint §17, A1): the daily reminder on a
 * learner's phone as well as in their inbox, through the browser's own push
 * service (Web Push, RFC 8030, encrypted per RFC 8291, signed with VAPID).
 *
 * The server only ever sends to a push service a browser hands it, and only
 * to the push services browsers use: a subscription naming any other address
 * is refused, so the server cannot be made to post to an address of a
 * learner's choosing.
 */

export interface PushMessage {
  readonly title: string;
  readonly body: string;
  /** Where a tap on the notification opens: a path under the site. */
  readonly url: string;
  /** Notifications with one tag replace each other: a day's reminder replaces the last. */
  readonly tag: string;
}

export interface PushSender {
  /** The VAPID public key a browser subscribes with (base64url). */
  readonly publicKey: string;
  /** "gone": the push service no longer knows the subscription; it should be forgotten. */
  send(subscription: PushSubscriptionRecord, message: PushMessage): Promise<"sent" | "gone">;
}

/** The push services of Chrome and Android (FCM), Firefox, Safari and Edge. */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/];

export function isPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  return url.protocol === "https:" && url.port === "" && url.username === "" && url.password === "" && PUSH_HOSTS.some((host) => host.test(url.hostname));
}

/**
 * Sends with the `web-push` library. `subject` is how a push service reaches
 * whoever runs this server: a mailto: or https: address.
 */
export function webPushSender(options: { readonly publicKey: string; readonly privateKey: string; readonly subject: string }): PushSender {
  const vapidDetails = { subject: options.subject, publicKey: options.publicKey, privateKey: options.privateKey };
  return {
    publicKey: options.publicKey,
    async send(subscription, message) {
      if (!isPushEndpoint(subscription.endpoint)) return "gone";
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(message), {
          vapidDetails,
          // A reminder is for today: one held longer than six hours is not worth showing.
          TTL: 6 * 3600,
          timeout: 10_000,
        });
        return "sent";
      } catch (error) {
        const status = (error as { statusCode?: unknown }).statusCode;
        if (status === 404 || status === 410) return "gone";
        throw error;
      }
    },
  };
}
