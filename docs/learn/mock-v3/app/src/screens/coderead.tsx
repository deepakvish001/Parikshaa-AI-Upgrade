import { useRef, useState } from "react";
import { ArrowRight, Check as CheckIcon, CircleCheck, CircleDashed, CircleX, Clock, CodeXml, FileSearch, Lightbulb, ListTree, Lock, MessagesSquare, Save, Sparkles } from "lucide-react";
import { useT, useToast, useCountdown, hms } from "../lib/core";
import { useVariant } from "../lib/variant";
import { Badge, Code, Meter } from "../ui/kit";
import { FocusBar, Panes, PaneHead, usePanes, useMedia } from "../ui/focus";
import { StepPills } from "./ailab";

/* AE6 "Code padhna" (LEARN-V2 §4c), added to the mock on 24 Oct 2026: an unfamiliar file of about 200 lines and three
   questions: what it does, where the bug is, what you would change and how you would prove it. Sahayak stays off until
   the answers are in. The file is real, runnable Python; its one bug (line 73 compares datetimes with a set of dates,
   so holidays are charged) was checked by running it. The step lives in pk43-v-read so the mock can open any step. */

type ReadStep = "read" | "answer" | "result";
const RSTEPS: ReadStep[] = ["read", "answer", "result"];
type Tri = [string, string, string];

