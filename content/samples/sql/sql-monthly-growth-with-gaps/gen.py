# Args: seed jobs. Prints INSERTs: two years of print jobs; June of each year has none (vacation).
import random
import sys

seed, n = map(int, sys.stdin.readline().split())
rng = random.Random(seed)
students = ["Asha", "Bunty", "Chetna", "Dhaval", "Ekta", None]
rows = []
for i in range(1, n + 1):
    while True:
        y = rng.choice([2025, 2026])
        mth = rng.randint(1, 12)
        if mth != 6:
            break
    day = rng.randint(1, 28)
    pages = rng.randint(1, 300)
    rate = rng.choice([1, 2, 2, 5])
    st = rng.choice(students)
    rows.append(f"({i}, '{y}-{mth:02d}-{day:02d}', {pages}, {rate}, {'NULL' if st is None else repr(st)})")
for i in range(0, len(rows), 250):
    print("INSERT INTO prints VALUES\n" + ",\n".join(rows[i:i + 250]) + ";")
