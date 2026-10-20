import { useEffect, useRef, useState } from "react";
import { Sparkles, X, PanelRightClose, FileCode2, ArrowUp, ThumbsUp, ThumbsDown, Copy, Lightbulb, CircleCheck, CircleDashed, Lock, Paperclip, History } from "lucide-react";
import { useT } from "../lib/core";
import { Seg, Badge, Code } from "./kit";

/** Types a reply out a few characters at a time (instant in screenshot mode). */
function useTyped(text: string, on: boolean) {
  const instant = document.documentElement.classList.contains("shots");
  const [n, setN] = useState(instant || !on ? text.length : 0);
  useEffect(() => {
    if (instant || !on) {
      setN(text.length);
      return;
    }
    setN(0);
    const id = window.setInterval(() => setN((x) => (x >= text.length ? (window.clearInterval(id), x) : x + 3)), 16);
    return () => window.clearInterval(id);
  }, [text, on, instant]);
  return text.slice(0, n);
}

export type AiMode = "learn" | "build";

/** The Sahayak conversation. Used in the right pane of any page, in the problem workspace and on its own page. */
export function SahayakPanel({
  onClose,
  onMinimize,
  context = "problem",
  locked,
  full,
}: {
  onClose?: () => void;
  onMinimize?: () => void;
  context?: "problem" | "lesson" | "studio" | "general";
  locked?: boolean;
  full?: boolean;
}) {
  const t = useT();
  const [mode, setMode] = useState<AiMode>(context === "studio" ? "build" : "learn");
  const [asked, setAsked] = useState(false);
  const [hint, setHint] = useState(2);
  const [draft, setDraft] = useState("");
  const body = useRef<HTMLDivElement>(null);
  const reply = t(
    "Yes. a[L] + a[R] can reach 3 × 10⁹, but an int stops at about 2.1 × 10⁹, so the sum wraps to a negative number and the loop moves the wrong pointer.",
    "Haan. a[L] + a[R] 3 × 10⁹ tak ja sakta hai, par int lagbhag 2.1 × 10⁹ par ruk jaata hai; sum negative ho jaata hai aur loop galat pointer hilata hai.",
    "हाँ। a[L] + a[R] 3 × 10⁹ तक जा सकता है, पर int लगभग 2.1 × 10⁹ पर रुक जाता है; योग ऋणात्मक हो जाता है।",
  );
  const typed = useTyped(reply, asked);
  useEffect(() => {
    body.current?.scrollTo({ top: body.current.scrollHeight, behavior: "smooth" });
  }, [typed, asked, mode]);

  const ctxLabel =
    context === "lesson"
      ? t("Lesson · Two pointers", "Lesson · Two pointers", "पाठ · दो पॉइंटर")
      : context === "studio"
        ? t("expense-split · src/api/split.ts", "expense-split · src/api/split.ts", "expense-split · src/api/split.ts")
        : t("Pair with target sum · line 4", "Pair with target sum · line 4", "Pair with target sum · पंक्ति 4");

  return (
    <div className={`sahayak ${full ? "ai-full" : ""}`}>
      <div className="ai-h">
        <span className="ai-mark">
          <Sparkles />
        </span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row g6">
            <b className="h3">Sahayak</b>
            <Badge tone="ai" sq>
              AI
            </Badge>
          </div>
          <div className="tiny faint num">{t("38 of 200 messages today", "Aaj 38 / 200 message", "आज 38 / 200 संदेश")}</div>
        </div>
        {!full && (
          <>
            {onMinimize && (
              <button className="icon-btn sm" onClick={onMinimize} data-tip={t("Collapse", "Chhota karo", "छोटा करें")} data-tip-pos="bottom">
                <PanelRightClose />
              </button>
            )}
            {onClose && (
              <button className="icon-btn sm" onClick={onClose} data-tip={t("Close (Ctrl J)", "Band (Ctrl J)", "बंद (Ctrl J)")} data-tip-pos="bottom">
                <X />
              </button>
            )}
          </>
        )}
      </div>

      {locked ? (
        <div className="ai-locked">
          <span className="ai-mark lg">
            <Lock />
          </span>
          <div className="h3">{t("Sahayak is off during contests and mock tests", "Contest aur mock test me Sahayak band hai", "प्रतियोगिता और मॉक टेस्ट में सहायक बंद है")}</div>
          <p className="muted small">
            {t(
              "So every score is your own. It opens again for review the moment you submit.",
              "Taaki har score aapka apna ho. Submit karte hi review ke liye wapas khulega.",
              "ताकि हर स्कोर आपका अपना हो। सबमिट करते ही समीक्षा के लिए खुलेगा।",
            )}
          </p>
        </div>
      ) : (
        <>
          <div className="ai-bar">
            <Seg
              value={mode}
              onChange={setMode}
              items={[
                { id: "learn", label: t("Learn", "Seekho", "सीखो") },
                { id: "build", label: t("Build", "Banao", "बनाओ") },
              ]}
            />
            <span className="ai-ctx" title={ctxLabel}>
              <FileCode2 />
              <span className="ellipsis">{ctxLabel}</span>
            </span>
            <button className="icon-btn sm" data-tip={t("History", "History", "इतिहास")} data-tip-pos="bottom">
              <History />
            </button>
          </div>
          <div className="ai-body" ref={body}>
            <div className="ai-note tiny">
              {mode === "learn"
                ? t(
                    "Learn mode: hints and questions, no full solution. Hints you use show on your submission.",
                    "Seekho mode: hint aur sawaal, poora hal nahi. Liye gaye hint submission par dikhte hain.",
                    "सीखो मोड: संकेत और सवाल, पूरा हल नहीं।",
                  )
                : t("Build mode: suggests code changes as a diff you can apply or ignore.", "Banao mode: code ka badlaav diff me, lagao ya chhodo.", "बनाओ मोड: बदलाव diff में।")}
            </div>

            <div className="msg me">{t("Why does my code fail test 23?", "Mera code test 23 par fail kyun?", "मेरा कोड टेस्ट 23 पर क्यों फेल?")}</div>

            <div className="msg ai-msg">
              <div className="ai-block good">
                <CircleCheck />
                <div>
                  <b>{t("What you got right", "Kya theek hai", "क्या सही है")}</b>
                  <p>{t("Two pointers is the right idea, and you move L and R the right way.", "Two pointers sahi idea hai, aur L, R sahi taraf hilte hain.", "दो पॉइंटर सही विचार है।")}</p>
                </div>
              </div>
              <div className="ai-block miss">
                <CircleDashed />
                <div>
                  <b>{t("What is missing", "Kya chhoota", "क्या छूटा")}</b>
                  <p>
                    {t("Look at line 4:", "Line 4 dekho:", "पंक्ति 4 देखें:")} <code className="inl">int sum = a[L] + a[R];</code>
                  </p>
                </div>
              </div>
              <div className="ai-q">
                <Lightbulb />
                <span>
                  {t(
                    "If a[i] can be 1.5 × 10⁹, what happens when you add two of them in an int?",
                    "Agar a[i] 1.5 × 10⁹ tak ho, to do ko int me jodne par kya hoga?",
                    "अगर a[i] 1.5 × 10⁹ तक हो, तो दो को int में जोड़ने पर क्या होगा?",
                  )}
                </span>
              </div>
              <div className="row g6 mt8">
                <span className="tiny faint">
                  {t("Hint", "Hint", "संकेत")} {hint} / 3
                </span>
                <button className="btn sm ghost" onClick={() => setHint((h) => Math.min(3, h + 1))} disabled={hint >= 3}>
                  {t("One more hint", "Ek aur hint", "एक और संकेत")}
                </button>
              </div>
              <div className="msg-tools">
                <button className="icon-btn sm" aria-label="Helpful">
                  <ThumbsUp />
                </button>
                <button className="icon-btn sm" aria-label="Not helpful">
                  <ThumbsDown />
                </button>
                <button className="icon-btn sm" aria-label="Copy">
                  <Copy />
                </button>
              </div>
            </div>

            {asked && (
              <>
                <div className="msg me">{t("It overflows?", "Overflow ho jaata hai?", "ओवरफ़्लो हो जाता है?")}</div>
                <div className="msg ai-msg">
                  <p>
                    {typed}
                    {typed.length < reply.length && <span className="type-caret" />}
                  </p>
                  {typed.length >= reply.length &&
                    (mode === "build" ? (
                      <div className="ai-diff">
                        <div className="row between tiny faint" style={{ padding: "6px 10px" }}>
                          <span className="mono">solution.cpp</span>
                          <span>1 line</span>
                        </div>
                        <Code code={"int sum = a[L] + a[R];\nlong long sum = (long long)a[L] + a[R];"} bad={[1]} good={[2]} nonum />
                        <div className="row g6" style={{ padding: 8 }}>
                          <button className="btn sm pri">{t("Apply", "Lagao", "लागू करें")}</button>
                          <button className="btn sm ghost">{t("Ignore", "Chhodo", "छोड़ें")}</button>
                        </div>
                      </div>
                    ) : (
                      <p className="muted mt8">
                        {t(
                          "Which type can hold 3 × 10⁹? Change line 4 yourself and run test 23 again.",
                          "Kaunsa type 3 × 10⁹ rakh sakta hai? Line 4 khud badlo aur test 23 phir chalao.",
                          "कौन-सा टाइप 3 × 10⁹ रख सकता है? पंक्ति 4 खुद बदलें।",
                        )}
                      </p>
                    ))}
                </div>
              </>
            )}
          </div>

          <div className="ai-sugg">
            {!asked && (
              <button className="chip" onClick={() => setAsked(true)}>
                {t("It overflows?", "Overflow ho jaata hai?", "ओवरफ़्लो हो जाता है?")}
              </button>
            )}
            <button className="chip">{t("Explain two pointers", "Two pointers samjhao", "दो पॉइंटर समझाएँ")}</button>
            <button className="chip">{t("Check my complexity", "Complexity jaancho", "जटिलता जाँचें")}</button>
          </div>

          <form
            className="ai-compose"
            onSubmit={(e) => {
              e.preventDefault();
              setAsked(true);
              setDraft("");
            }}
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("Ask about this problem…", "Is problem ke baare me poochho…", "इस प्रश्न के बारे में पूछें…")}
              rows={2}
            />
            <div className="row">
              <button type="button" className="icon-btn sm" aria-label="Attach selected code">
                <Paperclip />
              </button>
              <span className="tiny faint grow">{t("Sahayak can be wrong. Run your code to check.", "Sahayak galat ho sakta hai. Code chala kar jaancho.", "सहायक गलत हो सकता है।")}</span>
              <button className="send" aria-label="Send">
                <ArrowUp />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