const SRC = `"""Library fines for a college library (sample code for a reading drill).

A student keeps a book for 14 days (reference books: 3 days). After that a
fine is charged for every working day the book is late. Sundays and college
holidays are not counted. The fine stops growing at the book's price. If the
due date falls in an exam week, up to 3 late days are forgiven.
"""
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Iterable

FINE_PER_DAY = 2  # rupees
REFERENCE_FINE_PER_DAY = 5
LOAN_DAYS = 14
REFERENCE_LOAN_DAYS = 3
MAX_RENEWALS = 2
EXAM_GRACE_DAYS = 3

HOLIDAYS = {
    date(2026, 10, 2),   # Gandhi Jayanti
    date(2026, 10, 20),  # Dussehra
    date(2026, 11, 8),   # Diwali
    date(2026, 11, 9),
    date(2026, 11, 24),  # Guru Nanak Jayanti
    date(2026, 12, 25),
}

EXAM_WEEKS = [
    (date(2026, 11, 30), date(2026, 12, 6)),
]


@dataclass
class Book:
    acc_no: str
    title: str
    price: int
    reference: bool = False


@dataclass
class Loan:
    book: Book
    roll_no: str
    issued_at: datetime
    returned_at: datetime | None = None
    renewals: int = 0
    waived: bool = False
    notes: list[str] = field(default_factory=list)


def due_date(loan: Loan) -> datetime:
    days = REFERENCE_LOAN_DAYS if loan.book.reference else LOAN_DAYS
    days += loan.renewals * days
    return loan.issued_at + timedelta(days=days)


def in_exam_week(d: date) -> bool:
    for start, end in EXAM_WEEKS:
        if start <= d <= end:
            return True
    return False


def working_days_late(due: datetime, returned: datetime) -> int:
    """Days after \`due\` up to and including \`returned\`,
    leaving out Sundays and holidays."""
    if returned <= due:
        return 0
    late = 0
    d = due + timedelta(days=1)
    while d <= returned:
        if d in HOLIDAYS or d.weekday() == 6:
            d += timedelta(days=1)
            continue
        late += 1
        d += timedelta(days=1)
    return late


def fine_for(loan: Loan, now: datetime | None = None) -> int:
    """Fine in rupees for one loan. Open loans are charged up to \`now\`."""
    if loan.waived:
        return 0
    end = loan.returned_at or now or datetime.now()
    due = due_date(loan)
    days = working_days_late(due, end)
    if days == 0:
        return 0
    if in_exam_week(due.date()) and days <= EXAM_GRACE_DAYS:
        loan.notes.append("exam-week grace")
        return 0
    rate = REFERENCE_FINE_PER_DAY if loan.book.reference else FINE_PER_DAY
    return min(days * rate, loan.book.price)


def can_renew(loan: Loan, now: datetime, holds: set[str]) -> tuple[bool, str]:
    if loan.returned_at is not None:
        return False, "already returned"
    if loan.book.reference:
        return False, "reference books cannot be renewed"
    if loan.book.acc_no in holds:
        return False, "another student is waiting for this book"
    if loan.renewals >= MAX_RENEWALS:
        return False, "renewed twice already"
    if now > due_date(loan):
        return False, "late: pay the fine first"
    return True, ""


def renew(loan: Loan, now: datetime, holds: set[str]) -> Loan:
    ok, why = can_renew(loan, now, holds)
    if not ok:
        raise ValueError(why)
    loan.renewals += 1
    loan.notes.append(f"renewed on {now:%d %b}")
    return loan


def give_back(loan: Loan, when: datetime) -> int:
    if loan.returned_at is not None:
        raise ValueError("already returned")
    if when < loan.issued_at:
        raise ValueError("return is before issue")
    loan.returned_at = when
    return fine_for(loan)


@dataclass
class Receipt:
    roll_no: str
    lines: list[tuple[str, int]]
    total: int

    def text(self) -> str:
        rows = [f"{title[:30]:<30} Rs {amt:>4}" for title, amt in self.lines]
        rows.append("-" * 38)
        rows.append(f"{'Total':<30} Rs {self.total:>4}")
        return "\\n".join(rows)


def receipt_for(roll_no: str, loans: Iterable[Loan], now: datetime) -> Receipt:
    lines = []
    for loan in loans:
        if loan.roll_no != roll_no:
            continue
        amt = fine_for(loan, now)
        if amt:
            lines.append((loan.book.title, amt))
    lines.sort(key=lambda x: -x[1])
    return Receipt(roll_no, lines, sum(a for _, a in lines))


def waive(loan: Loan, by: str, reason: str) -> None:
    if not reason.strip():
        raise ValueError("a reason is needed to waive a fine")
    loan.waived = True
    loan.notes.append(f"waived by {by}: {reason}")


def overdue_report(loans: Iterable[Loan], now: datetime) -> list[dict]:
    out = []
    for loan in loans:
        if loan.returned_at is not None:
            continue
        due = due_date(loan)
        if now <= due:
            continue
        out.append({
            "roll_no": loan.roll_no,
            "acc_no": loan.book.acc_no,
            "title": loan.book.title,
            "due": due.strftime("%d %b %Y"),
            "days_late": working_days_late(due, now),
            "fine": fine_for(loan, now),
        })
    out.sort(key=lambda r: (-r["days_late"], r["roll_no"]))
    return out


def parse_issue_row(row: dict[str, str], books: dict[str, Book]) -> Loan:
    """One row of the issue register: acc_no, roll_no, issued (DD-MM-YYYY HH:MM)."""
    acc = row["acc_no"].strip().upper()
    if acc not in books:
        raise KeyError(f"unknown book {acc}")
    roll = row["roll_no"].strip().upper()
    issued = datetime.strptime(row["issued"].strip(), "%d-%m-%Y %H:%M")
    return Loan(book=books[acc], roll_no=roll, issued_at=issued)


def load_register(rows: Iterable[dict[str, str]], books: dict[str, Book]) -> tuple[list[Loan], list[str]]:
    loans, errors = [], []
    for i, row in enumerate(rows, start=2):
        try:
            loans.append(parse_issue_row(row, books))
        except (KeyError, ValueError) as e:
            errors.append(f"row {i}: {e}")
    return loans, errors


if __name__ == "__main__":
    books = {
        "B-1042": Book("B-1042", "Operating Systems, 3rd ed.", 650),
        "B-2210": Book("B-2210", "C Programming Basics", 320),
        "R-0007": Book("R-0007", "Engineering Maths Tables", 150, reference=True),
    }
    rows = [
        {"acc_no": "B-1042", "roll_no": "22CS041", "issued": "01-10-2026 11:30"},
        {"acc_no": "b-2210 ", "roll_no": "22cs041", "issued": "06-10-2026 15:05"},
        {"acc_no": "R-0007", "roll_no": "22EC112", "issued": "17-10-2026 10:00"},
        {"acc_no": "B-9999", "roll_no": "22ME007", "issued": "09-10-2026 12:00"},
    ]
    loans, errors = load_register(rows, books)
    now = datetime(2026, 10, 24, 17, 0)
    for line in errors:
        print("skip", line)
    print(receipt_for("22CS041", loans, now).text())
    for r in overdue_report(loans, now):
        print(r)`;
