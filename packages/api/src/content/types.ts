/**
 * The content format's items as TypeScript reads them (docs/content/schema,
 * CONTENT-FORMAT.md). Only what the bulk upload's gates and its publishing
 * read is typed; the schema checks everything else. An item reaches these
 * types only after it has passed its schema.
 */

export type CodeLanguage = "c" | "cpp" | "java" | "python" | "javascript";
export type RunLanguage = CodeLanguage | "sql";
export type TextLanguage = "en" | "hi-Latn";
export type Level = "L0" | "L1" | "L2" | "L3" | "L4";
export type Difficulty = "easy" | "medium" | "hard";

export type ContentChecker =
  | { readonly kind: "exact" | "tokens" | "unordered" }
  | { readonly kind: "numbers"; readonly tolerance: number }
  | { readonly kind: "custom"; readonly source: string };

export interface Tags {
  readonly topics: readonly string[];
  readonly patterns?: readonly string[];
  readonly extra?: readonly string[];
  readonly companies?: readonly { readonly name: string; readonly source: string; readonly verified: true }[];
}

export interface Placement {
  readonly track: string;
  readonly module: string;
  readonly position: number;
}

export interface Variants {
  readonly params: readonly { readonly name: string; readonly description: string }[];
  readonly sets: readonly Readonly<Record<string, unknown>>[];
}

