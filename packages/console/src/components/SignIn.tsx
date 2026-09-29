import { Suspense, lazy, useState } from "react";
import { Building2, Eye, EyeOff, Languages, MessageCircleQuestion, ShieldCheck } from "lucide-react";
import { Wordmark } from "@parikshaa/brand/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ConsoleClient, ConsoleError } from "../api.ts";

/**
 * Every way into the console (ROADMAP §1): a password, then a code when the
 * account has a second factor; a reset link by email; the organisation's own
 * sign-in provider; and, where the server takes them, an institution making
 * its own account.
 */

type Mode = "password" | "forgot" | "reset" | "sso" | "signup";

/**
 * What this device remembers between visits: the last email that signed in,
 * and the organisation whose own sign-in was last used. Neither is a secret;
 * storage can be unavailable, and then nothing is remembered.
 */
const EMAIL_KEY = "parikshaa.console.email";
const SSO_KEY = "parikshaa.console.ssoOrg";
export const remembered = {
  email: (): string => {
    try {
      return localStorage.getItem(EMAIL_KEY) ?? "";
    } catch {
      return "";
    }
  },
  setEmail: (email: string): void => {
    try {
      localStorage.setItem(EMAIL_KEY, email);
    } catch {
      // Not remembered.
    }
  },
  ssoOrg: (): { id: string; name: string } | null => {
    try {
      const raw = localStorage.getItem(SSO_KEY);
      const parsed = raw === null ? null : (JSON.parse(raw) as { id?: unknown; name?: unknown });
      return parsed !== null && typeof parsed.id === "string" && parsed.id !== "" ? { id: parsed.id, name: typeof parsed.name === "string" && parsed.name !== "" ? parsed.name : parsed.id } : null;
    } catch {
      return null;
    }
  },
  setSsoOrg: (org: { id: string; name: string }): void => {
    try {
      localStorage.setItem(SSO_KEY, JSON.stringify(org));
    } catch {
      // Not remembered.
    }
  },
};

/** Making an institution's account: once per institution, so loaded when chosen. */
const SignupForm = lazy(() => import("./Signup.tsx"));

/** What the provider's round trip came back with, said in plain words. */
const SSO_ERRORS: Record<string, string> = {
  not_staff: "Your organisation's sign-in worked, but that address is not a member of staff here. Ask an owner to add you.",
  sso_not_configured: "That organisation has not set up single sign-on.",
  invalid_sso: "The sign-in could not be completed. Try again.",
  cancelled: "The sign-in was cancelled.",
};

export function SignIn({
  onSignedIn,
  resetToken = null,
  ssoError = null,
}: {
  /** `fresh`: the account was made just now, so the console opens with its tour. */
  onSignedIn: (token: string, fresh?: boolean) => void;
  /** From a reset link: `?reset=…`. */
  resetToken?: string | null;
  /** From a failed provider round trip: `?sso_error=…`. */
  ssoError?: string | null;
}) {
  const [mode, setMode] = useState<Mode>(resetToken === null ? "password" : "reset");
  const signup = useQuery({ queryKey: ["signup-status"], queryFn: () => ConsoleClient.signupStatus(), staleTime: Infinity, retry: false });
  const open = signup.data?.open === true;

  return (
    <div className="signin">
      <aside className="signin-brand" aria-hidden="true">
        <Wordmark size={34} product="Console" />
        <div className="signin-pitch">
          <p className="signin-headline">Assessment you can prove.</p>
          <ul>
            <li>
              <ShieldCheck /> Every answer sealed in a hash-chained ledger, checkable by anyone.
            </li>
            <li>
              <MessageCircleQuestion /> A short follow-up on answers that need one — asked, never accused.
            </li>
            <li>
              <Languages /> Hindi and ten Indian languages, on a phone or a lab machine.
            </li>
          </ul>
        </div>
        <p className="signin-foot">परीक्षा · Built for Indian institutions</p>
      </aside>
      <main className="signin-form">
        <div className="signin-card">
          <span className="signin-mark">
            <Wordmark size={28} />
          </span>
          {mode === "password" ? (
            <PasswordForm onSignedIn={onSignedIn} onMode={setMode} ssoError={ssoError} signupOpen={open} />
          ) : mode === "signup" ? (
            <Suspense fallback={<p className="notice">Loading…</p>}>
              <SignupForm trialCredits={signup.data?.trialCredits ?? 0} onSignedIn={(token) => onSignedIn(token, true)} onBack={() => setMode("password")} />
            </Suspense>
          ) : mode === "forgot" ? (
            <ForgotForm onBack={() => setMode("password")} />
          ) : mode === "reset" ? (
            <ResetForm token={resetToken ?? ""} onDone={() => setMode("password")} />
          ) : (
            <SsoForm onBack={() => setMode("password")} />
          )}
        </div>
      </main>
    </div>
  );
}

