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
