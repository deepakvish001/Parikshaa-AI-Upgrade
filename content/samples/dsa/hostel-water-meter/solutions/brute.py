import sys

# Adds each range directly. Correct, O(n) per question: only for small tests.
data = sys.stdin.read().split()
n, q = int(data[0]), int(data[1])
a = [int(x) for x in data[2:2 + n]]
pos = 2 + n
out = []
for k in range(q):
    l, r = int(data[pos + 2 * k]), int(data[pos + 2 * k + 1])
    out.append(sum(a[l - 1:r]))
print("\n".join(map(str, out)))
