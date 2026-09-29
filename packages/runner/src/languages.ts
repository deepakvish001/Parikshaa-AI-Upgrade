/**
 * The languages candidates may write in, and how each is built and run.
 *
 * Chosen for campus hiring in India, where C++, Java and Python cover almost
 * every candidate; C and JavaScript cover most of the rest.
 *
 * Memory is capped differently per language, because it has to be. C, C++ and
 * Python run under a hard address-space limit. Node and the JVM reserve large
 * virtual ranges at start-up and cannot run under one at all, so they are
 * capped by their own heap flags instead — and, for every language, by the
 * cgroup limit on the runner's container, which is the backstop.
 *
 * SQL runs on SQLite, through the Python the runner already has: a test's input
 * is the SQL that makes and fills its tables, the answer is a query, and the
 * output is the query's rows. No new program is needed in the image.
 */

export const LANGUAGES = ["python", "javascript", "c", "cpp", "java", "sql"] as const;
export type Language = (typeof LANGUAGES)[number];

export const isLanguage = (value: string): value is Language => (LANGUAGES as readonly string[]).includes(value);

export interface LanguageSpec {
  /** What the source file must be called. */
  readonly file: string;
  /** Build step, if any. Runs with generous but finite limits. */
  readonly compile?: readonly string[];
  /** The command for one test run, given the memory cap in megabytes. */
  readonly run: (memoryMb: number) => readonly string[];
  /** Whether a hard address-space limit can be applied to the run. */
  readonly addressSpaceLimit: boolean;
}

/**
 * Runs an SQL answer: the test's input (the tables) from stdin into a database
 * in memory, then each statement of main.sql. The rows of the last statement
 * that returns any are printed one to a line, columns separated by a tab, NULL
 * as NULL. Once the tables are made, the answer may not ATTACH a file.
 */
export const SQL_DRIVER = `import sqlite3, sys
setup = sys.stdin.read()
with open("main.sql", encoding="utf-8") as f:
    source = f.read()
db = sqlite3.connect(":memory:", isolation_level=None)
try:
    db.executescript(setup)
except sqlite3.Error as e:
    print("The test's tables could not be made: " + str(e), file=sys.stderr)
    sys.exit(2)
denied = {sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH}
db.set_authorizer(lambda action, *rest: sqlite3.SQLITE_DENY if action in denied else sqlite3.SQLITE_OK)
statements, pending = [], ""
for line in source.splitlines(keepends=True):
    pending += line
    if sqlite3.complete_statement(pending):
        statements.append(pending)
        pending = ""
if pending.strip():
    statements.append(pending)
rows = []
try:
    for statement in statements:
        cursor = db.execute(statement)
        if cursor.description is not None:
            rows = cursor.fetchall()
except (sqlite3.Error, sqlite3.Warning) as e:
    print("Error: " + str(e), file=sys.stderr)
    sys.exit(1)
show = lambda v: "NULL" if v is None else v.hex() if isinstance(v, bytes) else str(v)
sys.stdout.write("".join("\\t".join(show(v) for v in row) + "\\n" for row in rows))
`;

export const SPECS: Readonly<Record<Language, LanguageSpec>> = {
  python: {
    file: "main.py",
    // -I: isolated mode — ignores PYTHON* environment variables and the user
    // site directory. -B: writes no bytecode.
    run: () => ["python3", "-I", "-B", "main.py"],
    addressSpaceLimit: true,
  },
  javascript: {
    file: "main.js",
    run: (memoryMb) => ["node", `--max-old-space-size=${memoryMb}`, "main.js"],
    addressSpaceLimit: false,
  },
  c: {
    file: "main.c",
    compile: ["gcc", "-O2", "-std=c17", "-o", "main", "main.c", "-lm"],
    run: () => ["./main"],
    addressSpaceLimit: true,
  },
  cpp: {
    file: "main.cpp",
    compile: ["g++", "-O2", "-std=c++17", "-o", "main", "main.cpp"],
    run: () => ["./main"],
    addressSpaceLimit: true,
  },
  java: {
    file: "Main.java",
    compile: ["javac", "-J-Xmx512m", "-encoding", "UTF-8", "Main.java"],
    run: (memoryMb) => ["java", `-Xmx${memoryMb}m`, "-Xss64m", "-XX:+UseSerialGC", "-XX:TieredStopAtLevel=1", "-cp", ".", "Main"],
    addressSpaceLimit: false,
  },
  sql: {
    file: "main.sql",
    run: () => ["python3", "-I", "-B", "-c", SQL_DRIVER],
    addressSpaceLimit: true,
  },
};