const LINES = SRC.split("\n");
const BAD = LINES.findIndex((l) => l.includes("if d in HOLIDAYS")) + 1;
const OUTLINE = LINES.flatMap((l, i) => {
  const m = /^\s*(def|class) (\w+)/.exec(l);
  return m ? [{ kind: m[1], name: m[2], line: i + 1, inner: /^\s/.test(l) }] : [];
});

const FIX = `-        if d in HOLIDAYS or d.weekday() == 6:
+        day = d.date()
+        if day in HOLIDAYS or day.weekday() == 6:`;
const TEST = `def test_holiday_is_not_a_late_day():
    due = datetime(2026, 10, 19, 11, 30)  # Mon
    back = datetime(2026, 10, 21, 16, 0)  # Wed; Tue is Dussehra
    assert working_days_late(due, back) == 1  # code: 2`;

const WHAT: Tri[] = [
  ["Works out the fine for a late library book, leaving out Sundays and holidays, up to the book's price.", "Library ki der se lautai kitab ka fine nikalti hai: Sunday aur chhutti chhod kar, kitab ke daam tak.", "देर से लौटाई किताब का जुर्माना, रविवार और छुट्टी छोड़कर, किताब के दाम तक।"],
  ["Decides how many books a student may borrow at once.", "Ek student ek saath kitni kitabein le sakta hai, ye tay karti hai.", "एक छात्र कितनी किताबें ले सकता है।"],
  ["Sends students an SMS on the day a book is due.", "Due date par student ko SMS bhejti hai.", "नियत दिन पर SMS भेजती है।"],
  ["Adds a fine for every late day, Sundays and holidays too, with no upper limit.", "Har der wale din ka fine jodti hai, Sunday aur chhutti bhi, bina kisi seema ke.", "हर दिन का जुर्माना, बिना सीमा के।"],
];
const RIGHT = 0;