function PasswordForm({
  onSignedIn,
  onMode,
  ssoError,
  signupOpen = false,
}: {
  onSignedIn: (token: string) => void;
  onMode: (mode: Mode) => void;
  ssoError: string | null;
  /** Institutions may make their own accounts here. */
  signupOpen?: boolean;
}) {
  const [email, setEmail] = useState(remembered.email);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [sso] = useState(remembered.ssoOrg);
  const signIn = useMutation({
    mutationFn: () => ConsoleClient.signIn(email.trim(), password, needsCode ? code.trim() : undefined),
    onSuccess: ({ token }) => {
      remembered.setEmail(email.trim());
      onSignedIn(token);
    },
    onError: (error) => {
      if (error instanceof ConsoleError && error.code === "second_factor_required") setNeedsCode(true);
    },
  });
  const error = signIn.error;
  const refused =
    error instanceof ConsoleError
      ? error.code === "second_factor_required"
        ? null
        : error.status === 429
          ? "Too many attempts. Wait a few minutes and try again."
          : error.code === "sso_required"
            ? "Your organisation signs its staff in through its own provider. Use “Sign in with your organisation” below."
            : needsCode
              ? "That code was not accepted. Codes change every 30 seconds; each works once."
              : "That email and password were not accepted."
      : error === null
        ? ssoError === null
          ? null
          : (SSO_ERRORS[ssoError] ?? SSO_ERRORS["invalid_sso"]!)
        : "Could not reach the server.";

  const missing = email.trim() === "" ? "Enter your email" : password === "" ? "Enter your password" : needsCode && code.trim() === "" ? "Enter the code from your app" : null;

  return (
    <>
      <h1>Sign in to the console</h1>
      <p className="notice">For examiners, invigilators and administrators.</p>
      {sso === null ? null : (
        <>
          <button type="button" className="block large" onClick={() => window.location.assign(ConsoleClient.ssoStartUrl(sso.id, email.trim()))}>
            <Building2 aria-hidden="true" />
            Continue with {sso.name}
          </button>
          <p className="or-divider">
            <span>or</span>
          </p>
        </>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          signIn.mutate();
        }}
      >
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="password-row">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="quiet icon reveal"
              aria-label={showPassword ? "Hide what you typed" : "Show what you typed"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>
        </div>
        {needsCode ? (
          <div className="field">
            <label htmlFor="code">Code from your authenticator app</label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <p className="notice">Lost your phone? Type one of your recovery codes instead.</p>
          </div>
        ) : null}
        {refused === null ? null : (
          <p className="error" role="alert">
            {refused}
          </p>
        )}
        <button
          type="submit"
          className={`block large${sso === null ? "" : " secondary"}`}
          disabled={signIn.isPending || missing !== null}
          aria-describedby={missing === null ? undefined : "signin-missing"}
        >
          {signIn.isPending ? "Signing in…" : "Sign in"}
        </button>
        {missing === null ? null : (
          <p className="notice small disabled-reason" id="signin-missing">
            {missing} to sign in.
          </p>
        )}
      </form>
      <div className="signin-links">
        <button type="button" className="link" onClick={() => onMode("forgot")}>
          Forgot your password?
        </button>
        <button type="button" className="link" onClick={() => onMode("sso")}>
          <Building2 aria-hidden="true" /> Sign in with your organisation
        </button>
      </div>
      {signupOpen ? (
        <p className="signin-new">
          New to Parikshaa?{" "}
          <button type="button" className="link" onClick={() => onMode("signup")}>
            Make your institution's account
          </button>
        </p>
      ) : null}
    </>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const send = useMutation({ mutationFn: () => ConsoleClient.requestReset(email.trim()) });

  return (
    <>
      <h1>Reset your password</h1>
      {send.isSuccess ? (
        <p className="notice" role="status">
          If {email.trim()} has an account, a link to choose a new password is on its way. It works once, within the hour.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <p className="notice">We'll email you a link to choose a new one.</p>
          <div className="field">
            <label htmlFor="reset-email">Email</label>
            <input id="reset-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {send.error === null ? null : (
            <p className="error" role="alert">
              {send.error instanceof ConsoleError && send.error.status === 429
                ? "Too many requests. Wait a few minutes and try again."
                : "Could not reach the server."}
            </p>
          )}
          <button type="submit" className="block large" disabled={send.isPending || email.trim() === ""}>
            Send the link
          </button>
        </form>
      )}
      <div className="signin-links">
        <button type="button" className="link" onClick={onBack}>
          Back to signing in
        </button>
      </div>
    </>
  );
}

