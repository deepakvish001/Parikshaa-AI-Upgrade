## 1. Understand the ask

Three rules drive the design: bookings in one room **must never overlap**; a group gets the **smallest** room that fits, to keep big rooms for big groups; and a booking can be **cancelled by id**. The clarifying answers settle the boundary question that causes most bugs: times are **half-open**, so a talk ending at 10:00 and another starting at 10:00 do not clash.

## 2. Entities

[[visual:rooms-classes]] shows the split.

- **Room** knows its bookings and answers one question: is `[start, end)` free?
- **Scheduler** knows all rooms, picks the best fit, issues ids, and keeps an **index from booking id to room** so cancellation does not search every room.
- **The driver** turns `HH:MM` into minutes and validates input.

## 3. The overlap test

Two half-open intervals `[s1, e1)` and `[s2, e2)` overlap exactly when **each starts before the other ends**: `s1 < e2 and s2 < e1`. The room is free when no booking overlaps, which the code writes as "for every booking, the new one ends before it starts or starts after it ends": `end <= s or e <= start`. Using `<=` here is what allows back-to-back meetings; using `<` would wrongly reject them.

## 4. Best fit

`book(size, start, end)` filters rooms that are big enough and free, then picks the minimum by `(capacity, name)`. The name tie-break makes the choice deterministic, which tests (and users) need. At tens of rooms and hundreds of bookings, a linear scan is simpler and fast enough; the follow-ups ask what to change at larger scale.

## 5. Cancellation and ids

Ids come from a counter and are never reused, so an old id cannot accidentally cancel a newer booking. The id-to-room index makes cancel O(1): look up the room, remove the booking, remove the index entry.

## 6. The change request

`BOOKROOM` asks for a particular room. It reuses the two pieces we already have: the room's `isFree` check and the scheduler's helper that issues an id and records the booking. Only the choice of room differs, so the change is a small method plus a driver command, and BOOK behaves exactly as before.

**The lesson: get the interval convention right first (half-open), put the availability question on the object that owns the data (Room), and keep the selection policy (best fit, or a named room) in the scheduler, where new policies can be added beside the old ones.**
