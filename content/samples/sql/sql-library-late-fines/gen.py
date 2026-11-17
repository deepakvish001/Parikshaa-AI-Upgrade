# Args: seed members loans. Prints INSERTs: loans issued from August to mid November 2026.
import datetime
import random
import sys

seed, members, n = map(int, sys.stdin.readline().split())
rng = random.Random(seed)
first = ["Kiran", "Meher", "Nikhil", "Oviya", "Pranav", "Rhea", "Sahil", "Tanvi", "Uday", "Vani"]
people = [f"{rng.choice(first)} {chr(65 + k % 26)}{k}" for k in range(members)]
start = datetime.date(2026, 8, 1)
asof = datetime.date(2026, 11, 17)
rows = []
for i in range(1, n + 1):
    issued = start + datetime.timedelta(days=rng.randint(0, 105))
    due = issued + datetime.timedelta(days=14)
    r = rng.random()
    if r < 0.25:
        back = "NULL"
    else:
        ret = issued + datetime.timedelta(days=rng.randint(1, 30))
        back = "NULL" if ret > asof else f"'{ret.isoformat()}'"
    rows.append(f"({i}, '{rng.choice(people)}', 'Book {rng.randint(1, 500)}', '{issued}', '{due}', {back})")
for i in range(0, len(rows), 250):
    print("INSERT INTO loans VALUES\n" + ",\n".join(rows[i:i + 250]) + ";")
