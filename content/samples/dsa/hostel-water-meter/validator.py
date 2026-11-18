import sys


def fail(message):
    print(message, file=sys.stderr)
    sys.exit(1)


data = sys.stdin.read().split()
if len(data) < 2:
    fail("missing n and q")
n, q = int(data[0]), int(data[1])
if not 1 <= n <= 50000:
    fail(f"n = {n} is outside 1..50000")
if not 1 <= q <= 30000:
    fail(f"q = {q} is outside 1..30000")
if len(data) != 2 + n + 2 * q:
    fail(f"expected {2 + n + 2 * q} numbers, got {len(data)}")
for i in range(n):
    v = int(data[2 + i])
    if not 0 <= v <= 10**6:
        fail(f"a_{i + 1} = {v} is outside 0..10^6")
for k in range(q):
    l, r = int(data[2 + n + 2 * k]), int(data[3 + n + 2 * k])
    if not 1 <= l <= r <= n:
        fail(f"query {k + 1}: ({l}, {r}) does not satisfy 1 <= l <= r <= n")
