## 1. Understand the ask

We need to stop a few students' scripts from slowing the portal for everyone, without punishing a normal student who clicks quickly a few times. That sentence already contains the two requirements: **short bursts are fine**, but **the long-run rate is capped**, and both apply **per user**.

The clarifying answers fix the remaining choices: refused requests are denied, not queued; time arrives with each request in whole seconds; a new user starts with a full allowance.

## 2. Choosing the algorithm

Three common designs:

- **Fixed window counter**: count requests per user per minute; reset at the minute boundary. Simple, but a user can send a full minute's quota at 10:00:59 and another at 10:01:00, doubling the rate at the boundary.
- **Sliding window log**: keep each request's timestamp and count those in the last minute. Accurate, but stores many timestamps per user.
- **Token bucket**: each user has a bucket of up to `capacity` tokens; tokens refill at `refill` per second; each request takes one. Bursts up to `capacity` are allowed, and over time the rate cannot exceed `refill`.

The token bucket matches the requirement exactly ("bursts fine, long-run rate capped") and needs only **four numbers per user**. We choose it.

## 3. Entities

[[visual:limiter-classes]] shows the design.

- **TokenBucket** owns the algorithm: `capacity`, `refill`, `tokens`, `last` (the time of the last refill), and one method, `tryTake(now)`.
- **RateLimiter** owns the mapping from user to bucket, and creates a full bucket for a user seen for the first time.
- **The driver** parses commands and prints results. It has no limiting logic, so the same classes could sit behind an HTTP handler.

## 4. Lazy refill

The tempting design runs a timer that adds tokens to every bucket every second. With 50,000 users, that is 50,000 updates a second for users who are mostly idle, and a thread to manage.

Instead, **refill when a request arrives**, from the time gap:

```text
tokens = min(capacity, tokens + (now - last) × refill)
last = now
if tokens == 0: deny
else: tokens -= 1; allow
```

Each request costs O(1), idle users cost nothing, and the result is exactly what a timer would have produced. The `min` with `capacity` is essential: a user who was away for an hour must come back to a **full** bucket, not to 3,600 saved-up requests.

## 5. Walking through a test

Capacity 2, refill 1 per second, user `om`:

- t = 10, first request: new bucket, full (2). Refill adds nothing; take one: allow, 1 left.
- t = 10: take one: allow, 0 left.
- t = 10: no time passed, no refill, 0 tokens: deny.
- t = 11: one second passed, refill 1, take it: allow, 0 left.
- t = 11: deny.

## 6. The change request: VIP users

Teaching assistants need double limits. The algorithm does not change at all; only **which numbers a bucket is created with** changes. So the change lands in exactly two places: `RateLimiter` remembers a set of VIP users and creates their buckets with `capacity × 2` and `refill × 2`, and the driver learns the `VIP` command. `TokenBucket` is untouched.

That is the payoff of separating the algorithm (TokenBucket) from the policy of who gets which limits (RateLimiter). If both had lived in one class with `if vip` scattered through the refill code, the change would have touched the most delicate part.

## 7. Beyond one server

On several API servers, each server's in-memory buckets would allow a user `capacity` requests **per server**. The real fix keeps buckets in a shared store such as Redis and runs the refill-and-take step as one atomic script, so two servers cannot both take the last token. The class design stays the same; only where the four numbers live changes.

**The idea to keep: compute state from elapsed time when you need it, instead of updating it on a clock; it is cheaper, simpler and exact.**
