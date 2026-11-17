## 1. Understand the ask

This is not a "design a booking site" question; it is a **burst** question. For two minutes a day, demand is hundreds of times supply, and everyone arrives at the same second. The current site dies because every request tries to do everything synchronously (check, lock, pay) against one database at once.

The clarifying answers give us the guarantees that matter: **never sell a seat twice**, **every payment ends in a ticket or a refund**, and **earlier valid requests do better**. We will design for those three and accept that many users get an asynchronous answer rather than an instant one.

## 2. Numbers first

- Burst (`peak-rps`): 15 lakh requests in 2 minutes is **12,500 requests per second** before retries.
- Hot trains (`hot-train-share`): about **250 requests per second** for one popular train with roughly 400 seats.
- Holds (`held-seats`): seats sell in under a minute but payments take a minute or more, so for the first minutes **almost every seat is held, not sold**. Hold handling is the main path, not an edge case.
- Reads (`availability-reads`): about **1.25 lakh availability reads per second**, which must never touch the booking database.

> **Note:** 250 requests per second on one train is small for a single process doing in-memory decisions, but large for 50 servers fighting over one database row. The numbers point at **serialising per train**, not at a bigger database.

## 3. Absorb the burst at the door

[[visual:tatkal-architecture]] shows the flow. The first job is to **not let the burst reach the booking logic directly**:

1. The booking page and availability numbers come from the **CDN and an availability cache**.
2. A booking request goes to a **waiting room**: a light, horizontally scaled service that validates the request, deduplicates by idempotency key, **stamps the arrival time**, and returns `202 Accepted` with a request id and a position.
3. Admitted requests are written to a **queue partitioned by train**. The waiting room can admit at whatever rate the partitions sustain; extra requests wait in it rather than failing.

The user's page then polls `GET /bookings/{id}` (or receives a push) for the outcome: HELD with a payment link, WAITLISTED, or SOLD OUT.

## 4. One writer per train

Each train's partition is consumed by **one booking worker**. For each request, in arrival order, it checks the train's counts: if `total - held - confirmed >= passengers`, it **holds** seats with an expiry; otherwise, if the waitlist has room, it **waitlists**; otherwise **sold out**. It writes the decision and the new counts in one transaction, then commits the queue offset.

Why this instead of row locks? With one writer there is **no contention**: decisions for a train are a simple loop, and they happen **in arrival order**, which is our fairness rule. Different trains are independent, so 3,000 trains spread across many workers scale horizontally. If a worker dies, another resumes from the last committed offset; because decisions are keyed by request id, replaying a request does not hold seats twice.

## 5. Holds, payments and refunds

A hold carries `hold_expires_at`, typically 5 minutes. The **payment orchestrator** creates the gateway payment and handles callbacks:

- a success callback for a **HELD** request turns the hold into a ticket (`held - n`, `confirmed + n`) and records `txn_id` with a unique constraint, so a duplicate callback changes nothing;
- a success for an **expired** hold first tries to take seats again through the train's worker; if none are left, it **refunds automatically**;
- a **reconciliation job** asks the gateway about payments with no callback after a few minutes.

An **expiry job** (or the worker itself, on a timer message in the same partition) releases expired holds and offers the seats to the waitlist in order. Putting expiry through the same partition keeps the single-writer rule: every change to a train's counts goes through its worker.

## 6. Reads

Availability is published by the workers to a cache every second or two. It is approximate by design; the worker's decision is the truth. Showing "about 12 seats, may change" is honest and keeps 1.25 lakh reads per second away from anything that writes.

## 7. Fairness and abuse

Fairness comes from the arrival stamp plus per-train ordering. Abuse undermines it: scripts that fire thousands of requests would take the front places. The waiting room therefore limits requests per account and device, collapses duplicates by idempotency key, and can require a CAPTCHA before 10:00 to pre-qualify users.

## 8. What can go wrong

A worker crash costs a few seconds while its partition moves; a gateway slowdown expires holds and triggers refunds; a stale cache shows slightly wrong numbers; a bot flood is absorbed by the waiting room's limits. In each case the core guarantees (no double sale, every payment resolved) still hold, because they live in the per-train writer and the idempotent payment path, not in timing luck.

**The transferable idea: when demand is a burst for a scarce resource, accept requests fast, decide them slowly and in order per resource, and make every slow external step (payment) idempotent and reconcilable.**
