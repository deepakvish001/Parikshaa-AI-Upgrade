import { useEffect, useId, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, CalendarRange, Check, ShieldCheck } from "lucide-react";
import { ApiError } from "../api.ts";
import { ScreenLink, useLearn } from "./context.tsx";
import { keepNext, safeNext, useLearnData, useSignInOptions } from "./data.tsx";
import { Sparkles } from "./icons.tsx";
import type { Tri } from "./screens.ts";
import { fill } from "./text.ts";
import "./learn-account.css";

/**
 * Learn's own sign-in and sign-up (tracker row 140, K2-2; the mock's
 * `LoginBody`, docs/learn/mock-v3/app/src/screens/entry.tsx), on the practice
 * site's own routes and session: email and password
 * (`POST /practice/<site>/signin`, `/signup`), and Google where the site
 * offers it (`/auth/google`, which comes back with `#session=`; data.tsx keeps
 * it). Nothing new on the server, and the account is the practice site's.
 *
 * After signing in the learner goes back to where they set out from (`?next=`,
 * only a screen of this site: `safeNext`), else to Aaj; after signing up, to
 * onboarding. The mock's phone OTP and campus sign-in have no backend yet
 * (Kadam 3/4), so they are not offered.
 */

export const W = {
  inTitle: ["Your plan is waiting.", "Aapka plan intezaar me hai.", "आपकी योजना इंतज़ार में है।"],
  inSub: ["Sign in to pick up where you left off.", "Sign in karo, jahan chhoda tha wahin se aage.", "साइन इन करें, जहाँ छोड़ा था वहीं से आगे।"],
  upTitle: ["Make your account.", "Apna account banao.", "अपना खाता बनाएँ।"],
  upSub: ["Under a minute, then six questions and your plan.", "Ek minute se kam, phir 6 sawaal aur aapka plan.", "एक मिनट से कम, फिर 6 सवाल और आपकी योजना।"],
  google: ["Continue with Google", "Google se aage badho", "Google से जारी रखें"],
  or: ["or with your email", "ya email se", "या ईमेल से"],
  name: ["Your name", "Aapka naam", "आपका नाम"],
  email: ["Email", "Email", "ईमेल"],
  password: ["Password", "Password", "पासवर्ड"],
  passwordHint: ["12 characters or more. A short sentence is easy to remember.", "Kam se kam 12 akshar. Chhota sa vaakya yaad rehta hai.", "कम से कम 12 अक्षर। छोटा सा वाक्य याद रहता है।"],
  signIn: ["Sign in", "Sign in karo", "साइन इन करें"],
  signUp: ["Make my account", "Account banao", "खाता बनाएँ"],
  newHere: ["New here?", "Naye ho?", "नए हैं?"],
  makeOne: ["Make an account", "Account banao", "खाता बनाएँ"],
  haveOne: ["Have an account?", "Account hai?", "खाता है?"],
  wrong: ["That email and password do not match an account here.", "Ye email aur password yahan kisi account se nahi milte.", "यह ईमेल और पासवर्ड यहाँ किसी खाते से नहीं मिलते।"],
  taken: ["There is already an account with this email. Sign in instead.", "Is email ka account pehle se hai. Sign in karo.", "इस ईमेल का खाता पहले से है। साइन इन करें।"],
  tooMany: ["Too many tries. Wait a few minutes, then try again.", "Bahut koshishein. Kuch minute ruk kar phir karo.", "बहुत कोशिशें। कुछ मिनट रुककर फिर करें।"],
  invalid: ["Check your name, email and password (12 characters or more).", "Naam, email aur password (12+ akshar) dekho.", "नाम, ईमेल और पासवर्ड (12+ अक्षर) देखें।"],
  failed: ["That did not go through. Nothing is lost; try again.", "Ye nahi hua. Kuch nahi gaya; phir koshish karo.", "यह नहीं हुआ। कुछ नहीं गया; फिर कोशिश करें।"],
  checkEmail: ["Account made. We sent a link to {email}: open it to confirm your address.", "Account ban gaya. {email} par link bheja hai: kholkar email confirm karo.", "खाता बन गया। {email} पर लिंक भेजा है: खोलकर ईमेल पक्का करें।"],
  sample: ["Sample", "Namoona", "नमूना"],
  sampleToday: ["Today · 5 things, 2h 10m", "Aaj · 5 kaam, 2h 10m", "आज · 5 काम, 2 घं 10 मि"],
  sampleTasks: ["Stack: the LIFO idea|Pair with target sum|Valid brackets|6 revision cards", "Stack: LIFO idea|Pair with target sum|Valid brackets|6 revision cards", "स्टैक: LIFO का विचार|Pair with target sum|Valid brackets|6 दोहराई कार्ड"],
  pointPlan: ["A plan for every evening", "Har shaam ka plan", "हर शाम की योजना"],
  pointJudge: ["A judge that shows why", "Judge jo wajah dikhaye", "कारण दिखाने वाला जज"],
  pointTutor: ["A tutor that asks first", "Tutor jo pehle poochhe", "पहले पूछने वाला शिक्षक"],
} as const satisfies Record<string, Tri>;

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** Why a sign-in or sign-up was refused, in the learner's words. */
export function refusal(error: unknown): Tri {
  if (!(error instanceof ApiError)) return W.failed;
  if (error.code === "sign_in_failed") return W.wrong;
  if (error.code === "email_taken") return W.taken;
  if (error.code === "too_many_attempts" || error.status === 429) return W.tooMany;
  if (error.code === "invalid" || error.status === 400 || error.status === 422) return W.invalid;
  return W.failed;
}

