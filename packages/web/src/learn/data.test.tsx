import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api.ts";
import { LearnProvider, type LearnState } from "./context.tsx";
import { arrivedSession, Failed, LearnDataProvider, learnKey, Loading, Offline, SignedOut, useContests, useHome, useLearnData, useMe, useOnline, useSubmissions, waitingForNetwork } from "./data.tsx";
import { D, fill } from "./text.ts";

/**
 * Learn's data layer (K2-0) reads through the practice site's own client and
 * session, against a fake of the API that answers and records every request.
 */

const SITE = "demo";
const SESSION = `parikshaa.practice.${SITE}.session`;

type Handler = () => { status?: number; body: unknown };
let routes: Record<string, Handler>;
let calls: { method: string; path: string; auth: string | null }[];

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", `/practice/${SITE}`);
  calls = [];
  routes = {
    "GET /practice/demo/me": () => ({ body: { id: "l1", name: "Asha Rao", email: "asha@example.com", emailVerified: true } }),
    "GET /practice/demo/home": () => ({ body: { name: "Asha Rao" } }),
    "GET /practice/demo/contests": () => ({ body: { contests: [{ slug: "weekly-13", title: "Weekly Round 13" }] } }),
    "GET /practice/demo/problems/two-sum/submissions": () => ({ body: { submissions: [{ id: "s1", status: "wrong_answer" }] } }),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = new URL(input, "http://localhost");
      const path = decodeURIComponent(url.pathname.replace(/^\/api/, ""));
      const method = init.method ?? "GET";
      const headers = (init.headers ?? {}) as Record<string, string>;
      calls.push({ method, path, auth: headers["authorization"] ?? null });
      const handler = routes[`${method} ${path}`];
      const { status = 200, body } = handler === undefined ? { status: 404, body: { error: "not_found" } } : handler();
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const learn: LearnState = {
  site: SITE,
  lang: "hg",
  setLang: () => undefined,
  t: (tri) => tri[1],
  theme: "dark",
  setTheme: () => undefined,
  href: (id) => `/practice/${SITE}/${id}`,
  go: () => undefined,
  openSahayak: () => undefined,
};

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LearnProvider value={learn}>
        <LearnDataProvider site={SITE}>{children}</LearnDataProvider>
      </LearnProvider>
    </QueryClientProvider>
  );
}

const signIn = (token = "pl_good") => localStorage.setItem(SESSION, token);

describe("the session", () => {
  it("is the practice site's: the same key on this device, sent as a bearer token", async () => {
    signIn();
    const { result } = renderHook(() => ({ data: useLearnData(), me: useMe() }), { wrapper: wrapper() });
    expect(result.current.data.signedIn).toBe(true);
    expect(result.current.data.token).toBe("pl_good");
    await waitFor(() => expect(result.current.me.data?.name).toBe("Asha Rao"));
    expect(calls).toEqual([{ method: "GET", path: "/practice/demo/me", auth: "Bearer pl_good" }]);
  });

  it("asks nothing that needs a session while signed out", async () => {
    const { result } = renderHook(() => ({ data: useLearnData(), me: useMe(), home: useHome() }), { wrapper: wrapper() });
    expect(result.current.data.signedIn).toBe(false);
    expect(result.current.me.fetchStatus).toBe("idle");
    expect(result.current.home.fetchStatus).toBe("idle");
    await act(async () => undefined);
    expect(calls).toEqual([]);
  });

  it("is forgotten, here and on the device, when the server no longer knows it", async () => {
    signIn("pl_old");
    routes["GET /practice/demo/me"] = () => ({ status: 401, body: { error: "unauthorized" } });
    const { result } = renderHook(() => ({ data: useLearnData(), me: useMe() }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data.signedIn).toBe(false));
    expect(localStorage.getItem(SESSION)).toBeNull();
  });

  it("is forgotten when any read is refused for it (401), not for other refusals", async () => {
    signIn();
    routes["GET /practice/demo/home"] = () => ({ status: 403, body: { error: "forbidden" } });
    const kept = renderHook(() => ({ data: useLearnData(), home: useHome() }), { wrapper: wrapper() });
    await waitFor(() => expect(kept.result.current.home.isError).toBe(true));
    expect(kept.result.current.data.signedIn).toBe(true);
    kept.unmount();

    routes["GET /practice/demo/home"] = () => ({ status: 401, body: { error: "unauthorized" } });
    const ended = renderHook(() => ({ data: useLearnData(), home: useHome() }), { wrapper: wrapper() });
    await waitFor(() => expect(ended.result.current.data.signedIn).toBe(false));
    expect(localStorage.getItem(SESSION)).toBeNull();
  });

  it("comes back from Google sign-in in the address's fragment: kept, and taken out of the address", () => {
    window.history.replaceState(null, "", `/practice/${SITE}/aaj?learn_v2=1#session=pl_google`);
    expect(arrivedSession(SITE)).toBe("pl_google");
    expect(localStorage.getItem(SESSION)).toBe("pl_google");
    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("?learn_v2=1");
    expect(arrivedSession(SITE)).toBeNull();
  });

  it("keys every read by the site and the session, so one learner's data never shows for another", () => {
    expect(learnKey(SITE, "home", "pl_a")).toEqual(["practice", "demo", "home", "pl_a"]);
    expect(learnKey(SITE, "home", "pl_a")).not.toEqual(learnKey(SITE, "home", "pl_b"));
  });
});

