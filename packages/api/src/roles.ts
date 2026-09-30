/**
 * The role library (docs/PREP-TRACKER.md, V2-12 CO7): the tests Indian
 * recruiters send most often, each as sections of the question bank to draw
 * from. A section is matched to bank questions by its keywords, against each
 * question's topic and tags, so a bank filed "Quantitative aptitude" or tagged
 * "percentages" both feed the aptitude section. Counts and times follow what
 * the usual online assessments for the role ask.
 */

export type Seniority = "fresher" | "junior" | "mid" | "senior";
export type Kind = "mcq" | "numeric" | "short" | "code";

export interface RoleSection {
  readonly id: string;
  readonly title: string;
  /** Lower-case words matched inside a question's topic or tags. */
  readonly keywords: readonly string[];
  readonly kinds: readonly Kind[];
  /** Questions each candidate gets. */
  readonly count: number;
}

export interface Role {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly sections: readonly RoleSection[];
  /** Qualifying mark, percent of the paper. */
  readonly cutoffPercent: number;
}

const OBJECTIVE: readonly Kind[] = ["mcq", "numeric"];

const APTITUDE = (count: number): RoleSection => ({
  id: "aptitude",
  title: "Quantitative aptitude",
  keywords: ["aptitude", "quant", "arithmetic", "percentage", "profit", "ratio", "time and work", "speed", "interest", "probability", "number system", "averages", "permutation"],
  kinds: OBJECTIVE,
  count,
});
const REASONING = (count: number): RoleSection => ({
  id: "reasoning",
  title: "Logical reasoning",
  keywords: ["reasoning", "logical", "puzzle", "series", "seating", "blood relation", "coding-decoding", "syllogism", "direction", "data interpretation"],
  kinds: OBJECTIVE,
  count,
});
const VERBAL = (count: number): RoleSection => ({
  id: "verbal",
  title: "Verbal ability",
  keywords: ["verbal", "english", "grammar", "reading comprehension", "comprehension", "vocabulary", "sentence", "synonym", "antonym"],
  kinds: OBJECTIVE,
  count,
});
const CODING = (count: number): RoleSection => ({
  id: "coding",
  title: "Coding",
  keywords: ["dsa", "array", "string", "linked list", "tree", "graph", "dynamic programming", "sorting", "searching", "hashing", "recursion", "stack", "queue", "greedy", "coding", "programming"],
  kinds: ["code"],
  count,
});
const SQL = (count: number): RoleSection => ({
  id: "sql",
  title: "SQL and databases",
  keywords: ["sql", "dbms", "database", "join", "normalization", "normalisation", "query", "index", "transaction"],
  kinds: OBJECTIVE,
  count,
});
const CS_CORE = (count: number): RoleSection => ({
  id: "cs",
  title: "CS fundamentals",
  keywords: ["operating system", "os", "computer network", "networks", "cn", "oop", "object oriented", "dbms", "computer science"],
  kinds: OBJECTIVE,
  count,
});

