import type { ReactNode } from "react";
import { WifiOff, RotateCw, Activity, Layers, Check, ArrowRight, X } from "lucide-react";
import { Link, useT } from "../lib/core";
import { useVariant } from "../lib/variant";
import { Diya, Skel, Menu } from "./kit";
import { FocusBar } from "./focus";

/* Mock v4.3: every core screen in the five states a real app spends most of its life in. The state is chosen
   with the switch at the bottom left (mock chrome) and kept in pk43-v-state; "ok" is the normal screen. */

type T3 = [string, string, string];
type Kind = "list" | "workspace" | "cards" | "doc";
type Copy = { kind: Kind; noun: T3; empty: [T3, T3, T3, string]; first: [T3, T3[], T3, string] };

const COPY: Record<string, Copy> = {
  aaj: {
    kind: "list",
    noun: ["today's plan", "aaj ka plan", "आज की योजना"],
    empty: [["Nothing planned for today", "Aaj kuch plan nahi", "आज कुछ तय नहीं"], ["Your plan has a rest day. Revise 6 cards if you like, or take the evening off.", "Aaj plan me aaram ka din hai. Chaho to 6 cards dohrao, ya shaam free rakho.", "आज आराम का दिन है।"], ["Revise 6 cards", "6 cards dohrao", "6 कार्ड दोहराएँ"], "revision"],
    first: [["Welcome, Aarav. Let's plan your first week.", "Swagat hai, Aarav. Pehla hafta plan karein.", "स्वागत है, आरव।"], [["Answer 5 questions (2 min)", "5 sawaal (2 min)", "5 सवाल (2 मिनट)"], ["See your 90-day plan", "Apna 90 din ka plan dekho", "90 दिन की योजना"], ["Start with a 25-minute lesson", "25 minute ke lesson se shuru", "25 मिनट का पाठ"]], ["Make my plan", "Mera plan banao", "मेरी योजना बनाएँ"], "onboarding"],
  },
  plan: {
    kind: "cards",
    noun: ["your plan", "aapka plan", "आपकी योजना"],
    empty: [["No plan yet", "Abhi koi plan nahi", "अभी कोई योजना नहीं"], ["Tell us your goal and your college exam dates; the plan fits around them.", "Goal aur college exam ki dates batao; plan unke hisaab se banega.", "लक्ष्य और परीक्षा की तारीख़ें बताएँ।"], ["Make a plan", "Plan banao", "योजना बनाएँ"], "onboarding"],
    first: [["Your plan is ready", "Aapka plan taiyaar hai", "आपकी योजना तैयार है"], [["Seven-day sprints, one topic each", "7 din ke sprint, har ek me ek topic", "7 दिन के स्प्रिंट"], ["A short test every Saturday", "Har Shanivar chhota test", "हर शनिवार टेस्ट"], ["Miss a day and the rest re-balances", "Din chhoota to baaki khud sambhal jaata hai", "दिन छूटा तो बाकी सँभल जाता है"]], ["See this week", "Is hafte ka dekho", "यह सप्ताह देखें"], "plan"],
  },
  problem: {
    kind: "workspace",
    noun: ["this problem", "ye problem", "यह प्रश्न"],
    empty: [["Nothing written yet", "Abhi kuch nahi likha", "अभी कुछ नहीं लिखा"], ["Start from the template or a blank file. Your code saves on this device every few seconds.", "Template se ya khaali file se shuru karo. Code har kuch second me is device par save hota hai.", "टेम्पलेट से शुरू करें।"], ["Use the template", "Template lo", "टेम्पलेट लें"], "problem"],
    first: [["Your first problem here", "Yahan aapka pehla problem", "यहाँ आपका पहला प्रश्न"], [["Read the problem on the left", "Baayein problem padho", "बाएँ प्रश्न पढ़ें"], ["Write on the right; Run checks the examples", "Daayein likho; Run examples jaanchta hai", "दाएँ लिखें; Run उदाहरण जाँचता है"], ["Submit runs every test; if one fails you see the smallest input that breaks it", "Submit saare test chalata hai; fail ho to sabse chhota todne wala input dikhta hai", "Submit सब टेस्ट चलाता है"]], ["Start", "Shuru karo", "शुरू करें"], "problem"],
  },
  sql: {
    kind: "workspace",
    noun: ["this SQL problem", "ye SQL problem", "यह SQL प्रश्न"],
    empty: [["No query yet", "Abhi koi query nahi", "अभी कोई क्वेरी नहीं"], ["The tables are on the left. Start with SELECT * FROM students LIMIT 5 to see the data.", "Tables baayein hain. Data dekhne ke liye SELECT * FROM students LIMIT 5 se shuru karo.", "बाएँ तालिकाएँ हैं।"], ["Insert a starter query", "Starter query daalo", "शुरुआती क्वेरी"], "sql"],
    first: [["SQL works like the coding problems", "SQL bhi coding problems jaisa", "SQL भी कोडिंग जैसा"], [["Tables and examples on the left", "Baayein tables aur examples", "बाएँ तालिकाएँ"], ["Write a query on the right", "Daayein query likho", "दाएँ क्वेरी लिखें"], ["Run shows your rows next to the expected ones", "Run aapki rows ko expected ke saath dikhata hai", "Run आपकी पंक्तियाँ दिखाता है"]], ["Start", "Shuru karo", "शुरू करें"], "sql"],
  },
  sheet: {
    kind: "list",
    noun: ["the DSA sheet", "DSA sheet", "DSA शीट"],
    empty: [["Nothing matches these filters", "In filters se kuch nahi mila", "कुछ नहीं मिला"], ["Clear a filter or pick another topic.", "Ek filter hatao ya doosra topic chuno.", "फ़िल्टर हटाएँ।"], ["Clear filters", "Filters hatao", "फ़िल्टर हटाएँ"], "sheet"],
    first: [["The sheet goes in the order that builds up", "Sheet usi kram me jo neev banata hai", "शीट सही क्रम में है"], [["Start at step 1, arrays", "Step 1, arrays se shuru", "चरण 1, ऐरे"], ["Every step opens with an easy warm-up", "Har step aasaan warm-up se", "हर चरण आसान से"], ["Ticks here also tick your plan", "Yahan tick, plan me bhi tick", "यहाँ टिक, योजना में भी"]], ["Start step 1", "Step 1 shuru", "चरण 1 शुरू"], "sheet"],
  },
  revision: {
    kind: "cards",
    noun: ["your revision cards", "revision cards", "दोहराई कार्ड"],
    empty: [["Nothing to revise today", "Aaj kuch dohrana nahi", "आज कुछ दोहराना नहीं"], ["Cards come back from your mistakes and the concepts you mark. The next one is due tomorrow.", "Cards aapki galtiyon aur mark kiye concepts se aate hain. Agla kal.", "अगला कार्ड कल।"], ["Practise something new", "Kuch naya practice karo", "कुछ नया अभ्यास करें"], "practice"],
    first: [["Revision cards come from your own mistakes", "Revision cards aapki apni galtiyon se", "दोहराई आपकी गलतियों से"], [["A wrong answer becomes a card", "Galat jawab ek card banta hai", "गलत उत्तर एक कार्ड बनता है"], ["It returns after 1, 3, 7 and 21 days", "1, 3, 7, 21 din baad wapas aata hai", "1, 3, 7, 21 दिन बाद"], ["8 minutes a day is enough", "Roz 8 minute kaafi", "रोज़ 8 मिनट काफ़ी"]], ["Got it", "Samajh gaya", "समझ गया"], "revision"],
  },
  lesson: {
    kind: "doc",
    noun: ["this lesson", "ye lesson", "यह पाठ"],
    empty: [["This lesson is still being written", "Ye lesson abhi likha ja raha hai", "यह पाठ अभी लिखा जा रहा है"], ["We will tell you when it is ready. The course goes on with the next lesson.", "Taiyaar hone par bata denge. Course agle lesson se chalta rahega.", "तैयार होने पर बताएँगे।"], ["Next lesson", "Agla lesson", "अगला पाठ"], "lesson"],
    first: [["Lessons are short: read, try, check", "Lessons chhote hain: padho, try karo, jaancho", "पाठ छोटे हैं"], [["About 4 minutes of reading", "Lagbhag 4 minute padhna", "लगभग 4 मिनट"], ["Try each idea in the box below it", "Har idea neeche ke box me try karo", "हर विचार आज़माएँ"], ["Three questions at the end", "Ant me teen sawaal", "अंत में तीन सवाल"]], ["Start reading", "Padhna shuru", "पढ़ना शुरू"], "lesson"],
  },
  "apt-set": {
    kind: "list",
    noun: ["this aptitude set", "ye aptitude set", "यह सेट"],
    empty: [["No questions in this set yet", "Is set me abhi sawaal nahi", "इस सेट में सवाल नहीं"], ["Pick another set from the same topic.", "Isi topic ka doosra set chuno.", "दूसरा सेट चुनें।"], ["Other sets", "Doosre sets", "दूसरे सेट"], "aptitude"],
    first: [["Timed sets of 10", "10 sawaal ke timed sets", "10 सवालों के सेट"], [["About 1 minute a question", "Har sawaal lagbhag 1 minute", "हर सवाल 1 मिनट"], ["Every wrong option says why it is wrong", "Har galat option ki wajah", "हर गलत विकल्प का कारण"], ["Your speed shows topic by topic", "Topic-war speed dikhti hai", "विषय-वार गति"]], ["Start the set", "Set shuru", "सेट शुरू"], "apt-set"],
  },
  contests: {
    kind: "cards",
    noun: ["contests", "contests", "प्रतियोगिताएँ"],
    empty: [["No contest this week", "Is hafte koi contest nahi", "इस सप्ताह कोई नहीं"], ["Weekly Round 14 opens next Sunday at 8 pm. Practise a past round meanwhile.", "Weekly Round 14 agle Ravivaar 8 baje. Tab tak purana round practice karo.", "अगले रविवार 8 बजे।"], ["Practise a past round", "Purana round practice", "पुराना राउंड"], "contests"],
    first: [["Contests every Sunday, 90 minutes", "Har Ravivaar contest, 90 minute", "हर रविवार 90 मिनट"], [["4 problems, easy to hard", "4 problems, aasaan se mushkil", "4 प्रश्न"], ["Your rating starts after 3 rounds", "Rating 3 round ke baad", "3 राउंड के बाद रेटिंग"], ["Editorials open right after", "Editorial turant baad", "तुरंत बाद संपादकीय"]], ["See this Sunday's round", "Is Ravivaar ka round", "इस रविवार का राउंड"], "contest-brief"],
  },
  profile: {
    kind: "cards",
    noun: ["your profile", "aapki profile", "आपकी प्रोफ़ाइल"],
    empty: [["Your profile is empty for now", "Profile abhi khaali hai", "प्रोफ़ाइल अभी खाली है"], ["Solve a few problems or link a coding site. Proof shows up here as you go.", "Kuch problems solve karo ya coding site jodo. Saboot yahan apne aap aata hai.", "प्रमाण यहाँ आता है।"], ["Link a coding site", "Coding site jodo", "साइट जोड़ें"], "profile"],
    first: [["Your profile shows only what is proved", "Profile me sirf saabit baatein", "सिर्फ़ प्रमाणित बातें"], [["Our judge and tests fill it in", "Hamara judge aur tests bharte hain", "जज और टेस्ट भरते हैं"], ["Other sites show how they were checked", "Doosri sites ke saath 'kaise jaancha'", "कैसे जाँचा"], ["You choose what HR sees", "HR kya dekhe, aap chuno", "HR क्या देखे, आप चुनें"]], ["See my profile", "Profile dekho", "प्रोफ़ाइल देखें"], "profile"],
  },
  studio: {
    kind: "workspace",
    noun: ["this project", "ye project", "यह प्रोजेक्ट"],
    empty: [["No project open", "Koi project khula nahi", "कोई प्रोजेक्ट खुला नहीं"], ["Pick a project from Build, or start a blank one.", "Build se project chuno ya khaali shuru karo.", "बिल्ड से चुनें।"], ["Open Build", "Build kholo", "बिल्ड खोलें"], "build"],
    first: [["Studio runs in your browser", "Studio browser me chalta hai", "स्टूडियो ब्राउज़र में"], [["Files on the left, editor in the middle", "Baayein files, beech me editor", "बाएँ फ़ाइलें"], ["Tests check each milestone", "Tests har milestone jaanchte hain", "टेस्ट हर पड़ाव जाँचते हैं"], ["Sahayak hints; it does not write your code", "Sahayak hint deta hai; code nahi likhta", "सहायक संकेत देता है"]], ["Open the project", "Project kholo", "प्रोजेक्ट खोलें"], "studio"],
  },
  notebook: {
    kind: "workspace",
    noun: ["this notebook", "ye notebook", "यह नोटबुक"],
    empty: [["Empty notebook", "Khaali notebook", "खाली नोटबुक"], ["Add a cell, or start from the milestone template.", "Cell jodo, ya milestone template se shuru karo.", "सेल जोड़ें।"], ["Use the template", "Template lo", "टेम्पलेट लें"], "notebook"],
    first: [["Python runs right here", "Python yahin chalta hai", "Python यहीं चलता है"], [["Small data runs in your browser", "Chhota data browser me", "छोटा डेटा ब्राउज़र में"], ["Bigger jobs run on our CPU", "Bada kaam hamare CPU par", "बड़ा काम हमारे CPU पर"], ["Need a GPU? Open it in Colab; the grade stays here", "GPU chahiye? Colab me kholo; grade yahin", "GPU? Colab में खोलें"]], ["Start", "Shuru karo", "शुरू करें"], "notebook"],
  },
};