/** `?next=` on this page's address, if it names a screen of this site. */
const nextOf = (): string | null => safeNext(new URLSearchParams(window.location.search).get("next"));

export function AccountPage({ mode }: { readonly mode: "signin" | "signup" }) {
  const { t, go, site, notify } = useLearn();
  const { client, signedIn, signIn } = useLearnData();
  const options = useSignInOptions();
  const id = useId();
  const next = nextOf();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Already signed in when the page opened: nothing to do here.
  const [already] = useState(signedIn);
  useEffect(() => {
    if (already) go(next ?? "aaj", true);
    // Once, on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const send = useMutation({
    mutationFn: () => (mode === "signup" ? client.signUp(name.trim(), email.trim(), password) : client.signIn(email.trim(), password)),
    onSuccess: (session) => {
      signIn(session.token);
      if (mode === "signup") {
        go("onboarding");
        notify({ tone: "info", text: fill(t(W.checkEmail), { email: session.learner.email }) });
      } else {
        go(next ?? "aaj");
      }
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    send.mutate();
  };
  const other = mode === "signup" ? "signin" : "signup";
  const tasks = t(W.sampleTasks).split("|");
  if (already) return null;
  return (
    <div className="la-auth">
      <div className="la-form">
        <div className="la-in">
          <h1 className="la-h">{t(mode === "signup" ? W.upTitle : W.inTitle)}</h1>
          <p className="la-sub">{t(mode === "signup" ? W.upSub : W.inSub)}</p>
          {options.data?.google === true ? (
            <>
              <a className="ln-btn ln-btn-lg la-google" href={client.googleUrl} onClick={() => keepNext(site, next)}>
                <GoogleG />
                {t(W.google)}
              </a>
              <p className="la-or">
                <span>{t(W.or)}</span>
              </p>
            </>
          ) : null}
          <form className="la-fields" onSubmit={submit} aria-label={t(mode === "signup" ? W.signUp : W.signIn)}>
            {mode === "signup" ? (
              <label className="ln-field">
                <span>{t(W.name)}</span>
                <input className="ln-input" autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
              </label>
            ) : null}
            <label className="ln-field">
              <span>{t(W.email)}</span>
              <input className="ln-input" type="email" autoComplete="email" required maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="ln-field">
              <span>{t(W.password)}</span>
              <input
                className="ln-input"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={mode === "signup" ? 12 : 1}
                maxLength={200}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                {...(mode === "signup" ? { "aria-describedby": `${id}-hint` } : {})}
              />
            </label>
            {mode === "signup" ? (
              <span className="ln-faint la-hint" id={`${id}-hint`}>
                {t(W.passwordHint)}
              </span>
            ) : null}
            {send.isError ? (
              <p className="la-error" role="alert">
                {t(refusal(send.error))}
              </p>
            ) : null}
            <button type="submit" className="ln-btn ln-btn-pri ln-btn-lg" disabled={send.isPending}>
              {t(mode === "signup" ? W.signUp : W.signIn)}
              <ArrowRight aria-hidden="true" />
            </button>
          </form>
          <p className="la-switch">
            {t(mode === "signup" ? W.haveOne : W.newHere)}{" "}
            <ScreenLink to={next === null ? other : `${other}?next=${encodeURIComponent(next)}`}>{t(mode === "signup" ? W.signIn : W.makeOne)}</ScreenLink>
          </p>
        </div>
      </div>
      <div className="la-art" aria-hidden="true">
        <div className="la-art-in">
          <div className="la-card">
            <div className="la-card-top">
              <span className="ln-eyebrow">{t(W.sampleToday)}</span>
              <span className="la-sample">{t(W.sample)}</span>
            </div>
            <ul>
              {tasks.map((task, i) => (
                <li key={task} className={i === 0 ? "la-done" : undefined}>
                  <span className="la-box">{i === 0 ? <Check /> : null}</span>
                  {task}
                </li>
              ))}
            </ul>
          </div>
          <ul className="la-points">
            <li>
              <CalendarRange />
              {t(W.pointPlan)}
            </li>
            <li>
              <ShieldCheck />
              {t(W.pointJudge)}
            </li>
            <li>
              <Sparkles />
              {t(W.pointTutor)}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
