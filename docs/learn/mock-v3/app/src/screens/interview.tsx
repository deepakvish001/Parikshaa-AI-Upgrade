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
  Bug,
  Sparkles,
  Wrench,
  FileSearch,
  Send,
} from "lucide-react";
import { Link, useT, useToast, useStopwatch, hms } from "../lib/core";
import { useVariant } from "../lib/variant";
import { Code, Meter, Seg } from "../ui/kit";
import { FocusBar } from "../ui/focus";

/* AI mock interview for learners. The interviewer is an AI; feedback is advice to practise with, never a hiring
   decision. Two kinds (LEARN-V2 §4c, AE5): "without AI" checks fundamentals and keeps Sahayak off, like a contest;
   "with AI" gives a small real task with an AI helper and asks why you chose what you did and how you checked the
   AI's code. Mode and step live in pk43-v-ivmode / pk43-v-ivphase so the mock can open any combination. */

type Phase = "setup" | "live" | "report";
type Mode = "noai" | "ai";

const CODE = `int firstUnique(string s) {
    unordered_map<char, int> seen;
    for (char c : s) seen[c]++;
    for (int i = 0; i < s.size(); i++)
        if (seen[s[i]] == 1) return i;
    return -1;
}`;

const AI_CODE = `router.post("/orders", async (req, res) => {
  const { items, orderKey } = req.body;
  const existing = await Order.findOne({ orderKey });
  if (existing) return res.status(200).json(existing);
  try {
    const order = await Order.create({ items, orderKey });
    return res.status(201).json(order);
  } catch (e) {
    if (e.code === 11000) return res.status(200).json(await Order.findOne({ orderKey }));
    throw e;
  }
});`;

