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
