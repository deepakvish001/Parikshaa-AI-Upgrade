# Args: seed members. Prints INSERTs: a forest where most members pick a mentor among the last 40 who joined.
import random
import sys

seed, n = map(int, sys.stdin.readline().split())
rng = random.Random(seed)
first = ["Anvi", "Bharat", "Chhavi", "Dinesh", "Eela", "Faraz", "Gargi", "Hiten", "Ishita", "Jairaj", "Kirti", "Lohit"]
ids = rng.sample(range(1, 10 * n), n)
rows = []
for k, mid in enumerate(ids):
    if k == 0 or rng.random() < 0.08:
        mentor = "NULL"
    else:
        mentor = str(ids[rng.randint(max(0, k - 40), k - 1)])
    rows.append(f"({mid}, '{rng.choice(first)}', {mentor}, '2026-{rng.randint(1, 11):02d}-{rng.randint(1, 28):02d}')")
for i in range(0, len(rows), 250):
    print("INSERT INTO members VALUES\n" + ",\n".join(rows[i:i + 250]) + ";")