function ModePick({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const t = useT();
  const opts: [Mode, typeof Lock, string, string, string][] = [
    ["noai", Lock, t("Without AI · fundamentals", "Bina AI · buniyaad", "बिना AI · बुनियाद"), t("DSA, SQL, CS or HR, on your own. Like most campus rounds.", "DSA, SQL, CS ya HR, khud se. Zyaadatar campus rounds jaisa.", "ख़ुद से, कैंपस जैसा।"), t("Service companies, campus", "Service companies, campus", "सर्विस, कैंपस")],
    ["ai", Bot, t("With AI · real task", "AI ke saath · asli kaam", "AI के साथ · असली काम"), t("A small task in a repo with an AI helper. The interviewer asks why, and how you checked the AI's code.", "Repo me chhota kaam, AI saathi ke saath. Interviewer poochhta kyun, aur AI ka code kaise jaancha.", "AI साथी के साथ; इंटरव्यूअर पूछता है क्यों।"), t("Product companies, GCCs", "Product companies, GCCs", "प्रोडक्ट, GCC")],
  ];
  return (
    <div className="iv-modes" role="group" aria-label={t("Interview kind", "Interview ka roop", "इंटरव्यू का रूप")}>
      {opts.map(([id, I, h, p, who]) => (
        <button key={id} className={`iv-mode ${mode === id ? "on" : ""} ${id}`} aria-pressed={mode === id} onClick={() => setMode(id)}>
          <span className="iv-mode-ic">
            <I />
          </span>
          <b>{h}</b>
          <span className="small muted">{p}</span>
          <span className="tiny faint">{who}</span>
        </button>
      ))}
    </div>
  );
}

function Setup({ mode, setMode, onStart }: { mode: Mode; setMode: (m: Mode) => void; onStart: () => void }) {
  const t = useT();
  const [kind, setKind] = useState("dsa");
  const [task, setTask] = useState("bug");
  const [len, setLen] = useState("30");
  const kinds: [string, typeof CodeXml, string, string][] = [
    ["dsa", CodeXml, t("Coding (DSA)", "Coding (DSA)", "कोडिंग"), t("One problem, think aloud, write code", "Ek problem, bol kar socho, code likho", "एक प्रश्न")],
    ["sql", Database, "SQL", t("Queries on a small schema", "Chhote schema par queries", "क्वेरी")],
    ["cs", Cpu, t("CS fundamentals", "CS fundamentals", "CS मूल बातें"), t("OS, DBMS, networks, OOP", "OS, DBMS, networks, OOP", "OS, DBMS")],
    ["hr", MessagesSquare, t("HR and behaviour", "HR aur vyavhaar", "HR"), t("Tell me about yourself, projects, conflicts", "Apne baare me, projects, mushkil waqt", "अपने बारे में")],
  ];
  const tasks: [string, typeof CodeXml, string, string][] = [
    ["bug", Bug, t("Fix a bug (Node)", "Bug theek karo (Node)", "बग ठीक करो"), t("A ticket in a small order app", "Chhote order app ka ek ticket", "ऑर्डर ऐप का टिकट")],
    ["feature", Wrench, t("Small feature (React)", "Chhota feature (React)", "छोटा फ़ीचर"), t("Add a filter with tests", "Tests ke saath filter jodo", "टेस्ट के साथ फ़िल्टर")],
    ["read", FileSearch, t("Read and review", "Padho aur review karo", "पढ़ो और समीक्षा"), t("Find what is wrong in an AI's pull request", "AI ke pull request me galti dhoondho", "AI के PR में गलती")],
  ];
  const list = mode === "ai" ? tasks : kinds;
  const cur = mode === "ai" ? task : kind;
  const pick = mode === "ai" ? setTask : setKind;
  return (
    <div className="iv-setup">
      <h1 className="h1">{t("Practise an interview", "Interview ki practice", "इंटरव्यू अभ्यास")}</h1>
      <p className="muted">{t("An AI interviewer asks, listens and follows up. You get a rubric at the end, not a verdict.", "AI interviewer poochhta hai, sunta hai, aage sawaal karta hai. Ant me rubric milta hai, faisla nahi.", "अंत में रूब्रिक मिलता है।")}</p>
      <ModePick mode={mode} setMode={setMode} />
      <div className={`iv-kinds ${mode === "ai" ? "three" : ""}`}>
        {list.map(([id, I, h, p]) => (
          <button key={id} className={`iv-kind ${cur === id ? "on" : ""}`} onClick={() => pick(id)} aria-pressed={cur === id}>
            <I />
            <b>{h}</b>
            <span className="small muted">{p}</span>
          </button>
        ))}
      </div>
      <div className="iv-opts">
        <label className="field">
          <span className="label">{t("Pattern", "Pattern", "पैटर्न")}</span>
          <select className="select input" defaultValue={mode === "ai" ? "gcc" : "product"} key={mode}>
            {mode === "ai" ? (
              <>
                <option value="gcc">{t("GCC / product, AI-assisted round (sample)", "GCC / product, AI wala round (sample)", "GCC / प्रोडक्ट")}</option>
                <option value="startup">{t("Startup, take-home in one sitting", "Startup, ek baar me take-home", "स्टार्टअप")}</option>
              </>
            ) : (
              <>
                <option value="product">{t("Product company, round 1 (sample)", "Product company, round 1 (sample)", "प्रोडक्ट कंपनी")}</option>
                <option value="service">{t("Service company, technical", "Service company, technical", "सर्विस कंपनी")}</option>
              </>
            )}
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
        <span className="small">
          {mode === "ai"
            ? t("Your prompts and the AI's replies become evidence in your report. Only you see it; companies never see practice interviews.", "Aapke prompts aur AI ke jawab report me saboot bante hain. Sirf aap dekhte ho; companies practice interview kabhi nahi dekhtin.", "प्रॉम्प्ट रिपोर्ट में सबूत; सिर्फ़ आप देखते हैं।")
            : t("The recording stays private to you. Delete it any time. Companies never see practice interviews.", "Recording sirf aapki. Kabhi bhi delete karo. Companies practice interview kabhi nahi dekhtin.", "रिकॉर्डिंग निजी।")}
        </span>
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

function LiveAi({ onEnd }: { onEnd: () => void }) {
  const t = useT();
  const toast = useToast();
  const [mic, setMic] = useState(true);
  const [s] = useStopwatch(17 * 60 + 5);
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
              {t("With AI · bug ticket · asking about your choices", "AI ke saath · bug ticket · aapke faislon par sawaal", "AI के साथ · आपके फ़ैसलों पर सवाल")}
            </span>
          </div>
          <span className={`iv-wave ${mic ? "on" : ""}`} aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${i * 90}ms` }} />
            ))}
          </span>
        </div>
        <div className="iv-q">
          <span className="eyebrow">{t("Task", "Kaam", "काम")}</span>
          <p>{t("In a small canteen app, one order is sometimes created twice at rush hour. Fix it in 30 minutes. The AI helper is on.", "Chhote canteen app me rush me ek order kabhi do baar banta. 30 minute me theek karo. AI saathi khula hai.", "एक ऑर्डर दो बार बनता है। AI साथी खुला है।")}</p>
        </div>
        <div className="iv-chat">
          <div className="iv-msg ai">{t("The helper first suggested disabling the button. You said no. Why?", "Saathi ne pehle button band karna sujhaya. Aapne mana kiya. Kyun?", "आपने मना क्यों किया?")}</div>
          <div className="iv-msg me">{t("Two tabs or a retry still send two requests. Only the server sees both, so it has to stop there.", "Do tab ya retry se phir bhi do requests jaati. Dono sirf server dekhta, isliye wahin rokna hoga.", "सर्वर पर रोकना होगा।")}</div>
          <div className="iv-msg ai">{t("Two requests with the same key arrive at the same moment. What does your code do?", "Same key ki do requests ek hi pal me aayein. Aapka code kya karega?", "एक साथ दो अनुरोध?")}</div>
          <div className="iv-msg me live">
            {t("The unique index rejects the second insert; I catch 11000 and return the first order", "Unique index doosra insert rokega; main 11000 pakad kar pehla order lautata", "11000 पकड़कर पहला ऑर्डर")}
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
          <span className="iv-lock tiny ai">
            <Sparkles /> {t("The interviewer sees your prompts", "Interviewer aapke prompts dekhta hai", "इंटरव्यूअर प्रॉम्प्ट देखता है")}
          </span>
        </div>
      </section>
      <section className="iv-code">
        <div className="iv-code-h">
          <span className="file-tab on">
            <CodeXml /> orders.js
          </span>
          <span className="grow" />
          <span className="iv-timer mono">
            <Clock /> {hms(s, false)} / 30:00
          </span>
        </div>
        <div className="iv-editor">
          <Code code={AI_CODE} good={[5, 6, 7, 8, 9, 10, 11]} />
        </div>
        <div className="iv-assist" aria-label={t("AI helper", "AI saathi", "AI साथी")}>
          <div className="row g6 tiny">
            <Bot className="t-ai" />
            <b>{t("AI helper", "AI saathi", "AI साथी")}</b>
            <span className="faint">{t("· every prompt is in your report", "· har prompt report me", "· हर प्रॉम्प्ट रिपोर्ट में")}</span>
          </div>
          <p className="iv-p me small">{t("@orders.js If two requests with the same orderKey race, create throws 11000. Catch only that code and return the saved order. Keep the 201 for new orders.", "@orders.js Same orderKey ki do requests race karein to create 11000 deta. Sirf wahi code pakdo aur saved order lautao. Naye order par 201 rakho.", "सिर्फ़ 11000 पकड़ो।")}</p>
          <p className="iv-p ai small">{t("Done: a try/catch around create, matching only 11000. Other errors still go up.", "Ho gaya: create ke chaaron taraf try/catch, sirf 11000 par. Baaki errors upar jaate.", "हो गया।")}</p>
          <div className="row g8">
            <label className="sr-only" htmlFor="iv-ask">
              {t("Ask the AI helper", "AI saathi se poochho", "AI साथी से पूछो")}
            </label>
            <input id="iv-ask" className="input" placeholder={t("Ask the helper… (@ for files)", "Saathi se poochho… (@ se file)", "साथी से पूछो…")} />
            <button className="icon-btn sm" aria-label={t("Send", "Bhejo", "भेजो")}>
              <Send />
            </button>
          </div>
        </div>
        <div className="iv-tests">
          <span className="small">
            <CircleCheck className="t-tick" /> {t("same key twice → 1 order", "wahi key do baar → 1 order", "एक ऑर्डर")}
          </span>
          <span className="small">
            <CircleCheck className="t-tick" /> {t("two keys → 2 orders", "do key → 2 order", "दो ऑर्डर")}
          </span>
          <span className="small">
            <TriangleAlert className="t-coin" /> {t("race test not written yet", "race ka test abhi nahi", "रेस टेस्ट नहीं")}
          </span>
        </div>
        <div className="iv-foot">
          <button className="btn sm" onClick={() => toast(t("4 of 4 tests pass", "4 / 4 tests pass", "4 / 4 पास"))}>
            <Play /> {t("Run tests", "Tests chalao", "टेस्ट चलाओ")}
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

function Report({ mode, onAgain }: { mode: Mode; onAgain: () => void }) {
  const t = useT();
  const plain: [string, number, string, string?][] = [
    [t("Problem solving", "Problem solving", "समस्या हल"), 4, t("Reached O(n) quickly and explained why.", "O(n) jaldi tak pahunche aur kyun bataya.", "O(n) तक पहुँचे।")],
    [t("Communication", "Baat-cheet", "संवाद"), 3, t("Clear, but went quiet for 2 minutes while coding.", "Saaf, par code karte waqt 2 minute chup.", "2 मिनट चुप।")],
    [t("Code quality", "Code quality", "कोड गुणवत्ता"), 4, t("Readable names; the loop could use size_t.", "Naam saaf; loop me size_t behtar.", "size_t बेहतर।")],
    [t("Edge cases", "Edge cases", "किनारे के मामले"), 2, t("Did not ask about the empty string or uppercase letters.", "Khaali string aur uppercase ke baare me nahi poochha.", "ख़ाली स्ट्रिंग नहीं पूछी।")],
    [t("Time", "Samay", "समय"), 3, t("Finished in 24 of 30 minutes.", "30 me se 24 minute me poora.", "24 मिनट।")],
  ];
  const withAi: [string, number, string, string][] = [
    [t("Understanding the problem", "Samasya samajhna", "समस्या समझना"), 4, t("Asked how often rush hour happens and whether retries exist.", "Poochha rush kitni baar aata aur retry hote hain ya nahi.", "सवाल पूछे।"), "02:10"],
    [t("Context to the AI", "AI ko context", "AI को संदर्भ"), 3, t("First prompt named no file or ticket; later prompts did.", "Pehle prompt me na file na ticket; baad wale me dono.", "पहला प्रॉम्प्ट अधूरा।"), "05:40"],
    [t("Checking the AI's output", "AI ka output jaanchna", "AI का आउटपुट जाँचना"), 4, t("Rejected the client-only fix with a clear reason; ran tests after each change.", "Sirf client wala fix wajah ke saath mana; har badlav ke baad tests.", "कारण के साथ मना किया।"), "09:12"],
    [t("Explaining why", "Kyun samjhana", "क्यों समझाना"), 3, t("Race condition answer was right but no test proved it.", "Race ka jawab sahi, par test se saabit nahi kiya.", "रेस का टेस्ट नहीं।"), "16:30"],
    [t("Fundamentals under the hood", "Neeche ki buniyaad", "बुनियाद"), 4, t("Knew why a unique index stops duplicates and what 11000 means.", "Pata tha unique index duplicate kyun rokta aur 11000 kya hai.", "यूनिक इंडेक्स समझा।"), "17:05"],
  ];
  const isAi = mode === "ai";
  const rows = isAi ? withAi : plain;
  return (
    <div className="iv-report">
      <header className="row between wrap g12">
        <div>
          <span className="eyebrow">
            {isAi ? t("Practice interview · with AI · 24 Oct", "Practice interview · AI ke saath · 24 Oct", "AI के साथ अभ्यास") : t("Practice interview · coding · 21 Oct", "Practice interview · coding · 21 Oct", "अभ्यास इंटरव्यू")}
          </span>
          <h1 className="h1">{isAi ? t("Good judgement with the AI. Prove the hard case.", "AI ke saath achhi samajh. Mushkil case saabit karo.", "मुश्किल केस साबित करो।") : t("Good attempt. One habit to fix.", "Achhi koshish. Ek aadat sudhaarni hai.", "अच्छी कोशिश।")}</h1>
        </div>
        <div className="iv-score">
          <b className="num">{isAi ? 18 : 16}</b>
          <span className="faint">/ 25</span>
        </div>
      </header>
      <div className="iv-rubric">
        {rows.map(([k, v, note, at]) => (
          <div key={k} className="iv-rb">
            <div className="row between">
              <b className="small">{k}</b>
              <span className="num small">{v} / 5</span>
            </div>
            <Meter v={v * 20} tone={v >= 4 ? "tick" : v === 3 ? "pen" : "coin"} size="thin" label={`${k} ${v}/5`} />
            <span className="tiny faint">{note}</span>
            {at && (
              <span className="iv-ev mono tiny">
                {t("transcript", "transcript", "ट्रांसक्रिप्ट")} {at}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="grid c2">
        <div className="card iv-box good">
          <b className="small">
            <CircleCheck /> {t("Keep doing", "Ye karte raho", "यह करते रहें")}
          </b>
          <p className="small">{isAi ? t("Saying no to an AI suggestion, with the reason, before writing code.", "Code se pehle AI ke sujhaav ko wajah ke saath mana karna.", "कारण के साथ मना करना।") : t("Stating the approach and its cost before writing code.", "Code se pehle tareeka aur uski keemat batana.", "पहले तरीका बताना।")}</p>
        </div>
        <div className="card iv-box fix">
          <b className="small">
            <TriangleAlert /> {t("Practise next", "Agli practice", "अगला अभ्यास")}
          </b>
          <p className="small">{isAi ? t("Give the file and the ticket in your first prompt, and write the test for the hard case (two requests at once).", "Pehle hi prompt me file aur ticket do, aur mushkil case (ek saath do requests) ka test likho.", "पहले प्रॉम्प्ट में फ़ाइल और टिकट।") : t("Ask about edge cases out loud in the first two minutes: empty input, case, size.", "Pehle do minute me edge cases bolkar poochho: khaali input, case, size.", "पहले दो मिनट में किनारे के मामले।")}</p>
        </div>
      </div>
      {isAi && (
        <div className="banner">
          <Lock />
          <span className="small">{t("Do the without-AI round too: most campus rounds still are, and the fundamentals show there.", "Bina-AI wala round bhi do: zyaadatar campus rounds abhi bhi waise hain, aur buniyaad wahin dikhti.", "बिना-AI राउंड भी दो।")}</span>
        </div>
      )}
      <div className="banner pen">
        <Lightbulb />
        <span>{t("This is AI feedback to practise with. It is never shown to companies and is not a hiring score.", "Ye practice ke liye AI ki salah hai. Companies ko kabhi nahi dikhti aur hiring score nahi hai.", "यह हायरिंग स्कोर नहीं है।")}</span>
      </div>
      <div className="row wrap g8">
        <button className="btn pri" onClick={onAgain}>
          <RotateCcw /> {t("Practise again", "Phir practice", "फिर अभ्यास")}
        </button>
        {isAi ? (
          <Link to="ticket-lab" className="btn">
            <Bug /> {t("Ticket lab on the same skill", "Isi hunar par ticket lab", "टिकट लैब")}
          </Link>
        ) : (
          <Link to="plus" className="btn">
            <CalendarCheck /> {t("Book a human mock (Plus)", "Insaan ke saath mock (Plus)", "इंसान के साथ मॉक")}
          </Link>
        )}
        <Link to={isAi ? "ai-drill" : "practice"} className="btn ghost">
          {isAi ? t("Catch-the-AI drills", "Galat AI pakdo drills", "गलत AI पकड़ो") : t("Practise edge cases", "Edge cases ki practice", "किनारे के मामले")} <ArrowRight />
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
  const [rawPhase, setPhaseRaw] = useVariant("ivphase", "live");
  const [rawMode, setModeRaw] = useVariant("ivmode", "noai");
  const phase = (["setup", "live", "report"].includes(rawPhase) ? rawPhase : "live") as Phase;
  const mode = (rawMode === "ai" ? "ai" : "noai") as Mode;
  const setPhase = (p: Phase) => setPhaseRaw(p);
  const setMode = (m: Mode) => setModeRaw(m);
  useEffect(() => {
    document.querySelector(".iv-wrap")?.scrollTo({ top: 0 });
  }, [phase, mode]);
  const phaseItems = [
    { id: "setup" as const, label: t("Set up", "Setup", "सेटअप") },
    { id: "live" as const, label: t("Live", "Live", "लाइव") },
    { id: "report" as const, label: t("Report", "Report", "रिपोर्ट") },
  ];
  const modeItems = [
    { id: "noai" as const, label: t("Without AI", "Bina AI", "बिना AI") },
    { id: "ai" as const, label: t("With AI", "AI ke saath", "AI के साथ") },
  ];
  return (
    <>
      <FocusBar
        back="jobs"
        title={t("Mock interview", "Mock interview", "मॉक इंटरव्यू")}
        sub={mode === "ai" ? t("With AI: real task, questions on your choices · sample", "AI ke saath: asli kaam, faislon par sawaal · sample", "AI के साथ · नमूना") : t("Practice with an AI interviewer · sample", "AI interviewer ke saath practice · sample", "AI के साथ अभ्यास")}
        center={
          <span className="mock-switch">
            <span className="tiny faint hide-narrow">{t("Mock: see each step", "Mock: har kadam", "मॉक: हर चरण")}</span>
            <Seg value={phase} onChange={setPhase} items={phaseItems} />
          </span>
        }
        right={
          <span className="hide-phone">
            <Seg value={mode} onChange={setMode} items={modeItems} />
          </span>
        }
      />
      <div className="iv-wrap">
        <div className="iv-phase-phone">
          <Seg value={phase} onChange={setPhase} items={phaseItems} />
          <Seg value={mode} onChange={setMode} items={modeItems} />
        </div>
        {phase === "setup" && <Setup mode={mode} setMode={setMode} onStart={() => setPhase("live")} />}
        {phase === "live" && (mode === "ai" ? <LiveAi onEnd={() => setPhase("report")} /> : <Live onEnd={() => setPhase("report")} />)}
        {phase === "report" && <Report mode={mode} onAgain={() => setPhase("setup")} />}
      </div>
    </>
  );
}
