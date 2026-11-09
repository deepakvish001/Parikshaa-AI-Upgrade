import type Anthropic from "@anthropic-ai/sdk";

/**
 * A stand-in for the model, for tests, browser runs and load runs: it answers
 * every call the service makes — the streamed probe, the rubric grade and the
 * viva reading — with fixed text, after an optional delay that stands in for
 * the real thing's latency. Nothing is sent anywhere.
 */
export interface FakeModelScript {
  probe: string;
  rubricScore: number;
  verdict: { verdict: "consistent" | "shallow" | "inconsistent" | "inconclusive"; confidence: number; reasoning: string };
  /** What reading a job description finds. */
  job: { roleId: string; title: string; seniority: "fresher" | "junior" | "mid" | "senior"; skills: { name: string; keywords: string[] }[] };
  /** What comparing a candidate's identity photos finds. */
  identity: { idMatchesSelfie: "same" | "different" | "unclear"; snapshots: { photo: number; person: "same" | "different" | "no_face" | "unclear"; otherPeople: boolean }[]; summary: string };
  /** What the AI interviewer asks (numbered, call by call), and what its reading of a finished interview finds. */
  interview: {
    question: string;
    reading: { criteria: { name: string; score: number; evidence: string[] }[]; summary: string; concerns: string[] };
  };
  /** What the AI assistant on an AI-fluency question answers. */
  assist: string;
  /** Each conversation sent to the AI assistant, its messages joined: tests read it to see what the model was told. */
  assistPrompts: string[];
  /** Each prompt the AI interviewer sent, as sent: tests read it to see what the model was told. */
  interviewPrompts: string[];
  /**
   * What the practice tutor (Sahayak) answers: in Markdown for a hint, a doubt
   * or a note; a review, follow-up questions and a reply to one in their fixed
   * shapes. Each request it was sent is kept, for tests to read.
   */
  tutor: {
    text: string;
    review: { verdict: "correct" | "partly" | "wrong"; summary: string; logic: { right: string[]; wrong: string[] }; complexity: { time: string; space: string; better: string }; quality: string[]; edgeCases: string[] };
    followups: { questions: [string, string] };
    reply: { verdict: "strong" | "partial" | "missing"; feedback: string; stronger: string };
  };
  tutorPrompts: string[];
  /** Milliseconds before a probe finishes streaming, and before a grade or reading returns. */
  latencyMs: number;
}

const USAGE = { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
const pause = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

export function fakeModel(overrides: Partial<FakeModelScript> = {}): { client: Anthropic; script: FakeModelScript } {
  const script: FakeModelScript = {
    probe: "Walk me through why your answer holds in the worst case.",
    rubricScore: 7,
    verdict: { verdict: "consistent", confidence: 0.8, reasoning: "The reply engages the specifics of the answer." },
    job: { roleId: "java-developer", title: "Java Developer — online test", seniority: "junior", skills: [{ name: "Apache Kafka", keywords: ["kafka", "event streaming"] }, { name: "Core Java", keywords: ["java"] }] },
    identity: { idMatchesSelfie: "same", snapshots: [{ photo: 1, person: "same", otherPeople: false }], summary: "The same person throughout." },
    interview: {
      question: "How would you find a duplicate in an array?",
      reading: {
        criteria: [
          { name: "Problem solving", score: 4, evidence: ["I would use a set"] },
          { name: "Technical knowledge", score: 3, evidence: [] },
          { name: "Code quality", score: 3, evidence: [] },
          { name: "Communication", score: 4, evidence: [] },
        ],
        summary: "Clear reasoning on the basics.",
        concerns: [],
      },
    },
    interviewPrompts: [],
    tutor: {
      text: "Look at what the sum can reach. **Which type** holds it?\n\n```python\nprint(a + b)\n```",
      review: {
        verdict: "wrong",
        summary: "The loop prints a fixed value instead of the pair it finds.",
        logic: { right: ["Reads the input in one pass."], wrong: ["Prints -1 before checking any pair."] },
        complexity: { time: "O(n)", space: "O(1)", better: "" },
        quality: ["Name the two pointers."],
        edgeCases: ["No pair adds up to the target."],
      },
      followups: { questions: ["What changes if the array is not sorted?", "How would you return every pair?"] },
      reply: { verdict: "partial", feedback: "A set finds a pair in one pass; say what it costs in memory.", stronger: "Use a hash set: O(n) time and O(n) space." },
    },
    tutorPrompts: [],
    assist: "Use a hash set: one pass, O(n).",
    assistPrompts: [],
    latencyMs: 0,
    ...overrides,
  };
  const client = {
    beta: {
      messages: {
        stream() {
          const text = script.probe;
          return {
            on(_event: string, cb: (delta: string) => void) {
              // Streamed in a few pieces, as the real one is.
              for (const piece of text.match(/.{1,16}/g) ?? [text]) cb(piece);
            },
            async finalMessage() {
              await pause(script.latencyMs);
              return { content: [{ type: "text", text }], stop_reason: "end_turn", stop_details: null, usage: USAGE };
            },
          };
        },
      },
    },
    messages: {
      // The practice tutor: one answer per call, in its fixed shape when one is asked for.
      async create(params: { messages?: { content: unknown }[]; output_config?: { format?: unknown } }) {
        await pause(script.latencyMs);
        const asked = String(params.messages?.[0]?.content ?? "");
        script.tutorPrompts.push(asked);
        const shaped = params.output_config?.format === undefined ? null : asked.startsWith("Review") ? script.tutor.review : asked.startsWith("Ask the two") ? script.tutor.followups : script.tutor.reply;
        return { content: [{ type: "text", text: shaped === null ? script.tutor.text : JSON.stringify(shaped) }], stop_reason: "end_turn", stop_details: null, usage: USAGE };
      },
      async parse(params: { system?: unknown; messages?: { content: unknown }[] }) {
        await pause(script.latencyMs);
        const system = JSON.stringify(params.system);
        if (system.includes("AI coding assistant inside a hiring test")) {
          script.assistPrompts.push((params.messages ?? []).map((m) => String(m.content)).join("\n---\n"));
          return { stop_reason: "end_turn", stop_details: null, parsed_output: { reply: script.assist }, usage: USAGE };
        }
        if (system.includes("You interview candidates") || system.includes("You read a finished")) {
          script.interviewPrompts.push(String(params.messages?.[0]?.content ?? ""));
          const reading = system.includes("You read a finished");
          const parsed = reading ? script.interview.reading : { question: `${script.interview.question} (${script.interviewPrompts.length})` };
          return { stop_reason: "end_turn", stop_details: null, parsed_output: parsed, usage: USAGE };
        }
        const grading = system.includes("grade exam answers");
        const parsed = system.includes("compare photos of an exam candidate") ? script.identity : system.includes("read job descriptions") ? script.job : grading ? { score: script.rubricScore, criteriaMet: [], reasoning: "Scored against the rubric." } : script.verdict;
        return { stop_reason: "end_turn", stop_details: null, parsed_output: parsed, usage: USAGE };
      },
    },
  } as unknown as Anthropic;
  return { client, script };
}
export { FakeRazorpay } from "./razorpay.js";
// Keeps what would have been sent: the browser suite has no mail server or WhatsApp account.
export { OutboxLog } from "./delivery.js";
