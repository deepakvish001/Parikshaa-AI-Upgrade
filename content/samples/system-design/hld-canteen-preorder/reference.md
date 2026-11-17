## 1. Understand the ask

Before drawing anything, let's restate the problem in one line: **students reserve a plate of food and a pickup slot, pay with UPI, and the canteen must never promise more than it can make.** Everything else (menus, screens, notifications) is supporting cast.

The clarifying answers give us the two limits that matter: **stock per item** for the day and **kitchen capacity per 10-minute slot**. They also tell us that payment is slow and unreliable in a specific way: the gateway's confirmation arrives seconds later, sometimes twice, sometimes never.

So the hard parts are **correctness under concurrency** and **a payment step in the middle of a reservation**. Scale is modest, and we will show that with numbers before choosing tools.

## 2. Numbers first

Orders (`lunch-qps`): 25,000 a day with 70% in the lunch hour is about **5 orders per second** on average, with bursts maybe ten times higher when classes end on the hour.

Menu reads (`menu-reads`): about **44 reads per second**, ten times the order rate. Reads and writes have different shapes, so we will treat them differently.

Storage (`order-storage`): about **9 GB a year**. That is tiny.

> **Note:** These numbers rule out a lot of complexity. 5 to 50 writes per second is comfortable for a single PostgreSQL or MySQL server. We do not need sharding, a distributed counter or an exotic database; we need **transactions used correctly**.

## 3. The happy path

Follow one order ([[visual:canteen-architecture]]):

1. The student opens the menu. The app reads it through the **menu cache**, refreshed every few seconds from the database, with availability shown as "approximately 40 left".
2. The student picks items and a pickup slot and taps Order. The app sends `POST /orders` with an **idempotency key** generated on the phone, so a double tap or a retry on a bad network does not create two orders.
3. The **order service** runs one transaction: take the stock, take slot capacity, create the order as **HELD** with an expiry five minutes ahead.
4. It returns a UPI payment link. The student pays in their UPI app.
5. The gateway calls back `/payments/callback`. The order service moves the order to **PAID** and pushes it to the canteen's kitchen screen for that slot.
6. At pickup, staff mark it **COLLECTED**.

## 4. Never oversell

The classic bug is read-then-write: read `stock = 1`, decide there is a plate, write `stock = 0`. Two students doing this at the same moment both succeed. The fix is to make the check and the change **one atomic statement**:

```sql
UPDATE items SET stock_today = stock_today - :qty
WHERE item_id = :id AND stock_today >= :qty;
```

If it changes one row, the plate is ours; if zero rows, the item ran out. The slot works the same way with `used + :plates <= capacity`. All of it, plus inserting the order, happens in **one transaction**: if the slot is full after the stock was taken, the whole transaction rolls back and nothing is held.

This is boring, and that is the point. The database's row locking does the hard concurrency work for us.

## 5. Holding during payment

Why take stock *before* payment? Because a student who has started paying should not lose the plate to someone faster. But we cannot hold it forever: some students close the app. So a held order carries `hold_expires_at`.

An **expiry worker** runs every 30 seconds:

```sql
-- in one transaction per order
UPDATE orders SET state = 'CANCELLED' WHERE order_id = :id AND state = 'HELD' AND hold_expires_at < now();
-- if that changed a row: give back its stock and slot capacity
```

The `state = 'HELD'` condition matters: if a payment confirmed the order a moment ago, the worker's update touches nothing and returns nothing to stock.

## 6. Payments that misbehave

Payment callbacks are the second hard part. Three cases:

- **Duplicate callback.** We store `txn_id` with a unique constraint, and move HELD → PAID only `WHERE state = 'HELD'`. The second callback hits the unique constraint or finds the order already PAID, and we answer 200 so the gateway stops retrying.
- **Late callback after expiry.** The order is CANCELLED and the stock went back. We try to take the stock again; if it is still there, the order becomes PAID. If not, we mark it for an **automatic refund** and tell the student. The money is never silently kept.
- **No callback.** The hold expires. A reconciliation job later asks the gateway for the status of recent transactions, which catches callbacks that were lost entirely.

> **Note:** "Exactly once" is not something the network gives you. You build it from **at-least-once delivery plus idempotent handling**: retries are allowed because handling the same message twice has no extra effect.

## 7. Reads, screens and the rest

Menus are cached for a few seconds. Kitchen screens subscribe to a **push channel** (WebSocket or server-sent events) and receive orders as they are confirmed, grouped by slot, so nobody polls the database every second. A small notification service tells students when their order is ready.

## 8. The data model, and why each constraint is there

The tables are small, but every constraint in them does a job:

- `items.stock_today` is **decremented by conditional updates only**. No code path reads it, does arithmetic in the application and writes it back.
- `slots(canteen_id, slot_start)` holds `capacity` and `used`. A check constraint `used <= capacity` is a second safety net: if a future bug ever tries to overfill a slot, the database refuses the write instead of letting the kitchen drown.
- `orders.idempotency_key` is **unique**. A retried `POST /orders` with the same key returns the existing order instead of creating a second one. Without it, a student on weak campus Wi-Fi who taps twice could hold two biryanis and pay for one.
- `payments.txn_id` is **unique**, which is what makes duplicate callbacks harmless.
- `orders.state` moves only forward: HELD → PAID → COLLECTED, or HELD → CANCELLED. Every transition is written as `UPDATE ... WHERE state = <expected>`, so two processes that race (the expiry worker and a late callback) cannot both win.

An index on `(state, hold_expires_at)` keeps the expiry worker's query cheap, and an index on `(canteen_id, slot_start, state)` serves the kitchen screen.

For an interview, saying **which constraint protects which rule** is worth more than listing tables. It shows you know where correctness actually lives: in the database's guarantees, not in hopeful application code.

## 9. What can go wrong

- **The gateway slows down at lunch.** Holds expire and stock returns automatically; the reconciliation job and refund path handle late successes.
- **The expiry worker stops.** Items look sold out while unpaid holds pile up. We alert on "held orders past expiry" so it is noticed within minutes.
- **The database fails.** Ordering pauses; menus can still be shown from cache with an "ordering paused" banner. A standby replica can be promoted.

## 10. Wrap-up

We chose the simplest store that is **correct**: one relational database with conditional updates and transactions, because the numbers are small. We made the slow, unreliable step (payment) safe with **holds that expire** and **idempotent callbacks**. And we kept the heavy read traffic away from the order path with a short-lived cache.

**The pattern carries over to cinema seats, hostel room booking and exam slot registration: reserve atomically, hold briefly, confirm idempotently, release automatically.**
