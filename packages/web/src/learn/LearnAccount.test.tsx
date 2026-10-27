import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi, renderLearn, SESSION, SITE, type FakeApi } from "./fake-api.tsx";
import { refusal, W } from "./LearnAccount.tsx";
import { ApiError } from "../api.ts";
import { D } from "./text.ts";

/**
 * Learn's own sign-in and sign-up (tracker row 140, K2-2) against a fake of
 * the practice site's API: the practice site's routes and session, where the
 * learner lands, the return address checked, Google's way back, and axe
 * finding nothing (colour-contrast and target-size are left to the browser,
 * e2e learn-account.spec.ts).
 */

async function violations(container: Element): Promise<string[]> {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false }, "target-size": { enabled: false } },
    resultTypes: ["violations"],
  });
  return result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

let api: FakeApi;
const hg = (tri: readonly [string, string, string]) => tri[1];
const session = (token: string) => ({ token, expiresAt: "2026-11-27T00:00:00Z", learner: { id: "l2", name: "Asha Verma", email: "asha@example.com", emailVerified: false } });
const bodyOf = async (method: string, path: string) => {
  const call = vi.mocked(fetch).mock.calls.find(([url, init]) => new URL(url as string, "http://x").pathname === `/api${path}` && (init?.method ?? "GET") === method);
  return JSON.parse(String(call?.[1]?.body ?? "null")) as unknown;
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.matchMedia = vi.fn((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  api = fakeApi();
  api.routes["GET /practice/demo/sign-in-options"] = () => ({ body: { google: false, requireVerified: false } });
  api.routes["POST /practice/demo/signin"] = () => ({ body: session("pl_new") });
  api.routes["POST /practice/demo/signup"] = () => ({ status: 201, body: session("pl_made") });
  api.routes["GET /practice/demo/plan"] = () => ({ body: { plan: null } });
  api.routes["GET /practice/demo/tracks"] = () => ({ body: { tracks: [] } });
  api.routes["GET /practice/demo/companies"] = () => ({ body: { companies: [] } });
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-theme");
});

const at = (path: string) => window.history.replaceState(null, "", `/practice/${SITE}${path}`);

describe("signing in", () => {
  it("signs in with email and password on the practice site's route, keeps its session, and goes back where it set out from", async () => {
    at("/signin?next=plan");
    const { container } = renderLearn();
    expect(await screen.findByRole("heading", { level: 1, name: hg(W.inTitle) })).toBeInTheDocument();
    // No side bar here: a page of its own.
    expect(screen.queryByRole("navigation", { name: "Learn menu" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: hg(W.google) })).not.toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
    await userEvent.type(screen.getByLabelText(hg(W.email)), "asha@example.com");
    await userEvent.type(screen.getByLabelText(hg(W.password)), "practice every single day");
    await userEvent.click(screen.getByRole("button", { name: hg(W.signIn) }));
    await waitFor(() => expect(window.location.pathname).toBe(`/practice/${SITE}/plan`));
    expect(await bodyOf("POST", "/practice/demo/signin")).toEqual({ email: "asha@example.com", password: "practice every single day" });
    expect(localStorage.getItem(SESSION)).toBe("pl_new");
    expect(await screen.findByRole("heading", { level: 2, name: "Abhi koi plan nahi" })).toBeInTheDocument();
    expect(api.calls.find((c) => c.path === "/practice/demo/plan")?.auth).toBe("Bearer pl_new");
  });

  it("says why it was refused, and keeps the learner on the page", async () => {
    api.routes["POST /practice/demo/signin"] = () => ({ status: 401, body: { error: "sign_in_failed" } });
    at("/signin");
    renderLearn();
    await userEvent.type(await screen.findByLabelText(hg(W.email)), "asha@example.com");
    await userEvent.type(screen.getByLabelText(hg(W.password)), "not it at all");
    await userEvent.click(screen.getByRole("button", { name: hg(W.signIn) }));
    expect(await screen.findByRole("alert")).toHaveTextContent(hg(W.wrong));
    expect(window.location.pathname).toBe(`/practice/${SITE}/signin`);
    expect(localStorage.getItem(SESSION)).toBeNull();
    expect(refusal(new ApiError(409, "email_taken"))).toBe(W.taken);
    expect(refusal(new ApiError(429, "too_many_attempts"))).toBe(W.tooMany);
    expect(refusal(new ApiError(400, "invalid"))).toBe(W.invalid);
    expect(refusal(new TypeError("offline"))).toBe(W.failed);
  });

  it("never follows a return address off this site's screens", async () => {
    at("/signin?next=%2F%2Fevil.example%2Fplan");
    renderLearn();
    await userEvent.type(await screen.findByLabelText(hg(W.email)), "asha@example.com");
    await userEvent.type(screen.getByLabelText(hg(W.password)), "practice every single day");
    await userEvent.click(screen.getByRole("button", { name: hg(W.signIn) }));
    await waitFor(() => expect(window.location.pathname).toBe(`/practice/${SITE}/aaj`));
  });

  it("offers Google where the site does, and comes back from it to the screen it set out from", async () => {
    api.routes["GET /practice/demo/sign-in-options"] = () => ({ body: { google: true, requireVerified: false } });
    at("/signin?next=plan");
    renderLearn();
    const google = await screen.findByRole("link", { name: hg(W.google) });
    expect(google).toHaveAttribute("href", "/api/practice/demo/auth/google");
    google.addEventListener("click", (event) => event.preventDefault());
    await userEvent.click(google);
    expect(sessionStorage.getItem(`parikshaa.learn.next.${SITE}`)).toBe("plan");
  });

  it("lands on the screen kept before Google, with the session out of the address", async () => {
    sessionStorage.setItem(`parikshaa.learn.next.${SITE}`, "plan");
    at("#session=pl_google");
    renderLearn();
    expect(await screen.findByRole("heading", { level: 2, name: "Abhi koi plan nahi" })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/practice/${SITE}/plan`);
    expect(window.location.hash).toBe("");
    expect(localStorage.getItem(SESSION)).toBe("pl_google");
  });

  it("sends a failed Google sign-in back to signing in, saying so", async () => {
    at("?signin_error=sign_in_failed");
    renderLearn();
    expect(await screen.findByRole("alert")).toHaveTextContent(hg(D.googleFailed));
    expect(window.location.pathname).toBe(`/practice/${SITE}/signin`);
    expect(window.location.search).toBe("");
  });

  it("sends a learner already signed in on to Aaj", async () => {
    localStorage.setItem(SESSION, "pl_good");
    at("/signin");
    renderLearn();
    await waitFor(() => expect(window.location.pathname).toBe(`/practice/${SITE}/aaj`));
  });

  it("follows a confirmation link once and says how it went", async () => {
    api.routes["POST /practice/demo/verify"] = () => ({ body: { ok: true } });
    at("?verify=l1.abcdefghijk");
    renderLearn();
    expect(await screen.findByText(hg(D.verified))).toBeInTheDocument();
    expect(await bodyOf("POST", "/practice/demo/verify")).toEqual({ token: "l1.abcdefghijk" });
    expect(window.location.search).toBe("");
  });

  it("signs out from the ⋯ menu: the server ends the session, this device forgets it", async () => {
    api.routes["POST /practice/demo/signout"] = () => ({ body: { ok: true } });
    localStorage.setItem(SESSION, "pl_good");
    at("");
    renderLearn();
    await userEvent.click(screen.getByRole("button", { name: "Aur vikalp" }));
    await userEvent.click(screen.getByRole("menuitem", { name: hg(D.signOut) }));
    await waitFor(() => expect(window.location.pathname).toBe(`/practice/${SITE}/signin`));
    expect(api.calls.find((c) => c.path === "/practice/demo/signout")?.auth).toBe("Bearer pl_good");
    expect(localStorage.getItem(SESSION)).toBeNull();
  });
});

describe("signing up", () => {
  it("makes the account on the practice site's route, then onboarding, saying a link was sent", async () => {
    at("/signin");
    const { container } = renderLearn();
    await userEvent.click(await screen.findByRole("link", { name: hg(W.makeOne) }));
    expect(await screen.findByRole("heading", { level: 1, name: hg(W.upTitle) })).toBeInTheDocument();
    expect(screen.getByLabelText(hg(W.password))).toHaveAccessibleDescription(hg(W.passwordHint));
    expect(await violations(container)).toEqual([]);
    await userEvent.type(screen.getByLabelText(hg(W.name)), "Asha Verma");
    await userEvent.type(screen.getByLabelText(hg(W.email)), "asha@example.com");
    await userEvent.type(screen.getByLabelText(hg(W.password)), "practice every single day");
    await userEvent.click(screen.getByRole("button", { name: hg(W.signUp) }));
    await waitFor(() => expect(window.location.pathname).toBe(`/practice/${SITE}/onboarding`));
    expect(await bodyOf("POST", "/practice/demo/signup")).toEqual({ name: "Asha Verma", email: "asha@example.com", password: "practice every single day" });
    expect(localStorage.getItem(SESSION)).toBe("pl_made");
    expect(screen.getByText(/asha@example.com par link bheja hai/)).toBeInTheDocument();
  });

  it("says when the address has an account already", async () => {
    api.routes["POST /practice/demo/signup"] = () => ({ status: 409, body: { error: "email_taken" } });
    at("/signup");
    renderLearn();
    await userEvent.type(await screen.findByLabelText(hg(W.name)), "Asha");
    await userEvent.type(screen.getByLabelText(hg(W.email)), "asha@example.com");
    await userEvent.type(screen.getByLabelText(hg(W.password)), "practice every single day");
    await userEvent.click(screen.getByRole("button", { name: hg(W.signUp) }));
    expect(await screen.findByRole("alert")).toHaveTextContent(hg(W.taken));
    await act(async () => undefined);
    expect(within(screen.getByRole("main")).getByRole("link", { name: hg(W.signIn) })).toHaveAttribute("href", `/practice/${SITE}/signin`);
  });
});