export function CodeReadScreen() {
  const t = useT();
  const toast = useToast();
  const [raw, setRaw] = useVariant("read", "read");
  const step = (RSTEPS.includes(raw as ReadStep) ? raw : "read") as ReadStep;
  const [left] = useCountdown(12 * 60, step !== "result");
  const { open, toggle } = usePanes({ code: true, q: true });
  const [phoneTab, setPhoneTab] = useState("q");
  const [what, setWhat] = useState<number | null>(null);
  const [line, setLine] = useState<number | null>(null);
  const [why, setWhy] = useState("");
  const [missing, setMissing] = useState(false);
  const ed = useRef<HTMLDivElement>(null);
  const phone = useMedia("(max-width: 860px)");

  const names: Record<ReadStep, string> = {
    read: t("Read", "Padho", "पढ़ो"),
    answer: t("Answer", "Jawab", "जवाब"),
    result: t("Result", "Nateeja", "नतीजा"),
  };
  const stepLabel = t("Drill steps", "Drill ke kadam", "ड्रिल के चरण");

  const jump = (n: number) => {
    if (phone) setPhoneTab("code");
    window.setTimeout(() => {
      const el = ed.current?.querySelectorAll(".ln")[n - 1];
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el?.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
    }, 60);
  };
  const pickFromCode = (e: React.MouseEvent) => {
    if (step !== "answer") return;
    const ln = (e.target as HTMLElement).closest(".ln");
    if (!ln?.parentElement) return;
    const n = Array.prototype.indexOf.call(ln.parentElement.children, ln) + 1;
    setLine(n);
    setMissing(false);
    if (phone) toast(t(`Line ${n} picked · see Questions`, `Line ${n} chuni · Sawaal me dekho`, `लाइन ${n} चुनी`));
  };
  const send = () => {
    if (what === null || line === null) {
      setMissing(true);
      return;
    }
    setRaw("result");
  };

  /* In the result, a mock opened straight on that step shows the sample answers. */
  const a1 = what ?? RIGHT;
  const a2 = line ?? BAD;
  const score = (a1 === RIGHT ? 1 : 0) + (a2 === BAD ? 1 : 0) + 0.5;
  const scoreText = score % 1 ? `${Math.floor(score) || ""}½` : String(score);

  const codePane = (
    <div className="cr-code">
      <PaneHead onClose={() => toggle("code")} closeLabel={t("Hide code", "Code chhupao", "कोड छिपाएँ")}>
        <div className="file-tabs">
          <span className="file-tab tl-ftab on">
            <CodeXml /> fines.py
          </span>
        </div>
        <span className="grow" />
        <span className="tiny faint cr-len">{t(`${LINES.length} lines · Python`, `${LINES.length} line · Python`, `${LINES.length} लाइन · Python`)}</span>
      </PaneHead>
      <div
        className={`editor cr-ed ${step === "answer" ? "picking" : ""}`}
        ref={ed}
        onClick={pickFromCode}
        role="region"
        aria-label={t("Code: library/fines.py", "Code: library/fines.py", "कोड: library/fines.py")}
      >
        <Code code={SRC} hl={step === "result" ? (a2 !== BAD ? [a2] : []) : line ? [line] : []} bad={step === "result" ? [BAD] : []} className="ed-code" />
      </div>
      <div className="statusbar">
        <span className="faint">library/fines.py</span>
        <span className="grow" />
        <span className="tiny faint">
          {step === "answer"
            ? t("Click the line you think is wrong", "Jo line galat lage us par click karo", "गलत लाइन पर क्लिक करो")
            : step === "result"
              ? t("Red: the line with the bug", "Laal: galti wali line", "लाल: गलती वाली लाइन")
              : t("Reading only · Sahayak is off", "Sirf padhna · Sahayak band", "सिर्फ़ पढ़ना · सहायक बंद")}
        </span>
      </div>
    </div>
  );

  const readStep = (
    <div className="cr-body">
      <div className="col g6">
        <span className="eyebrow">{t("Practice · read the code", "Abhyas · code padhna", "अभ्यास · कोड पढ़ना")}</span>
        <h1 className="h2">{t("Code you did not write", "Aisa code jo aapne nahi likha", "ऐसा कोड जो आपने नहीं लिखा")}</h1>
        <p className="small muted">
          {t(
            "A college library's fine rules in Python. At work you read far more code than you write, and more of it now comes from AI. Read it first; the three questions open after.",
            "Ek college library ke fine ke niyam, Python me. Job me likhne se zyada padhna hota hai, aur ab bahut sa code AI se aata hai. Pehle padho; teen sawaal uske baad khulenge.",
            "कॉलेज लाइब्रेरी के जुर्माने के नियम। पहले पढ़ो, फिर तीन सवाल।",
          )}
        </p>
      </div>
      <dl className="cr-facts">
        <dt>{t("File", "File", "फ़ाइल")}</dt>
        <dd className="mono">library/fines.py</dd>
        <dt>{t("Length", "Lambai", "लंबाई")}</dt>
        <dd>{t(`${LINES.length} lines`, `${LINES.length} line`, `${LINES.length} लाइन`)}</dd>
        <dt>{t("Time", "Samay", "समय")}</dt>
        <dd>{t("12 min, the clock is only a guide", "12 min, ghadi sirf andaaze ke liye", "12 मिनट")}</dd>
        <dt>Sahayak</dt>
        <dd>{t("Off until you answer", "Jawab tak band", "जवाब तक बंद")}</dd>
      </dl>
      <section className="col g8" aria-labelledby="cr-how-h">
        <h2 className="h3" id="cr-how-h">
          {t("How to read it", "Kaise padhein", "कैसे पढ़ें")}
        </h2>
        <ol className="cr-how small">
          <li>{t("The note at the top and the constants: what are the rules?", "Upar ka note aur constants: niyam kya hain?", "ऊपर का नोट और नियम।")}</li>
          <li>{t("The map below: which function calls which.", "Neeche ka naksha: kaunsa function kisko bulata hai.", "नीचे का नक्शा।")}</li>
          <li>{t("Run one example by hand: a book due on Monday, back on Wednesday.", "Ek example haath se chalao: kitab Monday ko due, Wednesday ko wapas.", "एक उदाहरण हाथ से चलाओ।")}</li>
        </ol>
      </section>
      <section className="col g8" aria-labelledby="cr-map-h">
        <h2 className="h3 row g6" id="cr-map-h">
          <ListTree className="ic" /> {t("In this file", "Is file me", "इस फ़ाइल में")}
        </h2>
        <ul className="cr-outline">
          {OUTLINE.map((o) => (
            <li key={o.line}>
              <button className={`cr-fn ${o.inner ? "inner" : ""}`} onClick={() => jump(o.line)} aria-label={`${o.name}, ${t("line", "line", "लाइन")} ${o.line}`}>
                <code>
                  {o.kind === "class" ? "class " : ""}
                  {o.name}
                  {o.kind === "def" ? "()" : ""}
                </code>
                <span className="tiny faint num">L{o.line}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <div className="banner">
        <Lock />
        <span className="small">{t("Sahayak is off in this drill: it is practice at reading. After you answer, it explains anything you ask.", "Is drill me Sahayak band hai: ye padhne ka abhyas hai. Jawab ke baad wo jo poochho samjhayega.", "इस ड्रिल में सहायक बंद है।")}</span>
      </div>
      <button className="btn pri lg" onClick={() => setRaw("answer")}>
        {t("Open the questions", "Sawaal kholo", "सवाल खोलो")} <ArrowRight />
      </button>
    </div>
  );

  const answerStep = (
    <div className="cr-body">
      <section className="cr-qa" aria-labelledby="cr-q1">
        <h2 className="h3" id="cr-q1">
          1. {t("What does this file do?", "Ye file kya karti hai?", "यह फ़ाइल क्या करती है?")}
        </h2>
        <div className="col g6" role="group" aria-labelledby="cr-q1">
          {WHAT.map((o, i) => (
            <button
              key={i}
              className="option"
              aria-pressed={what === i}
              onClick={() => {
                setWhat(i);
                setMissing(false);
              }}
            >
              <span className="radio" aria-hidden="true" data-on={what === i} />
              <span className="grow small">{t(...o)}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="cr-qa" aria-labelledby="cr-q2">
        <h2 className="h3" id="cr-q2">
          2. {t("Which line has the bug?", "Galti kis line me hai?", "गलती किस लाइन में है?")}
        </h2>
        <p className="tiny faint">{t("Click the line in the code, or type its number.", "Code me us line par click karo, ya uska number likho.", "कोड में लाइन पर क्लिक करो या नंबर लिखो।")}</p>
        <div className="row g8 cr-lnrow">
          <label className="field cr-lnf">
            <span className="tiny faint">{t("Line", "Line", "लाइन")}</span>
            <input
              className="input mono"
              inputMode="numeric"
              value={line ?? ""}
              placeholder="—"
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setLine(n >= 1 && n <= LINES.length ? n : null);
                setMissing(false);
              }}
            />
          </label>
          {line !== null && (
            <button className="btn sm ghost" onClick={() => jump(line)}>
              <FileSearch /> {t("Show in code", "Code me dikhao", "कोड में दिखाओ")}
            </button>
          )}
        </div>
        {line !== null && <code className="cr-pick">{LINES[line - 1].trim() || t("(empty line)", "(khaali line)", "(खाली लाइन)")}</code>}
      </section>
      <section className="cr-qa">
        <label className="h3" htmlFor="cr-why">
          3. {t("What would you change, and how would you prove it is fixed?", "Kya badloge, aur kaise saabit karoge ki theek hua?", "क्या बदलोगे, और कैसे साबित करोगे?")}
        </label>
        <textarea
          id="cr-why"
          className="textarea"
          rows={4}
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          placeholder={t("Why it is wrong, the change, and one test that fails today…", "Galat kyun hai, kya badlav, aur ek test jo aaj fail hota…", "क्यों गलत, क्या बदलाव, एक टेस्ट…")}
        />
        <p className="tiny faint">{t("Checked on three things: the reason, the change, the proof. An AI applies the rubric; a person checks a sample every week.", "Teen baaton par jaancha jaata: wajah, badlav, saboot. Rubric AI lagata; har hafte insaan kuch jawab khud dekhta.", "तीन बातें: वजह, बदलाव, सबूत।")}</p>
      </section>
      {missing && (
        <p className="small cr-miss" role="alert">
          {t("Answer questions 1 and 2 first. Question 3 can be short.", "Pehle sawaal 1 aur 2 ka jawab do. Sawaal 3 chhota bhi chalega.", "पहले सवाल 1 और 2 का जवाब दो।")}
        </p>
      )}
      <button className="btn pri lg" onClick={send}>
        {t("Send answers", "Jawab bhejo", "जवाब भेजो")} <ArrowRight />
      </button>
    </div>
  );

  const resultStep = (
    <div className="cr-body">
      <div className="cr-score">
        <span className="eyebrow">{t("Result", "Nateeja", "नतीजा")}</span>
        <b className="cr-big num">
          {scoreText} <span className="faint">/ 3</span>
        </b>
        <span className="small muted">{score === 2.5 ? t("Read well. The proof was missing.", "Achha padha. Saboot chhoot gaya.", "अच्छा पढ़ा। सबूत छूट गया।") : t("Look at the red line in the code, then read the reason below.", "Code me laal line dekho, phir neeche wajah padho.", "लाल लाइन देखो, फिर वजह पढ़ो।")}</span>
      </div>
      <ol className="cr-res">
        <li className={a1 === RIGHT ? "ok" : "bad"}>
          {a1 === RIGHT ? <CircleCheck /> : <CircleX />}
          <div className="col g4">
            <b className="small">1. {t("What it does", "Kya karti hai", "क्या करती है")}</b>
            <span className="small muted">{a1 === RIGHT ? t("Right.", "Sahi.", "सही।") : `${t("You picked", "Aapne chuna", "आपने चुना")}: “${t(...WHAT[a1])}”`} {t(...WHAT[RIGHT])}</span>
          </div>
        </li>
        <li className={a2 === BAD ? "ok" : "bad"}>
          {a2 === BAD ? <CircleCheck /> : <CircleX />}
          <div className="col g4">
            <b className="small">2. {t("Where the bug is", "Galti kahan", "गलती कहाँ")}</b>
            <span className="small muted">
              {a2 === BAD ? t("Right: ", "Sahi: ", "सही: ") : `${t("You picked line", "Aapne line chuni", "आपने लाइन चुनी")} ${a2}. ${t("It is ", "Sahi ", "सही ")}`}
              {t("line", "line", "लाइन")} {BAD}, <code>{LINES[BAD - 1].trim()}</code>
            </span>
          </div>
        </li>
        <li className="part">
          <CircleDashed />
          <div className="col g6">
            <b className="small">3. {t("What to change · half", "Kya badloge · aadha", "क्या बदलोगे · आधा")}</b>
            {why.trim() && <q className="small cr-quote">{why.trim()}</q>}
            <ul className="cr-rub small">
              <li className="ok">
                <CheckIcon /> {t("Reason: d is a datetime but HOLIDAYS holds dates, so d in HOLIDAYS is never true and holidays are charged.", "Wajah: d ek datetime hai par HOLIDAYS me date hain, isliye d in HOLIDAYS kabhi sach nahi hota aur chhutti ka din bhi gina jaata.", "वजह: datetime और date बराबर नहीं।")}
              </li>
              <li className="ok">
                <CheckIcon /> {t("Change: compare d.date() instead.", "Badlav: d.date() se jaancho.", "बदलाव: d.date() से जाँचो।")}
              </li>
              <li className="miss">
                <CircleDashed /> {t("Proof: no test. One holiday case fails today and passes after the change.", "Saboot: test nahi diya. Chhutti wala ek case aaj fail hota, badlav ke baad pass.", "सबूत: टेस्ट नहीं दिया।")}
              </li>
            </ul>
          </div>
        </li>
      </ol>
      <div className="col g6">
        <span className="tiny faint">{t("The change", "Badlav", "बदलाव")}</span>
        <Code code={FIX} bad={[1]} good={[2, 3]} nonum />
      </div>
      <div className="col g6">
        <span className="tiny faint">{t("A test that proves it", "Ye test saabit karta", "यह टेस्ट साबित करता है")}</span>
        <Code code={TEST} nonum />
      </div>
      <label className="field">
        <span className="tiny faint">{t("One line to remember", "Ek line yaad rakhne ko", "याद रखने की एक लाइन")}</span>
        <input className="input" defaultValue={t("A datetime never equals a date: take .date() before looking in a set of dates.", "datetime kabhi date ke barabar nahi hota: date ke set me dhoondhne se pehle .date() lo.", "datetime कभी date के बराबर नहीं।")} />
      </label>
      <div className="row wrap g8">
        <button className="btn pri" onClick={() => toast(t("Saved to your mistake notebook", "Galtiyon ki copy me save", "सहेजा"))}>
          <Save /> {t("Save to my notebook", "Copy me save karo", "कॉपी में सहेजो")}
        </button>
        <button className="btn ai" onClick={() => toast(t("Sahayak is on again for this file", "Is file par Sahayak ab chalu", "सहायक अब चालू"))}>
          <Sparkles /> {t("Ask Sahayak why", "Sahayak se kyun poochho", "सहायक से पूछो")}
        </button>
      </div>
      <div className="cr-week">
        <div className="row between small">
          <span>{t("Files read right this week", "Is hafte sahi samjhi files", "इस सप्ताह सही समझी फ़ाइलें")}</span>
          <span className="num faint">6 / 8</span>
        </div>
        <Meter v={75} tone="tick" size="thin" label={t("6 of 8 files read right this week", "Is hafte 8 me se 6 files sahi", "8 में से 6")} />
        <span className="tiny faint">{t("Tomorrow: Go · 240 lines · a cache that serves old prices.", "Kal: Go · 240 line · ek cache jo purane daam deta.", "कल: Go · 240 लाइन।")}</span>
      </div>
      <div className="banner pen">
        <Lightbulb />
        <span className="small">{t("Every file is picked by a person; the bug is proven by our judge: a test fails before the change and passes after it.", "Har file insaan chunta; galti hamara judge saabit karta: badlav se pehle test fail, baad me pass.", "हर गलती जज से साबित।")}</span>
      </div>
    </div>
  );

  const qPane = (
    <div className="cr-q">
      <PaneHead onClose={() => toggle("q")} closeLabel={t("Hide questions", "Sawaal chhupao", "सवाल छिपाएँ")}>
        <span className="pane-title row g6">
          <MessagesSquare /> {step === "read" ? t("Before the questions", "Sawaal se pehle", "सवाल से पहले") : step === "answer" ? t("Three questions", "Teen sawaal", "तीन सवाल") : t("Result", "Nateeja", "नतीजा")}
        </span>
      </PaneHead>
      <div className="cr-scroll">{step === "read" ? readStep : step === "answer" ? answerStep : resultStep}</div>
    </div>
  );

  return (
    <>
      <FocusBar
        back="practice"
        title={t("Read the code · library/fines.py", "Code padhna · library/fines.py", "कोड पढ़ना · library/fines.py")}
        sub={t("Practice · Python · sample", "Abhyas · Python · sample", "अभ्यास · नमूना")}
        center={<StepPills steps={RSTEPS} names={names} step={step} setStep={(s) => setRaw(s)} label={stepLabel} />}
        right={
          <>
            <span className="hide-phone">
              <Badge icon={<Lock />}>{t("Sahayak off", "Sahayak band", "सहायक बंद")}</Badge>
            </span>
            {step !== "result" && (
              <span className="tl-timer mono" aria-label={t("Time guide", "Samay ka andaaza", "समय")}>
                <Clock /> {hms(left, false)}
              </span>
            )}
          </>
        }
      />
      <div className="tl-wrap is-build cr">
        <div className="tl-phone-steps">
          <StepPills steps={RSTEPS} names={names} step={step} setStep={(s) => setRaw(s)} phone label={stepLabel} />
        </div>
        <Panes
          open={open}
          toggle={toggle}
          phoneTab={phoneTab}
          setPhoneTab={setPhoneTab}
          panes={[
            { id: "code", label: t("Code", "Code", "कोड"), icon: <CodeXml />, weight: 0.58, min: 380, content: codePane },
            { id: "q", label: t("Questions", "Sawaal", "सवाल"), icon: <MessagesSquare />, weight: 0.42, min: 340, content: qPane },
          ]}
        />
      </div>
    </>
  );
}
