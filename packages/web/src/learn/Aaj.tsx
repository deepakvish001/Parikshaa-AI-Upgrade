import { ArrowRight, BookOpen, Brain, Bug, CalendarClock, CalendarRange, Check, CircleX, Feather, Play, RotateCcw, Snowflake, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { Meter, Ring } from "@parikshaa/brand/kit";
import type { Tri } from "./screens.ts";
import { ScreenLink, useLearn } from "./context.tsx";
import { CodeXml, Flame, Sparkles, Timer } from "./icons.tsx";

/**
 * Aaj, roop A "Ek kaam" (DESIGN-SYSTEM §7a; the mock's `AajBody` and
 * `AajRail` in docs/learn/mock-v3/app/src/screens/today.tsx), drawn with the
 * kit on sample data. Nothing here is fetched: Kadam 2 puts the learner's own
 * day in its place, and until then the page says it is a sample.
 */

type Task = { readonly id: string; readonly kind: "lesson" | "problem" | "revision" | "aptitude"; readonly title: Tri; readonly meta: Tri; readonly min: number; readonly done: boolean; readonly to: string };

const TASKS: readonly Task[] = [
  { id: "t1", kind: "lesson", title: ["Stack: the LIFO idea", "Stack: LIFO idea", "स्टैक: LIFO का विचार"], meta: ["Lesson · 4 min read + 3 questions", "Lesson · 4 min padhna + 3 sawaal", "पाठ · 4 मिनट पढ़ना + 3 सवाल"], min: 25, done: true, to: "courses" },
  { id: "t2", kind: "problem", title: ["Pair with target sum", "Pair with target sum", "Pair with target sum"], meta: ["Two pointers · level 2", "Two pointers · level 2", "Two pointers · स्तर 2"], min: 30, done: false, to: "sheet" },
  { id: "t3", kind: "problem", title: ["Valid brackets", "Valid brackets", "Valid brackets"], meta: ["Stack · level 2", "Stack · level 2", "Stack · स्तर 2"], min: 35, done: false, to: "sheet" },
  { id: "t4", kind: "revision", title: ["6 revision cards", "6 revision cards", "6 दोहराई कार्ड"], meta: ["3 mistakes, 3 concepts", "3 galtiyan, 3 concepts", "3 गलतियाँ, 3 अवधारणाएँ"], min: 15, done: false, to: "revision" },
  { id: "t5", kind: "aptitude", title: ["Successive percentages", "Successive percentage", "क्रमिक प्रतिशत"], meta: ["Aptitude set · 10 questions", "Aptitude set · 10 sawaal", "एप्टीट्यूड सेट · 10 सवाल"], min: 25, done: false, to: "aptitude" },
];
const NOW = "t2";

const KIND: Record<Task["kind"], ReactNode> = {
  lesson: <BookOpen aria-hidden="true" />,
  problem: <CodeXml aria-hidden="true" />,
  revision: <RotateCcw aria-hidden="true" />,
  aptitude: <Brain aria-hidden="true" />,
};

export function SampleNote() {
  const { t } = useLearn();
  return (
    <p className="ln-sample" role="note">
      <b>{t(["Sample", "Sample", "नमूना"])}</b>
      {t(["This day is sample data; step 2 shows your own.", "Ye din sample data hai; Kadam 2 me aapka apna dikhega.", "यह दिन नमूना डेटा है; कदम 2 में आपका अपना दिखेगा।"])}
    </p>
  );
}

export function AajBody() {
  const { t, openSahayak } = useLearn();
  const left = TASKS.filter((task) => !task.done);
  const mins = left.reduce((sum, task) => sum + task.min, 0);
  const doneCount = TASKS.length - left.length;
  const rest = TASKS.filter((task) => task.id !== NOW);
  return (
    <div className="ln-stack">
      <SampleNote />
      <div className="ln-aaj-head">
        <div className="ln-grow">
          <p className="ln-eyebrow">{t(["Tuesday, 20 October · day 38 of 90", "Mangalvaar, 20 October · din 38/90", "मंगलवार, 20 अक्टूबर · दिन 38/90"])}</p>
          <h1 className="ln-aaj-h1">
            {t(["Good evening, Aarav.", "Shubh sandhya, Aarav.", "शुभ संध्या, आरव।"])}{" "}
            <span className="ln-aaj-sub">
              {t([`${left.length} things left, about ${mins} min.`, `${left.length} kaam baaki, lagbhag ${mins} min.`, `${left.length} काम बाकी, लगभग ${mins} मिनट।`])}
            </span>
          </h1>
        </div>
        <span className="ln-badge ln-tone-tick">
          <Check aria-hidden="true" />
          {t(["2 days ahead", "2 din aage", "2 दिन आगे"])}
        </span>
      </div>

      <section className="ln-now" aria-labelledby="ln-now-title">
        <div className="ln-now-top">
          <span className="ln-eyebrow">{t(["Now · task 2 of 5", "Abhi · kaam 2 / 5", "अभी · काम 2 / 5"])}</span>
          <span className="ln-faint">30 min</span>
        </div>
        <div className="ln-now-main">
          <div className="ln-grow">
            <h2 className="ln-now-title" id="ln-now-title">
              Pair with target sum
            </h2>
            <p className="ln-now-why">
              <span className="ln-badge ln-tone-red">
                <CircleX aria-hidden="true" />
                {t(["Wrong answer · test 23", "Galat · test 23", "गलत · टेस्ट 23"])}
              </span>
              <span>{t(["The idea is right; one input breaks it.", "Idea sahi hai; ek input todta hai.", "विचार सही है; एक इनपुट तोड़ता है।"])}</span>
            </p>
            <code className="ln-now-code">
              <span className="ln-faint">4 </span>int sum = <mark>a[L] + a[R]</mark>;
            </code>
          </div>
          <div className="ln-now-act">
            <ScreenLink to="sheet" className="ln-btn ln-btn-pri ln-btn-lg">
              <Play aria-hidden="true" />
              {t(["Resume", "Jaari rakho", "जारी रखें"])}
            </ScreenLink>
            <button type="button" className="ln-btn ln-btn-ai" onClick={openSahayak}>
              <Sparkles aria-hidden="true" />
              {t(["Ask why it fails", "Fail kyun? Poochho", "क्यों फेल? पूछें"])}
            </button>
          </div>
        </div>
        <Meter
          label={t(["Today's tasks", "Aaj ke kaam", "आज के काम"])}
          value={doneCount}
          max={TASKS.length}
          valueText={t([`${doneCount} of ${TASKS.length} done`, `${TASKS.length} me se ${doneCount} ho gaye`, `${TASKS.length} में से ${doneCount} पूरे`])}
          tone="pen"
          size="thin"
        />
      </section>

      <section className="ln-card" aria-labelledby="ln-then-title">
        <div className="ln-card-h">
          <h2 className="ln-h3" id="ln-then-title">
            {t(["Then", "Phir", "फिर"])}
          </h2>
          <span className="ln-faint">
            {doneCount} / {TASKS.length} {t(["done", "ho gaye", "पूरे"])}
          </span>
        </div>
        <ul className="ln-tasks">
          {rest.map((task) => (
            <li key={task.id} className={task.done ? "ln-done" : undefined}>
              <span className={`ln-task-ic ln-k-${task.kind}`}>{KIND[task.kind]}</span>
              <span className="ln-grow">
                <b>{t(task.title)}</b>
                <span className="ln-faint">{t(task.meta)}</span>
              </span>
              <span className="ln-faint">{task.min} min</span>
              {task.done ? (
                <span className="ln-tick" role="img" aria-label={t(["Done", "Ho gaya", "पूरा"])}>
                  <Check aria-hidden="true" />
                </span>
              ) : (
                <ScreenLink to={task.to} className="ln-icon-btn" label={`${t(["Open", "Kholo", "खोलें"])}: ${t(task.title)}`}>
                  <ArrowRight aria-hidden="true" />
                </ScreenLink>
              )}
            </li>
          ))}
        </ul>
        <div className="ln-card-f">
          <Feather aria-hidden="true" />
          <span className="ln-grow">{t(["Heavy day? Make today lighter.", "Bhaari din? Aaj halka karo.", "भारी दिन? आज हल्का करें।"])}</span>
          <ScreenLink to="plan" className="ln-btn ln-btn-ghost">
            {t(["Make lighter", "Halka karo", "हल्का करें"])}
          </ScreenLink>
        </div>
      </section>
    </div>
  );
}

function Agenda({ icon, title, sub, to, action }: { readonly icon: ReactNode; readonly title: string; readonly sub: string; readonly to?: string; readonly action?: string }) {
  return (
    <li>
      {icon}
      <span className="ln-grow">
        <b>{title}</b>
        <span className="ln-faint">{sub}</span>
      </span>
      {to === undefined || action === undefined ? null : (
        <ScreenLink to={to} className="ln-btn ln-btn-sm" label={`${action}: ${title}`}>
          {action}
        </ScreenLink>
      )}
    </li>
  );
}

export function AajRail() {
  const { t } = useLearn();
  return (
    <>
      <section className="ln-card ln-card-pad" aria-labelledby="ln-week-title">
        <h2 className="ln-h3" id="ln-week-title">
          {t(["This week", "Is hafte", "इस सप्ताह"])}
        </h2>
        <div className="ln-week">
          <Ring label={t(["Readiness", "Taiyari", "तैयारी"])} value={62} valueText="62%" size={72} tone="pen">
            62%
          </Ring>
          <p className="ln-faint">{t(["Readiness for your goal: Two pointers and Stack are holding you back.", "Goal ki taiyari: Two pointers aur Stack peeche rok rahe.", "लक्ष्य की तैयारी: Two pointers और Stack पीछे रोक रहे।"])}</p>
        </div>
        <div className="ln-streak">
          <Flame aria-hidden="true" />
          <b>12</b>
          <span className="ln-grow">{t(["day streak", "din ki streak", "दिन लगातार"])}</span>
          <span className="ln-faint">
            <Snowflake aria-hidden="true" />1 {t(["freeze", "freeze", "फ़्रीज़"])}
          </span>
        </div>
      </section>
      <section className="ln-card" aria-labelledby="ln-next-title">
        <div className="ln-card-h">
          <h2 className="ln-h3" id="ln-next-title">
            {t(["Coming up", "Aage", "आगे"])}
          </h2>
        </div>
        <ul className="ln-agenda">
          <Agenda icon={<Bug aria-hidden="true" />} title={t(["Catch the AI", "Galat AI pakdo", "गलत AI पकड़ो"])} sub={t(["Today's drill · 5 min · 2 of 3 left", "Aaj ka drill · 5 min · 3 me se 2 baaki", "आज का ड्रिल · 5 मिनट"])} to="ai-drill" action={t(["Start", "Shuru", "शुरू"])} />
          <Agenda icon={<Timer aria-hidden="true" />} title={t(["Problem of the day", "Aaj ka problem", "आज का प्रश्न"])} sub={t(["3 h 57 min left", "3 ghante 57 min baaki", "3 घंटे 57 मिनट बाकी"])} to="potd" action={t(["Solve", "Solve", "हल करें"])} />
          <Agenda icon={<CalendarRange aria-hidden="true" />} title={t(["Sprint test", "Sprint test", "स्प्रिंट टेस्ट"])} sub={t(["Saturday · 45 min", "Shanivar · 45 min", "शनिवार · 45 मिनट"])} />
          <Agenda icon={<Trophy aria-hidden="true" />} title="Weekly Round 13" sub={t(["Sunday 8:00 pm", "Ravivaar 8 baje", "रविवार 8 बजे"])} to="contests" action={t(["Register", "Register", "पंजीकरण"])} />
          <Agenda icon={<CalendarClock aria-hidden="true" />} title={t(["Semester exams 3–15 Nov", "Semester exams 3–15 Nov", "सेमेस्टर परीक्षा 3–15 नवंबर"])} sub={t(["Plan drops to 45 min a day", "Plan roz 45 min ho jaayega", "योजना रोज़ 45 मिनट"])} />
        </ul>
      </section>
    </>
  );
}
