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
      async parse(params: { system?: unknown }) {
        await pause(script.latencyMs);
        const grading = JSON.stringify(params.system).includes("grade exam answers");
        const parsed = grading ? { score: script.rubricScore, criteriaMet: [], reasoning: "Scored against the rubric." } : script.verdict;
        return { stop_reason: "end_turn", stop_details: null, parsed_output: parsed, usage: USAGE };
      },
    },
  } as unknown as Anthropic;
  return { client, script };
}
