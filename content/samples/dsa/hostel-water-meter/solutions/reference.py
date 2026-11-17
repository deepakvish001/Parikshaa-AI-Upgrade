import sys


def range_totals(litres, queries):
    # prefix[i] = litres used on days 1..i, so a range is one subtraction.
    prefix = [0] * (len(litres) + 1)
    for i, x in enumerate(litres):
        prefix[i + 1] = prefix[i] + x
    return [prefix[r] - prefix[l - 1] for l, r in queries]


def main():
    data = sys.stdin.buffer.read().split()
    n, q = int(data[0]), int(data[1])
    litres = [int(x) for x in data[2:2 + n]]
    pos = 2 + n
    queries = [(int(data[pos + 2 * k]), int(data[pos + 2 * k + 1])) for k in range(q)]
    sys.stdout.write("\n".join(map(str, range_totals(litres, queries))) + "\n")


main()
