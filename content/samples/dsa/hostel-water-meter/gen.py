# Args: seed n q maxv [mode]. Prints one test. Modes: random (default), full (every query is 1..n),
# single (every query is one day), zeros (every day 0), max (every day maxv, every query 1..n).
import random
import sys

args = sys.stdin.readline().split()
seed, n, q, maxv = map(int, args[:4])
mode = args[4] if len(args) > 4 else "random"
rng = random.Random(seed)
if mode == "zeros":
    a = [0] * n
elif mode == "max":
    a = [maxv] * n
else:
    a = [rng.randint(0, maxv) for _ in range(n)]
lines = [f"{n} {q}", " ".join(map(str, a))]
for _ in range(q):
    if mode in ("full", "max"):
        l, r = 1, n
    elif mode == "single":
        l = r = rng.randint(1, n)
    else:
        l = rng.randint(1, n)
        r = rng.randint(l, n)
    lines.append(f"{l} {r}")
print("\n".join(lines))