function ResetForm({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const reset = useMutation({ mutationFn: () => ConsoleClient.completeReset(token, password) });

  if (reset.isSuccess) {
    return (
      <>
        <h1>Password changed</h1>
        <p className="notice" role="status">
          Sign in with your new password. Every other session has ended.
        </p>
        <button type="button" className="block large" onClick={onDone}>
          Sign in
        </button>
      </>
    );
  }

  const problem =
    reset.error instanceof ConsoleError
      ? reset.error.status === 410
        ? "This link has been used or has expired. Ask for a new one."
        : (reset.error.detail ?? "That password was not accepted.")
      : reset.error === null
        ? null
        : "Could not reach the server.";

  return (
    <>
      <h1>Choose a new password</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          reset.mutate();
        }}
      >
        <div className="field">
          <label htmlFor="new-password">New password</label>
          <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="new-password-again">The same again</label>
          <input
            id="new-password-again"
            type="password"
            autoComplete="new-password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
          />
        </div>
        <p className="notice">At least 12 characters. A phrase of a few words is easier to remember than a jumble.</p>
        {again !== "" && again !== password ? <p className="error">The two do not match.</p> : null}
        {problem === null ? null : (
          <p className="error" role="alert">
            {problem}
          </p>
        )}
        <button type="submit" className="block large" disabled={reset.isPending || password.length < 12 || password !== again}>
          Set password
        </button>
      </form>
      <div className="signin-links">
        <button type="button" className="link" onClick={onDone}>
          Back to signing in
        </button>
      </div>
    </>
  );
}

function SsoForm({ onBack }: { onBack: () => void }) {
  const [org, setOrg] = useState("");
  const [email, setEmail] = useState("");
  return (
    <>
      <h1>Sign in with your organisation</h1>
      <p className="notice">Through your institution's own sign-in — Google Workspace, Microsoft or similar — if it has set one up.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const known = remembered.ssoOrg();
          remembered.setSsoOrg({ id: org.trim(), name: known?.id === org.trim() ? known.name : org.trim() });
          window.location.assign(ConsoleClient.ssoStartUrl(org.trim(), email));
        }}
      >
        <div className="field">
          <label htmlFor="sso-org">Organisation ID</label>
          <input id="sso-org" autoComplete="organization" value={org} onChange={(e) => setOrg(e.target.value)} />
          <p className="notice">Your administrator can tell you it; it is the short name your organisation was set up with.</p>
        </div>
        <div className="field">
          <label htmlFor="sso-email">Email (optional)</label>
          <input id="sso-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button type="submit" className="block large" disabled={org.trim() === ""}>
          Continue
        </button>
      </form>
      <div className="signin-links">
        <button type="button" className="link" onClick={onBack}>
          Back to signing in
        </button>
      </div>
    </>
  );
}
