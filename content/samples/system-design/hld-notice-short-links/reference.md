## 1. Understand the ask

The service has two very unequal halves. **Creating** links is rare: a few thousand a day, by trusted staff. **Following** links is common, bursty and anonymous: lakhs of students clicking the moment an SMS arrives. Good designs treat the halves differently, so let's keep them apart from the start.

There are also two quieter requirements that turn out to drive key decisions: links for notices may be sent **before** the notice is public, and staff must be able to **disable** a link that was sent by mistake.

## 2. Numbers first

Peak redirects (`peak-redirects`): one notice to 1 lakh students with 60% of clicks in ten minutes is about **100 redirects per second**, and a few notices at once (results plus a timetable change) push that to several hundred, with bursts of a couple of thousand.

Code space (`codes-in-7`): seven characters from 62 symbols give about **3.5 trillion** codes. At 2,000 links a day we will never run out, which means we can afford **random** codes with almost no clashes.

Storage (`storage-10y`): about **3.7 GB** for ten years. One database table with a primary key is enough; we do not need a distributed store.

> **Note:** When storage is tiny and reads dominate, the design question is not "which big database" but "how do I keep the read path short".

## 3. The redirect path

A click on `uni.in/x7Kq2` ([[visual:shortlink-architecture]]):

1. The browser asks the **redirect service** for `/x7Kq2`.
2. The service looks in the **hot code cache**. A popular notice is in the cache after its first click, so almost every click is answered from memory.
3. On a miss, it reads the `links` table by primary key and fills the cache.
4. It checks `disabled` and `expires_at`; then it answers with a **302** redirect to the long URL (or 410 Gone, or 404).
5. It writes a small click event to a **queue** and returns. It does not wait for the event to be stored.

That is one memory read and one response for nearly every click: well inside 50 ms.

## 4. Choosing codes

Two standard schemes, and why we pick one here:

- **Sequence + base 62.** The database gives 1, 2, 3 ..., and we write the number in base 62. Short, simple, never clashes. **But guessable**: whoever has code `x7Kq2` can try `x7Kq3` and may open a notice that was meant to go out tomorrow.
- **Random 7 characters.** Generate a random code and insert it with the code as primary key; if the insert hits a duplicate (extremely rare with millions of codes used out of trillions), try again. Codes reveal nothing about each other.

Because notices are sometimes linked before they are published, we choose **random codes**. Custom codes (`results-2026`) go through the same insert, so a clash with an existing code is caught by the primary key.

## 5. 301 or 302?

A **301** says "moved permanently": browsers remember it and go straight to the long URL next time without asking us. That saves traffic, but repeat clicks never reach us (counts are low) and, worse, if a notice was sent by mistake we **cannot take it back** from browsers that cached it.

A **302** says "moved temporarily": every click comes to us. We pay for the traffic with our own cache, and in return counts are right and **disabling a link works immediately** (after we purge it from our cache).

For a university that sometimes sends the wrong notice, 302 is the right call.

## 6. Counting without slowing down

The obvious design increments a counter row on each redirect. Under a burst, every click on the same notice updates the **same row**, which becomes a lock hotspot and slows every redirect. Instead, each redirect drops an event onto a queue, and an **aggregator** turns events into per-day counts every minute. Stats are a minute or two behind, which the requirements allow.

## 7. Creating and disabling links

Creation goes through an **admin API** that requires a staff login, validates the URL (the university's own domains, or a checked allowlist, to stop the short domain being used to disguise phishing), generates the code and writes the row. Disabling sets `disabled = true` and **purges the code from the cache**, so the next click returns 410.

## 8. Failures

If the links table is down, the cache keeps hot notices working; creating links pauses. If the queue is down, redirects keep working and counts are a little low. The redirect service is stateless, so a crashed instance is simply replaced behind the load balancer.

**The lesson that carries over: split a system by how it is used. The rare, trusted write path can be careful and slow; the common, anonymous read path must be a short straight line, with everything else (counting, analytics) moved off to the side.**
