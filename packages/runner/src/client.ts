import type { RunRequest, RunResult } from "./execute.js";

/**
 * How the API reaches the runner: over HTTP, to a separate container.
 *
 * The runner is its own service so that candidate code never executes in the
 * process — or the container, or the network — that holds the database
 * credentials and the model API key.
 */
export interface CodeRunner {
  run(request: RunRequest): Promise<RunResult>;
}

/** Raised when the runner cannot be reached or refuses the work. */
export class RunnerUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunnerUnavailable";
  }
}

export class HttpCodeRunner implements CodeRunner {
  readonly #url: string;
  readonly #token: string;
  readonly #timeoutMs: number;

  constructor(url: string, token: string, options: { readonly timeoutMs?: number } = {}) {
    this.#url = url.replace(/\/$/, "");
    this.#token = token;
    this.#timeoutMs = options.timeoutMs ?? 120_000;
  }

  async run(request: RunRequest): Promise<RunResult> {
    let response: Response;
    try {
      response = await fetch(`${this.#url}/run`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.#token}`, "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch (error) {
      throw new RunnerUnavailable(`The code runner could not be reached: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) throw new RunnerUnavailable(`The code runner answered ${response.status}`);
    return (await response.json()) as RunResult;
  }
}
