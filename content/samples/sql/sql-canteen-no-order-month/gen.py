# Args: seed students orders. Prints INSERTs for a big canteen month.
import random
import sys

seed, n, m = map(int, sys.stdin.readline().split())
rng = random.Random(seed)
names = ["Aarav", "Bhavna", "Chirag", "Divya", "Eshan", "Farah", "Gopal", "Heena", "Irfan", "Jaya", "Kabir", "Lata"]
hostels = ["Kaveri", "Godavari", "Narmada", "Tapti", None]
items = [("Masala dosa", 60), ("Poha", 30), ("Chai", 10), ("Veg thali", 90), ("Samosa", 15), ("Cold coffee", 45)]
months = ["2025-11", "2026-09", "2026-10", "2026-11", "2026-11", "2026-12"]


def chunks(rows):
    for i in range(0, len(rows), 200):
        yield ",\n".join(rows[i:i + 200])


students = []
for i in range(1, n + 1):
    h = rng.choice(hostels)
    students.append(f"({i}, '{rng.choice(names)}', {'NULL' if h is None else repr(h)})")
for part in chunks(students):
    print(f"INSERT INTO students VALUES\n{part};")

orders = []
for j in range(1, m + 1):
    who = "NULL" if rng.random() < 0.05 else str(rng.randint(1, n))
    item, price = rng.choice(items)
    day = f"{rng.choice(months)}-{rng.randint(1, 30):02d}"
    orders.append(f"({1000 + j}, {who}, '{item}', {price}, '{day}')")
for part in chunks(orders):
    print(f"INSERT INTO orders VALUES\n{part};")
