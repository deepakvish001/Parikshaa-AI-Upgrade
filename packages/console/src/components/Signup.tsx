import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { ConsoleClient, ConsoleError } from "../api.ts";
import { remembered } from "./SignIn.tsx";

/**
 * An institution making its own account: the organisation and its first
 * owner, signed straight in. The address is the owner's sign-in; the name is
 * what candidates will see.
 */
export default function SignupForm({ trialCredits, onSignedIn, onBack }: { trialCredits: number; onSignedIn: (token: string) => void; onBack: () => void }) {
  const [kind, setKind] = useState<"institution" | "company">("institution");
  const [organisation, setOrganisation] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const create = useMutation({
    mutationFn: () => ConsoleClient.signUp({ organisation: organisation.trim(), name: name.trim(), email: email.trim(), password, kind }),
    onSuccess: ({ token }) => {
      remembered.setEmail(email.trim());
      onSignedIn(token);
    },
  });
  const error = create.error;
  const taken = error instanceof ConsoleError && error.code === "email_taken";
  const refused =
    error === null
      ? null
      : error instanceof ConsoleError
        ? taken
          ? "An account already uses this email address."
          : error.status === 429
            ? "Too many new accounts from this network. Try again in an hour."
            : error.status === 404
              ? "This server does not take new institutions. Ask whoever runs it for an account."
              : (error.detail ?? "Those details were not accepted.")
        : "Could not reach the server.";
  const short = password !== "" && password.length < 12;
  const missing =
    organisation.trim() === ""
      ? kind === "company"
        ? "Enter your company's name"
        : "Enter your institution's name"
      : name.trim() === ""
        ? "Enter your name"
        : email.trim() === ""
          ? "Enter your email"
          : password.length < 12
            ? "Choose a password of at least 12 characters"
            : null;

  return (
    <>
      <h1>{kind === "company" ? "Make your company's account" : "Make your institution's account"}</h1>
      <p className="notice">
        You will be its owner: you add your colleagues afterwards.
        {trialCredits > 0 ? ` The first ${trialCredits} attempts are free — enough for a ${kind === "company" ? "first round" : "pilot batch"}.` : ""}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (missing === null) create.mutate();
        }}
      >
        <fieldset className="field signup-kind">
          <legend>We are</legend>
          <label>
            <input type="radio" name="signup-kind" checked={kind === "institution"} onChange={() => setKind("institution")} />
            A college or institute, testing our students
          </label>
          <label>
            <input type="radio" name="signup-kind" checked={kind === "company"} onChange={() => setKind("company")} />
            A company, hiring
          </label>
        </fieldset>
        <div className="field">
          <label htmlFor="signup-org">{kind === "company" ? "Company" : "Institution"}</label>
          <input id="signup-org" autoComplete="organization" value={organisation} onChange={(e) => setOrganisation(e.target.value)} aria-describedby="signup-org-hint" />
          <p className="notice small" id="signup-org-hint">
            As candidates will see it, e.g. {kind === "company" ? "“Kiranshala Labs”" : "“Nalanda Institute of Technology”"}.
          </p>
        </div>
        <div className="field">
          <label htmlFor="signup-name">Your name</label>
          <input id="signup-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="signup-email">Work email</label>
          <input id="signup-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="signup-password">Password</label>
          <div className="password-row">
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              aria-describedby="signup-password-hint"
              aria-invalid={short || undefined}
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
          <p className={`notice small${short ? " field-error" : ""}`} id="signup-password-hint">
            At least 12 characters. A short sentence is easy to remember and hard to guess.
          </p>
        </div>
        {refused === null ? null : (
          <p className="error" role="alert">
            {refused}
            {taken ? (
              <>
                {" "}
                <button type="button" className="link" onClick={onBack}>
                  Sign in instead
                </button>
              </>
            ) : null}
          </p>
        )}
        <button
          type="submit"
          className="block large"
          disabled={create.isPending || missing !== null}
          aria-describedby={missing === null ? undefined : "signup-missing"}
        >
          {create.isPending ? "Making the account…" : "Make the account"}
        </button>
        {missing === null ? null : (
          <p className="notice small disabled-reason" id="signup-missing">
            {missing} to continue.
          </p>
        )}
      </form>
      <div className="signin-links">
        <button type="button" className="link" onClick={onBack}>
          I already have an account
        </button>
      </div>
    </>
  );
}
