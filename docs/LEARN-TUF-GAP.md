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

## 3. TUF se behtar kya kar sakte hain (research, 18 Oct 2026)

**Research ki seema:** takeuforward.org is sandbox se khulta nahi (DNS par ruka), aur TUF+ ke reviews search me nahi
mile. Neeche ke saboot zyaadatar dusre platforms ke blogs aur vendor pages se hain, jinka apna faayda hai. Inhe ishaare
samjho, pakke aankde nahi. Har idea ke saath likha hai ki hamare code me uski neev pehle se kahan hai.

### 3a. Students kyun chhod dete hain (aur hum kya karein)

| Dard (saboot) | TUF me | Hum behtar kaise |
|---|---|---|
| **Consistency toot-ti hai, mushkil nahi**: shuru me josh, phir "aage kya karun" pata nahi, phir chhod dena ([namastedev FAQ](https://namastedev.com/pages/faq/why-do-many-students-struggle-despite-watching-free-dsa-courses), [FinishDSA](https://www.producthunt.com/products/finishdsa)) | Sheet aur Planly | Planner ✅ hai. Jodo: **"Wapsi" mode**: 3+ din chhoote to bina sharm ke chhota naya plan, pehle din sirf 1 aasaan problem. **Study circle**: 3–5 dost, hafte ka saajha lakshya, WhatsApp par (channel pehle se, W1). Streak freeze ✅ |
| **Solution yaad karte hain, samajhte nahi** ("Blind 75 kiya phir bhi atakta hoon": [Blind post](https://www.teamblind.com/post/what-i-discovered-after-teaching-dsa-for-10-years-rbx2kyxw)) | Video + article | **Micro-viva har solve ke baad**: Sahayak 2 chhote sawaal poochhe ("ye loop kab rukta hai?", "n = 0 par kya?"). Sahi jawab = **Pramaan** (verified solve). Follow-up sawaal ✅ aur viva engine (exam) pehle se. Ye TUF ke paas nahi |
| **Resource badalte rehte hain** (namastedev) | Ek sheet | Ek hi path, deadline ke hisaab se (planner ✅). Dashboard ka "aage kya" ✅. Jodo: path ke beech "tum yahan ho, 38% done, 9 din aage" |
| **Bhool jaate hain** (spaced repetition: [namastedev](https://namastedev.com/pages/faq/why-do-i-keep-forgetting-dsa-concepts)) | Revision star | SM-2 revision ✅. Behtar: card par flashcard nahi, **blank editor me dobara solve** (purana code chhupa); fail hua to gap chhota |

### 3b. Bade daav (TUF ke paas nahi, hamari neev pehle se)

1. **Mass recruiters ke mock tests (TCS NQT, Infosys, Wipro, Accenture)**: tier-2/3 college ke zyaadatar students inhi
   ke liye taiyaari karte hain. TUF product companies par hai. In tests ka format har saal milta-julta rehta hai: timed
   sections (quant, reasoning, verbal + 1–2 coding) ([FACE Prep](https://faceprep.in/article/company-corner-new/),
   [jobrise](https://jobrise.io/en/blog/aptitude-test-preparation-guide-2026/)). Hamara **exam engine** (CBT,
   sections, timer, proctoring, percentile, scorecard) pehle se bana hai. Apne sawaalon se "NQT jaisa" full mock,
   sahi timing ke saath, aur har section ka analysis. Company ka naam unke logo ya sawaalon ke bina, sirf "format ke
   jaisa". **Sabse bada daav**: aptitude (L5) isi me kaam aata hai.
2. **Dry-run player (video ki jagah)**: TUF ki taakat Striver ke videos hain; hum jaldi barabar nahi kar sakte. Har
   editorial ke reference program ko runner par chalakar **step-by-step dry run**: kaunsi line, variables ki values,
   array par pointer. Code playback (G4a-2) aur runner pehle se. Har problem par apne aap, bina recording ke, Hindi
   labels ke saath. Video (L7) baad me bhi rahe.
3. **Learn → Pramaan → Hire**: verified solves aur mock scores (student ki marzi se) companies ko Hire me dikhen. TUF
   ka student ka kaam wahin ruk jaata hai; hamara company tak pahunchta hai (LAUNCH-PLAN "hamari jeet").
4. **Hindi/Hinglish poora**: research batata hai ki local bhasha me padhe students ko English me programming sikhana
   mushkil padta hai ([IEEE study](https://ieeexplore.ieee.org/document/6305939)), aur Hinglish DSA ki supply zyaadatar
   videos tak hai ([CodeChef](https://blog.codechef.com/?p=9587)). Hamare paas Sahayak Hindi/Hinglish ✅ aur 11 bhashaon
   ka UI ✅. Jodo: **editorial/hint ka Hinglish toggle** (AI anuvaad + insaan ki jaanch, L2 pipeline me), code ke
   comments bhi.
5. **AI mock interview, sasta**: bazaar me AI voice mock ₹99–149 ke pass par bik rahe hain, kuch Hindi + English
   ([Greenroom](https://usegreenroom.app/blog/best-mock-interview-websites-india), [CloudVyn](https://www.cloudvyn.com/blog/free-ai-mock-interview-platforms-india-freshers-2026)).
   Hamara AI interviewer (Hire) pehle se: Learn me practice mode (L8), pehle text + code, phir awaaz. Plus me ya chhote
   pass me.

### 3c. Chhote par kaam ke

| Idea | Kyun | Neev |
|---|---|---|
| **Pattern pehchaan drill**: statement padho, pattern chuno (MCQ), 30 second | Asli interview me sabse mushkil yahi hai; content sasta (sirf statements) ([pattern guide](https://www.scribd.com/document/910285199/DSA-Pattern-Learning-Mastery)) | Problems ke patterns tagged ✅, quiz engine ✅ |
| **Pattern templates + "kaunsa pattern" flowchart** | AlgoMonster isi par bikta hai ([review](https://www.lodely.com/blog/algomonster-review)) | Lessons ✅; apne likhe templates (Python/Java/C++) |
| **Galti ki diary**: har galat submit ki wajah (off-by-one, TLE, edge case, galat pattern) apne aap, phir unhi par revision | Ek hi galti baar-baar; AI tools isi ko bechte hain ([LeetCopilot](https://alternativeto.net/software/leetcopilot/about)) | Submissions history ✅, verdicts ✅, Sahayak review ✅ |
| **Debug karo**: galat code do, bug dhoondo | AI ke daur me code padhna/sudhaarna zaroori; interviews me badh raha hai | Runner + tests ✅ |
| **Hint ladder** (nudge → pattern → lagbhag hal) | Sab AI tools yahi dete hain | ✅ pehle se (Sahayak), bas UI me saaf dikhao |
| **Sasta aur saaf daam**: core free, Plus mahine ka chhota daam, "placement week" pass | NeetCode Pro $119, LeetCode Premium ~$159/saal ([lodely](https://www.lodely.com/blog/algoexpert-pricing)); Bharat me kam | Plus + Razorpay ✅ |
| **College ke saath**: TPO readiness dekhe, class Learn par practice kare | TUF akela student hai | Campus/Classes ✅, readiness heatmap ✅ |

**Kya nahi karenge:** company ke "asli sawaal" ka daava bina saboot ke (banaya hua data students ko gumraah karta hai,
tracker ka purana faisla); TUF/LeetCode ke statements, videos ya kram ki copy.

## 4. Plan (slices; build Hire ke baad, ya owner jab kahe)

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
| L9 Mass-recruiter mocks (3b-1) | Apne sawaalon se NQT/Infosys/Wipro/Accenture **format** ke full mock (sections, timer, percentile), exam engine par | 4 formats, har ek ke 3 mock, section analysis |
| L10 Dry-run player (3b-2) | Reference program ka step-by-step dry run (lines, variables, array pointer), Hindi labels | DSA ke pehle 40 problems par |
| L11 Micro-viva + Pramaan (3a) | Solve ke baad 2 sawaal; sahi = verified solve; profile par; student ki marzi se Hire me | Har solve par chale, profile par dikhe |
| L12 Wapsi + study circle (3a) | Chhoote dino ke baad chhota plan; 3–5 dost ka circle, WhatsApp reminder | Wapsi plan test; circle ka hafta |
| L13 Pattern drill + templates + galti ki diary (3c) | 30-second pattern MCQ; apne templates; galat submits ki wajah aur unpar revision | 100 drill sawaal; diary har submit par |
| L14 Hinglish toggle (3b-4) | Editorial/hint ka Hinglish, L2 pipeline me AI anuvaad + insaan ki jaanch | DSA 40 ka Hinglish |

**Sujhaya kram (asar ÷ mehnat):** L9 aur L5 (aptitude) pehle (sabse bada bazaar, engine taiyaar), phir L11 (hamari
alag pehchaan), L1–L3 (content, lamba kaam, saath-saath), L10, L13, L12, L14, L8, L4, L6, L7.

## 5. Owner se kya chahiye

1. **Content kaun banayega:** AI draft + insaan review (L2) ki haan, aur review kaun karega (content team ya owner).
2. **Video:** kaun banayega, kis bhasha me, host kahan (tracker "Ruka hua kaam" me pehle se).
3. **Kram:** upar ka sujhaya kram (L9 + aptitude pehle) theek hai, ya L1 (DSA content) pehle.
4. **Mass-recruiter mocks:** company ka naam ("TCS NQT jaisa") likhna theek hai ya sirf "IT services format"; ye legal/brand ka faisla hai.
