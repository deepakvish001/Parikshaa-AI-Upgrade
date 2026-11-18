# Args: seed students. Prints INSERTs: a placement test across five branches, scores bunched so ties are common.
import random
import sys

seed, n = map(int, sys.stdin.readline().split())
rng = random.Random(seed)
branches = ["CSE", "ECE", "EEE", "ME", "CE"]
first = ["Aman", "Bela", "Charan", "Dia", "Ehsan", "Firoz", "Gita", "Harsh", "Ira", "Jatin", "Komal", "Lalit"]
rows = []
for i in range(1, n + 1):
    b = rng.choice(branches)
    score = "NULL" if rng.random() < 0.07 else str(rng.randint(55, 100))
    rows.append(f"('{b}{i:04d}', '{rng.choice(first)}', '{b}', {score})")
for i in range(0, len(rows), 250):
    print("INSERT INTO scores VALUES\n" + ",\n".join(rows[i:i + 250]) + ";")
