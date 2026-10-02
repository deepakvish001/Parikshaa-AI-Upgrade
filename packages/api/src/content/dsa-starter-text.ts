/**
 * The words of the DSA starter written for it: each problem's first hint (an
 * observation, never the algorithm, shown free by Sahayak as rung 1) and its
 * brute-force approach (the editorial's first tab). The statements, the
 * optimal approach and the reference programs are the Sahayak eval's own
 * problems, also written for Parikshaa; `dsa-starter.ts` brings them together.
 */
export const DSA_TEXT: Readonly<Record<string, { readonly hint: string; readonly brute: string }>> = {
  "range-sum-queries": {
    hint: "The takings never change between questions. Is there something you could work out once, before any question, that makes every question quick?",
    brute: "For each question, add the takings from day `l` to day `r` one by one. That is O(n) per question and O(n·q) in all.",
  },
  "best-streak-sum": {
    hint: "Think about the best run that *ends* on a given day. How does it relate to the best run that ends on the day before?",
    brute: "Try every start day, and from it extend the run one day at a time, keeping the best total seen. O(n²).",
  },
  "pairs-with-target-sum": {
    hint: "When you reach a number `x`, the only earlier numbers that pair with it are equal to `T − x`. How could you know how many of those you have passed?",
    brute: "Check every pair of positions `i < j` and count those that add up to `T`. O(n²).",
  },
  "count-inversions": {
    hint: "If the left half and the right half of the list were each already sorted, could you count the out-of-order pairs that cross between them quickly?",
    brute: "Compare every pair of positions `i < j` and count those with `ai > aj`. O(n²).",
  },
  "longest-window-under-budget": {
    hint: "Tolls are never negative. If a stretch of stops is over budget, can any longer stretch with the same start be within it?",
    brute: "From every starting stop, keep adding stops while the total stays within `B`, and remember the longest run. O(n²) in the worst case.",
  },
  "closest-pair-gap": {
    hint: "If the numbers were in sorted order, which pairs could possibly be the closest?",
    brute: "Compute the difference of every pair and keep the smallest. O(n²).",
  },
  "subarrays-summing-to-k": {
    hint: "The sum of a stretch is the difference of two prefix sums. For a given end, what must the prefix sum just before the start be?",
    brute: "From every start, extend the stretch one number at a time, keeping its running sum, and count each time it equals `K`. O(n²).",
  },
  "largest-pair-product": {
    hint: "Negative numbers matter here: what happens when you multiply two large negative numbers?",
    brute: "Multiply every pair of numbers and keep the largest product. O(n²).",
  },
  "total-pairwise-distance": {
    hint: "Once the houses are sorted, every house to the left of house `i` is a distance `ai − aj` away. Can you add all of those at once?",
    brute: "Add `|ai − aj|` for every pair of houses. O(n²).",
  },
  "slowest-eating-speed": {
    hint: "If a speed `k` is fast enough, is every speed above `k` fast enough too?",
    brute: "Try `k = 1, 2, 3, …` and for each count the hours needed; stop at the first `k` that fits. O(n · answer).",
  },
  "trapped-rainwater": {
    hint: "Look at a single wall. How high can the water stand above it, given the walls to its left and to its right?",
    brute: "For every wall, scan left and right to find the tallest wall on each side, and add `min(left, right) − hi`. O(n²).",
  },
  "wait-for-warmer": {
    hint: "A day that is still waiting for a warmer day is only ever answered by a later day. Which days are still waiting when a new day arrives, and in what order are they answered?",
    brute: "From every day, scan forward until a warmer day appears and add the gap. O(n²) when the temperature keeps falling.",
  },
  "largest-rectangle-histogram": {
    hint: "Suppose a rectangle's height is exactly the height of one column. How far left and right can it reach?",
    brute: "Try every left edge and every right edge, keeping the lowest column between them, and take the largest area. O(n²).",
  },
  "distinct-in-windows": {
    hint: "Two neighbouring windows share all but two numbers. What changes when the window moves one step?",
    brute: "For each window, put its `k` numbers in a set and add the set's size. O(n·k).",
  },
  "double-trouble-pairs": {
    hint: "If both halves of the list were sorted, could you count the crossing pairs with `ai > 2·aj` without trying them all?",
    brute: "Check every pair of positions `i < j` and count those with `ai > 2·aj`. O(n²).",
  },
  "two-lists-budget": {
    hint: "Both lists are sorted. As the main gets more expensive, what happens to the most expensive dessert you can still afford with it?",
    brute: "Try every main with every dessert and count the pairs within `T`. O(n·m).",
  },
  "union-length": {
    hint: "If the stretches were sorted by where they start, when does a stretch join the one before it, and when does a new piece of road begin?",
    brute: "Cut the road at every endpoint and, for each piece, check every crew to see whether it is under repair. O(n²).",
  },
  "best-k-window": {
    hint: "Two neighbouring windows of `k` days share `k − 1` days. How do you get the next window's total from the current one?",
    brute: "Add up every window of `k` days from scratch and keep the largest. O(n·k).",
  },
  "sum-of-window-minimums": {
    hint: "Turn the question around: for one number, in how many stretches is it the smallest?",
    brute: "From every start, extend the stretch one number at a time, keeping its running minimum, and add it each time. O(n²).",
  },
  "staircase-ways": {
    hint: "The last move to step `i` was a jump of 1 to `k` steps. How do the ways to reach step `i` relate to the ways to reach the steps before it?",
    brute: "For every step, add up the ways of the `k` steps before it one by one. O(n·k).",
  },
  "heaviest-square": {
    hint: "In one dimension, a prefix sum gives any range's total in O(1). What would the same idea look like on a grid?",
    brute: "For every top-left corner, add up the `k × k` cells of the square. O(n·m·k²).",
  },
  "grid-paths-with-blocks": {
    hint: "You can only arrive at a cell from the cell above it or the cell to its left.",
    brute: "Follow every path from the top-left corner recursively, counting those that reach the bottom-right. Exponential in `n + m`.",
  },
  "coin-change-ways": {
    hint: "Order does not matter, so decide the coins one value at a time. How many ways are there to pay `x` with only the values considered so far?",
    brute: "Recursively choose how many coins of each value to use, counting the choices that pay exactly `A`. Exponential.",
  },
  "knapsack-max-value": {
    hint: "Each good is either taken or left. What is the most value you can carry within each capacity from 0 to `W`, using only the goods considered so far?",
    brute: "Try every subset of goods, keep those within `W` kilograms, and take the most valuable. O(2ⁿ).",
  },
  "pairwise-product-sum": {
    hint: "Guest `i` shakes hands with every earlier guest. What does that add up to, in terms of the sum of the earlier guests' values?",
    brute: "Multiply the values of every pair of guests and add the products. O(n²).",
  },
  "frequent-value-score": {
    hint: "A value's score needs only how many times it appears. How can you count every value in one pass?",
    brute: "For each number, scan the whole list again to count its copies, and keep the best value × count. O(n²).",
  },
  "increasing-triplets": {
    hint: "Fix the middle number of the triple. How many triples have it in the middle?",
    brute: "For each middle position, count the smaller numbers to its left and the larger ones to its right by scanning, and multiply. O(n²).",
  },
  "make-equal-cost": {
    hint: "The cost for a target `x` is the sum of `|ai − x|`. As `x` moves up by one, how does that sum change?",
    brute: "Try every shelf's count as the target and add up the cost for each. O(n²).",
  },
  "paint-houses": {
    hint: "To decide the cheapest way to paint up to house `i`, what do you need to know about house `i − 1`? Only its colour.",
    brute: "Try every colouring of the street, skip those where neighbours match, and take the cheapest. O(3ⁿ · n).",
  },
  "cheapest-route": {
    hint: "Tolls are never negative. Of the towns not yet settled, which one's cheapest toll can no longer get cheaper?",
    brute: "Repeatedly scan every town to find the unsettled one with the smallest known toll, then update its neighbours. O(n²).",
  },
  "range-min-sum": {
    hint: "The temperatures never change. The minimum of a stretch is the minimum of any two blocks that together cover it, even if they overlap.",
    brute: "For every question, scan the days from `l` to `r` and take the lowest. O(n·q).",
  },
  "circular-best-streak": {
    hint: "A run that wraps around the end leaves out one run in the middle. What should that left-out run look like for the wrapping run to be best?",
    brute: "From every stall, try every length up to `n` going round the circle, and keep the best total. O(n²).",
  },
  "widest-container": {
    hint: "Start with the two outermost walls. The shorter of them limits the tank. Is any other tank using that shorter wall worth checking?",
    brute: "Try every pair of walls and keep the largest `min(hi, hj) × (j − i)`. O(n²).",
  },
  "nearest-to-zero-pair": {
    hint: "Sort the weights. If the smallest and the largest add up to a negative number, can the smallest one do better with any other partner?",
    brute: "Add every pair of weights and keep the smallest `|ai + aj|`. O(n²).",
  },
  "running-median-sum": {
    hint: "The median splits the amounts into a lower half and an upper half. You only ever need the largest of the lower half and the smallest of the upper half.",
    brute: "After each order, sort all the amounts so far and take the middle one. O(n² log n).",
  },
  "small-product-windows": {
    hint: "Every factor is at least 1, so making a bundle longer never makes it cheaper. For each right end, which left ends work?",
    brute: "From every start, extend the bundle one item at a time while the product stays below `K`, counting each bundle. O(n²) when most bundles qualify.",
  },
  "range-bonus": {
    hint: "An order changes a whole range by the same amount. What if you wrote down only where each order begins and ends?",
    brute: "For every order, add `v` to each worker from `l` to `r`, then take the largest bonus. O(n·q).",
  },
  "house-robber": {
    hint: "At each house the thief either takes it or skips it. If they take it, what must have happened at the house before?",
    brute: "Try every set of houses with no two neighbours and keep the richest. O(2ⁿ · n).",
  },
  "pairs-with-difference": {
    hint: "A pair with difference `K` is a value `v` together with a value `v + K`. Can you count those without looking at pairs at all?",
    brute: "Check every pair of positions and count those with `|ai − aj| = K`. O(n²).",
  },
  "rope-joining": {
    hint: "A rope joined early is paid for again in every later join. Which ropes should be joined first?",
    brute: "Before each join, sort all the ropes again and join the two shortest. O(n² log n).",
  },
};

