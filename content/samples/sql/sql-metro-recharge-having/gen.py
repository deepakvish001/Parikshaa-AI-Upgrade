# Args: seed cards rows. Prints INSERTs: recharges from late September to early November.
import random
import sys

seed, cards, n = map(int, sys.stdin.readline().split())
rng = random.Random(seed)
stations = ["Rajiv Chowk", "Kashmere Gate", "Hauz Khas", "Dwarka Sec 21", None]
days = [f"2026-09-{d:02d}" for d in range(25, 31)] + [f"2026-10-{d:02d}" for d in range(1, 32)] + [f"2026-11-{d:02d}" for d in range(1, 6)]
rows = []
for i in range(1, n + 1):
    card = f"DM-{1000 + rng.randint(1, cards)}"
    amount = 50 * rng.randint(2, 20)
    status = "ok" if rng.random() < 0.9 else "failed"
    st = rng.choice(stations)
    rows.append(f"({i}, '{card}', {amount}, '{rng.choice(days)}', '{status}', {'NULL' if st is None else repr(st)})")
for i in range(0, len(rows), 250):
    print("INSERT INTO recharges VALUES\n" + ",\n".join(rows[i:i + 250]) + ";")
