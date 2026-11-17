import sys

# Wrong: correct answers, but O(n) work per question, O(n * q) in all.
data = sys.stdin.buffer.read().split()
n, q = int(data[0]), int(data[1])
a = [int(x) for x in data[2:2 + n]]
pos = 2 + n
out = []
for k in range(q):
    l, r = int(data[pos + 2 * k]), int(data[pos + 2 * k + 1])
    total = 0
    for i in range(l - 1, r):
        total += a[i]
    out.append(total)
sys.stdout.write("\n".join(map(str, out)) + "\n")
