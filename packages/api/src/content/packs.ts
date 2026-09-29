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
