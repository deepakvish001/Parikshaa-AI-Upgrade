# Args: seed drivers trips. Prints INSERTs: three days of trips; minutes collide on purpose.
import random
import sys

seed, drivers, n = map(int, sys.stdin.readline().split())
rng = random.Random(seed)
names = [f"Driver {k:02d}" for k in range(1, drivers + 1)]
rows = []
for i in range(1, n + 1):
    day = rng.choice(["2026-11-15", "2026-11-16", "2026-11-17"])
    hh = rng.choice([0, 6, 7, 8, 9, 13, 18, 19, 23])
    mm = rng.choice([0, 15, 30, 45, 59])
    status = "cancelled" if rng.random() < 0.1 else "done"
    fare = 50 if status == "cancelled" else rng.randint(8, 60) * 10
    tip = "NULL" if rng.random() < 0.6 else str(rng.choice([10, 20, 30, 50]))
    rows.append(f"({i}, '{rng.choice(names)}', '{day} {hh:02d}:{mm:02d}', {fare}, {tip}, '{status}')")
for i in range(0, len(rows), 250):
    print("INSERT INTO trips VALUES\n" + ",\n".join(rows[i:i + 250]) + ";")
