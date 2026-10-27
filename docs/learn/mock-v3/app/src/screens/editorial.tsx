import { useEffect, useState } from "react";
import { Play, Pause, ChevronLeft, ChevronRight, Clock, HardDrive, TriangleAlert, Lightbulb, CodeXml, ThumbsUp, ThumbsDown, Sparkles, ArrowRight, BookOpen, ListChecks } from "lucide-react";
import { Link, useT } from "../lib/core";
import { useAi } from "../lib/state";
import { Badge, Level, Code, Seg, Tabs, PenNote, Hl } from "../ui/kit";

/* ---------------- dry run (computed, not hand written) ---------------- */

const ARR = [1, 3, 4, 6, 8, 11];
const TARGET = 10;
type Step = { L: number; R: number; sum: number; line: number; found?: boolean };
function pairSteps(): Step[] {
  const out: Step[] = [];
  let L = 0;
  let R = ARR.length - 1;
  while (L < R) {
    const sum = ARR[L] + ARR[R];
    if (sum === TARGET) {
      out.push({ L, R, sum, line: 5, found: true });
      break;
    }
    out.push({ L, R, sum, line: sum < TARGET ? 6 : 7 });
    if (sum < TARGET) L++;
    else R--;
  }
  return out;
}
const STEPS = pairSteps();

const BEST = `vector<int> pairWithSum(vector<int>& a, long long target) {
    int L = 0, R = a.size() - 1;
    while (L < R) {
        long long sum = (long long)a[L] + a[R];
        if (sum == target) return {L, R};
        if (sum < target) L++;
        else R--;
    }
    return {-1};
}`;
const CODE: Record<string, string> = {
  "C++": BEST,
  Java: `int[] pairWithSum(int[] a, long target) {
    int L = 0, R = a.length - 1;
    while (L < R) {
        long sum = (long) a[L] + a[R];
        if (sum == target) return new int[]{L, R};
        if (sum < target) L++;
        else R--;
    }
    return new int[]{-1};
}`,
  Python: `def pair_with_sum(a, target):
    L, R = 0, len(a) - 1
    while L < R:
        s = a[L] + a[R]   # Python ints never overflow
        if s == target: return [L, R]
        if s < target: L += 1
        else: R -= 1
    return [-1]`,
  JavaScript: `function pairWithSum(a, target) {
  let L = 0, R = a.length - 1;
  while (L < R) {
    const sum = a[L] + a[R]; // safe below 2^53
    if (sum === target) return [L, R];
    if (sum < target) L++;
    else R--;
  }
  return [-1];
}`,
};

function wobble(x: number, y: number, w: number, h: number, seed: number) {
  const j = (k: number) => ((Math.sin(seed * 12.9 + k * 78.2) * 43758.5) % 1) * 1.6;
  return `M${x + j(1)} ${y + j(2)} L${x + w + j(3)} ${y + j(4)} L${x + w + j(5)} ${y + h + j(6)} L${x + j(7)} ${y + h + j(8)} Z`;
}

