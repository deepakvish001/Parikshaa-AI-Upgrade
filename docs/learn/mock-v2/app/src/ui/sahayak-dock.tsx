import { useEffect, useRef, useState } from "react";
import { X, Plus, Send, AtSign, Check, X as Cross, Sparkles, FileText, CircleAlert, CodeXml, BookOpen, Info } from "lucide-react";
import { useT } from "../lib/core";
import { Diya, Seg } from "./kit";

type Mode = "learn" | "build";

function useStream(text: string, on: boolean, speed = 14) {
  const [n, setN] = useState(on ? 0 : text.length);
  useEffect(() => {
    if (!on) {
      setN(text.length);
      return;
    }
    setN(0);
    const id = window.setInterval(() => setN((x) => (x >= text.length ? x : x + 3)), speed);
    return () => window.clearInterval(id);
  }, [text, on, speed]);
  return text.slice(0, n);
}

export function ContextChip({ icon, label, onRemove }: { icon: "problem" | "verdict" | "code" | "lesson"; label: string; onRemove?: () => void }) {
  const Icon = icon === "problem" ? FileText : icon === "verdict" ? CircleAlert : icon === "code" ? CodeXml : BookOpen;
  return (
    <span className="ctx-chip">
      <Icon size={12} />
      {label}
      {onRemove && (
        <button type="button" aria-label={`Remove ${label}`} onClick={onRemove}>
          <X size={11} />
        </button>
      )}
    </span>
  );
}

