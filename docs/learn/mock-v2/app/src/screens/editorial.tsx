import { useState } from "react";
import { Copy, Lightbulb, TriangleAlert, Ban, Clock, HardDrive, PlayCircle, ArrowRight, CircleCheck, Link2 } from "lucide-react";
import { Link, useT, useToast } from "../lib/core";
import { Code, Level, Seg, Tabs } from "../ui/kit";
import { PageHead } from "../ui/shell";
import { DryRunPlayer } from "../ui/dryrun";

type A = "brute" | "better" | "best";
type L = "cpp" | "java" | "py" | "js";

const CODE: Record<A, Record<L, string>> = {
  brute: {
    cpp: `// Try every pair: O(n²)
for (int i = 0; i < n; i++)
    for (int j = i + 1; j < n; j++)
        if ((long long)a[i] + a[j] == target)
            return {i, j};
return {-1};`,
    java: `// Try every pair: O(n²)
for (int i = 0; i < n; i++)
    for (int j = i + 1; j < n; j++)
        if ((long) a[i] + a[j] == target)
            return new int[]{i, j};
return new int[]{-1};`,
    py: `# Try every pair: O(n²)
for i in range(n):
    for j in range(i + 1, n):
        if a[i] + a[j] == target:
            return [i, j]
return [-1]`,
    js: `// Try every pair: O(n²)
for (let i = 0; i < n; i++)
  for (let j = i + 1; j < n; j++)
    if (a[i] + a[j] === target) return [i, j];
return [-1];`,
  },
  better: {
    cpp: `// Remember what we have seen: O(n) time, O(n) space
unordered_map<long long, int> seen;
for (int j = 0; j < n; j++) {
    long long need = target - a[j];
    if (seen.count(need)) return {seen[need], j};
    seen[a[j]] = j;
}
return {-1};`,
    java: `Map<Long, Integer> seen = new HashMap<>();
for (int j = 0; j < n; j++) {
    long need = target - a[j];
    if (seen.containsKey(need)) return new int[]{seen.get(need), j};
    seen.put((long) a[j], j);
}
return new int[]{-1};`,
    py: `seen = {}
for j, x in enumerate(a):
    if target - x in seen:
        return [seen[target - x], j]
    seen[x] = j
return [-1]`,
    js: `const seen = new Map();
for (let j = 0; j < n; j++) {
  const need = target - a[j];
  if (seen.has(need)) return [seen.get(need), j];
  seen.set(a[j], j);
}
return [-1];`,
  },
  best: {
    cpp: `// Two pointers on the sorted array: O(n) time, O(1) space
int L = 0, R = n - 1;
while (L < R) {
    long long s = (long long)a[L] + a[R];
    if (s == target) return {L, R};
    if (s < target) L++;
    else R--;
}
return {-1};`,
    java: `int L = 0, R = n - 1;
while (L < R) {
    long s = (long) a[L] + a[R];
    if (s == target) return new int[]{L, R};
    if (s < target) L++; else R--;
}
return new int[]{-1};`,
    py: `L, R = 0, n - 1
while L < R:
    s = a[L] + a[R]          # Python ints never overflow
    if s == target: return [L, R]
    if s < target: L += 1
    else: R -= 1
return [-1]`,
    js: `let L = 0, R = n - 1;
while (L < R) {
  const s = a[L] + a[R];     // exact up to 2^53
  if (s === target) return [L, R];
  if (s < target) L++; else R--;
}
return [-1];`,
  },
};

