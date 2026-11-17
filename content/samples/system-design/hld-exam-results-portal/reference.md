## 1. Understand the ask

Let's start the way a good interviewer expects: not with boxes, but with the problem. The portal does **one thing**: given a roll number and date of birth, show a marksheet. It does it under one brutal condition: **almost every student arrives in the same few minutes**. So this is not a hard system in features; it is a hard system in **timing**.

Three facts from the clarifying questions shape everything:

1. **The data is fixed on the day.** Results are computed the night before and do not change during the rush.
2. **The data is small.** 12 lakh marksheets at 2 KB each is about 2.4 GB.
3. **The traffic is a spike, not a curve.** Most of the first hour's load lands in its first ten minutes.

Read-only, small, spiky: that combination points at one strategy, which we will justify with numbers: **do all the work before 10:00, so that 10:00 is only reads from memory.**

## 2. Numbers first

Let's estimate the peak (the `peak-qps` estimate). 80% of 12 lakh students check in the first hour, about 3 times each because they refresh and share with family: 28.8 lakh lookups. If 40% of those land in the first 10 minutes, that is about 11.5 lakh lookups in 600 seconds, roughly **1,900 lookups per second**, with short bursts above that.

Data size (`result-store`): 2.4 GB of JSON. A single modest cache server holds that with room to spare, and we will run a few replicas.

Bandwidth (`pdf-bandwidth`): if 30% also download a 60 KB PDF, that is about 280 Mbps at the peak. Serving that from our own servers would need a lot of network; serving it from a **CDN** costs us almost nothing.

> **Note:** 1,900 requests per second is not huge for a cache. A single Redis node handles tens of thousands of simple reads per second. The danger is not the cache; it is anything **slow** on the request path, such as a database query or PDF rendering.

## 3. The read path

Follow one request ([[visual:results-architecture]] shows the whole picture):

1. The student's browser loads the results page. It is static HTML and JavaScript, served by the **CDN**; our servers never see it.
2. The page posts the roll number and date of birth to `/results/lookup`. The CDN forwards it to a **load balancer**.
3. One of many **stateless lookup servers** computes the key `SHA-256(roll || dob || salt)` and reads it from the **results cache**.
4. On a hit, it returns the marksheet JSON. On a miss, it returns a plain "no result found for these details", never saying whether the roll number or the date was wrong.
5. If the student wants a PDF, the response includes a link to a file that was **rendered the night before** and stored in object storage, served through the CDN with a signed URL.

There is **no database on this path** and **no rendering on this path**. Each lookup is a hash, a memory read and a small response. That is why the design can promise a p99 under 300 ms during the rush.

## 4. Why precompute, not cache-aside

The usual pattern for caches is cache-aside: look in the cache, and on a miss read the database and fill the cache. It works for most systems because the same keys are read again and again over time.

On result day it fails in the worst way. At 10:00, **every** request is for a key nobody has read yet, so every request misses, and the database takes the full 1,900 lookups per second at the very moment we hoped the cache would protect it. Caches that start cold are a classic cause of exactly the crashes the university sees every year.

So we **warm the cache ahead of time**. The night before, a batch job reads every result from the exam cell's database, writes one record per student into the cache (and to a durable key-value copy for recovery), and renders every PDF into object storage. It has hours to do this, so it can go slowly and be checked. By morning, the system already holds every answer it will be asked for.

## 5. Making 10:00 a switch, not a spike

If the results are in the cache at 2 am, what stops someone from seeing them early? A **publish flag**. Every lookup server checks it (reading it from a config service and caching it for a few seconds). Until 10:00 the flag is off and lookups return "results not yet published". At 10:00 an operator, or a scheduled job, flips it on, and within seconds every server answers.

This separates two kinds of work that would hurt each other: **writes** (loading data) happen at night, **reads** happen in the morning. It also gives a safety lever: if a mistake is found at 10:05, flipping the flag off hides results instantly, without a deploy.

The static page itself must not be stuck in "not yet published" at 10:00: give the status endpoint a very short CDN TTL and purge it at the moment of publication.

## 6. Scaling the servers

The lookup servers are **stateless**: they hold no user data, so any server can answer any request and we can add more. We run enough for about three times the expected peak, already started before 10:00 (autoscaling that reacts to load takes minutes to add servers, which is too slow for a spike that arrives in seconds).

If demand still exceeds capacity, we prefer a **waiting room** to errors: the load balancer sends excess requests to a static page served by the CDN ("you are in the queue; this page refreshes in 20 seconds"). Students tolerate a queue; they do not tolerate a blank error page that tempts them to refresh harder.

## 7. Security and privacy

Two risks deserve design, not just a mention.

**Guessing.** Roll numbers are often sequential, and dates of birth for a batch fall within a year or two, so an attacker could try about 700 dates per roll number. We rate-limit failed lookups per roll number and per IP, and add a CAPTCHA after a few failures. At 10 failures per hour, guessing one student's result takes days.

**Leaks.** The cache key is a salted hash, not the roll number, so a dump of the cache does not list students. The PDF links are signed and expire. Error messages never reveal which half of the input was wrong.

## 8. What can go wrong

- **A cache node dies.** We run replicas; the client library fails over. As a last resort the lookup service can read the durable key-value copy, behind tight rate limits so it cannot be overwhelmed.
- **Wrong results were published.** Flag off, fix in the exam cell's database, rebuild only the affected keys and PDFs, flag on.
- **Re-evaluation later.** A few thousand records change over weeks; update those keys and PDFs individually. There is no spike for these, so ordinary writes are fine.

## 9. Trade-offs, in one breath

We spend a night of batch work and some storage on PDFs we may never serve, and in exchange result day becomes a simple, boring read path. We give up the convenience of looking up records by roll number in the cache, and gain privacy if the cache leaks. We accept a waiting room on the worst day instead of an outage.

**The lesson that transfers to other systems: when you know the peak in advance and the data is fixed, move the work out of the peak.** Flash sales, ticket releases and admission lists are the same problem wearing different clothes.
