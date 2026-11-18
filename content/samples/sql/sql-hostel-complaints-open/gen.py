# Args: seed complaints updates. Prints INSERTs; update times repeat on purpose, and some updates are entered late.
import random
import sys

seed, n, m = map(int, sys.stdin.readline().split())
rng = random.Random(seed)
cats = ["water", "electrical", "wifi", "furniture", "cleaning"]
print("INSERT INTO complaints VALUES\n" + ",\n".join(
    f"({i}, {rng.randint(100, 420)}, '{rng.choice(cats)}', '2026-11-{rng.randint(1, 15):02d}')" for i in range(1, n + 1)) + ";")
statuses = ["assigned", "in-progress", "resolved", "reopened"]
rows = []
for j in range(1, m + 1):
    cid = rng.randint(1, n)
    at = f"2026-11-{rng.randint(1, 17):02d} {rng.choice([9, 12, 18]):02d}:{rng.choice([0, 30]):02d}"
    rows.append(f"({j}, {cid}, '{rng.choice(statuses)}', '{at}')")
for i in range(0, len(rows), 250):
    print("INSERT INTO updates VALUES\n" + ",\n".join(rows[i:i + 250]) + ";")