describe("the hooks", () => {
  it("read an open endpoint signed out, and with the session when there is one", async () => {
    const open = renderHook(() => useContests(), { wrapper: wrapper() });
    await waitFor(() => expect(open.result.current.data?.[0]?.title).toBe("Weekly Round 13"));
    expect(calls.at(-1)).toEqual({ method: "GET", path: "/practice/demo/contests", auth: null });
    open.unmount();
    signIn();
    const mine = renderHook(() => useContests(), { wrapper: wrapper() });
    await waitFor(() => expect(mine.result.current.isSuccess).toBe(true));
    expect(calls.at(-1)?.auth).toBe("Bearer pl_good");
  });

  it("read a problem's submissions only for a problem", async () => {
    signIn();
    const none = renderHook(() => useSubmissions(null), { wrapper: wrapper() });
    await act(async () => undefined);
    expect(none.result.current.fetchStatus).toBe("idle");
    expect(calls).toEqual([]);
    const some = renderHook(() => useSubmissions("two-sum"), { wrapper: wrapper() });
    await waitFor(() => expect(some.result.current.data?.[0]?.status).toBe("wrong_answer"));
  });

  it("follow the browser online and offline", () => {
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
    act(() => void window.dispatchEvent(new Event("offline")));
    expect(result.current).toBe(false);
    act(() => void window.dispatchEvent(new Event("online")));
    expect(result.current).toBe(true);
  });

  it("tell a query paused for the network from one loading", () => {
    expect(waitingForNetwork({ isPending: true, fetchStatus: "paused" })).toBe(true);
    expect(waitingForNetwork({ isPending: true, fetchStatus: "fetching" })).toBe(false);
    expect(waitingForNetwork({ isPending: false, fetchStatus: "paused" })).toBe(false);
  });
});

describe("the states", () => {
  async function violations(container: Element): Promise<string[]> {
    const result = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"] },
      rules: { "color-contrast": { enabled: false }, "target-size": { enabled: false } },
      resultTypes: ["violations"],
    });
    return result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  }

  it("say loading in words, fail with a reference and a retry, wait offline, and send a signed-out learner to sign in", async () => {
    const retry = vi.fn();
    const { container } = render(
      <main>
        <Loading />
        <Failed error={new ApiError(500, "server_error")} onRetry={retry} />
        <Offline />
        <Offline waiting />
        <SignedOut />
      </main>,
      { wrapper: wrapper() },
    );
    expect(screen.getAllByRole("status")[0]).toHaveTextContent(D.loading[1]);
    const failed = screen.getByRole("alert");
    expect(failed).toHaveTextContent(D.failedTitle[1]);
    expect(failed).toHaveTextContent("server_error · 500");
    await userEvent.click(screen.getByRole("button", { name: D.retry[1] }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByText(D.offlineBody[1])).toBeInTheDocument();
    expect(screen.getByText(D.offlineWait[1])).toBeInTheDocument();
    expect(screen.getByRole("link", { name: D.signIn[1] })).toHaveAttribute("href", "/practice/demo/signin?learn_v2=0");
    expect(await violations(container)).toEqual([]);
  });

  it("fill a text's places", () => {
    expect(fill("{n} kaam baaki, {m} min", { n: 3, m: 45 })).toBe("3 kaam baaki, 45 min");
    expect(fill("{n} and {gone}", { n: 1 })).toBe("1 and {gone}");
  });
});