export const ROLES: readonly Role[] = [
  {
    id: "fresher-aptitude",
    title: "Fresher aptitude (mass hiring)",
    summary: "The first round of a service-company drive: aptitude, reasoning and English.",
    sections: [APTITUDE(20), REASONING(15), VERBAL(15)],
    cutoffPercent: 60,
  },
  {
    id: "java-developer",
    title: "Java developer",
    summary: "Java and object-oriented design, databases, and two coding problems.",
    sections: [
      { id: "java", title: "Java and OOP", keywords: ["java", "oop", "object oriented", "collections", "exception", "jvm", "multithreading", "spring"], kinds: OBJECTIVE, count: 12 },
      SQL(6),
      APTITUDE(8),
      CODING(2),
    ],
    cutoffPercent: 60,
  },
  {
    id: "python-developer",
    title: "Python developer",
    summary: "Python, databases, and two coding problems.",
    sections: [
      { id: "python", title: "Python", keywords: ["python", "django", "flask", "pandas", "list comprehension", "decorator", "generator"], kinds: OBJECTIVE, count: 12 },
      SQL(6),
      APTITUDE(8),
      CODING(2),
    ],
    cutoffPercent: 60,
  },
  {
    id: "frontend-developer",
    title: "Frontend developer",
    summary: "HTML, CSS, JavaScript and React, with one coding problem.",
    sections: [
      { id: "web", title: "HTML, CSS and JavaScript", keywords: ["javascript", "js", "html", "css", "react", "dom", "web", "typescript", "frontend", "browser"], kinds: OBJECTIVE, count: 15 },
      APTITUDE(8),
      CODING(1),
    ],
    cutoffPercent: 60,
  },
  {
    id: "data-analyst",
    title: "Data analyst",
    summary: "SQL, statistics and data interpretation.",
    sections: [
      SQL(12),
      { id: "stats", title: "Statistics and data", keywords: ["statistics", "probability", "excel", "data interpretation", "mean", "regression", "data", "analytics"], kinds: OBJECTIVE, count: 10 },
      APTITUDE(8),
    ],
    cutoffPercent: 60,
  },
  {
    id: "qa-engineer",
    title: "QA / test engineer",
    summary: "Testing concepts and automation, programming basics, SQL.",
    sections: [
      { id: "testing", title: "Software testing", keywords: ["testing", "qa", "selenium", "test case", "sdlc", "stlc", "automation", "bug", "regression testing"], kinds: OBJECTIVE, count: 15 },
      SQL(5),
      APTITUDE(8),
      CODING(1),
    ],
    cutoffPercent: 60,
  },
  {
    id: "devops-engineer",
    title: "DevOps / cloud engineer",
    summary: "Linux, networking, containers and cloud.",
    sections: [
      { id: "linux", title: "Linux and scripting", keywords: ["linux", "shell", "bash", "unix", "scripting"], kinds: OBJECTIVE, count: 8 },
      { id: "network", title: "Networking", keywords: ["network", "tcp", "dns", "http", "computer network", "cn"], kinds: OBJECTIVE, count: 6 },
      { id: "cloud", title: "Containers, CI/CD and cloud", keywords: ["docker", "kubernetes", "ci/cd", "ci", "aws", "azure", "gcp", "cloud", "git", "devops", "terraform"], kinds: OBJECTIVE, count: 10 },
      APTITUDE(6),
    ],
    cutoffPercent: 60,
  },
  {
    id: "support-bpo",
    title: "Customer support / BPO",
    summary: "English, reasoning, and written replies to customers.",
    sections: [
      VERBAL(20),
      REASONING(10),
      { id: "writing", title: "Written replies", keywords: ["customer", "support", "email writing", "communication", "writing", "situation"], kinds: ["short"], count: 2 },
    ],
    cutoffPercent: 55,
  },
  {
    id: "campus-software",
    title: "Campus software engineer",
    summary: "The usual product-company campus test: aptitude, CS fundamentals and coding.",
    sections: [APTITUDE(10), CS_CORE(10), CODING(2)],
    cutoffPercent: 60,
  },
];

/** Minutes a candidate needs for one question of each kind, as the usual assessments allow. */
export const MINUTES: Readonly<Record<Kind, number>> = { mcq: 1.2, numeric: 1.5, short: 6, code: 25 };

/** Which difficulties to prefer, most wanted first, for how senior the role is. */
export const DIFFICULTY_ORDER: Readonly<Record<Seniority, readonly ("easy" | "medium" | "hard")[]>> = {
  fresher: ["medium", "easy", "hard"],
  junior: ["medium", "hard", "easy"],
  mid: ["hard", "medium", "easy"],
  senior: ["hard", "medium", "easy"],
};

export const roleById = (id: string): Role | undefined => ROLES.find((r) => r.id === id);
