## 1. Understand the ask

Two very different kinds of traffic share one service. **Transactional** messages (an OTP, a fee receipt) go to one person and must arrive in seconds. **Bulk** messages (results are out) go to lakhs of people and may take an hour. The SMS provider caps us at 500 messages per second for **both** together. The central design problem is therefore **sharing a limited pipe fairly**, with reliability (no lost messages, no duplicates) close behind.

## 2. Numbers first

- Campaign duration (`sms-campaign-minutes`): 12 lakh SMS at 500 per second is **40 minutes**. No amount of servers makes it faster; the provider sets the pace.
- OTP share (`otp-share`): about 20 OTPs per second is **4%** of the SMS budget; reserving about 10% leaves headroom.
- Status volume (`status-rows`): about **9 crore** status rows a year, so the status table is partitioned by month.
- Backlog (`queue-backlog-gb`): a whole campaign queued is about **1.2 GB**: a durable queue holds it comfortably.

> **Note:** When a downstream provider is the bottleneck, the design's job is to **queue, pace and prioritise**, not to scale our own servers.

## 3. Accepting work

[[visual:notify-architecture]] shows the flow. Senders call the **notification API** with an idempotency key; a retry with the same key returns the same `message_id`. A single message is written to the database and placed on the channel's **transactional queue**. A campaign is accepted as one record and handed to **fan-out workers**.

Fan-out workers expand the segment in batches of, say, 1,000 users: check each user's preferences and opt-outs, render nothing yet (templates are applied at send time so a fixed template can be replayed), and enqueue per-user messages onto the **bulk queues**. The caller never sends 12 lakh requests; the service does the expansion where it can pace and observe it.

## 4. Priority without starvation

Each channel has two queues. The SMS senders draw from a **token bucket** of 500 per second, with a **reserved** share for transactional messages. The send loop always checks the transactional queue first; bulk messages use whatever tokens remain. An OTP at 10:01 waits only for its own queue, which is nearly empty, not behind 12 lakh results.

Push and email providers allow much more, so their buckets are larger, but the same structure applies, which keeps the code uniform.

## 5. Sending exactly once to the user

Inside the system we accept **at-least-once** delivery: queues redeliver after crashes. The user must see **at most one** SMS. So before calling the provider, the sender inserts `(message_id, channel)` with status SENDING under a unique constraint. If it already exists, another worker is handling or has handled it, and this worker skips. The provider call carries `message_id` as a **client reference**, so if we time out and retry, the provider recognises the duplicate. Webhooks from the provider update the status by `provider_msg_id`, idempotently.

## 6. Retries, fallbacks and dead letters

Temporary failures (timeouts, 5xx, throttling) are retried with **exponential backoff plus jitter**, so a provider outage is not hit by synchronized waves of retries. Permanent failures (an invalid number) stop at once. After the last retry, the message goes to a **dead-letter queue** with its error, for inspection and replay. For important messages, a failed push can **fall back** to SMS, controlled per template.

## 7. Status and campaigns

Each delivery's status moves queued → sending → sent → delivered or failed. Campaign counts are aggregated from these events (incrementing counters per status), so a sender can watch progress ("7.2 lakh sent, 6.9 lakh delivered") without scanning the table.

## 8. Failures in one paragraph

A provider outage fills queues and slows bulk sends while OTPs fall back to another provider; a crashed worker's messages are redelivered and deduplicated; a broken template sends its messages to dead letters for a fix and replay; a slow status store is buffered so sending continues.

**The lesson: put a limited, shared resource behind queues you control, split traffic by urgency before it reaches the bottleneck, and make every step after the queue idempotent.**