export function DryRun({ compact }: { compact?: boolean }) {
  const t = useT();
  const [i, setI] = useState(0);
  const [play, setPlay] = useState(false);
  const s = STEPS[i];
  useEffect(() => {
    if (!play) return;
    const id = window.setInterval(() => setI((x) => (x >= STEPS.length - 1 ? (setPlay(false), x) : x + 1)), 1300);
    return () => window.clearInterval(id);
  }, [play]);
  const cell = 64;
  const W = ARR.length * cell + 40;
  const cap =
    s.found
      ? t(`${ARR[s.L]} + ${ARR[s.R]} = ${s.sum}. Found it: positions ${s.L} and ${s.R}.`, `${ARR[s.L]} + ${ARR[s.R]} = ${s.sum}. Mil gaya: ${s.L} aur ${s.R}.`, `${ARR[s.L]} + ${ARR[s.R]} = ${s.sum}। मिल गया।`)
      : s.sum < TARGET
        ? t(`${ARR[s.L]} + ${ARR[s.R]} = ${s.sum}, less than ${TARGET}. Move L right.`, `${ARR[s.L]} + ${ARR[s.R]} = ${s.sum}, ${TARGET} se kam. L daayein.`, `${s.sum}, ${TARGET} से कम। L दाएँ।`)
        : t(`${ARR[s.L]} + ${ARR[s.R]} = ${s.sum}, more than ${TARGET}. Move R left.`, `${ARR[s.L]} + ${ARR[s.R]} = ${s.sum}, ${TARGET} se zyada. R baayein.`, `${s.sum}, ${TARGET} से ज़्यादा। R बाएँ।`);
  return (
    <div className={`dry ${compact ? "compact" : ""}`}>
      <div className="dry-stage paper-grid">
        <svg viewBox={`0 0 ${W} 170`} width="100%" style={{ maxWidth: W }} aria-label={cap}>
          <text x="20" y="22" className="dry-hand" fontSize="15">
            target = {TARGET}
          </text>
          {ARR.map((v, k) => {
            const x = 20 + k * cell;
            const inRange = k >= s.L && k <= s.R;
            const hit = k === s.L || k === s.R;
            return (
              <g key={k} opacity={inRange ? 1 : 0.35}>
                {hit && <path d={wobble(x + 4, 50, cell - 8, cell - 8, k + 3)} fill={s.found ? "var(--tick-soft)" : "url(#hatch)"} />}
                <path d={wobble(x + 4, 50, cell - 8, cell - 8, k)} fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinejoin="round" />
                <text x={x + cell / 2} y={50 + cell / 2 + 7} textAnchor="middle" className="dry-hand" fontSize="22" fontWeight="700">
                  {v}
                </text>
                <text x={x + cell / 2} y={42} textAnchor="middle" className="dry-idx">
                  {k}
                </text>
              </g>
            );
          })}
          {[
            ["L", s.L, "var(--pen)"],
            ["R", s.R, "var(--red)"],
          ].map(([n, k, c]) => {
            const x = 20 + (k as number) * cell + cell / 2;
            return (
              <g key={n as string} className="dry-ptr" style={{ transform: `translateX(${x}px)` }}>
                <path d="M0 146 L0 118 M-6 124 L0 116 L6 124" stroke={c as string} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <text x="0" y="164" textAnchor="middle" className="dry-hand" fill={c as string} fontSize="16" fontWeight="700">
                  {n as string}
                </text>
              </g>
            );
          })}
          <defs>
            <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" fill="var(--marker-soft)" />
              <line x1="0" y1="0" x2="0" y2="7" stroke="var(--coin)" strokeWidth="1.4" opacity=".55" />
            </pattern>
          </defs>
        </svg>
        <div className="dry-sum">
          <span className="hand">
            sum = {ARR[s.L]} + {ARR[s.R]} = <b className={s.found ? "t-tick" : s.sum < TARGET ? "t-pen" : "t-red"}>{s.sum}</b>
          </span>
        </div>
      </div>
      <div className="dry-cap">
        <span className={`dry-step ${s.found ? "ok" : ""}`}>
          {t("Step", "Kadam", "चरण")} {i + 1} / {STEPS.length}
        </span>
        <span className="grow">{cap}</span>
      </div>
      <div className="dry-ctrl">
        <button className="icon-btn" onClick={() => setI(Math.max(0, i - 1))} aria-label="Previous step">
          <ChevronLeft />
        </button>
        <button className="btn sm pri" onClick={() => (i >= STEPS.length - 1 ? (setI(0), setPlay(true)) : setPlay(!play))}>
          {play ? <Pause /> : <Play />}
          {play ? t("Pause", "Roko", "रोकें") : t("Play", "Chalao", "चलाएँ")}
        </button>
        <button className="icon-btn" onClick={() => setI(Math.min(STEPS.length - 1, i + 1))} aria-label="Next step">
          <ChevronRight />
        </button>
        <input type="range" min={0} max={STEPS.length - 1} value={i} onChange={(e) => setI(+e.target.value)} className="dry-range" aria-label="Step" />
        {!compact && (
          <div className="dry-vars mono">
            <span>L={s.L}</span>
            <span>R={s.R}</span>
            <span>
              line <b>{s.line}</b>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- editorial page ---------------- */

export function EditorialBody() {
  const t = useT();
  const ai = useAi();
  const [ap, setAp] = useState<"brute" | "better" | "best">("best");
  const [lang, setLang] = useState("C++");
  return (
    <article className="edi">
      <header className="page-head" style={{ marginBottom: 8 }}>
        <div className="grow">
          <div className="eyebrow">{t("Editorial", "Editorial", "हल")} · Two pointers</div>
          <h1 className="h1">Pair with target sum</h1>
          <div className="row wrap g8 mt12">
            <Level n={2} />
            <Badge icon={<Clock />}>{t("8 min read", "8 min padhai", "8 मिनट")}</Badge>
            <Badge tone="tick">{t("Reviewed by an expert", "Expert ne jaancha", "विशेषज्ञ ने जाँचा")}</Badge>
          </div>
        </div>
        <div className="page-actions">
          <Link to="problem" className="btn">
            <CodeXml />
            {t("Back to the problem", "Problem par wapas", "प्रश्न पर वापस")}
          </Link>
        </div>
      </header>

      <div className="edi-paper margin-page">
        <section id="e-idea">
          <h2 className="edi-h2">
            <span className="edi-n">1</span>
            {t("The idea in one line", "Ek line me idea", "एक पंक्ति में विचार")}
          </h2>
          <p className="prose">
            {t(
              "Because the array is sorted, the smallest and largest numbers sit at the two ends. If their sum is too small, only moving the left end can help; if it is too big, only the right end can.",
              "Array sorted hai, isliye sabse chhota aur sabse bada dono kinaron par hain. Sum chhota ho to sirf baayan kinara madad karega; bada ho to sirf daayan.",
              "ऐरे क्रमबद्ध है, इसलिए सबसे छोटा और सबसे बड़ा दोनों सिरों पर हैं।",
            )}
          </p>
          <aside className="margin-note">
            <PenNote>{t("sorted → two ends", "sorted → do kinare", "क्रमबद्ध → दो सिरे")}</PenNote>
          </aside>
        </section>

        <section id="e-approach">
          <h2 className="edi-h2">
            <span className="edi-n">2</span>
            {t("Three ways, from slow to fast", "Teen tareeke, dheeme se tez", "तीन तरीके")}
          </h2>
          <Seg
            value={ap}
            onChange={setAp}
            items={[
              { id: "brute", label: t("Brute · O(n²)", "Brute · O(n²)", "ब्रूट · O(n²)") },
              { id: "better", label: t("Better · O(n log n)", "Better · O(n log n)", "बेहतर · O(n log n)") },
              { id: "best", label: t("Best · O(n)", "Best · O(n)", "सर्वोत्तम · O(n)") },
            ]}
          />
          <div className="approach">
            {ap === "brute" && (
              <p className="prose">{t("Try every pair i < j. Simple and correct, but n = 2 · 10⁵ means about 2 · 10¹⁰ pairs: far beyond one second.", "Har pair i < j try karo. Sahi hai, par n = 2 · 10⁵ par 2 · 10¹⁰ pairs: ek second se bahut zyada.", "हर जोड़ी आज़माएँ।")}</p>
            )}
            {ap === "better" && (
              <p className="prose">{t("For each a[i], binary search for target − a[i] in the rest. Fast enough, but it ignores that both ends move together.", "Har a[i] ke liye target − a[i] ko binary search karo. Kaafi tez, par dono kinaron ka faayda nahi.", "बाइनरी सर्च।")}</p>
            )}
            {ap === "best" && (
              <>
                <p className="prose">{t("Two pointers: start L at 0 and R at n − 1, compare the sum with the target, and move exactly one pointer each step. Every step throws away one number for good, so it ends in at most n steps.", "Two pointers: L = 0, R = n − 1; sum ko target se milao aur har kadam ek hi pointer hilao. Har kadam ek number hamesha ke liye hatata hai, isliye n kadam me khatam.", "दो पॉइंटर: हर कदम एक पॉइंटर।")}</p>
                <div className="cx">
                  <span>
                    <Clock /> O(n) {t("time", "samay", "समय")}
                  </span>
                  <span>
                    <HardDrive /> O(1) {t("space", "jagah", "स्थान")}
                  </span>
                </div>
              </>
            )}
          </div>
        </section>

        <section id="e-dry">
          <h2 className="edi-h2">
            <span className="edi-n">3</span>
            {t("Watch it run", "Chalte hue dekho", "चलते हुए देखें")}
          </h2>
          <p className="muted small">
            a = [1, 3, 4, 6, 8, 11], target = 10 · {t("every frame is computed from the code", "har frame code se nikla hai", "हर फ़्रेम कोड से")}
          </p>
          <DryRun />
        </section>

        <section id="e-code">
          <h2 className="edi-h2">
            <span className="edi-n">4</span>
            {t("Code", "Code", "कोड")}
          </h2>
          <Tabs
            value={lang}
            onChange={setLang}
            items={Object.keys(CODE).map((k) => ({ id: k, label: k }))}
          />
          <Code code={CODE[lang]} hl={lang === "C++" || lang === "Java" ? [4] : []} />
          <aside className="margin-note" style={{ top: 150 }}>
            <PenNote>{t("long long, not int!", "long long, int nahi!", "long long, int नहीं!")}</PenNote>
          </aside>
        </section>

        <section id="e-mistakes">
          <h2 className="edi-h2">
            <span className="edi-n">5</span>
            {t("Where people slip", "Log kahan fisalte hain", "लोग कहाँ फिसलते हैं")}
          </h2>
          <div className="slips">
            <div className="slip">
              <TriangleAlert />
              <div>
                <b>{t("Overflow on the sum", "Sum par overflow", "योग पर ओवरफ़्लो")}</b>
                <p className="small muted">
                  {t("Two values up to 1.5 · 10⁹ add to 3 · 10⁹; an int stops near 2.1 · 10⁹. Use ", "Do values 1.5 · 10⁹ tak, jod 3 · 10⁹; int 2.1 · 10⁹ par rukta hai. Use karo ", "int 2.1 · 10⁹ पर रुकता है।")}
                  <code className="inl">long long</code>.
                </p>
              </div>
            </div>
            <div className="slip">
              <TriangleAlert />
              <div>
                <b>{t("L ≤ R instead of L < R", "L < R ki jagah L ≤ R", "L < R की जगह L ≤ R")}</b>
                <p className="small muted">{t("That pairs a number with itself when the target is twice that number.", "Isse number khud se jud jaata hai jab target uska double ho.", "संख्या खुद से जुड़ जाती है।")}</p>
              </div>
            </div>
          </div>
        </section>

        <footer className="edi-foot">
          <span className="small muted">{t("Did this help?", "Kaam aaya?", "काम आया?")}</span>
          <button className="btn sm">
            <ThumbsUp />
            {t("Yes", "Haan", "हाँ")}
          </button>
          <button className="btn sm">
            <ThumbsDown />
            {t("Not really", "Nahi", "नहीं")}
          </button>
          <span className="grow" />
          <button className="btn sm ai" onClick={() => ai.setOpen(true)}>
            <Sparkles />
            {t("Ask about this editorial", "Is editorial par poochho", "इस हल पर पूछें")}
          </button>
        </footer>
      </div>
    </article>
  );
}

export function EditorialRail() {
  const t = useT();
  const items = [
    ["e-idea", t("The idea", "Idea", "विचार")],
    ["e-approach", t("Three ways", "Teen tareeke", "तीन तरीके")],
    ["e-dry", t("Watch it run", "Chalte dekho", "चलते देखें")],
    ["e-code", t("Code", "Code", "कोड")],
    ["e-mistakes", t("Where people slip", "Kahan fisalte", "कहाँ फिसलते")],
  ];
  return (
    <>
      <section className="card pad col g8 toc">
        <span className="eyebrow">{t("On this page", "Is page par", "इस पेज पर")}</span>
        {items.map(([id, l], i) => (
          <a
            key={id}
            href={`#${id}`}
            className={i === 2 ? "on" : ""}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <span className="num">{i + 1}</span>
            {l}
          </a>
        ))}
      </section>
      <section className="card pad col g10">
        <span className="h3">{t("Practise the pattern", "Pattern ki practice", "पैटर्न का अभ्यास")}</span>
        {[
          ["Three numbers to zero", 3],
          ["Closest pair to target", 3],
          ["Container with most water", 3],
        ].map(([n, l]) => (
          <Link to="problem" key={n as string} className="row between small rail-link">
            <span className="row g8">
              <ListChecks className="faint" style={{ width: 15, height: 15 }} />
              {n as string}
            </span>
            <Level n={l as 3} short />
          </Link>
        ))}
      </section>
      <section className="card pad col g8">
        <span className="h3 row g6">
          <Lightbulb style={{ width: 16, height: 16, color: "var(--marker-ink)" }} />
          {t("Remember", "Yaad rakho", "याद रखें")}
        </span>
        <p className="small muted">
          <Hl long>{t("Sorted + pair → two pointers.", "Sorted + pair → two pointers.", "क्रमबद्ध + जोड़ी → दो पॉइंटर।")}</Hl>{" "}
          {t("Added to your revision cards.", "Revision cards me jud gaya.", "दोहराई कार्ड में जुड़ा।")}
        </p>
        <Link to="revision" className="link small">
          {t("Open revision", "Revision kholo", "दोहराई खोलें")}
          <ArrowRight />
        </Link>
      </section>
      <section className="card pad row g10">
        <BookOpen style={{ width: 18, height: 18, color: "var(--teal)" }} />
        <span className="small grow">{t("Lesson: two pointers in 6 minutes", "Lesson: two pointers 6 min me", "पाठ: दो पॉइंटर")}</span>
        <Link to="lesson" className="btn sm">
          {t("Read", "Padho", "पढ़ें")}
        </Link>
      </section>
    </>
  );
}
