import { useEffect, useRef, useState } from "react";
import { ArrowRight, Smartphone, Mail, ShieldCheck, Check, ArrowLeft } from "lucide-react";
import { Link, navigate, useCountdown, useT } from "../lib/core";
import { Diya, LogoMark, Seg } from "../ui/kit";
import { LangMenu, ThemeButton } from "../ui/shell";

export function LoginScreen() {
  const t = useT();
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [step, setStep] = useState<"enter" | "otp">("enter");
  const [phone, setPhone] = useState("98765 43210");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [left, setLeft] = useCountdown(30, step === "otp");
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => {
    if (step === "otp") boxes.current[0]?.focus();
  }, [step]);
  const filled = otp.every((d) => d !== "");
  return (
    <div className="auth">
      <aside className="auth-side">
        <Link to="landing" className="brand">
          <LogoMark size={30} /> Parikshaa
        </Link>
        <div className="stack lg">
          <Diya size={96} mood="happy" className="bob" />
          <h2>{t("One plan. Every day. Until the offer.", "Ek plan. Roz. Offer tak.", "एक योजना। रोज़। ऑफ़र तक।")}</h2>
          <ul className="auth-points">
            <li>
              <Check size={15} /> {t("A plan built around your college calendar", "College calendar ke hisaab se plan", "कॉलेज कैलेंडर के हिसाब से योजना")}
            </li>
            <li>
              <Check size={15} /> {t("The smallest test your code fails", "Sabse chhota test jahan code fail", "सबसे छोटा गलत टेस्ट")}
            </li>
            <li>
              <Check size={15} /> {t("Sahayak in English, Hinglish or Hindi", "Sahayak English, Hinglish ya Hindi me", "सहायक हिंदी में भी")}
            </li>
          </ul>
        </div>
        <span className="faint" style={{ fontSize: "var(--fs-12)" }}>
          <ShieldCheck size={12} style={{ verticalAlign: -2 }} /> {t("We never show your phone number to anyone.", "Aapka number kisi ko nahi dikhate.", "आपका नंबर किसी को नहीं दिखता।")}
        </span>
      </aside>

      <main className="auth-main">
        <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
          <LangMenu />
          <ThemeButton />
        </div>
        <div className="auth-card">
          {step === "enter" ? (
            <>
              <div>
                <h1>{t("Create your account", "Account banao", "खाता बनाएँ")}</h1>
                <p className="muted">{t("Already have one? The same steps log you in.", "Pehle se hai? Yahi steps se login.", "पहले से है? इन्हीं से लॉग इन।")}</p>
              </div>
              <button type="button" className="btn secondary lg block google">
                <span className="g-mark" aria-hidden="true">G</span>
                {t("Continue with Google", "Google se aage badho", "गूगल से आगे बढ़ें")}
              </button>
              <div className="or">
                <span>{t("or", "ya", "या")}</span>
              </div>
              <Seg
                label="Method"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "phone", label: <><Smartphone size={13} /> {t("Phone", "Phone", "फ़ोन")}</> },
                  { value: "email", label: <><Mail size={13} /> Email</> },
                ]}
              />
              {mode === "phone" ? (
                <div className="field">
                  <label htmlFor="phone">{t("Mobile number", "Mobile number", "मोबाइल नंबर")}</label>
                  <div className="input">
                    <span className="faint">+91</span>
                    <input id="phone" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <span className="hint">{t("We send a 6-digit code by SMS. WhatsApp if SMS is slow.", "6 ank ka code SMS se. SMS dheema ho to WhatsApp.", "6 अंकों का कोड SMS से।")}</span>
                </div>
              ) : (
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <div className="input">
                    <Mail size={15} />
                    <input id="email" type="email" defaultValue="aarav@college.edu.in" />
                  </div>
                  <span className="hint">{t("We send a sign-in link. No password to remember.", "Sign-in link bhejenge. Password yaad nahi rakhna.", "साइन-इन लिंक भेजेंगे।")}</span>
                </div>
              )}
              <button type="button" className="btn primary lg block" onClick={() => setStep("otp")}>
                {mode === "phone" ? t("Send code", "Code bhejo", "कोड भेजें") : t("Send link", "Link bhejo", "लिंक भेजें")} <ArrowRight size={16} />
              </button>
              <p className="faint" style={{ fontSize: "var(--fs-12)" }}>
                {t("By continuing you agree to the terms and the privacy notice.", "Aage badhne par aap terms aur privacy notice maante hain.", "आगे बढ़ने पर आप शर्तें मानते हैं।")}
              </p>
            </>
          ) : (
            <>
              <button type="button" className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => setStep("enter")}>
                <ArrowLeft size={14} /> {t("Change number", "Number badlo", "नंबर बदलें")}
              </button>
              <div>
                <h1>{t("Enter the code", "Code daalo", "कोड डालें")}</h1>
                <p className="muted">
                  {t("Sent to", "Bheja gaya", "भेजा गया")} +91 {phone}
                </p>
              </div>
              <div className="otp" role="group" aria-label="One-time code">
                {otp.map((d, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    ref={(el) => {
                      boxes.current[i] = el;
                    }}
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    aria-label={`Digit ${i + 1}`}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(-1);
                      setOtp((o) => o.map((x, j) => (j === i ? v : x)));
                      if (v && i < 5) boxes.current[i + 1]?.focus();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !otp[i] && i > 0) boxes.current[i - 1]?.focus();
                    }}
                  />
                ))}
              </div>
              <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => setOtp(["4", "8", "2", "9", "1", "6"])}>
                {t("Fill a sample code", "Namune ka code bharo", "नमूना कोड भरें")}
              </button>
              <button type="button" className="btn primary lg block" disabled={!filled} onClick={() => navigate("onboarding")}>
                {t("Verify and continue", "Verify karke aage", "जाँचें और आगे")} <ArrowRight size={16} />
              </button>
              <p className="faint" style={{ fontSize: "var(--fs-12)" }}>
                {left > 0 ? (
                  <>
                    {t("Resend in", "Dobara bhejo", "फिर से भेजें")} <span className="num">0:{String(left).padStart(2, "0")}</span>
                  </>
                ) : (
                  <button type="button" className="link-btn" onClick={() => setLeft(30)}>
                    {t("Resend code", "Code dobara bhejo", "कोड फिर से भेजें")}
                  </button>
                )}
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
