/** Questions and answers the screenshots are taken over: a coding round and an aptitude paper. */

export const CODE_QUESTION = {
  id: "q4",
  kind: "code",
  stem: "Read n, then n integers on one line. Print the length of the longest run of equal neighbours.",
  maxScore: 10,
  rubric: [],
  language: "python",
  languages: ["python", "cpp", "java", "javascript", "c"],
  tests: [
    { id: "s1", input: "6\n1 1 2 2 2 3\n", expected: "3\n", hidden: false, weight: 1 },
    { id: "s2", input: "4\n5 6 7 8\n", expected: "1\n", hidden: false, weight: 1 },
    { id: "h1", input: "1\n9\n", expected: "1\n", hidden: true, weight: 2 },
    { id: "h2", input: "8\n4 4 4 4 1 4 4 4\n", expected: "4\n", hidden: true, weight: 2 },
  ],
  limits: { timeMs: 2000 },
} as const;

/** A clear, correct answer. */
export const RUN_ORIGINAL = `n = int(input())
values = list(map(int, input().split()))

best = current = 1
for i in range(1, n):
    if values[i] == values[i - 1]:
        current += 1
        best = max(best, current)
    else:
        current = 1

print(best)
`;

/** The same program with every name changed and comments added: what copying looks like. */
export const RUN_COPIED = `# read the input
size = int(input())
arr = list(map(int, input().split()))

# track the streak
ans = cnt = 1
for k in range(1, size):
    if arr[k] == arr[k - 1]:
        cnt += 1
        ans = max(ans, cnt)
    else:
        cnt = 1

print(ans)
`;

/** A different, correct approach. */
export const RUN_GROUPBY = `from itertools import groupby

input()
nums = input().split()
print(max(len(list(group)) for _, group in groupby(nums)))
`;

/** Another honest approach. */
export const RUN_WHILE = `n = int(input())
a = input().split()
i, longest = 0, 0
while i < n:
    j = i
    while j + 1 < n and a[j + 1] == a[i]:
        j += 1
    longest = max(longest, j - i + 1)
    i = j + 1
print(longest)
`;

/** Wrong on runs at the very end. */
export const RUN_OFF_BY_ONE = `n = int(input())
v = input().split()
best = 1
run = 1
for i in range(1, n - 1):
    run = run + 1 if v[i] == v[i - 1] else 1
    best = max(best, run)
print(best)
`;

export const codeAnswer = (source: string, language = "python") => JSON.stringify({ language, source });

const MONSOON = {
  id: "monsoon",
  title: "The monsoon",
  text: "The south-west monsoon usually reaches Kerala in the first week of June, and covers the whole country by the middle of July.\nIt brings about three-quarters of India's annual rainfall, and a late or weak monsoon is felt in food prices within months.",
};

/** An aptitude paper: a chart to read, a figure series, several right options, negative marking, and a passage. */
export function aptitudePaper(chart: string, series: string) {
  return [
    {
      id: "di1",
      kind: "numeric",
      stem: "By what percentage did units sold rise from February to April?",
      maxScore: 2,
      rubric: [],
      expected: 100,
      tolerance: 0,
      negativeMarks: 0.5,
      images: [{ media: chart, alt: "Bar chart of units sold: January 120, February 90, March 150, April 180, May 110, June 160" }],
    },
    {
      id: "fs1",
      kind: "mcq",
      stem: "How many dots will the next square in the series have?",
      maxScore: 2,
      rubric: [],
      options: ["4", "5", "6", "8"],
      correctIndex: 1,
      negativeMarks: 0.5,
      images: [{ media: series, alt: "Four squares with one, two, three and four dots, then a question mark" }],
    },
    {
      id: "pr1",
      kind: "mcq",
      stem: "Which of these numbers are prime?",
      maxScore: 4,
      rubric: [],
      options: ["21", "23", "27", "29"],
      correctIndex: 1,
      correctIndices: [1, 3],
      partialCredit: true,
      negativeMarks: 1,
    },
    { id: "rc1", kind: "mcq", stem: "When does the monsoon usually reach Kerala?", maxScore: 1, rubric: [], options: ["Early May", "First week of June", "Mid-July"], correctIndex: 1, passage: MONSOON },
    {
      id: "rc2",
      kind: "mcq",
      stem: "According to the passage, a weak monsoon shows up first in…",
      maxScore: 1,
      rubric: [],
      options: ["Food prices", "Interest rates", "Exports"],
      correctIndex: 0,
      passage: MONSOON,
    },
  ];
}

