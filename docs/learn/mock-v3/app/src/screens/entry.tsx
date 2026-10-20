import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Phone,
  Mail,
  School,
  Check,
  GraduationCap,
  Building2,
  Rocket,
  Compass,
  Clock,
  CalendarRange,
  Languages,
  Gauge,
  Target,
  ShieldCheck,
  Sparkles,
  Pencil,
} from "lucide-react";
import { Link, navigate, useT, useCountdown } from "../lib/core";
import { Logo, LogoMark, Hl, Tick, Stamp, Seg, Diya, Badge } from "../ui/kit";
import { LangButton, ThemeButton } from "../ui/shell";

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

/* ---------------- sign in ---------------- */

export function LoginBody() {
  const t = useT();
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [step, setStep] = useState<"id" | "otp">("id");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [left, setLeft] = useCountdown(30, step === "otp");
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const full = otp.every((d) => d !== "");
  return (
    <div className="auth">
      <div className="auth-form">
        <div className="row between">
          <Link to="landing" aria-label="Parikshaa">
            <Logo size={28} />
          </Link>
          <div className="row g4">
            <LangButton compact />
            <ThemeButton />
          </div>
        </div>
        <div className="auth-in">
          {step === "id" ? (
            <>
              <h1 className="display auth-h">{t("Your plan is waiting.", "Aapka plan intezaar me hai.", "आपकी योजना इंतज़ार में है।")}</h1>
              <p className="muted">{t("Sign in or create an account. It takes under a minute.", "Sign in karo ya account banao. Ek minute se kam.", "साइन इन करें या खाता बनाएँ।")}</p>
              <button className="btn lg block google" onClick={() => navigate("onboarding")}>
                <GoogleG />
                {t("Continue with Google", "Google se aage badho", "Google से जारी रखें")}
              </button>
              <div className="or">
                <span>{t("or", "ya", "या")}</span>
              </div>
              <Seg
                value={mode}
                onChange={setMode}
                items={[
                  { id: "phone", label: t("Phone", "Phone", "फ़ोन"), icon: <Phone /> },
                  { id: "email", label: t("Email", "Email", "ईमेल"), icon: <Mail /> },
                ]}
              />
              <form
                className="col g12"
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep("otp");
                  setLeft(30);
                }}
              >
                {mode === "phone" ? (
                  <div className="field">
                    <label htmlFor="ph">{t("Mobile number", "Mobile number", "मोबाइल नंबर")}</label>
                    <div className="phone-in">
                      <span>+91</span>
                      <input id="ph" className="input" inputMode="numeric" defaultValue="98765 43210" />
                    </div>
                    <span className="help">{t("We send a 6-digit code by SMS. No spam.", "SMS par 6 ank ka code. Spam nahi.", "SMS पर 6 अंकों का कोड।")}</span>
                  </div>
                ) : (
                  <div className="field">
                    <label htmlFor="em">{t("College or personal email", "College ya personal email", "ईमेल")}</label>
                    <input id="em" className="input" type="email" defaultValue="aarav@college.edu.in" />
                  </div>
                )}
                <button className="btn pri lg block">
                  {t("Send code", "Code bhejo", "कोड भेजें")}
                  <ArrowRight />
                </button>
              </form>
              <button className="btn ghost block">
                <School />
                {t("Sign in with your college (campus licence)", "College se sign in (campus licence)", "कॉलेज से साइन इन")}
              </button>
            </>
          ) : (
            <>
              <button className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => setStep("id")}>
                <ArrowLeft />
                {t("Change number", "Number badlo", "नंबर बदलें")}
              </button>
              <h1 className="display auth-h">{t("Enter the code", "Code daalo", "कोड डालें")}</h1>
              <p className="muted">
                {t("Sent to", "Bheja gaya", "भेजा गया")} <b className="mono">+91 98765 43210</b>
              </p>
              <div className="otp" onPaste={(e) => {
                const d = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
                if (d.length) setOtp([...d, ...Array(6 - d.length).fill("")]);
              }}>
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      boxes.current[i] = el;
                    }}
                    className={`otp-box ${d ? "on" : ""}`}
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    aria-label={`Digit ${i + 1}`}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(-1);
                      const next = [...otp];
                      next[i] = v;
                      setOtp(next);
                      if (v && i < 5) boxes.current[i + 1]?.focus();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !otp[i] && i > 0) boxes.current[i - 1]?.focus();
                    }}
                  />
                ))}
              </div>
              <button className="btn sm ghost" style={{ alignSelf: "flex-start" }} onClick={() => setOtp(["4", "8", "2", "1", "9", "6"])}>
                {t("Fill sample code", "Sample code bharo", "नमूना कोड")}
              </button>
              <button className="btn pri lg block" disabled={!full} onClick={() => navigate("onboarding")}>
                {t("Verify and continue", "Verify karke aage", "सत्यापित करें")}
              </button>
              <p className="small faint">
                {left > 0
                  ? t(`Resend in 0:${String(left).padStart(2, "0")}`, `0:${String(left).padStart(2, "0")} me dobara bhejo`, `0:${String(left).padStart(2, "0")} में दोबारा`)
                  : t("Didn't get it? Resend · Call me instead", "Nahi mila? Dobara bhejo · Call karo", "नहीं मिला? दोबारा भेजें")}
              </p>
            </>
          )}
          <p className="tiny faint auth-legal">
            {t(
              "By continuing you agree to the Terms and Privacy Policy. We never sell your data.",
              "Aage badhne par Terms aur Privacy Policy maan rahe ho. Data kabhi nahi bechte.",
              "आगे बढ़कर आप शर्तें और गोपनीयता नीति मानते हैं।",
            )}
          </p>
        </div>
      </div>
      <div className="auth-art paper-grid" aria-hidden="true">
        <div className="auth-art-in">
          <span className="hand auth-scribble">{t("tonight, 7:30 pm", "aaj raat, 7:30", "आज रात 7:30")}</span>
          <div className="auth-card paper">
            <div className="row between">
              <span className="eyebrow">{t("Today", "Aaj", "आज")}</span>
              <Badge tone="tick">{t("2 days ahead", "2 din aage", "2 दिन आगे")}</Badge>
            </div>
            <div className="display" style={{ fontSize: 26, marginTop: 6 }}>
              {t("5 things, 2h 10m", "5 kaam, 2h 10m", "5 काम, 2 घं 10 मि")}
            </div>
            <ul className="ps-list">
              {[t("Stack: the LIFO idea", "Stack: LIFO idea", "स्टैक"), t("Pair with target sum", "Pair with target sum", "Pair with target sum"), t("Valid brackets", "Valid brackets", "Valid brackets"), t("6 revision cards", "6 revision cards", "6 कार्ड")].map((x, i) => (
                <li key={x} className={i === 0 ? "done" : ""}>
                  <span className="ps-box">{i === 0 && <Tick size={14} />}</span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="auth-points">
            {[
              [<CalendarRange key="a" />, t("A plan for every evening", "Har shaam ka plan", "हर शाम की योजना")],
              [<ShieldCheck key="b" />, t("A judge that shows why", "Judge jo wajah dikhaye", "कारण दिखाने वाला जज")],
              [<Sparkles key="c" />, t("A tutor that asks first", "Tutor jo pehle poochhe", "पहले पूछने वाला शिक्षक")],
            ].map(([ic, x], i) => (
              <span key={i}>
                {ic}
                {x}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- onboarding ---------------- */

type Ans = { year?: string; goal?: string; when?: string; hours?: string; weekend?: string; level?: string; lang?: string; exams?: string; ui?: string };

export function OnboardingBody() {
  const t = useT();
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Ans>({ weekend: "more", ui: "hg" });
  const [built, setBuilt] = useState(0);
  const total = 6;
  const set = (k: keyof Ans, v: string) => setA((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (step !== 6) return;
    if (document.documentElement.classList.contains("shots")) {
      setBuilt(4);
      return;
    }
    setBuilt(0);
    const id = window.setInterval(() => setBuilt((b) => (b >= 4 ? (window.clearInterval(id), b) : b + 1)), 650);
    return () => window.clearInterval(id);
  }, [step]);

  const Q: { eyebrow: string; q: string; help: string; key: keyof Ans; icon: ReactElement; opts: { id: string; label: string; sub?: string; icon?: ReactElement }[] }[] = [
    {
      eyebrow: t("About you", "Aapke baare me", "आपके बारे में"),
      q: t("Where are you right now?", "Aap abhi kahan ho?", "आप अभी कहाँ हैं?"),
      help: t("So the plan fits your semester.", "Taaki plan semester me fit ho.", "ताकि योजना सेमेस्टर में फ़िट हो।"),
      key: "year",
      icon: <GraduationCap />,
      opts: [
        { id: "1", label: t("1st year", "1st year", "पहला वर्ष") },
        { id: "2", label: t("2nd year", "2nd year", "दूसरा वर्ष") },
        { id: "3", label: t("3rd year", "3rd year", "तीसरा वर्ष") },
        { id: "4", label: t("Final year", "Final year", "अंतिम वर्ष") },
        { id: "g", label: t("Graduated", "Graduate", "स्नातक") },
        { id: "w", label: t("Working, 0–3 years", "Job me, 0–3 saal", "नौकरी में, 0–3 वर्ष") },
      ],
    },
    {
      eyebrow: t("Your goal", "Aapka goal", "आपका लक्ष्य"),
      q: t("What are you preparing for?", "Kiski taiyari kar rahe ho?", "किसकी तैयारी कर रहे हैं?"),
      help: t("You can change this later; the plan re-balances.", "Baad me badal sakte ho; plan khud adjust hoga.", "बाद में बदल सकते हैं।"),
      key: "goal",
      icon: <Target />,
      opts: [
        { id: "product", label: t("Product company SDE", "Product company SDE", "प्रोडक्ट कंपनी SDE"), sub: t("DSA-heavy, 3–4 rounds", "DSA zyada, 3–4 rounds", "DSA, 3–4 राउंड"), icon: <Rocket /> },
        { id: "service", label: t("Service companies", "Service companies", "सर्विस कंपनियाँ"), sub: t("Aptitude + coding + HR", "Aptitude + coding + HR", "एप्टीट्यूड + कोडिंग"), icon: <Building2 /> },
        { id: "startup", label: t("Startups", "Startups", "स्टार्टअप"), sub: t("Projects and practical rounds", "Projects aur practical rounds", "प्रोजेक्ट"), icon: <Sparkles /> },
        { id: "unsure", label: t("Not sure yet", "Abhi pata nahi", "अभी तय नहीं"), sub: t("We'll start broad and help you pick", "Broad shuru karke chunne me madad", "हम मदद करेंगे"), icon: <Compass /> },
      ],
    },
    {
      eyebrow: t("Your timeline", "Aapki timeline", "समय-सीमा"),
      q: t("When do placements start for you?", "Placements kab shuru hain?", "प्लेसमेंट कब शुरू?"),
      help: t("The plan ends two weeks before, so you have time for mocks.", "Plan do hafte pehle khatam hota hai, mocks ke liye samay.", "दो सप्ताह पहले योजना पूरी।"),
      key: "when",
      icon: <CalendarRange />,
      opts: [
        { id: "dec", label: t("December 2026", "December 2026", "दिसंबर 2026") },
        { id: "jul", label: t("July 2027", "July 2027", "जुलाई 2027") },
        { id: "now", label: t("Already started", "Shuru ho chuke", "शुरू हो चुके") },
        { id: "idk", label: t("I don't know", "Pata nahi", "पता नहीं") },
      ],
    },
    {
      eyebrow: t("Your time", "Aapka samay", "आपका समय"),
      q: t("How much time on a weekday?", "Weekday par kitna samay?", "सप्ताह के दिन कितना समय?"),
      help: t("Be honest; a plan you keep beats a plan you skip.", "Sach batao; nibhaya plan chhode plan se behtar.", "ईमानदारी से बताएँ।"),
      key: "hours",
      icon: <Clock />,
      opts: [
        { id: "1", label: t("About 1 hour", "Lagbhag 1 ghanta", "लगभग 1 घंटा") },
        { id: "2", label: t("About 2 hours", "Lagbhag 2 ghante", "लगभग 2 घंटे") },
        { id: "3", label: t("About 3 hours", "Lagbhag 3 ghante", "लगभग 3 घंटे") },
        { id: "4", label: t("4 hours or more", "4+ ghante", "4+ घंटे") },
      ],
    },
    {
      eyebrow: t("Where you start", "Kahan se shuru", "कहाँ से शुरू"),
      q: t("How comfortable are you with DSA?", "DSA me kitne comfortable ho?", "DSA में कितने सहज हैं?"),
      help: t("Not sure? Take a 10-minute check after this.", "Pata nahi? Iske baad 10 minute ka check do.", "10 मिनट का चेक दें।"),
      key: "level",
      icon: <Gauge />,
      opts: [
        { id: "0", label: t("Never written a loop", "Kabhi loop nahi likha", "कभी लूप नहीं लिखा") },
        { id: "1", label: t("Basics: arrays, strings", "Basics: arrays, strings", "बेसिक्स") },
        { id: "2", label: t("Comfortable up to trees", "Trees tak comfortable", "ट्री तक सहज") },
        { id: "3", label: t("Strong, want hard problems", "Strong, mushkil chahiye", "मज़बूत") },
      ],
    },
    {
      eyebrow: t("Calendar & language", "Calendar aur bhasha", "कैलेंडर और भाषा"),
      q: t("When are your semester exams?", "Semester exams kab hain?", "सेमेस्टर परीक्षा कब?"),
      help: t("Your plan goes lighter in exam weeks, on its own.", "Exam weeks me plan khud halka ho jaata hai.", "परीक्षा सप्ताह में योजना हल्की।"),
      key: "exams",
      icon: <CalendarRange />,
      opts: [
        { id: "nov", label: t("3–15 November", "3–15 November", "3–15 नवंबर"), sub: t("From your college calendar", "College calendar se", "कॉलेज कैलेंडर से") },
        { id: "dec", label: t("1–12 December", "1–12 December", "1–12 दिसंबर") },
        { id: "none", label: t("No exams before placements", "Placements se pehle exam nahi", "कोई परीक्षा नहीं") },
        { id: "later", label: t("I'll add dates later", "Baad me daalunga", "बाद में जोड़ूँगा") },
      ],
    },
  ];

  const summary: [ReactElement, string, string | undefined][] = [
    [<GraduationCap key="1" />, t("Year", "Saal", "वर्ष"), Q[0].opts.find((o) => o.id === a.year)?.label],
    [<Target key="2" />, t("Goal", "Goal", "लक्ष्य"), Q[1].opts.find((o) => o.id === a.goal)?.label],
    [<CalendarRange key="3" />, t("Placements", "Placements", "प्लेसमेंट"), Q[2].opts.find((o) => o.id === a.when)?.label],
    [<Clock key="4" />, t("Time", "Samay", "समय"), Q[3].opts.find((o) => o.id === a.hours)?.label],
    [<Gauge key="5" />, t("Start", "Shuru", "शुरुआत"), Q[4].opts.find((o) => o.id === a.level)?.label],
    [<Languages key="6" />, t("Exams", "Exams", "परीक्षा"), Q[5].opts.find((o) => o.id === a.exams)?.label],
  ];

  if (step >= 6) {
    const done = built >= 4;
    const items = [
      t("Reading your college calendar", "College calendar padh rahe", "कॉलेज कैलेंडर"),
      t("Picking 148 topics for Product SDE", "Product SDE ke 148 topics chun rahe", "148 विषय चुन रहे"),
      t("Fitting 2 hours a day around exams", "Exams ke gird 2 ghante roz", "परीक्षा के आसपास 2 घंटे"),
      t("Adding revision days", "Revision ke din jod rahe", "दोहराई के दिन"),
    ];
    return (
      <div className="onb">
        <header className="onb-top">
          <Logo size={26} />
          <div className="row g4">
            <LangButton compact />
            <ThemeButton />
          </div>
        </header>
        <div className="onb-done paper-grid">
          {!done ? (
            <div className="building">
              <Diya size={72} mood="think" />
              <h1 className="display" style={{ fontSize: 36 }}>
                {t("Writing your plan…", "Aapka plan likh rahe…", "योजना लिख रहे…")}
              </h1>
              <ul className="build-list">
                {items.map((x, i) => (
                  <li key={x} className={i < built ? "ok" : i === built ? "now" : ""}>
                    <span className="bl-ic">{i < built ? <Tick size={16} /> : <span className="spinner" />}</span>
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="ready">
              <div className="ready-stamp">
                <Stamp top="PARIKSHAA" mid="Plan ready" bottom="20 · 10 · 2026" />
              </div>
              <span className="eyebrow">{t("Your plan", "Aapka plan", "आपकी योजना")}</span>
              <h1 className="display ready-h">
                {t("Ready by ", "Taiyaar ", "तैयार ")}
                <Hl>{t("10 December", "10 December tak", "10 दिसंबर तक")}</Hl>
              </h1>
              <p className="muted" style={{ maxWidth: 520, fontSize: 16 }}>
                {t(
                  "Six sprints, about two hours an evening, lighter during your exams, with two weeks left for mocks before placements.",
                  "Chhe sprints, roz lagbhag do ghante, exams me halka, aur placements se pehle mocks ke liye do hafte.",
                  "छह स्प्रिंट, रोज़ लगभग दो घंटे, परीक्षा में हल्का।",
                )}
              </p>
              <div className="ready-grid">
                {[
                  ["6", t("sprints", "sprints", "स्प्रिंट")],
                  ["148", t("topics", "topics", "विषय")],
                  ["90h", t("total", "kul", "कुल")],
                  ["2h", t("a day", "roz", "प्रतिदिन")],
                ].map(([n, l]) => (
                  <div key={l}>
                    <b className="display">{n}</b>
                    <span>{l}</span>
                  </div>
                ))}
              </div>
              <div className="row wrap g10" style={{ justifyContent: "center" }}>
                <Link to="aaj" className="btn pri lg">
                  {t("Start today's plan", "Aaj ka plan shuru", "आज की योजना शुरू")}
                  <ArrowRight />
                </Link>
                <Link to="plan" className="btn lg">
                  {t("See the whole plan", "Poora plan dekho", "पूरी योजना")}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const q = Q[step];
  const val = a[q.key];
  return (
    <div className="onb">
      <header className="onb-top">
        <Link to="landing" aria-label="Parikshaa">
          <LogoMark size={28} />
        </Link>
        <div className="onb-prog">
          <span className="tiny faint num">
            {step + 1} / {total}
          </span>
          <div className="segs" style={{ width: "min(320px, 40vw)" }}>
            {Array.from({ length: total }, (_, i) => (
              <i key={i} className={i < step ? "ok" : i === step ? "on" : ""} />
            ))}
          </div>
        </div>
        <div className="row g4">
          <span className="hide-phone row g4">
            <LangButton compact />
            <ThemeButton />
          </span>
          <Link to="aaj" className="btn ghost sm">
            {t("Skip for now", "Abhi skip", "अभी छोड़ें")}
          </Link>
        </div>
      </header>
      <div className="onb-body">
        <div className="onb-q" key={step}>
          <span className="eyebrow row g6">
            {q.icon}
            {q.eyebrow}
          </span>
          <h1 className="display onb-h">{q.q}</h1>
          <p className="muted">{q.help}</p>
          <div className={`onb-opts ${q.opts[0].sub ? "rich" : ""}`}>
            {q.opts.map((o) => (
              <button key={o.id} className="option" aria-pressed={val === o.id} onClick={() => set(q.key, o.id)}>
                {o.icon ? <span className="opt-ic">{o.icon}</span> : <span className="radio" aria-checked={val === o.id} />}
                <span className="grow" style={{ minWidth: 0 }}>
                  <b style={{ fontWeight: 560 }}>{o.label}</b>
                  {o.sub && <span className="tiny faint" style={{ display: "block" }}>{o.sub}</span>}
                </span>
                {val === o.id && <Check className="t-pen" />}
              </button>
            ))}
          </div>
          {step === 3 && (
            <div className="row g10 wrap mt8">
              <span className="small muted">{t("Weekends:", "Weekend:", "सप्ताहांत:")}</span>
              <Seg
                value={a.weekend ?? "more"}
                onChange={(v) => set("weekend", v)}
                items={[
                  { id: "same", label: t("Same", "Utna hi", "उतना ही") },
                  { id: "more", label: t("More", "Zyada", "ज़्यादा") },
                  { id: "off", label: t("Rest day", "Chhutti", "आराम") },
                ]}
              />
            </div>
          )}
          {step === 5 && (
            <div className="row g10 wrap mt8">
              <span className="small muted">{t("Learn in:", "Padhai ki bhasha:", "पढ़ाई की भाषा:")}</span>
              <Seg
                value={a.ui ?? "hg"}
                onChange={(v) => set("ui", v)}
                items={[
                  { id: "en", label: "English" },
                  { id: "hg", label: "Hinglish" },
                  { id: "hi", label: "हिंदी" },
                ]}
              />
            </div>
          )}
          <div className="onb-nav">
            <button className="btn ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeft />
              {t("Back", "Peeche", "पीछे")}
            </button>
            <button className="btn pri lg" onClick={() => setStep((s) => s + 1)} disabled={!val}>
              {step === total - 1 ? t("Write my plan", "Mera plan likho", "योजना लिखें") : t("Next", "Aage", "आगे")}
              <ArrowRight />
            </button>
          </div>
        </div>
        <aside className="onb-side" aria-label="Your plan so far">
          <div className="onb-paper margin-page paper-ruled">
            <div className="row between">
              <span className="hand onb-title">{t("Plan for Aarav", "Aarav ka plan", "आरव की योजना")}</span>
              <Pencil className="faint" style={{ width: 16, height: 16 }} />
            </div>
            <ul className="onb-sum">
              {summary.map(([ic, k, v], i) => (
                <li key={i} className={v ? "on" : ""}>
                  <span className="os-ic">{ic}</span>
                  <span className="faint small">{k}</span>
                  <b className="ellipsis">{v ?? "—"}</b>
                  {v && <Tick size={15} />}
                </li>
              ))}
            </ul>
            <div className="onb-fore">
              <span className="tiny faint">{t("Forecast so far", "Ab tak ka andaaza", "अब तक का अनुमान")}</span>
              <b>{a.goal && a.hours ? t("≈ 90 hours · ready by 10 Dec", "≈ 90 ghante · 10 Dec tak", "≈ 90 घंटे · 10 दिसंबर") : t("Answer a few more…", "Kuch aur jawab do…", "कुछ और जवाब…")}</b>
            </div>
          </div>
          <div className="onb-diya">
            <Diya size={64} mood={step > 3 ? "cheer" : "happy"} />
          </div>
        </aside>
      </div>
    </div>
  );
}