export function EditorialBody() {
  const t = useT();
  const toast = useToast();
  const [ap, setAp] = useState<A>("best");
  const [lang, setLang] = useState<L>("cpp");
  const meta: Record<A, { time: string; space: string; idea: [string, string, string] }> = {
    brute: {
      time: "O(n²)",
      space: "O(1)",
      idea: [
        "Check every pair (i, j). Simple and always right, but n = 2 · 10⁵ means about 2 · 10¹⁰ pairs: far too slow.",
        "Har jodi (i, j) check karo. Seedha aur hamesha sahi, par n = 2 · 10⁵ par lagbhag 2 · 10¹⁰ jodiyan: bahut dheema.",
        "हर जोड़ी जाँचें। सही, पर बहुत धीमा।",
      ],
    },
    better: {
      time: "O(n)",
      space: "O(n)",
      idea: [
        "Walk once and remember every value you have seen. For a[j], ask: have I seen target − a[j]? This works even if the array is not sorted.",
        "Ek baar chalo aur dekhi hui values yaad rakho. a[j] ke liye poochho: kya target − a[j] dekha hai? Ye unsorted array par bhi chalta hai.",
        "एक बार चलें और देखे मान याद रखें।",
      ],
    },
    best: {
      time: "O(n)",
      space: "O(1)",
      idea: [
        "The array is sorted. Put L at the start and R at the end. If the sum is too small, only moving L right can help; if too big, only moving R left can help. Each step throws away one element for good.",
        "Array sorted hai. L shuru me, R aakhir me. Sum chhota ho to sirf L ko daayein khiskana madad karega; bada ho to sirf R ko baayein. Har kadam ek element hamesha ke liye hata deta hai.",
        "ऐरे क्रमबद्ध है। L शुरू में, R अंत में। योग छोटा → L दाएँ; बड़ा → R बाएँ।",
      ],
    },
  };
  const m = meta[ap];
  return (
    <div className="page article-page">
      <PageHead
        crumbs={[
          { to: "sheet", label: "DSA sheet" },
          { to: "problem", label: "Pair with target sum" },
          { label: t("Editorial", "Editorial", "हल") },
        ]}
        title={t("Pair with target sum: editorial", "Pair with target sum: editorial", "हल: लक्ष्य योग वाली जोड़ी")}
        sub={t("Three approaches, from the obvious to the best. Read in English, Hinglish or Hindi from the top bar.", "Teen tareeke, seedhe se best tak. Bhasha top bar se badlo.", "तीन तरीके। भाषा ऊपर से बदलें।")}
        actions={
          <>
            <Level lv={2} />
            <span className="tag">Two pointers</span>
          </>
        }
      />

      <div className="row wrap between" style={{ gap: 12 }}>
        <Seg<A>
          label="Approach"
          value={ap}
          onChange={setAp}
          options={[
            { value: "brute", label: t("Brute force", "Brute force", "सीधा तरीका") },
            { value: "better", label: t("Better", "Better", "बेहतर") },
            { value: "best", label: t("Best", "Best", "सबसे अच्छा") },
          ]}
        />
        <div className="row" style={{ gap: 8 }}>
          <span className="tag outline">
            <Clock size={12} /> {m.time}
          </span>
          <span className="tag outline">
            <HardDrive size={12} /> {m.space}
          </span>
        </div>
      </div>

      <article className="article" key={ap}>
        <section>
          <h2>
            <Lightbulb size={18} /> {t("Intuition", "Samajh", "समझ")}
          </h2>
          <p>{t(...m.idea)}</p>
        </section>

        {ap === "best" && (
          <section>
            <h2>{t("Steps", "Kadam", "कदम")}</h2>
            <ol className="steps-list">
              <li>{t("Set L = 0 and R = n − 1.", "L = 0 aur R = n − 1 rakho.", "L = 0, R = n − 1।")}</li>
              <li>{t("While L < R, compute s = a[L] + a[R] in a 64-bit integer.", "Jab tak L < R, s = a[L] + a[R] ko 64-bit me nikalo.", "s = a[L] + a[R] को 64-बिट में।")}</li>
              <li>{t("If s equals target, return (L, R).", "s == target ho to (L, R) lautao.", "s = target हो तो लौटाएँ।")}</li>
              <li>{t("If s is smaller, move L right; otherwise move R left.", "s chhota ho to L daayein; warna R baayein.", "छोटा → L दाएँ, नहीं तो R बाएँ।")}</li>
              <li>{t("If the pointers meet, there is no pair: return −1.", "Pointers mil jaayein to jodi nahi: −1.", "मिल जाएँ तो −1।")}</li>
            </ol>
          </section>
        )}

        {ap === "best" && (
          <section>
            <h2>{t("Dry run", "Dry run", "ड्राई रन")}</h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              {t("a = [1, 3, 4, 6, 8, 11], target = 10. Slide or press play; the code line and variables follow.", "a = [1, 3, 4, 6, 8, 11], target = 10. Slide karo ya play dabao; code line aur variables saath chalenge.", "स्लाइड करें या चलाएँ।")}
            </p>
            <DryRunPlayer />
          </section>
        )}

        <section>
          <div className="row between wrap" style={{ gap: 8 }}>
            <h2>{t("Code", "Code", "कोड")}</h2>
            <div className="row" style={{ gap: 6 }}>
              <Tabs<L>
                label="Language"
                value={lang}
                onChange={setLang}
                tabs={[
                  { value: "cpp", label: "C++" },
                  { value: "java", label: "Java" },
                  { value: "py", label: "Python" },
                  { value: "js", label: "JavaScript" },
                ]}
              />
              <button
                type="button"
                className="icon-btn bordered"
                aria-label="Copy code"
                onClick={() => {
                  navigator.clipboard?.writeText(CODE[ap][lang]).catch(() => {});
                  toast(t("Code copied", "Code copy hua", "कोड कॉपी हुआ"));
                }}
              >
                <Copy size={15} />
              </button>
            </div>
          </div>
          <div className="code-card">
            <Code code={CODE[ap][lang]} />
          </div>
        </section>

        <section className="callout warn">
          <h3>
            <TriangleAlert size={16} /> {t("The mistake most people make", "Sabse aam galti", "सबसे आम गलती")}
          </h3>
          <p>
            {t(
              "a[i] can be 1.5 · 10⁹, so a[L] + a[R] can reach 3 · 10⁹. That does not fit in a 32-bit int (max 2,147,483,647). In C++ and Java, add in a 64-bit type. The smallest test that catches it: a = [2³⁰, 2³⁰], target = 2³¹.",
              "a[i] 1.5 · 10⁹ tak, to a[L] + a[R] 3 · 10⁹ tak. Ye 32-bit int me nahi aata (max 2,147,483,647). C++ aur Java me 64-bit type me jodo. Pakadne wala sabse chhota test: a = [2³⁰, 2³⁰], target = 2³¹.",
              "योग 32-बिट int में नहीं आता। 64-बिट में जोड़ें।",
            )}
          </p>
        </section>

        <section className="callout">
          <h3>
            <Ban size={16} /> {t("When this does not work", "Kab nahi chalega", "कब नहीं चलेगा")}
          </h3>
          <p>
            {t(
              "Two pointers needs the array sorted. If it is not, either sort a copy and keep the original indices (O(n log n)), or use the hashing approach (O(n), extra memory).",
              "Two pointers ko sorted array chahiye. Na ho to copy sort karke asli index rakho (O(n log n)), ya hashing wala tareeka (O(n), extra memory).",
              "क्रमबद्ध न हो तो हैशिंग।",
            )}
          </p>
        </section>

        <section>
          <h2>{t("Complexity", "Complexity", "जटिलता")}</h2>
          <div className="cx-grid">
            <div>
              <span>{t("Time", "Samay", "समय")}</span>
              <b>{m.time}</b>
              <small>
                {ap === "brute"
                  ? t("n(n−1)/2 pairs", "n(n−1)/2 jodiyan", "n(n−1)/2 जोड़ियाँ")
                  : t("each step moves one pointer; at most n − 1 steps", "har kadam ek pointer; zyada se zyada n − 1", "अधिकतम n − 1 कदम")}
              </small>
            </div>
            <div>
              <span>{t("Extra space", "Extra jagah", "अतिरिक्त जगह")}</span>
              <b>{m.space}</b>
              <small>{ap === "better" ? t("the hash map holds up to n values", "hash map me n tak values", "n मान") : t("two indices", "do index", "दो सूचकांक")}</small>
            </div>
          </div>
        </section>

        <section className="video-opt">
          <div className="vthumb" aria-hidden="true">
            <PlayCircle size={34} />
          </div>
          <div className="grow">
            <b>{t("Video walkthrough · 9 min", "Video · 9 min", "वीडियो · 9 मिनट")}</b>
            <p className="faint" style={{ fontSize: "var(--fs-12)" }}>
              {t("Optional. Off when data saver is on. Hindi and English audio.", "Optional. Data saver par band. Hindi aur English audio.", "वैकल्पिक। हिंदी और अंग्रेज़ी।")}
            </p>
          </div>
          <button type="button" className="btn secondary sm">
            {t("Play", "Chalao", "चलाएँ")}
          </button>
        </section>

        <section>
          <h2>{t("Practise the pattern", "Pattern ka abhyas", "पैटर्न का अभ्यास")}</h2>
          <div className="list panel">
            {[
              ["Three numbers that add to zero", 3],
              ["Container with the most water", 3],
              ["Pairs with difference k", 2],
            ].map(([n, lv]) => (
              <Link key={n as string} to="problem" className="list-row">
                <Link2 size={15} className="faint" />
                <span className="t">{n}</span>
                <Level lv={lv as 2 | 3} />
                <ArrowRight size={15} className="faint" />
              </Link>
            ))}
          </div>
        </section>

        <div className="article-foot">
          <span className="faint" style={{ fontSize: "var(--fs-12)", display: "flex", alignItems: "center", gap: 6 }}>
            <CircleCheck size={13} /> {t("Checked by 2 reviewers · every code block passes all 24 tests", "2 reviewers ne jaancha · har code saare 24 tests pass", "2 समीक्षकों ने जाँचा")}
          </span>
          <Link to="problem" className="btn primary">
            {t("Back to the problem", "Problem par wapas", "प्रश्न पर वापस")} <ArrowRight size={15} />
          </Link>
        </div>
      </article>
    </div>
  );
}