/** A LeetCode-style question: the candidate writes a function; Parikshaa calls it. */
export const MERGE_INTERVALS = {
  id: "merge",
  kind: "code",
  stem: [
    "Given an array of `intervals` where `intervals[i] = [start, end]`, merge all overlapping intervals, and return the intervals that cover every one of them.",
    "",
    "Two intervals overlap when one starts at or before the other ends.",
  ].join("\n"),
  maxScore: 10,
  rubric: [],
  language: "python",
  languages: ["python", "java", "cpp", "c", "javascript"],
  signature: { name: "merge", params: [{ name: "intervals", type: "int[][]" }], returns: "int[][]", anyOrder: "top" },
  constraints: ["- `1 <= intervals.length <= 10^4`", "- `intervals[i].length == 2`", "- `0 <= start <= end <= 10^4`"].join("\n"),
  outputFormat: "The merged intervals, in any order.",
  tests: [
    { id: "s1", input: "[[1,3],[2,6],[8,10],[15,18]]", expected: "[[1,6],[8,10],[15,18]]", hidden: false, weight: 1, explanation: "`[1,3]` and `[2,6]` overlap, so they merge into `[1,6]`." },
    { id: "s2", input: "[[1,4],[4,5]]", expected: "[[1,5]]", hidden: false, weight: 1, explanation: "`[1,4]` and `[4,5]` touch at 4, which counts as overlapping." },
    { id: "h1", input: "[[5,7],[1,2],[3,4]]", expected: "[[1,2],[3,4],[5,7]]", hidden: true, weight: 2 },
    { id: "h2", input: "[[1,10],[2,3],[4,5],[6,7]]", expected: "[[1,10]]", hidden: true, weight: 2 },
    { id: "h3", input: "[[0,0]]", expected: "[[0,0]]", hidden: true, weight: 1 },
  ],
  limits: { timeMs: 2000 },
} as const;

/** A right answer, as a candidate would write it on LeetCode. */
export const MERGE_SOLUTION = `class Solution:
    def merge(self, intervals: List[List[int]]) -> List[List[int]]:
        intervals.sort(key=lambda it: it[0])
        merged = []
        for start, end in intervals:
            if merged and start <= merged[-1][1]:
                merged[-1][1] = max(merged[-1][1], end)
            else:
                merged.append([start, end])
        return merged
`;

/** Forgets to sort: right on the examples, wrong on a hidden test that comes out of order. */
export const MERGE_UNSORTED = MERGE_SOLUTION.replace("        intervals.sort(key=lambda it: it[0])\n", "");

const mcq = (id: string, stem: string, options: readonly string[], correctIndex: number, extra: Record<string, unknown> = {}) => ({
  id,
  kind: "mcq",
  stem,
  maxScore: 4,
  negativeMarks: 1,
  rubric: [],
  options,
  correctIndex,
  ...extra,
});

/** A campus drive's aptitude round, so the palette looks like a real sitting's. */
export const PRACTICE_SET = [
  mcq("p1", "A shopkeeper marks an article 25% above cost and allows a 10% discount, earning ₹150. What is the cost price?", ["₹1,200", "₹1,500", "₹1,800", "₹2,000"], 1),
  mcq("p2", "In how many ways can a committee of 2 be chosen from 6 people?", ["12", "15", "30", "36"], 1),
  mcq("p3", "Pointing to a photograph, Ravi says, “Her mother is the only daughter of my mother.” How is Ravi related to the girl?", ["Father", "Brother", "Uncle", "Cousin"], 2),
  mcq("p4", "If CODE is written as DPEF, how is BASE written?", ["CBTF", "CATF", "DBTF", "CBSF"], 0),
  mcq("p5", "The average of five consecutive odd numbers is 27. What is the largest of them?", ["29", "31", "33", "35"], 1),
  mcq("p6", "A train 240 m long passes a pole in 12 seconds. How long will it take to pass a platform 360 m long?", ["24 s", "30 s", "36 s", "40 s"], 1),
  mcq("p7", "Which of these numbers are divisible by 11?", ["121", "253", "341", "506"], 0, { correctIndices: [0, 1, 3], partialCredit: true }),
  mcq("p8", "Choose the word most nearly opposite in meaning to “frugal”.", ["Thrifty", "Extravagant", "Careful", "Modest"], 1),
  mcq("p9", "A can finish a work in 12 days and B in 18 days. Working together, in how many days will they finish it?", ["6.4", "7.2", "8", "9"], 1),
  mcq("p10", "Find the odd one out.", ["Mercury", "Venus", "Moon", "Mars"], 2),
  mcq("p11", "Simple interest on ₹8,000 at 6% per annum for 3 years is:", ["₹1,240", "₹1,440", "₹1,540", "₹1,640"], 1),
  mcq("p12", "Which data structure gives O(1) average-time lookup by key?", ["Linked list", "Binary heap", "Hash table", "Sorted array"], 2),
  mcq("p13", "Complete the series: 2, 6, 12, 20, 30, ?", ["40", "42", "44", "48"], 1),
  mcq("p14", "If today is Wednesday, what day will it be 100 days from now?", ["Thursday", "Friday", "Saturday", "Sunday"], 1),
  mcq("p15", "The ratio of boys to girls in a class is 3 : 2. If there are 18 boys, how many students are there?", ["27", "30", "32", "36"], 1),
  mcq("p16", "Which SQL clause filters groups after aggregation?", ["WHERE", "GROUP BY", "HAVING", "ORDER BY"], 2),
  mcq("p17", "A clock shows 3:15. What is the angle between the hour and minute hands?", ["0°", "7.5°", "15°", "22.5°"], 1),
];