export interface Visual {
  readonly id: string;
  readonly kind: string;
  readonly alt: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface EditorialLength {
  readonly form: "standard" | "long";
  readonly target_words: number;
}

export interface IoTest {
  readonly id: string;
  readonly input: string;
  readonly expected: string;
  readonly hidden: boolean;
  readonly weight?: number;
  readonly milestone?: string;
}

export interface RevisionCard {
  readonly front: string;
  readonly back: string;
}

interface Common {
  readonly schema: string;
  readonly slug: string;
  readonly version: number;
  readonly title: string;
  readonly tier: "public" | "premium";
  readonly text_language: TextLanguage;
  readonly tags: Tags;
  readonly placement?: readonly Placement[];
  readonly variants?: Variants;
  readonly revision_card?: RevisionCard;
}

export interface DsaSolution {
  readonly role: "reference" | "brute" | "wrong";
  readonly lang: RunLanguage;
  readonly src: string;
  readonly expect?: "WA" | "TLE" | "RE" | "MLE" | "FAIL";
  readonly why?: string;
}

export type TestGroupName = "samples" | "minimal" | "boundary" | "edge" | "random_small" | "random_large" | "anti" | "output_edge";

export interface TestGroup {
  readonly group: TestGroupName;
  readonly hidden: boolean;
  readonly brute?: boolean;
  readonly tests?: readonly { readonly input: string; readonly expected?: string; readonly explanation?: string; readonly weight?: number }[];
  readonly gen?: string;
  readonly args?: readonly (readonly (string | number)[])[];
}

export interface DsaItem extends Common {
  readonly difficulty: Difficulty;
  readonly level: Level;
  readonly statement: string;
  readonly input_format: string;
  readonly output_format: string;
  readonly constraints: string;
  readonly languages: readonly CodeLanguage[];
  readonly starters: Readonly<Partial<Record<CodeLanguage, string>>>;
  readonly solutions: readonly DsaSolution[];
  readonly generators?: readonly { readonly name: string; readonly lang: "python"; readonly src: string }[];
  readonly validator?: { readonly lang: "python"; readonly src: string };
  readonly test_plan: readonly TestGroup[];
  readonly checker?: ContentChecker;
  readonly limits: { readonly time_ms: Readonly<Partial<Record<CodeLanguage, number>>>; readonly memory_mb: number };
  readonly hints: readonly string[];
  readonly approaches: readonly { readonly name: "brute" | "better" | "optimal"; readonly time: string; readonly space: string; readonly summary: string }[];
  readonly editorial: string;
  readonly editorial_length: EditorialLength;
  readonly visuals?: readonly Visual[];
  readonly related: readonly string[];
}

export interface SqlDataset {
  readonly id: string;
  readonly hidden: boolean;
  readonly purpose: string;
  readonly rows_sql?: string;
  readonly gen?: { readonly src: string; readonly args?: string };
  readonly expected?: string;
}

export interface SqlItem extends Common {
  readonly difficulty: Difficulty;
  readonly level: Level;
  readonly stem: string;
  readonly schema_sql: string;
  readonly datasets: readonly SqlDataset[];
  readonly order_matters: boolean;
  readonly reference: string;
  readonly alternatives?: readonly string[];
  readonly wrong: readonly { readonly src: string; readonly why: string }[];
  readonly starter: string;
  readonly hints: readonly string[];
  readonly approaches: readonly { readonly name: string; readonly summary: string }[];
  readonly editorial: string;
  readonly editorial_length: EditorialLength;
  readonly related?: readonly string[];
}

export interface McqItem extends Common {
  readonly difficulty: Difficulty;
  readonly section: string;
  readonly topic: string;
  readonly kind: "mcq" | "numeric";
  readonly stem: string;
  readonly passage?: { readonly id: string; readonly title?: string; readonly text: string };
  readonly options?: readonly string[];
  readonly correct?: number;
  readonly answer?: number;
  readonly tolerance?: number;
  readonly unit?: string;
  readonly explanation: string;
  readonly distractors?: readonly { readonly option: number; readonly mistake: string }[];
  readonly time_target_sec: number;
  readonly solver?: string;
  readonly images?: readonly { readonly file: string; readonly alt: string }[];
}

export interface CodeBlock {
  readonly lang: string;
  readonly src: string;
  readonly runnable?: boolean;
  readonly stdin?: string;
  readonly expected_output?: string;
  readonly caption?: string;
}

export interface InlineMcq {
  readonly stem: string;
  readonly options: readonly string[];
  readonly correct: number;
  readonly explanation: string;
}

export interface LessonSection {
  readonly kind: "why" | "concept" | "example" | "misconception" | "interview" | "summary" | "note";
  readonly heading: string;
  readonly body: string;
  readonly code?: readonly CodeBlock[];
  readonly visual?: Visual;
  readonly qa?: readonly { readonly q: string; readonly a: string }[];
}

export interface HandsOn {
  readonly id: string;
  readonly title: string;
  readonly task: string;
  readonly lang: RunLanguage;
  readonly starter: string;
  readonly solution: string;
  readonly tests: readonly IoTest[];
  readonly checker?: ContentChecker;
}

export interface LessonItem extends Common {
  readonly difficulty: Difficulty;
  readonly course: string;
  readonly est_minutes: number;
  readonly outcomes: readonly string[];
  readonly sections: readonly LessonSection[];
  readonly quiz: readonly InlineMcq[];
  readonly hands_on?: readonly HandsOn[];
  readonly video_url?: string;
}

export interface ContentFile {
  readonly path: string;
  readonly content: string;
}

export interface ProjectItem extends Common {
  readonly language: CodeLanguage;
  readonly brief: string;
  readonly files: readonly ContentFile[];
  readonly solution_files: readonly ContentFile[];
  readonly bundle_order: readonly string[];
  readonly tests: readonly IoTest[];
  readonly milestones: readonly { readonly id: string }[];
  readonly rubric: readonly { readonly weight: number; readonly checked_by: string }[];
}

export interface KataImplementation {
  readonly language: CodeLanguage;
  readonly files: readonly ContentFile[];
  readonly solution_files: readonly ContentFile[];
  readonly bundle_order: readonly string[];
  readonly change_files?: readonly ContentFile[];
}

export interface DesignItem extends Common {
  readonly mode: "hld" | "lld";
  readonly scenario: string;
  readonly rubric: readonly { readonly weight: number; readonly checked_by: string }[];
  readonly diagram?: unknown;
  readonly estimates?: readonly { readonly id: string; readonly answer: number; readonly solver?: string }[];
  readonly expected_components?: readonly unknown[];
  readonly deep_dives?: readonly unknown[];
  readonly entities?: readonly unknown[];
  readonly patterns?: readonly unknown[];
  readonly kata?: { readonly implementations: readonly KataImplementation[]; readonly change_request?: { readonly tests?: readonly IoTest[] } };
  readonly concept_checks: readonly InlineMcq[];
}