export const STATE_SCREENS = Object.keys(COPY);
export type MockState = "ok" | "empty" | "loading" | "error" | "offline" | "first";

export function useMockState(): [MockState, (s: MockState) => void] {
  const [v, set] = useVariant("state", "ok");
  return [v as MockState, (s) => set(s)];
}

function Skeleton({ kind, noun }: { kind: Kind; noun: T3 }) {
  const t = useT();
  return (
    <div className={`st-skel st-${kind}`} aria-busy="true" aria-live="polite">
      <span className="tiny faint st-cap">
        {t("Loading", "Load ho raha hai:", "लोड हो रहा है:")} {t(...noun)}…{" "}
        {t("On a slow connection this can take a few seconds.", "Dheeme net par kuch second lag sakte hain.", "धीमे नेट पर कुछ सेकंड लग सकते हैं।")}
      </span>
      {kind === "workspace" ? (
        <>
          <div className="st-pane">
            <Skel w="60%" h={22} />
            <Skel w="40%" h={12} />
            {[90, 96, 80, 70, 92].map((w, i) => (
              <Skel key={i} w={`${w}%`} h={12} />
            ))}
            <Skel h={90} r={10} />
          </div>
          <div className="st-pane">
            {Array.from({ length: 12 }, (_, i) => (
              <Skel key={i} w={`${30 + ((i * 37) % 60)}%`} h={12} />
            ))}
          </div>
        </>
      ) : kind === "cards" ? (
        <>
          <Skel w="40%" h={30} />
          <div className="st-cards">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="st-card">
                <Skel w="50%" h={14} />
                <Skel w="80%" h={28} />
                <Skel w="65%" h={12} />
              </div>
            ))}
          </div>
        </>
      ) : kind === "doc" ? (
        <div className="st-doc">
          <Skel w="70%" h={30} />
          {[96, 92, 98, 60, 0, 94, 90, 72].map((w, i) => (w ? <Skel key={i} w={`${w}%`} h={13} /> : <span key={i} style={{ height: 10 }} />))}
          <Skel h={120} r={12} />
        </div>
      ) : (
        <>
          <Skel w="35%" h={14} />
          <Skel w="55%" h={34} />
          <div className="st-rows">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="st-row">
                <Skel w={34} h={34} r={10} />
                <span className="grow col g6">
                  <Skel w={`${50 + i * 7}%`} h={13} />
                  <Skel w="30%" h={10} />
                </span>
                <Skel w={64} h={30} r={8} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Center({ children }: { children: ReactNode }) {
  return <div className="st-center">{children}</div>;
}

/** What replaces a core screen in the empty, loading and error states. */
export function StateBody({ id, state }: { id: string; state: MockState }) {
  const t = useT();
  const c = COPY[id];
  if (!c) return null;
  if (state === "loading") return <Skeleton kind={c.kind} noun={c.noun} />;
  if (state === "empty")
    return (
      <Center>
        <div className="empty paper-grid st-empty">
          <Diya size={64} mood="peek" />
          <div className="h3">{t(...c.empty[0])}</div>
          <p className="muted small" style={{ maxWidth: 400 }}>
            {t(...c.empty[1])}
          </p>
          <Link to={c.empty[3]} className="btn pri">
            {t(...c.empty[2])}
            <ArrowRight />
          </Link>
        </div>
      </Center>
    );
  if (state === "error")
    return (
      <Center>
        <div className="empty st-error" role="alert">
          <Diya size={64} mood="think" />
          <div className="h3">
            {t("We couldn't load", "Load nahi ho paaya:", "लोड नहीं हुआ:")} {t(...c.noun)}
          </div>
          <p className="muted small" style={{ maxWidth: 420 }}>
            {t(
              "Our server did not answer in time. Nothing you did is lost; your last saved work is on this device.",
              "Hamara server time par nahi bola. Aapka kuch nahi gaya; aakhri save kiya kaam is device par hai.",
              "सर्वर ने समय पर जवाब नहीं दिया। आपका कुछ नहीं गया।",
            )}
          </p>
          <div className="row wrap g8" style={{ justifyContent: "center" }}>
            <button className="btn pri" onClick={() => window.dispatchEvent(new Event("pk-retry"))}>
              <RotateCw />
              {t("Try again", "Phir koshish", "फिर कोशिश")}
            </button>
            <a className="btn ghost" href="#map">
              <Activity />
              {t("Status page", "Status page", "स्थिति पेज")}
            </a>
          </div>
          <span className="tiny faint mono">ref 7KQ2-504 · 23 Oct, 7:41 pm</span>
        </div>
      </Center>
    );
  return null;
}

/** Shown above the normal screen when there is no network. */
export function OfflineBanner() {
  const t = useT();
  return (
    <div className="banner marker st-offline" role="status">
      <WifiOff />
      <span className="grow">
        <b>{t("You are offline.", "Net nahi hai.", "नेट नहीं है।")}</b>{" "}
        {t(
          "Keep reading and writing; we save on this device and sync when you are back. Submitting and Sahayak need the net.",
          "Padhte-likhte raho; sab is device par save hoga aur net aate hi sync. Submit aur Sahayak ko net chahiye.",
          "पढ़ते-लिखते रहें; नेट आते ही सिंक होगा।",
        )}
      </span>
    </div>
  );
}

/** The first-visit card shown on top of the normal screen. */
export function FirstCard({ id, floating }: { id: string; floating?: boolean }) {
  const t = useT();
  const [, set] = useMockState();
  const c = COPY[id];
  if (!c) return null;
  return (
    <section className={`st-first ${floating ? "float" : ""}`} aria-label={t("First visit", "Pehli baar", "पहली बार")}>
      <Diya size={52} mood="happy" />
      <div className="grow col g8" style={{ minWidth: 0 }}>
        <b className="st-first-t">{t(...c.first[0])}</b>
        <ol className="st-steps">
          {c.first[1].map((s, i) => (
            <li key={i}>
              <span className="num">{i + 1}</span>
              {t(...s)}
            </li>
          ))}
        </ol>
        <div className="row wrap g8">
          <Link to={c.first[3]} className="btn pri sm" onClick={() => set("ok")}>
            {t(...c.first[2])}
          </Link>
          <button className="btn ghost sm" onClick={() => set("ok")}>
            {t("Skip", "Chhodo", "छोड़ें")}
          </button>
        </div>
      </div>
      <button className="icon-btn st-first-x" onClick={() => set("ok")} aria-label={t("Close", "Band karo", "बंद करें")}>
        <X />
      </button>
    </section>
  );
}

/** A focus screen in the empty, loading or error state keeps its top bar so the way back is never lost. */
export function FocusState({ id, title, state }: { id: string; title: string; state: MockState }) {
  return (
    <>
      <FocusBar back="aaj" title={title} />
      <div className="st-focus">
        <StateBody id={id} state={state} />
      </div>
    </>
  );
}

const STATES: { id: MockState; label: T3 }[] = [
  { id: "ok", label: ["Normal", "Theek", "सामान्य"] },
  { id: "first", label: ["First visit", "Pehli baar", "पहली बार"] },
  { id: "empty", label: ["Empty", "Khaali", "खाली"] },
  { id: "loading", label: ["Loading", "Load ho raha", "लोड हो रहा"] },
  { id: "error", label: ["Error", "Error", "त्रुटि"] },
  { id: "offline", label: ["Offline", "Net nahi", "ऑफ़लाइन"] },
];

/** Mock chrome: pick the state of this screen. Only on the twelve core screens. */
export function StateFab() {
  const t = useT();
  const [s, set] = useMockState();
  const cur = STATES.find((x) => x.id === s) ?? STATES[0];
  return (
    <div className="state-fab">
      <Menu
        up
        align="left"
        width={220}
        trigger={(open, toggle) => (
          <button className={`btn sm ${s === "ok" ? "" : "pri"}`} onClick={toggle} aria-expanded={open} aria-label={t("Screen state (mock)", "Screen ki haalat (mock)", "स्क्रीन की स्थिति (मॉक)")}>
            <Layers />
            {t("State", "Haalat", "स्थिति")}: {t(...cur.label)}
          </button>
        )}
      >
        {(close) => (
          <>
            <div className="menu-label">{t("Mock · see this screen as", "Mock · ye screen aise dekho", "मॉक · ऐसे देखें")}</div>
            {STATES.map((x) => (
              <button
                key={x.id}
                className="menu-item"
                role="menuitemradio"
                aria-checked={s === x.id}
                onClick={() => {
                  set(x.id);
                  close();
                }}
              >
                <span className="grow">{t(...x.label)}</span>
                {s === x.id && <Check />}
              </button>
            ))}
          </>
        )}
      </Menu>
    </div>
  );
}