/** The conversation used in the dock, the problem page and the Sahayak page. */
export function SahayakChat({ compact }: { compact?: boolean }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("learn");
  const [chips, setChips] = useState(["problem", "verdict", "code"]);
  const [asked, setAsked] = useState(false);
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);

  const learnIntro = t(
    "You pass 23 of 24 tests, so the idea is right. The miss is one input, not the approach.",
    "24 me se 23 test pass hain, matlab idea sahi hai. Galti ek input me hai, approach me nahi.",
    "24 में से 23 टेस्ट पास हैं, यानी तरीका सही है। गलती एक इनपुट में है, तरीके में नहीं।",
  );
  const buildIntro = t(
    "Line 4 adds two values up to 1.5 × 10⁹ in an int. Their sum can pass 2,147,483,647 and wrap to a negative number. Keep the sum in a long long.",
    "Line 4 me do value (1.5 × 10⁹ tak) int me jud rahi hain. Sum 2,147,483,647 se upar jaakar negative ho jaata hai. Sum long long me rakho.",
    "पंक्ति 4 में दो मान (1.5 × 10⁹ तक) int में जुड़ रहे हैं। योग 2,147,483,647 से ऊपर जाकर ऋणात्मक हो जाता है। योग long long में रखें।",
  );
  const intro = useStream(mode === "learn" ? learnIntro : buildIntro, true);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [asked, mode]);

  return (
    <div className={`sahayak ${compact ? "compact" : ""}`}>
      <div className="sahayak-modes">
        <Seg<Mode>
          label="Mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "learn", label: t("Learn mode", "Seekho mode", "सीखो मोड") },
            { value: "build", label: t("Build mode", "Banao mode", "बनाओ मोड") },
          ]}
        />
        <span className="faint" style={{ fontSize: "var(--fs-11)" }}>
          {mode === "learn"
            ? t("Asks you questions, never gives the answer first", "Sawaal poochh kar sikhata hai, jawab pehle nahi", "सवाल पूछकर सिखाता है, जवाब पहले नहीं")
            : t("Points to the fix directly", "Seedha fix batata hai", "सीधे सुधार बताता है")}
        </span>
      </div>
      <div className="sahayak-thread">
        <div className="msg me">
          <p>{t("Why does my code fail on the hidden test?", "Mera code hidden test par fail kyun ho raha hai?", "मेरा कोड छिपे टेस्ट पर क्यों फेल हो रहा है?")}</p>
          <div className="row wrap" style={{ gap: 6 }}>
            <ContextChip icon="problem" label="Pair with target sum" />
            <ContextChip icon="verdict" label={t("Wrong answer · 23/24", "Galat jawab · 23/24", "गलत उत्तर · 23/24")} />
          </div>
        </div>
        <div className="msg ai">
          <Diya size={28} mood="think" className="msg-avatar" />
          <div className="ai-card">
            <p>{intro}</p>
            {mode === "learn" ? (
              <>
                <div className="ai-block ok">
                  <b>{t("What you did well", "Kya sahi kiya", "क्या सही किया")}</b>
                  <p>
                    <Check size={14} /> {t("Two pointers on a sorted array: the right pattern, O(n).", "Sorted array par two pointers: sahi pattern, O(n).", "सॉर्टेड ऐरे पर दो पॉइंटर: सही पैटर्न, O(n)।")}
                  </p>
                  <p>
                    <Check size={14} /> {t("You move the correct pointer when the sum is too small or too big.", "Sum chhota/bada hone par sahi pointer aage badhate ho.", "योग छोटा/बड़ा होने पर सही पॉइंटर खिसकाते हो।")}
                  </p>
                </div>
                <div className="ai-block bad">
                  <b>{t("What is missing", "Kya kami hai", "क्या कमी है")}</b>
                  <p>
                    <Cross size={14} /> {t("Look at the constraints again: how large can a[i] + a[j] get?", "Constraints dobara dekho: a[i] + a[j] kitna bada ho sakta hai?", "शर्तें फिर देखो: a[i] + a[j] कितना बड़ा हो सकता है?")}
                  </p>
                </div>
                <div className="ai-question">
                  <Sparkles size={14} />
                  {t("Your turn: what is the largest value an int can hold?", "Ab aap batao: int me sabse badi value kitni aati hai?", "अब आप बताओ: int में सबसे बड़ा मान कितना आता है?")}
                </div>
              </>
            ) : (
              <pre className="mini-diff">
                <span className="del">- int sum = a[L] + a[R];</span>
                {"\n"}
                <span className="add">+ long long sum = (long long)a[L] + a[R];</span>
              </pre>
            )}
            <div className="ai-foot">
              <span className="tag outline">AI</span>
              <span className="faint">{t("Check it yourself; AI can be wrong.", "Khud jaanch lo; AI galat ho sakta hai.", "खुद जाँच लें; एआई गलत हो सकता है।")}</span>
            </div>
          </div>
        </div>
        {asked && (
          <>
            <div className="msg me">
              <p>{draft || "2,147,483,647"}</p>
            </div>
            <div className="msg ai">
              <Diya size={28} mood="cheer" className="msg-avatar" />
              <div className="ai-card">
                <p>
                  {t(
                    "Right. The failing test adds 2³⁰ + 2³⁰ = 2,147,483,648, one more than that. So which type should hold the sum?",
                    "Sahi. Galat test me 2³⁰ + 2³⁰ = 2,147,483,648, usse ek zyada. To sum kis type me rakhoge?",
                    "सही। गलत टेस्ट में 2³⁰ + 2³⁰ = 2,147,483,648, उससे एक ज़्यादा। तो योग किस टाइप में रखोगे?",
                  )}
                </p>
              </div>
            </div>
          </>
        )}
        <div ref={end} />
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          setAsked(true);
        }}
      >
        <div className="row wrap" style={{ gap: 6 }}>
          {chips.includes("problem") && <ContextChip icon="problem" label={t("Problem", "Problem", "प्रश्न")} onRemove={() => setChips((c) => c.filter((x) => x !== "problem"))} />}
          {chips.includes("verdict") && <ContextChip icon="verdict" label={t("Verdict", "Verdict", "नतीजा")} onRemove={() => setChips((c) => c.filter((x) => x !== "verdict"))} />}
          {chips.includes("code") && <ContextChip icon="code" label={t("My code", "Mera code", "मेरा कोड")} onRemove={() => setChips((c) => c.filter((x) => x !== "code"))} />}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="icon-btn" aria-label={t("Add context", "Context jodo", "संदर्भ जोड़ें")}>
            <AtSign size={16} />
          </button>
          <input
            id="sahayak-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("Ask in English, Hinglish or Hindi…", "English, Hinglish ya Hindi me poochho…", "अंग्रेज़ी, हिंग्लिश या हिंदी में पूछें…")}
            aria-label="Message"
          />
          <button type="submit" className="btn primary sm" aria-label={t("Send", "Bhejo", "भेजें")}>
            <Send size={14} />
          </button>
        </div>
        <div className="row between faint" style={{ fontSize: "var(--fs-11)" }}>
          <span>
            <Info size={11} style={{ verticalAlign: -1 }} /> {t("Off during contests and tests", "Contest aur test me band", "प्रतियोगिता और परीक्षा में बंद")}
          </span>
          <span>{t("38 of 200 messages today", "Aaj 200 me se 38 message", "आज 200 में से 38 संदेश")}</span>
        </div>
      </form>
    </div>
  );
}

export function SahayakDock({ onClose }: { onClose: () => void }) {
  const t = useT();
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <>
      <div className="scrim" onMouseDown={onClose} />
      <aside className="drawer sahayak-drawer" role="dialog" aria-modal="true" aria-label="Sahayak">
        <div className="panel-head">
          <div className="row" style={{ gap: 10 }}>
            <Diya size={30} />
            <div>
              <b>Sahayak</b>
              <div className="faint" style={{ fontSize: "var(--fs-11)" }}>
                {t("Knows where you are on Parikshaa", "Jaanta hai aap Parikshaa par kahan ho", "जानता है आप परीक्षा पर कहाँ हैं")}
              </div>
            </div>
          </div>
          <div className="row" style={{ gap: 4 }}>
            <button type="button" className="btn ghost sm">
              <Plus size={14} /> {t("New chat", "Nayi chat", "नई बातचीत")}
            </button>
            <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>
        <SahayakChat compact />
      </aside>
    </>
  );
}
