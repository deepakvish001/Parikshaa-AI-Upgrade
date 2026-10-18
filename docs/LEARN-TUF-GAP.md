# Learn vs takeUforward: kya hai, kya kam hai, kya banega (18 Oct 2026)

**Owner ne kya maanga (18 Oct 2026):** Learn section ko takeUforward (TUF) jaisa banana. Abhi sirf plan; build baad me
(owner ka faisla: Hire v2 pehle chalta rahe, H2d se aage). Ye file wo plan hai. Tracker me plan row 121.

## 0. Niyam: "TUF jaisa" ka matlab

- **Features TUF ke barabar ya usse behtar, code aur content hamara apna.** TUF ki website ka code reverse engineer
  nahi karenge, aur unke articles, editorials, videos, A2Z sheet ka kram aur unke chune hue problems copy nahi karenge.
  Ye unka copyright hai; REA jaisa tool bhi apne disclaimer me ye mana karta hai.
- TUF ke baare me sirf **public jaankari** (unke features kya hain) se tulna; unke pages scrape nahi karenge.
- LeetCode ya kisi aur site ke problem statements bhi nahi. Problem, test, editorial, hint: sab apne likhe (jaise
  `content/dsa-starter.ts` me abhi hai), CI me asli runner par jaanche hue.

## 1. TUF ke paas kya hai (public jaankari, Oct 2026)

- **A2Z DSA sheet**: free, step-wise roadmap, ~474 problems (152 easy, 186 medium, 136 hard), har problem par article,
  video, difficulty, progress tick ([macmyths overview](https://macmyths.com/strivers-a2z-dsa-course-overview/)).
- **Chhoti sheets**: SDE sheet, last-moment revision list jaisi (interview se pehle ke liye).
- **TUF+ paid passes**: DSA, DBMS + SQL, OS, CN, Aptitude, OOPs, LLD, Company questions, Planly (planner); AI assistant
  TUFY; AI pass 2027 ([LAUNCH-PLAN.md](LAUNCH-PLAN.md) §2).
- Har problem par online judge, notes, revision ke liye star.

## 2. Feature ke hisaab se tulna

| TUF ka feature | Parikshaa me | Kahan | Kami |
|---|---|---|---|
| Structured DSA path (steps → topics → problems) | ✅ engine | tracks/modules/lessons, console → Practice → Tracks | **Content**: 40 DSA problems (9 pattern modules); ~450 chahiye |
| Har problem par article: brute / better / optimal | ✅ engine, 🟡 content | `web/src/practice/editorial.ts`, `content/dsa-starter.ts` | 40 editorials (17 me "Better"); baaki naye problems ke saath |
| Har problem par video | ⬜ | lesson me sirf bahar ka link | Video host ka faisla (Ruka hua kaam), 0/60 videos |
| Online judge, Run/Submit | ✅ | practice workspace, runner, Judge0 (G3) | — |
| Progress tick, revision star | ✅ behtar | done marks, spaced revision SM-2 (`RevisePage`) | — |
| Notes har problem/lesson par | ✅ behtar | `NoteEditor`, notes ka AI draft, PDF export | — |
| Planner (Planly) | ✅ | `api/src/prep-plan.ts`, sprints, freeze, late mail | — |
| AI assistant (TUFY) | ✅ behtar | Sahayak: hint ladder, code review, Hindi/Hinglish, jawab nahi deta | Paid eval run baaki (Ruka hua kaam) |
| SQL practice | ✅ | runner `sql`, `content/sql-starter.ts` | 8 problems; ~50 chahiye |
| DBMS, OS, CN, OOPs | 🟡 | `content/cs-fundamentals.ts`: 80 MCQ, 6 subjects | Lessons (padhne wala content) nahi; har subject ka track chahiye |
| Aptitude | ⬜ | — | Quant, reasoning, verbal ka track + quiz (MCQ/numeric engine pehle se) |
| LLD / system design | ⬜ | — | Text + diagram lessons ka track; design sawaal |
| Company questions | ⬜ | company pages aur readiness ka engine ✅ | **Asli** reports chahiye (Ruka hua kaam); banaya hua data nahi |
| Chhoti sheets (SDE sheet jaisi) | ⬜ | track engine se ban jaayegi | Apne problems se "Placement 150", "Aakhri 30 din" |
| Contests, rating | ✅ behtar | weekly contests, Elo, ICPC scoreboard | Judge autoscale 🟡 |
| Mock interview | 🟡 | Sahayak follow-up sawaal ✅; AI interviewer (Hire) | Learn me AI mock interview ka darwaza |
| Community, interview experiences | ✅ | `ExperiencesPage`, discuss | — |
| Paid tier | ✅ | Plus (Razorpay, refunds) | — |
| Profile, certificate | 🟡 | public profile, achievement cards | Pramaan (viva se pakka solve) plan me |

**Seedhi baat:** engine me hum TUF ke barabar ya aage hain. Kami **content** ki hai: problems, editorials, CS subject
lessons, aptitude, LLD aur videos.

## 3. Plan (slices; build Hire ke baad, ya owner jab kahe)

| Slice | Kya | Done kab |
|---|---|---|
| L1 Apna DSA path | Topics → steps → ~450 items ka **apna** kram (TUF ka kram nahi); har item: title, pattern, difficulty, prerequisite. Owner/content team review kare | Path ki list repo me, owner ki haan |
| L2 Content pipeline | Problem banane ki line: AI draft (statement, tests, reference program, brute/better/optimal, hint) → CI me asli runner par jaanch (`editorial-check`, `content-dsa.test.ts` jaisa) → insaan manzoor kare. G2 Library aur H6 ke draft-review ka dobara use. 50 ke batch | Har batch: tests hare, review ho gaya |
| L3 Batches | L1 ka path L2 se bharna: 40 → 150 → 300 → 450 | Har milestone par track live |
| L4 Chhoti sheets | Apne problems se "Placement 150" aur "Aakhri 30 din" tracks | Tracks live, progress chale |
| L5 CS subjects + SQL + aptitude | DBMS, OS, CN, OOPs ke lesson tracks (quiz pehle se); SQL 50; aptitude track (quant, reasoning, verbal) | Har subject: lessons + quiz + revision cards |
| L6 LLD | Text + diagram lessons, design sawaal, Sahayak se review | Pehle 20 lessons |
| L7 Video | Host chunna (Ruka hua kaam), player progress, signed URL | Pehle 20 videos |
| L8 Mock interview | Hire ke AI interviewer ka Learn wala darwaza (practice mode, koi company nahi) | Ek poora mock, feedback ke saath |

## 4. Owner se kya chahiye

1. **Content kaun banayega:** AI draft + insaan review (L2) ki haan, aur review kaun karega (content team ya owner).
2. **Video:** kaun banayega, kis bhasha me, host kahan (tracker "Ruka hua kaam" me pehle se).
3. **Kram:** Hire launch ke baad L1 se shuru, ya pehle.
