import { useEffect, useState } from "react";
import {
  Mic,
  MicOff,
  Keyboard,
  Play,
  Square,
  Clock,
  CircleCheck,
  TriangleAlert,
  Lightbulb,
  RotateCcw,
  CalendarCheck,
  Lock,
  Bot,
  CodeXml,
  Database,
  Cpu,
  MessagesSquare,
  ShieldCheck,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { Link, useT, useToast, useStopwatch, hms } from "../lib/core";
import { Badge, Code, Meter, Seg } from "../ui/kit";
import { FocusBar } from "../ui/focus";

/* AI mock interview for learners. The interviewer is an AI; feedback is advice to practise with, never a hiring
   decision. Sahayak (the helper) is off while the interview runs, like in contests. */

type Phase = "setup" | "live" | "report";

const CODE = `int firstUnique(string s) {
    unordered_map<char, int> seen;
    for (char c : s) seen[c]++;
    for (int i = 0; i < s.size(); i++)
        if (seen[s[i]] == 1) return i;
    return -1;
}`;

function Setup({ onStart }: { onStart: () => void }) {
  const t = useT();
  const [kind, setKind] = useState("dsa");
  const [len, setLen] = useState("30");
  const kinds: [string, typeof CodeXml, string, string][] = [
    ["dsa", CodeXml, t("Coding (DSA)", "Coding (DSA)", "कोडिंग"), t("One problem, think aloud, write code", "Ek problem, bol kar socho, code likho", "एक प्रश्न")],
    ["sql", Database, "SQL", t("Queries on a small schema", "Chhote schema par queries", "क्वेरी")],
    ["cs", Cpu, t("CS fundamentals", "CS fundamentals", "CS मूल बातें"), t("OS, DBMS, networks, OOP", "OS, DBMS, networks, OOP", "OS, DBMS")],
    ["hr", MessagesSquare, t("HR and behaviour", "HR aur vyavhaar", "HR"), t("Tell me about yourself, projects, conflicts", "Apne baare me, projects, mushkil waqt", "अपने बारे में")],
  ];
  return (
    <div className="iv-setup">
      <h1 className="h1">{t("Practise an interview", "Interview ki practice", "इंटरव्यू अभ्यास")}</h1>
      <p className="muted">{t("An AI interviewer asks, listens and follows up. You get a rubric at the end, not a verdict.", "AI interviewer poochhta hai, sunta hai, aage sawaal karta hai. Ant me rubric milta hai, faisla nahi.", "अंत में रूब्रिक मिलता है।")}</p>
      <div className="iv-kinds">
        {kinds.map(([id, I, h, p]) => (
          <button key={id} className={`iv-kind ${kind === id ? "on" : ""}`} onClick={() => setKind(id)} aria-pressed={kind === id}>
            <I />
            <b>{h}</b>
            <span className="small muted">{p}</span>
          </button>
        ))}
      </div>
      <div className="iv-opts">
        <label className="field">
          <span className="label">{t("Pattern", "Pattern", "पैटर्न")}</span>
          <select className="select input" defaultValue="product">
            <option value="product">{t("Product company, round 1 (sample)", "Product company, round 1 (sample)", "प्रोडक्ट कंपनी")}</option>
            <option value="service">{t("Service company, technical", "Service company, technical", "सर्विस कंपनी")}</option>
          </select>
        </label>
        <div className="field">
          <span className="label">{t("Length", "Samay", "समय")}</span>
          <Seg value={len} onChange={setLen} items={[{ id: "20", label: "20 min" }, { id: "30", label: "30 min" }, { id: "45", label: "45 min" }]} />
        </div>
        <div className="field">
          <span className="label">{t("Answer by", "Jawab kaise", "जवाब")}</span>
          <Seg value="voice" onChange={() => {}} items={[{ id: "voice", label: t("Voice + code", "Bolkar + code", "आवाज़ + कोड") }, { id: "text", label: t("Typing", "Likh kar", "लिखकर") }]} />
        </div>
      </div>
      <div className="iv-trust">
        <ShieldCheck />
        <span className="small">{t("The recording stays private to you. Delete it any time. Companies never see practice interviews.", "Recording sirf aapki. Kabhi bhi delete karo. Companies practice interview kabhi nahi dekhtin.", "रिकॉर्डिंग निजी।")}</span>
      </div>
      <button className="btn pri lg" onClick={onStart}>
        <Play /> {t("Start interview", "Interview shuru", "शुरू करें")}
      </button>
    </div>
  );
}

function Live({ onEnd }: { onEnd: () => void }) {
  const t = useT();
  const toast = useToast();
  const [mic, setMic] = useState(true);
  const [s] = useStopwatch(14 * 60 + 22);
  return (
    <div className="iv-live">
      <section className="iv-talk">
        <div className="iv-agent">
          <span className="iv-ava">
            <Bot />
          </span>
          <div className="grow">
            <b>{t("Interviewer (AI)", "Interviewer (AI)", "इंटरव्यूअर (AI)")}</b>
            <span className="tiny faint" style={{ display: "block" }}>
              {t("Round 1 · coding · question 2 of 2", "Round 1 · coding · sawaal 2 / 2", "राउंड 1 · प्रश्न 2 / 2")}
            </span>
          </div>
          <span className={`iv-wave ${mic ? "on" : ""}`} aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${i * 90}ms` }} />
            ))}
          </span>
        </div>
        <div className="iv-q">
          <span className="eyebrow">{t("Question", "Sawaal", "प्रश्न")}</span>
          <p>{t("Given a string, return the index of its first character that appears only once. Return −1 if there is none.", "Ek string do, uska pehla aisa character jo sirf ek baar aaye, uska index lautao. Na ho to −1.", "पहले अकेले अक्षर का इंडेक्स।")}</p>
        </div>
        <div className="iv-chat">
          <div className="iv-msg ai">{t("Before coding, how would you count the characters?", "Code se pehle, characters kaise ginoge?", "अक्षर कैसे गिनेंगे?")}</div>
          <div className="iv-msg me">{t("A hash map from char to count, one pass. Then a second pass to find the first with count 1.", "Char se count ka hash map, ek pass. Phir doosre pass me pehla jiska count 1 ho.", "हैश मैप, दो पास।")}</div>
          <div className="iv-msg ai">{t("Good. What is the time and space, and can the map be smaller?", "Achha. Time aur space kya hai, aur kya map chhota ho sakta hai?", "समय और स्थान?")}</div>
          <div className="iv-msg me live">
            {t("O(n) time. Space is O(1) if only lowercase letters, an array of 26", "O(n) time. Sirf lowercase letters ho to space O(1), 26 ka array", "O(n)")}
            <span className="type-caret" />
          </div>
        </div>
        <div className="iv-ctrls">
          <button className={`iv-mic ${mic ? "on" : ""}`} onClick={() => setMic(!mic)} aria-label={mic ? "Mute" : "Unmute"}>
            {mic ? <Mic /> : <MicOff />}
          </button>
          <button className="btn sm ghost">
            <Keyboard /> {t("Type instead", "Likh kar", "लिखकर")}
          </button>
          <span className="grow" />
          <span className="iv-lock tiny">
            <Lock /> {t("Sahayak is off during the interview", "Interview me Sahayak band", "सहायक बंद")}
          </span>
        </div>
      </section>
      <section className="iv-code">
        <div className="iv-code-h">
          <span className="file-tab on">
            <CodeXml /> solution.cpp
          </span>
          <span className="grow" />
          <span className="iv-timer mono">
            <Clock /> {hms(s, false)} / 30:00
          </span>
        </div>
        <div className="iv-editor">
          <Code code={CODE} caret={3} />
        </div>
        <div className="iv-tests">
          <span className="small">
            <CircleCheck className="t-tick" /> "leetcode" → 0
          </span>
          <span className="small">
            <CircleCheck className="t-tick" /> "aabb" → −1
          </span>
          <span className="small faint">{t("The interviewer sees your code as you type.", "Interviewer code ko likhte waqt dekhta hai.", "इंटरव्यूअर कोड देखता है।")}</span>
        </div>
        <div className="iv-foot">
          <button className="btn sm" onClick={() => toast(t("2 of 2 sample cases pass", "2 / 2 sample case pass", "2 / 2 पास"))}>
            <Play /> {t("Run", "Chalao", "चलाएँ")}
          </button>
          <span className="grow" />
          <button className="btn sm dang" onClick={onEnd}>
            <Square /> {t("End interview", "Interview khatam", "समाप्त करें")}
          </button>
        </div>
      </section>
    </div>
  );
}

function Report({ onAgain }: { onAgain: () => void }) {
  const t = useT();
  const rows: [string, number, string][] = [
    [t("Problem solving", "Problem solving", "समस्या हल"), 4, t("Reached O(n) quickly and explained why.", "O(n) jaldi tak pahunche aur kyun bataya.", "O(n) तक पहुँचे।")],
    [t("Communication", "Baat-cheet", "संवाद"), 3, t("Clear, but went quiet for 2 minutes while coding.", "Saaf, par code karte waqt 2 minute chup.", "2 मिनट चुप।")],
    [t("Code quality", "Code quality", "कोड गुणवत्ता"), 4, t("Readable names; the loop could use size_t.", "Naam saaf; loop me size_t behtar.", "size_t बेहतर।")],
    [t("Edge cases", "Edge cases", "किनारे के मामले"), 2, t("Did not ask about the empty string or uppercase letters.", "Khaali string aur uppercase ke baare me nahi poochha.", "ख़ाली स्ट्रिंग नहीं पूछी।")],
    [t("Time", "Samay", "समय"), 3, t("Finished in 24 of 30 minutes.", "30 me se 24 minute me poora.", "24 मिनट।")],
  ];
  return (
    <div className="iv-report">
      <header className="row between wrap g12">
        <div>
          <span className="eyebrow">{t("Practice interview · coding · 21 Oct", "Practice interview · coding · 21 Oct", "अभ्यास इंटरव्यू")}</span>
          <h1 className="h1">{t("Good attempt. One habit to fix.", "Achhi koshish. Ek aadat sudhaarni hai.", "अच्छी कोशिश।")}</h1>
        </div>
        <div className="iv-score">
          <b className="num">16</b>
          <span className="faint">/ 25</span>
        </div>
      </header>
      <div className="iv-rubric">
        {rows.map(([k, v, note]) => (
          <div key={k} className="iv-rb">
            <div className="row between">
              <b className="small">{k}</b>
              <span className="num small">{v} / 5</span>
            </div>
            <Meter v={v * 20} tone={v >= 4 ? "tick" : v === 3 ? "pen" : "coin"} size="thin" />
            <span className="tiny faint">{note}</span>
          </div>
        ))}
      </div>
      <div className="grid c2">
        <div className="card iv-box good">
          <b className="small">
            <CircleCheck /> {t("Keep doing", "Ye karte raho", "यह करते रहें")}
          </b>
          <p className="small">{t("Stating the approach and its cost before writing code.", "Code se pehle tareeka aur uski keemat batana.", "पहले तरीका बताना।")}</p>
        </div>
        <div className="card iv-box fix">
          <b className="small">
            <TriangleAlert /> {t("Practise next", "Agli practice", "अगला अभ्यास")}
          </b>
          <p className="small">{t("Ask about edge cases out loud in the first two minutes: empty input, case, size.", "Pehle do minute me edge cases bolkar poochho: khaali input, case, size.", "पहले दो मिनट में किनारे के मामले।")}</p>
        </div>
      </div>
      <div className="banner pen">
        <Lightbulb />
        <span>{t("This is AI feedback to practise with. It is never shown to companies and is not a hiring score.", "Ye practice ke liye AI ki salah hai. Companies ko kabhi nahi dikhti aur hiring score nahi hai.", "यह हायरिंग स्कोर नहीं है।")}</span>
      </div>
      <div className="row wrap g8">
        <button className="btn pri" onClick={onAgain}>
          <RotateCcw /> {t("Practise again", "Phir practice", "फिर अभ्यास")}
        </button>
        <Link to="plus" className="btn">
          <CalendarCheck /> {t("Book a human mock (Plus)", "Insaan ke saath mock (Plus)", "इंसान के साथ मॉक")}
        </Link>
        <Link to="practice" className="btn ghost">
          {t("Practise edge cases", "Edge cases ki practice", "किनारे के मामले")} <ArrowRight />
        </Link>
        <span className="grow" />
        <button className="btn ghost sm">
          <Trash2 /> {t("Delete recording", "Recording delete", "रिकॉर्डिंग हटाएँ")}
        </button>
      </div>
    </div>
  );
}

export function InterviewScreen() {
  const t = useT();
  const [phase, setPhase] = useState<Phase>("live");
  useEffect(() => {
    document.querySelector(".iv-wrap")?.scrollTo({ top: 0 });
  }, [phase]);
  return (
    <>
      <FocusBar
        back="jobs"
        title={t("Mock interview", "Mock interview", "मॉक इंटरव्यू")}
        sub={t("Practice with an AI interviewer · sample", "AI interviewer ke saath practice · sample", "AI के साथ अभ्यास")}
        center={
          <span className="mock-switch">
            <span className="tiny faint hide-narrow">{t("Mock: see each step", "Mock: har kadam", "मॉक: हर चरण")}</span>
            <Seg
              value={phase}
              onChange={setPhase}
              items={[
                { id: "setup", label: t("Set up", "Setup", "सेटअप") },
                { id: "live", label: t("Live", "Live", "लाइव") },
                { id: "report", label: t("Report", "Report", "रिपोर्ट") },
              ]}
            />
          </span>
        }
        right={
          <Badge tone="ai" icon={<Bot size={13} />}>
            AI
          </Badge>
        }
      />
      <div className="iv-wrap">
        <div className="iv-phase-phone">
          <Seg
            value={phase}
            onChange={setPhase}
            items={[
              { id: "setup", label: t("Set up", "Setup", "सेटअप") },
              { id: "live", label: t("Live", "Live", "लाइव") },
              { id: "report", label: t("Report", "Report", "रिपोर्ट") },
            ]}
          />
        </div>
        {phase === "setup" && <Setup onStart={() => setPhase("live")} />}
        {phase === "live" && <Live onEnd={() => setPhase("report")} />}
        {phase === "report" && <Report onAgain={() => setPhase("setup")} />}
      </div>
    </>
  );
}
