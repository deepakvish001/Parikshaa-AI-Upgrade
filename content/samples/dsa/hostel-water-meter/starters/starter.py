import sys


def range_totals(litres, queries):
    # litres[i] is day i + 1; each query is (l, r), 1-indexed and inclusive.
    # Return one total per query, in order.
    # TODO: your code here
    return [0 for _ in queries]


def main():
    data = sys.stdin.buffer.read().split()
    n, q = int(data[0]), int(data[1])
    litres = [int(x) for x in data[2:2 + n]]
    pos = 2 + n
    queries = [(int(data[pos + 2 * k]), int(data[pos + 2 * k + 1])) for k in range(q)]
    sys.stdout.write("\n".join(map(str, range_totals(litres, queries))) + "\n")


main()
