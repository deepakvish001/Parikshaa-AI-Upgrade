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
 */

export const LANGUAGES = ["python", "javascript", "c", "cpp", "java"] as const;
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
};
