# Args: seed rooms allotments. Prints INSERTs for a big hostel.
import random
import sys

seed, n, m = map(int, sys.stdin.readline().split())
rng = random.Random(seed)
names = ["Aditi", "Bina", "Charu", "Deepa", "Esha", "Fiza", "Gauri", "Hema", "Isha", "Jyoti", "Kavya", "Leela"]
rooms = []
for i in range(n):
    block = "ABCDE"[i % 5]
    rooms.append((100 + i, block, rng.choice([1, 2, 3, 4])))
print("INSERT INTO rooms VALUES\n" + ",\n".join(f"({r}, '{b}', {c})" for r, b, c in rooms) + ";")
rows = []
for j in range(1, m + 1):
    room = rng.choice(rooms)[0]
    left = "NULL" if rng.random() < 0.6 else f"'2026-{rng.randint(1, 10):02d}-{rng.randint(1, 28):02d}'"
    rows.append(f"({j}, {room}, '{rng.choice(names)}', {left})")
for i in range(0, len(rows), 250):
    print("INSERT INTO allotments VALUES\n" + ",\n".join(rows[i:i + 250]) + ";")
