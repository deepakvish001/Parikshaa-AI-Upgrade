import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, ParikshaaClient } from "./api.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** An SSE response built from complete frames, delivered in arbitrary chunks. */
const sse = (frames: readonly string[], chunkSize = 7) => {
  const payload = frames.join("");
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const bytes = new TextEncoder().encode(payload);
      for (let i = 0; i < bytes.length; i += chunkSize) {
        controller.enqueue(bytes.slice(i, i + chunkSize));
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
};

afterEach(() => vi.unstubAllGlobals());

describe("ParikshaaClient", () => {
  it("sends the attempt token as a bearer header", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json({ state: "in_progress" }));
    vi.stubGlobal("fetch", fetchMock);

    await new ParikshaaClient("tok").state();

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("/api/attempts/me");
    expect((call?.[1]?.headers as Record<string, string>)["authorization"]).toBe("Bearer tok");
  });

  it("sends only the reply when answering a probe", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await new ParikshaaClient("tok").replyToProbe("probe-1", "The potential decreases.");

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;

    // Latency is an integrity signal measured on the server. There is nothing
    // here for a modified client to misreport.
    expect(Object.keys(body)).toEqual(["reply"]);
    expect(body).not.toHaveProperty("latencyMs");
    expect(body).not.toHaveProperty("repliedAt");
  });

  it("does not claim a JSON body when submitting, which has none", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await new ParikshaaClient("tok").submit();

    // The server refuses an empty body labelled as JSON, so a bare submit that
    // sent this header could never succeed.
    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty("content-type");
  });

  it("escapes a probe id into the path", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await new ParikshaaClient("tok").replyToProbe("a/../b", "x");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/attempts/me/probes/a%2F..%2Fb/reply");
  });

  it("raises an ApiError carrying the server's code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "invalid_state" }, 409)));

    await expect(new ParikshaaClient("tok").submit()).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      code: "invalid_state",
    });
    expect(new ApiError(409, "x")).toBeInstanceOf(Error);
  });

  describe("streamProbe", () => {
    it("reassembles frames split across chunk boundaries", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          sse([
            'event: token\ndata: {"token":"Which quantity "}\n\n',
            'event: token\ndata: {"token":"decreases?"}\n\n',
            'event: probe\ndata: {"id":"p1","prompt":"Which quantity decreases?"}\n\n',
          ]),
        ),
      );

      const tokens: string[] = [];
      let probe: { id: string; prompt: string } | null = null;
      await new ParikshaaClient("tok").streamProbe({
        onToken: (t) => tokens.push(t),
        onProbe: (p) => (probe = p),
      });

      expect(tokens.join("")).toBe("Which quantity decreases?");
      expect(probe).toEqual({ id: "p1", prompt: "Which quantity decreases?" });
    });

    it("reports when no probe is due", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => sse(["event: none\ndata: {}\n\n"])));

      const onNone = vi.fn();
      const onProbe = vi.fn();
      await new ParikshaaClient("tok").streamProbe({ onProbe, onNone });

      expect(onNone).toHaveBeenCalledOnce();
      expect(onProbe).not.toHaveBeenCalled();
    });

    it("surfaces a stream error and ignores malformed frames", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          sse(["data: not json\n\n", 'event: error\ndata: {"message":"probe failed"}\n\n']),
        ),
      );

      const onError = vi.fn();
      await new ParikshaaClient("tok").streamProbe({ onProbe: vi.fn(), onError });

      expect(onError).toHaveBeenCalledWith("probe failed");
    });

    it("reports a failed request rather than hanging", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));

      const onError = vi.fn();
      await new ParikshaaClient("tok").streamProbe({ onProbe: vi.fn(), onError });

      expect(onError).toHaveBeenCalledWith(expect.stringContaining("401"));
    });
  });
});