/**
 * The middle approach, for the problems that have a real one: faster than the
 * brute force, or as fast with less to remember, but not yet the optimal. The
 * editorial shows it as its own tab, between the two. A problem whose brute
 * force leads straight to the optimal has none, rather than an invented one.
 */
export const DSA_BETTER: Readonly<Record<string, { readonly text: string; readonly time: string }>> = {
  "pairs-with-target-sum": {
    text: "Sort the numbers. For each `a[i]`, the partners are the values equal to `T − a[i]` after position `i`; two binary searches (first and last such value) count them.",
    time: "O(n log n)",
  },
  "longest-window-under-budget": {
    text: "Tolls are never negative, so prefix sums only grow. For each start, binary search the prefix sums for the farthest end whose total stays within `B`.",
    time: "O(n log n)",
  },
  "largest-pair-product": {
    text: "Sort. The answer is the larger of the two largest numbers multiplied and the two smallest multiplied. Correct, but the sort does more work than the answer needs.",
    time: "O(n log n)",
  },
  "trapped-rainwater": {
    text: "Precompute, for every wall, the tallest wall to its left (one pass from the left) and to its right (one pass from the right). The water above wall `i` is then `min(left[i], right[i]) − h[i]`. Linear time, but two extra arrays of `n` numbers.",
    time: "O(n), O(n) memory",
  },
  "largest-rectangle-histogram": {
    text: "Divide and conquer at the lowest column: the best rectangle either spans the whole range at that height, or lies wholly to its left or right. Find each range's lowest column with a sparse table built once, and recurse with an explicit stack rather than recursion (sorted heights go 10^5 deep).",
    time: "O(n log n)",
  },
  "two-lists-budget": {
    text: "Both lists are sorted. For each main, binary search the desserts for the last price within `T − main`; every dessert up to it is affordable.",
    time: "O(n log m)",
  },
  "best-k-window": {
    text: "Build prefix sums once; the window ending at day `i` totals `p[i] − p[i−k]`. Linear, but it keeps an array of `n + 1` sums where one running sum would do.",
    time: "O(n), O(n) memory",
  },
  "heaviest-square": {
    text: "Prefix sums along each row: a row's stretch of `k` cells is then one subtraction, so a square is `k` look-ups instead of `k²` additions.",
    time: "O(n·m·k)",
  },
  "coin-change-ways": {
    text: "A table `ways[i][x]`: the ways to pay `x` with the first `i` coin values, either not using value `i` (`ways[i−1][x]`) or using it once more (`ways[i][x − value]`). The same time as the optimal, but `c × A` numbers in memory instead of `A`.",
    time: "O(c·A), O(c·A) memory",
  },
  "knapsack-max-value": {
    text: "A table `best[i][c]`: the most value from the first `i` goods within capacity `c`, either skipping good `i` or taking it once (`best[i−1][c − wi] + vi`). The same time as the optimal, but `n × W` numbers in memory instead of `W`.",
    time: "O(n·W), O(n·W) memory",
  },
  "range-min-sum": {
    text: "A segment tree over the days: each node keeps the minimum of its range, and a query combines O(log n) nodes.",
    time: "O(n + q log n)",
  },
  "running-median-sum": {
    text: "Keep the amounts in a sorted list, inserting each new one at its place found by binary search (Python's `bisect.insort`); the median is the middle element. Finding the place is O(log n), but shifting the list is O(n) per insert.",
    time: "O(n²)",
  },
  "house-robber": {
    text: "`best[i]` is the most from the first `i` houses: `max(best[i−1], best[i−2] + ai)`. Linear, but it keeps an array of `n` totals where two would do.",
    time: "O(n), O(n) memory",
  },
  "pairs-with-difference": {
    text: "Sort. For each value `v`, binary search for the copies of `v + K` (for `K = 0`, count each run of equal values as c(c − 1)/2 instead).",
    time: "O(n log n)",
  },
  "rope-joining": {
    text: "Keep the ropes in a sorted list. Join the first two and insert the joined rope at its place, found by binary search, instead of sorting again. Finding the place is O(log n), but inserting shifts the list: O(n) per join.",
    time: "O(n²)",
  },
  "frequent-value-score": {
    text: "Sort, then walk the runs of equal values: each run's length is the count, and the best value × count is the answer.",
    time: "O(n log n)",
  },
  "paint-houses": {
    text: "A table `cost[i][colour]`: the least cost of painting the first `i` houses with house `i` in that colour, from the cheaper of the other two colours at `i − 1`. Linear, but `3n` totals in memory where three would do.",
    time: "O(n), O(n) memory",
  },
};
