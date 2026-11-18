/**
 * Starter content a practice site may take in at once (ROADMAP §16), so a new
 * site does not open empty: CS fundamentals as lessons and questions, and SQL
 * problems that run.
 */

export type PackDifficulty = "easy" | "medium" | "hard";

export interface CsPack {
  /** Where it was taken from. */
  readonly source: string;
  readonly subjects: readonly {
    readonly id: string;
    readonly name: string;
    readonly topics: readonly {
      readonly id: string;
      readonly name: string;
      readonly questions: readonly {
        readonly title: string;
        readonly text: string;
        readonly difficulty: PackDifficulty;
        /** Markdown. */
        readonly answer: string;
        readonly options: readonly string[];
        readonly correct: number;
      }[];
    }[];
  }[];
}

export interface SqlPack {
  readonly problems: readonly {
    readonly slug: string;
    readonly title: string;
    readonly difficulty: PackDifficulty;
    readonly tags: readonly string[];
    /** Markdown. */
    readonly stem: string;
    /** Each test's input makes and fills the tables; its expected output is the reference query's rows. */
    readonly tests: readonly { readonly id: string; readonly input: string; readonly expected: string; readonly hidden: boolean; readonly weight: number }[];
    /** Rows must come in order; otherwise any order is right. */
    readonly ordered: boolean;
    /** A right answer, kept for the pack's own test. */
    readonly reference: string;
    /** Markdown, one `##` heading per approach. */
    readonly editorial: string;
  }[];
}

/** Data-structures-and-algorithms problems that read standard input, made from the Sahayak eval's own (written for Parikshaa). */
export interface DsaPack {
  readonly problems: readonly {
    readonly slug: string;
    readonly title: string;
    readonly difficulty: PackDifficulty;
    readonly tags: readonly string[];
    /** Markdown. */
    readonly statement: string;
    readonly inputFormat: string;
    readonly outputFormat: string;
    readonly constraints: string;
    /** Examples shown; small random and edge cases hidden. Each expected output is the reference program's. */
    readonly tests: readonly { readonly id: string; readonly input: string; readonly expected: string; readonly hidden: boolean; readonly weight: number }[];
    /** The best approach, in prose. */
    readonly optimal: string;
    /** Its time complexity, e.g. "O(n log n)". */
    readonly optimalTime: string;
    /** The brute force's time complexity. */
    readonly bruteTime: string;
    /** A right program, in Python, shown in the editorial. */
    readonly reference: string;
    readonly timeMs?: number;
  }[];
}

/**
 * Aptitude questions written for Parikshaa: quant, logical reasoning and verbal ability (K2-8). Each is a content kit
 * item (content/samples/aptitude) as the bulk upload publishes it: its default variant set, filled with its solver's
 * values; section and topic lead its tags; the explanation, then the shortcut, is its editorial.
 */
export interface AptitudePack {
  /** Where it was made from. */
  readonly source: string;
  readonly questions: readonly {
    readonly slug: string;
    readonly title: string;
    readonly difficulty: PackDifficulty;
    /** The section (`aptitude-quant`, `aptitude-logical`, `aptitude-verbal`), the topic, then the item's topics and patterns. */
    readonly tags: readonly string[];
    readonly question:
      | {
          readonly kind: "mcq";
          /** Markdown. */
          readonly stem: string;
          readonly options: readonly string[];
          readonly correctIndex: number;
          /** A reading passage the question is on. */
          readonly passage?: { readonly id: string; readonly title?: string; readonly text: string };
        }
      | { readonly kind: "numeric"; readonly stem: string; readonly expected: number; readonly tolerance: number };
    /** Markdown: Understand, Plan, Solve, Check, then the shortcut where there is one. */
    readonly editorial: string;
  }[];
}
