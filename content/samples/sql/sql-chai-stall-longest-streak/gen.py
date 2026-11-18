# Args: seed stalls days. Prints INSERTs: daily cups per stall from 2026-08-01, with closed days and lost sheets.
import datetime
import random
import sys

seed, n, days = map(int, sys.stdin.readline().split())
rng = random.Random(seed)
first = datetime.date(2026, 8, 1)
stalls = [f"Stall {k:03d}" for k in range(1, n + 1)]
print("INSERT INTO stalls VALUES\n" + ",\n".join(f"('{s}', 'Owner {k}')" for k, s in enumerate(stalls, 1)) + ";")
rows = []
for s in stalls:
    good_bias = rng.random()
    for d in range(days):
        if rng.random() < 0.1:
            continue
        day = first + datetime.timedelta(days=d)
        cups = "NULL" if rng.random() < 0.03 else str(rng.randint(50, 90) if rng.random() < good_bias else rng.randint(20, 49))
        rows.append(f"('{s}', '{day.isoformat()}', {cups})")
for i in range(0, len(rows), 300):
    print("INSERT INTO sales VALUES\n" + ",\n".join(rows[i:i + 300]) + ";")
