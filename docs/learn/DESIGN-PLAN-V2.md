# Design plan v2: TUF ke 3 clips se poora flow, har component, aur Parikshaa ka behtar version (20 Oct 2026)

Owner ne TUF ke platform-features page ki 3 recordings bheji aur kaha: "pura flow aur design samjho, har choti badi
cheez dekho, sare features working in detail, aur pura better plan banao". Ye doc wahi hai. Pehle ka saar:
[DESIGN-STUDY.md](DESIGN-STUDY.md) (kyun mock v1 kamzor tha). Purana mock: [mock/README.md](mock/README.md).

**Kaise dekha:** teeno clip (lagbhag 3 + 3 + 1.7 min, 1728×1080) se har 2 second par ek frame (231 frames), 60 frames
ko zoom karke ek-ek padha, aur 40 jagah se pixel ke rang naape. Har feature ke liye: TUF me kya dikha → kaam ka logic
→ components aur unki haalatein → **hamara version, aur kahan hum aage nikalte hain**.

**Niyam (pehle jaisa):** pattern seekhna theek. TUF ka logo, mascot, naam (Planly, TUFY, Striver's, A2Z), copy,
company ginti, testimonials, ya hubahu layout **nahi**. Hamare naam, hamara mascot, hamara data
([../LEARN-LAUNCH-PLAN.md](../LEARN-LAUNCH-PLAN.md) §11).

---

## 0. Ek line me unka product

**Plan → aaj ka kaam → workspace (timer ke saath) → progress → din chhoota to plan badlo.** Baaki sab (curriculum,
editorial, practice, company prep, aptitude, AI) is plan me "kaam" ban kar aata hai. Isliye product ek lagta hai: har
page ka kaam aakhir me plan ki ek line tick karta hai. **Hamara bhi yahi dhaancha hoga** (hamare paas `prep_plans` ✅,
streak/freeze ✅, POTD ✅, SM-2 revision ✅ pehle se hain), bas behtar.

---

## 1. Marketing page ka dhaancha (landing)

| Hissa | Kya dikha | Chhoti baatein |
|---|---|---|
| **Top bar** | Logo baayein; beech me Dashboard, Explore ▾, Pricing; daayein neela "Get Started ›" | Patli (≈56 px), page ke saath scroll par chipki; nav links ke saath chhote icons |
| **Hero** | Upar chhoti pill "N+ learners"; 3 line ka bada heading, ek shabd ke neeche **haath se kheenchi neeli lakeer**; 2 line subtext; do button: ghost "Start Learning for free" + solid neela "Explore plus →" | Heading ≈56 px, geometric sans; subtext grey; buttons 44 px |
| **Hero ka card (daayein)** | Ek bada gol-kinare wala dark card jisme **har 2–3 s badalta demo**: DSA sheet (accordion, Basic/Core tag), aaj ke task (3/10, kiye hue kate hue, har ek ke aage minute), progress (Topics 12/24, Time spent, Last active, Progress bar 31%), AI helper (editor + mascot), company problems (code G-01…, tag), subjects (icon + ginti) | Har demo ke upar ek title + ek line; card ke andar halki parchhai; badalne par fade |
| **Social proof** | YouTube/LinkedIn ki ginti ka card, bada number "Engineers learning", "Join our community" | — |
| **Platform features** | Heading "One platform. Every placement advantage." + 9 pill tabs (planner, curriculum, resources, AI, company prep, aptitude, practice, workspace, profile) | **Har tab:** baayein chipka sub-menu (5–7 items), daayein "stage": upar ek line ka italic heading jisme **ek shabd neela**, neeche chalta hua demo. Sub-menu item par click ya scroll se demo badalta |
| **Testimonials** | Baayein chipka heading + "Hall of Fame ↗"; daayein 2 column masonry quote card: bada quote chinh, 5–7 line, "Read more", neeche photo, naam, role, company logo, LinkedIn icon | Card bina border, halka surface, 24 px radius |
| **FAQ** | Accordion, har sawaal ek patti, daayein ⌄ | — |
| **Footer** | 4 column (Learn, Practice, Features, Company & Support) + "Explore Plus" / "Start for free" + social icons + legal links + **neeche bahut bada fika wordmark** | Copyright ek line |

**Seekh:** marketing page par motion aur glow; app ke andar nahi. Har feature **chalta demo** dikhata hai,
screenshot nahi.

**Hamara landing:** wahi kram (hero → 30 s ka "ek din" demo → stambh tabs → asli nateeje → FAQ → footer), par:
hero me **Hinglish/हिंदी toggle** dikhe; demo me hamare 3 khaas cheezein (sabse chhota galat test, dry-run slider,
Sahayak ke do mode); social proof **sirf asli number** (launch par na ho to dikhaana hi nahi); testimonials sirf
likhit anumati ke saath ([../LEARN-LAUNCH-PLAN.md](../LEARN-LAUNCH-PLAN.md) §11).

---

## 2. Feature-wise: flow, logic, components, hamara version

### 2.1 Planner (unka "Planly") — sabse zaroori

| Kadam | TUF me kya dikha | Logic |
|---|---|---|
| **a. About you** | Heading "About you", 4 numbered sawaal, har ek ke chips (ek hi chuno): role (SDE Intern / Software Engineer), experience (0–2 / 2–5 / 5+ saal), company kism (Startups / FAANG / All product based / Open to all), region (India / US-Europe-Others). Chuna chip: neeli border + halka neela andar | 4 click, typing nahi. Ek line: "Tell it who you are, it builds the plan around you" |
| **b. Bridge** | Khaali screen par ek line "Your answers become a clear direction" | Kadmon ke beech saans; agle screen ki ummeed |
| **c. Ban raha hai** | "Creating your *personalized* roadmap" (ek shabd italic neela), "Getting ready…", mascot laptop par magnifier ke saath, 5 kadam ki list: goals samjhe ✓ → taiyaari ka samay ✓ → topics kram ✓ → sprints ✓ → "Crafting your plan" (ghoomta icon, row highlighted) | Har kadam ≈1 s me tick. Asal kaam shayad turant hai; list **bharosa** banati hai ki soch kar bana |
| **d. Taiyaar** | Mascot jashn (confetti), "Your personalised roadmap is ready", subtext; card: target icon + plan ka naam + "Let's get to work!"; 4 khaane (Start date, End date, Total sprints, Duration) calendar icon ke saath; neela "Go to Dashboard ›" | Ek nazar me poora plan: kab se kab tak, kitne sprint |
| **e. Sprints** | "Big goals feel lighter, one sprint at a time". List: gol radio, outline pill "Sprint 1", "· Arrays, Strings & Hashing", status chip (Completed / In progress / Upcoming, sab neele tint me dot ke saath), "Est. 12h", ⌄ | Hafta = sprint = 1–2 topic. Status se pata kahan ho |
| **f. Din aur kaam** | Sprint khula: Day 1…7 ek **khadi line (tree connector)** se jude; Day row: ⌄, "Day 1", "Est. 2h 15m", "Today" chip (dashed neeli border), gol neela → button. Khula din: kaam ki rows (check-circle, naam, "30 min", ›). "Day off" wale din dot + "Day off". Neeche "Wrap up your sprint" card (flag icon, "Complete sprint" button) aur "Complete Day 7 to generate your personalised wrap-up" (sparkle) | Har kaam par samay; chhutti ke din plan me hi; hafte ke ant me AI saar |
| **g. Samay naapna** | Workspace ki upar patti: "Task 2/4 ▾" dropdown (aaj ke kaam: kiya hua hara ✓ aur kata hua "22m"; abhi wala "In progress" hara chip "18m"; baaki ›), "Day · 4h 20m", timer "18:05", ⏸, ☆ | Problem kholte hi timer; plan ka asli samay vs andaaza |
| **h. Progress** | "Every task becomes visible momentum". Card: plan naam, "Started on … · Currently on: Sprint 3", "View your plan" + ⋯. 4 tile: **Overall** (ring 46%, Sprints 2/6, Topics 68/148, Time 41h 35m / 90h), **Sprint progress** (7 gol: hue din neele ✓, aaj bold, baaki number; ‹ Sprint 3 ›), **Today's task** (0/4, list Est. min ke saath), **Today's progress** (Tasks, Time spent, Scheduled, Progress bar). Neeche "Est. completion on …" + neela "Continue where you left off ›" | Ek screen me: kitna hua, is hafte kahan, aaj kya, ek button aage |
| **i. Din chhoota** | Card par do button: "Adjust plan" aur "Take a break" (icon); neeche "Sprints completed 2 of 6", "Est. completion 30 Aug 2026" | Guilt nahi, do raaste. Naya end date turant |

**Hamara version ("Aaj ka plan", naam owner tay karein):**

1. **Sawaal India ke hisaab se** (USER-FLOWS F2 ke 6 sawaal): abhi kaun (1st–4th year / graduate / working), goal
   (product SDE / **service company jaise TCS NQT, Infosys** / data / frontend-backend / tay nahi), kab tak (taareekh ya
   3/6/12 mahine), roz kitna samay + kaun se din, bhasha (C++/Java/Python/JS), level (1–5 ya 10 min diagnostic). Chips
   wahi pattern, par **har sawaal Hinglish/हिंदी me** bhi.
2. **"Ban raha hai" sach bole:** kadam asli hon (diagnostic padha, college exam ke hafte halke kiye, topics kram me),
   nakli deri nahi. Kaam jaldi ho to list 1.5 s me poori.
3. **College calendar:** semester exam / placement season daalo → un hafton me plan apne aap halka. (TUF me nahi dikha.)
4. **"Din chhoota" me 3 raaste + pehle se dikhe asar:** "kal ka kaam aage khiskao" (end date +1 din), "is hafte me
   samet lo" (roz +25 min), "kam zaroori hata do" (kaun se hatenge, list). Har raaste par **naya end date chunne se
   pehle** dikhe. Break: streak freeze ✅ ke saath.
5. **Imaandaar timer:** tab chhupa ho ya 5 min koi input na ho to timer ruk jaata hai, wapas aane par "Jaari rakhein?".
   Samay ka naap learner ka, dikhawe ka nahi.
6. **Hafte ka wrap-up:** AI saar + **mistake notebook ki top 3 galtiyan** + agle sprint me unka drill. (Unke "wrap-up"
   se gehra: hamare paas har WA ka sabse chhota galat test hai.)
7. **Phone par:** aaj ke kaam ek list, row par swipe = "ho gaya / kal", upar sprint ke 7 gol.

### 2.2 Curriculum

| TUF me | Logic |
|---|---|
| Baayein: DSA, OOPs, LLD, DBMS, OS, CN, SQL. DSA par **accordion card list**: rangeen icon tile (DSA teal, System design narangi, Core subjects gulabi-baingani, Data engineering neela-baingani), naam, ek line, "7 Sheets", ⌄/›. Khulne par chhote CAPS label wale samooh: "Start coding – free certification tag" (C++, Java, Python), "Learn from zero" (poori sheet), "Interview prep – India", "Interview prep – US/Europe" | Learner ke goal se rasta (shuru se / India interview / bahar). Sirf yahi jagah kai rang: **category ki pehchaan** |
| Subject page (OOPs, SQL…): "Master **X** through structured modules, topic-wise lessons, and in-depth video learning" + ek card (naam, tagline, ✓ N problems │ ▶ N hours), halki neeli chamak | Do number: kitna kaam, kitna samay |

**Hamara:** samooh **goal se** (shuru se seekho · service company · product company · bahar) aur har subject card par
3 number: lessons, problems, ghante + "Pramaan milega" chip agar us course ka proctored test hai. Category ke rang:
hamare 7 stambh ke 7 rang ([ALL-IN-ONE.md](ALL-IN-ONE.md)), sirf icon tile me; baaki UI ek-rangi.

### 2.3 Resources (editorial)

| TUF me | Logic |
|---|---|
| Sub-menu: written editorial (approach-wise), video editorial, infographic sliders, multiple language, revision images | Ek problem ke 5 roop |
| Editorial page: upar **Brute / Better / Optimal** segmented tabs; video thumbnail (DSA chip, bada title, instructor, "12 MIN" chip); title; 2 paragraph (invariant ke saath); "Algorithm" bullets; "Dry Run" (8 kadam ki **sketch infographic**, safed kaagaz, haath ki lakeer, neeche caption patti); "Solution" code card: C++/Java/Python/JavaScript/C#/Go tabs, copy, fullscreen; "Complexity Analysis" (time ka hisaab N(N−1)/2 tak, space, stable/adaptive ki baat) | Har approach alag tab; padhne ka kram: samjho → kadam → dry run → code → complexity |

**Unki galti jo humne pakdi:** "Infographic sliders" me tasveer *Implement Queue using Stack* ki thi aur caption
"Selection Sort — illustrated algorithm walkthrough". Caption haath se likha gaya. **Hamara niyam:** caption, alt text
aur frame **ek hi spec se** bante hain ([VISUAL-STYLE.md](VISUAL-STYLE.md) §3), galat ho hi nahi sakta.

**Hamara (aage):** dry run **slider** hai, static grid nahi (ek-ek kadam, code ki line highlight, variables ki table;
phone par swipe); har approach ke saath "**kyun chalta hai**" aur "**aam galtiyan**" ([EDITORIAL-STYLE.md](EDITORIAL-STYLE.md));
English / Hinglish / हिंदी toggle; video optional (text pehle, kam data); code tab ke paas "Studio me chalao".

### 2.4 AI sahayak (unka "TUFY")

| Hissa | TUF me | Logic |
|---|---|---|
| Overview | Editor me code type hota, mascot kone se jhaankta; upar tirchhe chips "AI Assistant, Guide Me, Ask…, Explain Problem" | AI har jagah, ek naam |
| Doubt chat | Panel: "New chat +" tab, ✕; user ka message (neela tint, daayein) **context chips** ke saath (Problem); AI ka jawab card: ek line saar, "What you've done well –" ✓ (hara) list, "What's missing –" ✗ (laal) list; baayein chhota mascot avatar. Neeche composer: chips (✕ se hatao), "@" se context jodo, "⇧↵ line break", bhejo → | AI **tareef + kami** ke format me, seedha code nahi |
| Hints | WA card: laal icon "Wrong Answer" + "Some hidden test cases did not pass"; "Passed 2/3" + patli hari-adhuri bar; runtime, memory chhote; "Failing at: 3" (laal); card "Not quite there yet" + neela "+ Get hint" + **"Hold to reveal case 3"** (taala, dabaa kar rakho to gol progress bharta hai) | Galti par pehle hint, chhupa test dekhna **jaan-boojh kar mehnat wala** (hold) |
| Code review | Numbered accordion: 1 verdict + behtar approach, 2 time, 3 space, 4 readability, 5 edge cases (+ interview follow-up sawaal) | Interviewer jaisa review |
| Har jagah | Superhero mascot ke chaaron or 10 chips ka **orbit**: subject editorials, practice quiz, video editorial, video explainer, notes refine, notes generate, module lecture, problem practice, sprint notes, sprint quiz | "Jahan mushkil, wahan AI" |
| Aptitude me | Side panel: mascot, "Hey, I'm …", "step by step, poora jawab turant nahi", "Question" context chip | — |

**Hamara Sahayak (aage kahan):**

1. **Do mode** (Seekho: sawaal se samjhaye / Banao: seedha madad) upar toggle ✅ plan me.
2. **Sabse chhota galat test**, "hold to reveal" se behtar: hum chhupa test nahi kholte, **judge sabse chhota input
   dhoondhta hai jispar aapka code galat hai** (jaise n=2, [1e9 1e9]). Seedha seekh milti hai, test leak nahi.
   Hint ladder: 1 (disha) → 2 (pattern) → 3 (pseudo-code); har kadam par "kitne hint liye" imaandaari se dikhe.
3. **Review card** wahi pattern (✓ sahi / ✗ kami) + **pattern ka naam** + "interviewer ye poochhega" 2 sawaal.
4. Context chips: Problem, Mera code, Verdict, Lesson, Note. "@" se jodo.
5. **AI label** har jawab par; contest me AI band ✅ niyam; roz ki seema dikhe (fair use).
6. Hinglish me jawab default agar learner Hinglish me likhe.

### 2.5 Company aur interview prep

| Hissa | TUF me | Logic |
|---|---|---|
| Company grid | "Global / Indian" segmented; companies ke chips ka **badal (cloud)**, har chip par ginti, kinaare fade (mask) | Ek nazar me sab companies |
| Company page | Logo, naam, ek line; filter; problem table (hara dot = hal); daayein "Your progress 84%" card; **"Topics asked"** modal: bar chart (Frequency × Topics) + daayein topic list %; list par hover = bar neela + tooltip "Sliding Window 35%" | Kya padhna zaroori, data se |
| Problem par company tag | Chips "Core", "Hints", "Companies" → popover samooh **Last 30 / 60 / 90 days**, har company ke aage High/Medium/Low | Kab aur kitni baar poocha |
| Interview experiences | 2 column masonry card: title, avatar + naam + "4 days ago", 2 line, **sabse upvoted comment** ek box me ("Most Upvoted"), company chip, neeche likes/comments/views | Asli kahaniyan, community |
| Premium | Card "Curated interview sets — Problems worth going deeper on", "500+", table Problem │ Resources (sona icon), **sunehri chamak** | Plus ka rang = sona |

**Hamara (aage, aur imaandaar):**

1. **Sirf verified data** ✅ niyam: har company page par "**kahan se pata:** N verified experiences, aakhri taareekh,
   source link". Frequency High/Medium/Low ka tareeka ek "ⓘ" me likha. Data kam ho to "abhi kam data" saaf likha.
2. **Service companies ka pura pattern** (TCS NQT, Infosys, Wipro, Accenture, Capgemini, Cognizant): round, sections,
   samay, negative marking (sirf verified source se) → usi pattern ka mock (hamara exam engine ✅).
3. Experience likhne ka template: round-wise (OA → technical → HR), anonymous option, Hindi/Hinglish allowed, moderation
   ✅ (community queue).
4. Chart: bar par **label hamesha** (sirf hover par nahi), phone par list.

### 2.6 Aptitude

| Hissa | TUF me |
|---|---|
| Topics | "Learn major placement topics through N video explainers with AI assistance"; 3 badi patti: Quantitative, Logical, Verbal; har ek par 2 number (problems, mock quizzes) icon ke saath |
| Practice set | Upar video thumbnail ("7 MIN"); **Intuition** (2 line) → **Approach** (har line alag, math mono font me: `100 × 1.2 = 120`) → **Why this works** (general formula `(1 + x/100)(1 − x/100) = 1 − (x/100)²`); neeche "End Quiz" (ghost) + "Next ›" (neela). Daayein **Question palette** 5×6 (30) + legend: Correct hara, Incorrect laal, Current neeli ring, Unanswered grey; mascot palette ke kinare se jhaankta |
| Mock | Upar "Aptitude Mock Test", ⏱ 00:29:37, neela "Submit ›"; "Question 5" chip; options poori chaudai ki patti, gol dot; chuna = neeli border + tint; neeche "‹ Previous" (outline) aur "End Quiz" |

**Hamara:** exam engine ✅ (NTA palette, timer, calculator, phone sheet) yahi istemaal; har solution **KaTeX** me
(asli math, mono nahi); "Intuition → Approach → Kyun chalta hai" ke baad **"Shortcut" aur "Kab nahi chalega"**
(owner ki kitaab ki style); mock ke baad scorecard ✅ (har sawaal ka samay, section-wise) + "**kamzor topic ka 10 sawaal
drill**" ek button.

### 2.7 Practice (DSA, SQL, aptitude), POTD, contest

| Hissa | TUF me | Logic |
|---|---|---|
| Track chuno | "Pick a practice track": 3 button DSA / SQL / Aptitude, hover par chamak | — |
| Problem table | Header: "Practice portal", "DSA Practice Set", daayein bada "1,300+ problems to solve". Column: Problem │ difficulty tag │ Resources (editorial icon, laal video icon) │ Bookmark. Hara dot = hal, grey = nahi. Row hover: neeli border | Ek row = sab kuch |
| Problem page | Baayein tabs **Problem / Solution / Submissions / Peer Solutions** + bookmark; title; chips (Hints, Core, Google, Amazon, Microsoft); statement; **Example** (Input / Output / Explanation); **Constraints** box (mono); **Hints** accordion (pattern naam → "Why it works"); neeche ♡ 184, 💬 6, share, "☐ Completed". Daayein editor: **file tabs Tab-1 ✕ Tab-2 +**, bhasha ▾, ▶ run, hara outline "🚀 Submit"; neeche panel "Test Case › Sample │ Verdict" ⌃; status "☁ Saved"; icons reset/copy/format/save/fullscreen | LeetCode jaisa par ghana |
| Accepted | Hara ✓ "Accepted — Great work! You've successfully passed all test cases", "Passed 2/2" + hari bar, runtime/memory; card "✦ Amazing work! Share your solution to help others learn" + "Share" | Jashn chhota, share ka nyota |
| POTD | Card "Problem Of The Day", sikka chip "+20", **countdown 3 dabbe** 03:57:39, neela "Solve problem →" | Roz ek |
| POTD calendar | Mahina ‹ › ; hal kiye din par **kone me neeli mudi patti** (ribbon) chhote number ke saath; chhoote din par udaas emoji; aaj neeli outline; aage ke din fike | Streak dikhta hai |
| Contest brief | Sunehra title "Contest On Arrays", "!?" illustration; "* Once you begin, you cannot restart"; neela "Start Contest ›". "Candidate Instructions": 4 hare ✓ (dhyan se padho, fullscreen, tab badla = warning, baad me submissions dekh sakte) | Niyam pehle, phir ghadi |
| Contest live | Upar timer; **10 min se kam = laal + laal chamak** "00:09:16", "Finish"; har sawaal ki patti: points "100" + "Attempt" | Dabaav dikhe |
| Contest result | "Contest Completed: …", taareekh; daayein total "280" (sona), "Attempted 3/4" hari bar, "Unattempted 1/4" laal bar; har sawaal: "Question 1" chip, naam, score (100/100/80/Unattempted), "View" | Ek nazar me nateeja |

**Hamara (aage):**

1. **Verdict card sabse behtar:** AC / WA / TLE / MLE / RE / CE, har ek ki **saaf wajah + agla kadam**; WA par sabse chhota
   galat test (input, aapka output, sahi output, diff); TLE par "kitne bade n par atka" + complexity ka andaaza.
2. Problem table me **"kyun" column** ki jagah tag: pattern (two pointers…) aur company (verified), filter dono par.
3. POTD ✅ aur streak ✅ pehle se: calendar me **freeze wale din** alag (barf icon), chhoote din par emoji nahi, bas khaali
   (sharam nahi, [UX-BLUEPRINT.md](UX-BLUEPRINT.md) niyam 5).
4. POTD countdown **asli** (IST raat 12 baje tak), nakli urgency nahi.
5. Contest: ICPC/IOI ✅ plan, contest ke baad har galat submission ka sabse chhota galat test, editorial khulta; rating
   graph; laal timer sirf aakhri 10 min (wahi pattern, theek hai).
6. Hindi statement toggle; phone par "laptop par jaari rakho" QR.

### 2.8 Workspace (compiler, lists, notes)

| Hissa | TUF me |
|---|---|
| Online compiler | File tab "linear-search.cpp ✕" "+", ⋯, fullscreen; bhasha; icons reset, ✦ AI, copy; neela "▶ Run". Daayein **Input** panel (upload, copy, reset) aur **Output** panel (download, copy) "Output 3", "Execution time 12 ms · Memory 4.2 MB". Status bar: UTF-8 · Spaces: 4 · Ln 3, Col 1 · 3 lines + download, save, share |
| Lists | Har problem row ke icons (article, video, notes, bookmark, ⋯) → bookmark dropdown: "My saved lists ↗", **Public** (DSA Patterns), **Private** (Revision Week, Company Sprint), "Create new list +" |
| List page | "Build focused problem lists for *every goal*." Breadcrumb My Space / All Lists / Interview Revision; title + ✎; description; **Public toggle** + share; + aur ⋯; daayein bada "0 %" + "0/5 problems solved" + bar; rows: checkbox, naam, tag, icons |
| Notes | Modal: "Valid Parentheses ↗", "Edited just now", download, ✕; toolbar B I U, align, list, T, image, ⋯; tags (stack, strings); "Words: 0"; button "… is writing notes…" (spinner); mascot laptop par likhta, modal ke bagal me |

**Hamara:** compiler = Code Studio ✅ plan ([CODE-STUDIO.md](CODE-STUDIO.md)); lists me **"Revision"** list apne aap
(SM-2 ✅ se due) aur "Galtiyan" list (mistake notebook); notes AI **mere hi submissions aur galtiyon** se banaye
(generic nahi), PDF export, Hindi; public list ka link share, copy karke apni banao.

### 2.9 Profile aur certificate

| Hissa | TUF me |
|---|---|
| Portfolio | Banner image, gol avatar, naam, @handle, "Professional" badge, role @ company, jagah · profile views. **About**. **Featured projects** (3 card: image, naam, "Confidential"/"GitHub" chip, 2 line, tech chips). **Consistency** heatmap + platform tabs (All, unka, LeetCode, CodeChef, Codeforces), "5 platforms connected", "12 Months ▾"; neeche 4 number (contributions, active days, best streak, contests). **Achievements**: titles (badge) + trophies (kaansa/chaandi/sona). **DSA progress**: donut 567/1343 teen rang (Basic hara, Core peela, Pro laal) + topic-wise horizontal bars |
| Daayein rail | At a glance (problems, best streak 🔥, global rank, languages); Skills samooh (Languages, Backend & Infra, Concepts) chips; Work experience timeline; Education timeline; Coding profiles (LeetCode, GFG, HackerRank, Codeforces, CodeChef → hara "Synced"); Social links (GitHub, LinkedIn, Instagram → "Synced") |
| Share | "One shareable portfolio for *everything you build*" + "Share" |
| Certificate | "Receive proof of completion for eligible learning programmes and milestones" + progress 100% → safed certificate: baayein neeli lehrein, "CERTIFICATE OF COMPLETION", naam, course, taareekh, seal, co-founder ke signature, **QR**, certificate ID |

**Hamara (aage, aur sach):**

1. **Pramaan = kaabiliyat ka saboot**, sirf "course poora" nahi: proctored test pass ✅ (exam engine), QR se verify ✅
   (scorecard PDF me pehle se), LinkedIn par jodne ka button.
2. Profile par **do tarah ka data, saaf alag:** "Parikshaa par verified" (hamare judge/test se) aur "learner ne bataya"
   (LeetCode/GitHub links). **Doosre sites se scraping nahi** (hamara niyam); jahan official API ho (GitHub) wahan sync.
3. Privacy chip har section par: public / sirf link / sirf recruiters (Hire ✅ se jude, consent ke saath).
4. Projects = Studio ✅ me bane, live link ke saath; "Confidential" jaisa chip.

---

## 3. Design system jo dikha (naap ke saath)

Rang video frames se naape (JPEG/video compression ki wajah se ±5% farq ho sakta hai):

| Cheez | TUF (naapa) | Upyog |
|---|---|---|
| Page | `#090A0C` | Lagbhag kaala, thoda neela |
| Panel / card | `#111015` – `#14171C` | Page se ek seedhi upar |
| Row / chip | `#1D1E22`, `#20242D` | Panel se ek seedhi upar |
| Border | `#161719` – `#24262D` | Bahut patli, 1 px |
| Active nav | `#242F4B` (neela tint) | Sub-menu ka chuna item |
| User chat bubble | `#1A243D` | Neela tint |
| Action neela | `#3A7BEC` | Har primary button, link, chuna chip |
| Sahi / AC | `#4CE56E` (text), hara | Verdict, ✓ |
| Galat / timer | Laal; timer bg par laal chamak | WA, < 10 min |
| Difficulty | Basic hara (`#6ECF89`), Core peela (`#EECC61`), Pro laal-gulabi (`#E04E65`) | Tag me 15% tint bg + poora rang text |
| Premium | Sona (`#99784D` icon), sunehri chamak | Sirf Plus |
| Category tile | Teal `#7CC2C5`, narangi `#DEA183`, gulabi `#E0A9EE`, neela-baingani `#919AD1` | Sirf icon tile |

**Typography:** geometric sans (DM Sans jaisa), app me 13–14 px body, page title ≈32 px (sub-menu heading), marketing
heading ≈56 px; **italic + ek neela shabd** heading ka signature; code mono ≈13 px. **Radius:** chip 6, row 10, card
14–16, stage 20. **Icons:** patli lakeer (Lucide jaisa). **Chamak (glow):** sirf featured card par neeli/sunehri
`box-shadow` 40 px blur. **Motion:** tab badalne par fade, checklist tick ek-ek, timer laal hone par pulse, chart hover.

---

## 4. Component list: har component, uski haalatein, hamara badlaav

Ye hamare UI kit ki list hai (mock v2 aur product dono me yahi). ✅ = hamare kit me kisi roop me pehle se.

| # | Component | Haalatein (states) | Hamara badlaav |
|---|---|---|---|
| 1 | **App shell** (top bar + section sub-menu + stage + daayein rail) | rail band/khula; phone par bottom tabs | Ek hi shell sab pages par; Ctrl+K ✅ |
| 2 | **Segmented control** (Global/Indian, Brute/Better/Optimal, Sample/Verdict) | default, chuna, hover, disabled, keyboard ←→ | Radix ToggleGroup |
| 3 | **Choice chip** (onboarding) | khaali, hover, chuna (border + tint + ✓), focus | 44 px uncha (phone) |
| 4 | **Difficulty tag** | L1–L5 ya Aasaan/Madhyam/Kathin; dark/light | Rang + shabd dono (sirf rang nahi) |
| 5 | **Status chip** (Completed / In progress / Upcoming / Today / Day off) | 5 kism | Har ek alag icon bhi |
| 6 | **Count badge** (company chip ginti, "0/31") | — | ✅ |
| 7 | **Progress ring** + **segmented donut** | 0%, beech, 100%, loading | Beech me number, label hamesha |
| 8 | **Progress bar** (patli) | hara/neela/laal, indeterminate | ✅ |
| 9 | **Stat tile** (label, bada number, chhota sub) | loading skeleton ✅, khaali | ✅ console kit me "figure strip" |
| 10 | **Day stepper** (7 gol, ✓/aaj/aage) | done, aaj, aage, chhutti, freeze | Freeze ka barf icon |
| 11 | **Tree accordion** (sprint → din → kaam, connector line) | band, khula, aaj highlight | Keyboard ↑↓←→ |
| 12 | **Task row** (icon, naam, samay, ›) | baaki, chalu, hua (kata), chhoota | Swipe (phone) |
| 13 | **Checklist loader** ("plan ban raha") | kadam: baaki → chalu (ghoomta) → ✓ | Asli kadam, reduced motion par bina animation |
| 14 | **Success card** (plan taiyaar) | — | Mascot pose + 4 khaane |
| 15 | **Timer pill** | chalu, ruka, < 10 min laal, khatam | Imaandaar idle-pause |
| 16 | **Countdown boxes** (HH : MM : SS) | — | Screen reader ke liye har minute ek baar |
| 17 | **Task switcher** dropdown (Task 2/4 ▾) | — | — |
| 18 | **Problem row** (dot, naam, tag, resource icons, bookmark) | hal, koshish ki, nahi; hover; chuna | Pattern + company tag |
| 19 | **Statement blocks** (Example, Constraints, Hints accordion) | hint band/khula | KaTeX, Hindi toggle |
| 20 | **Code editor frame** (file tabs, bhasha, run, submit, test/verdict panel, status bar, Saved) | saving, saved, offline ✅, running, readonly | CodeMirror 6 ✅ (practice me pehle se) |
| 21 | **Verdict card** | AC, WA, TLE, MLE, RE, CE, judge busy, partial (x/y) | **Sabse chhota galat test + diff** |
| 22 | **Hint ladder card** | 0/1/2/3 hint liye, band | Hint ka "kharcha" imaandaar |
| 23 | **Chat panel** (tabs, messages, review card ✓/✗, context chips, composer) | khaali, likh raha (stream), error, seema poori | Do mode toggle, AI label |
| 24 | **Review accordion** (numbered) | — | + pattern naam, + follow-up sawaal |
| 25 | **Video card** (thumbnail, samay chip) | play, dekha hua | Optional, data saver par band |
| 26 | **Article blocks** (algorithm list, complexity, code tabs, cheat table, FAQ) | — | Shiki code rang, KaTeX |
| 27 | **Dry-run slider** | kadam 1…n, play/pause, swipe | Hamara khaas ([VISUAL-STYLE.md](VISUAL-STYLE.md)) |
| 28 | **Question palette** + legend | sahi, galat, abhi, chhoda, review ✅ | ✅ exam engine |
| 29 | **Option row** (radio) | khaali, hover, chuna, sahi, galat | 56 px ✅ |
| 30 | **Chip cloud** (fade mask) | hover, chuna | Phone par list |
| 31 | **Bar chart + linked list** (hover sync) | hover, chuna | Label hamesha, table view |
| 32 | **Grouped popover** (30/60/90 din) | — | Source "ⓘ" |
| 33 | **Experience card** (masonry) | — | Round-wise chips |
| 34 | **Premium table** (sunehri) | locked/unlocked | Saffron, sona nahi |
| 35 | **Streak calendar** (ribbon) | hal, chhoota, freeze, aaj, aage | Sharam wala emoji nahi |
| 36 | **Contest brief** + instructions list | — | ✅ exam gate jaisa |
| 37 | **Score summary** (attempted/unattempted bars) | — | + rank, rating badlaav |
| 38 | **List dropdown** (public/private, create) | — | ✅ Radix Popover |
| 39 | **List header** (✎ title, public toggle, share, % ) | — | — |
| 40 | **Note modal** (toolbar, tags, words, AI likh raha) | khaali, AI likh raha, saved | Mere submissions se |
| 41 | **Profile blocks** (header, heatmap + tabs, achievements, timeline, synced links) | private/public | Verified vs self-declared alag |
| 42 | **Certificate** | — | QR verify ✅ |
| 43 | **Testimonial card**, **FAQ accordion**, **Footer** | — | — |
| 44 | **Mascot** (5 pose: jhaankna, sochna, jashn, likhna, hero) | reduced motion par sthir | Hamara apna (§6) |
| 45 | **Feature stage** (marketing tabs + demo + glow) | — | Sirf marketing |
| 46 | **Orbit chips** | — | Sirf marketing |
| 47 | **Toast / Saved chip / Empty / Error** | ✅ | ✅ |

---

## 5. TUF kahan kamzor hai (yahan hum aage nikalenge)

| Kami (frames me dikhi) | Hamara jawab |
|---|---|
| Grey text kaale par bahut fika (≈11 px, kam contrast) | AA contrast dono theme ✅ niyam, 12 px se chhota nahi |
| Sirf dark; light theme nahi dikhi | Dark-first + light toggle |
| Koi Hindi/regional nahi | English / Hinglish / हिंदी har screen ✅ (11 bhasha engine) |
| Phone layout kahin nahi dikha | Phone-first (390 px) har screen |
| Caption galat (Queue ki tasveer, Selection Sort caption) | Caption spec se, galat ho hi nahi sakta |
| Company frequency ka source nahi | Verified source + taareekh har jagah |
| "Hold to reveal" chhupa test khol deta hai | Sabse chhota galat test (seekh, leak nahi) |
| Bahut jagah Plus/Premium ka dabaav | Free me poora seekhna, Plus sirf extra |
| Nakli lagne wala "creating" animation (shayad) | Asli kadam, jaldi ho to jaldi |

---

## 6. Parikshaa ka look (final prastaav)

[DESIGN-STUDY.md](DESIGN-STUDY.md) §4 wala, ab naap ke saath pakka:

| Token | Dark (default) | Light | Kyun |
|---|---|---|---|
| `--page` | `#0B0D12` | `#F7F8FB` | TUF se thoda neela-garam, pehchaan alag |
| `--panel` | `#12151C` | `#FFFFFF` | |
| `--raised` (row, chip) | `#181C25` | `#F1F3F8` | |
| `--line` | `#232836` | `#E2E6EF` | |
| `--text` / `--text-2` / `--text-3` | `#E6E8EE` / `#A3AABB` / `#7A8296` | `#131A2E` / `#4F586C` / `#5F687C` | text-3 bhi AA (TUF se zyada contrast) |
| `--action` | `#6E7BFF` (indigo) | `#3346C4` ✅ | TUF ka neela nahi, hamara indigo |
| `--plus` | `#F5A524` (saffron) | `#C76A0E` | Plus, streak; sona nahi |
| `--ok` / `--bad` / `--warn` | `#22C55E` / `#EF4444` / `#F59E0B` | ✅ purane | |
| Difficulty L1…L5 | hara → teal → peela → narangi → laal | wahi, gehre | 3 ki jagah 5 star, shabd ke saath |
| Stambh tiles (7) | ek-ek rang, sirf icon tile | | |
| Sketch | coral `#F6A496`, ink | ✅ [VISUAL-STYLE.md](VISUAL-STYLE.md) | Dry run, empty state |

- **Font:** UI ke liye **Plus Jakarta Sans** (OFL; geometric, par DM Sans se alag), Hindi **Noto Sans Devanagari** ✅,
  code **JetBrains Mono** ✅. Body 14, chhota 12, page title 24, marketing 56. Heading signature: ek shabd **saffron
  underline** (haath ki lakeer, rough.js), TUF ki italic-neeli nahi.
- **Radius** 6 / 10 / 14 / 20, **spacing** 4 ka grid, **icons** Lucide 1.5 px, **glow** sirf marketing aur Plus card par.
- **Mascot (owner tay karein, illustrator banaye):** teen idea: (1) **diya** (gyaan ki lau, roz jalta = streak),
  (2) chhota **ullu** (raat ki padhai, samajhdaar), (3) **pencil-robot** (likhna + code). Sujhav: diya, kyunki streak
  ki lau se seedha juda aur bilkul Indian. 5 pose chahiye (§4 #44).
- **Naam** (sujhav, owner tay karein): planner "**Aaj ka Plan**", AI "**Sahayak**" ✅, certificate "**Pramaan**" ✅,
  practice "**Abhyas**", lists "**Mera Daftar**".

---

## 7. Information architecture (hamara shell)

```
Top bar:  [logo]  Aaj  Seekho  Abhyas  Companies  Banao  Career        [Ctrl+K] [🔥 12] [🪙] [Plus] [avatar]
Baayein (section ka sub-menu, TUF jaisa chipka):
  Aaj      → Plan · Revision due · Daily 10 · Progress
  Seekho   → Roadmaps · Courses · Lessons · Editorials · Cheat sheets
  Abhyas   → DSA · SQL · Aptitude · POTD · Contests · Mock tests
  Companies→ Company list · Experiences · Patterns (service cos) · Premium
  Banao    → Studio · Projects · Arenas · HLD
  Career   → Pramaan · Profile · Resume · Jobs (Hire)
  Mera     → Lists · Notes · Settings
Daayein rail (wide screen): aaj ke kaam ka saar, Sahayak button, Plus card (sirf free user, chhota)
Phone: neeche 5 tab (Aaj, Seekho, Abhyas, Sahayak, Main), baaki "Main" me
```

---

## 8. Mock v2: screens ki list aur kram

Har screen: **1440 aur 390 · dark aur light · English aur Hindi** = 8 screenshot. Asli React code, asli tokens,
Playwright se screenshot, `docs/learn/mock-v2/` me ([DESIGN-STUDY.md](DESIGN-STUDY.md) §4).

| Batch | Screens | Kyun pehle |
|---|---|---|
| **1 (owner ko pehle)** | (1) **Aaj / progress dashboard** (§2.1h + plan tree), (2) **Problem table** (sheet), (3) **Problem workspace** (statement + editor + WA verdict + sabse chhota test + Sahayak panel), (4) **Aptitude practice set** (palette + Intuition/Approach/Kyun + KaTeX), (5) **Editorial** (approach tabs + dry-run slider + code tabs) | Ye 5 roz ke 80% screens |
| 2 | Onboarding (4 sawaal → ban raha → taiyaar), sprint/din tree, din chhoota (3 raaste), company page + chart + experiences, contest (brief → live → result), POTD calendar, lists + notes, profile, Pramaan certificate | Baaki core flow |
| 3 | Landing page (hero + feature stage + FAQ + footer), Plus, settings, empty/error/loading sab | Marketing aur kinare |
| 4 | Phone-only: Daily 10, Parsons, dry run swipe, code keyboard | Phone ka khaas |

---

## 9. Kaise banega (kram)

| Kadam | Kya | Kab "ho gaya" |
|---|---|---|
| D0 | Tokens v3 (dark-first) `packages/brand` me, font Plus Jakarta Sans add (OFL, self-host) | Stylelint ✅ pass, purane pages toote nahi (visual baselines) |
| D1 | Shell + 15 base components (§4 #1–#22 ke zaroori) + gallery page | Gallery ka screenshot dono theme, axe 0 |
| D2 | Batch 1 ke 5 screens, `/mock-v2/*` route (sirf dev/flag) | 40 screenshot, main khud dekh kar 2 round sudhaar |
| D3 | Owner review → badlaav | Owner ki haan |
| D4 | Batch 2–4 | — |
| D5 | Mock ke components hi product me (LV-F3 se aage) | Phenkna kuch nahi |

Andaaza: D0–D2 ≈ 3–4 session, D4 ≈ 4–6 session. Har UI slice par Design QA gate ✅ ([UX-BLUEPRINT.md](UX-BLUEPRINT.md)
§5): `npm run check`, `build:clients`, `budget`, axe, screenshots.

---

## 10. Owner se kya chahiye (DESIGN-STUDY §5 ka update)

| # | Kya | Haalat |
|---|---|---|
| 1 | Dark-first + light toggle: haan/na | Intezaar |
| 2 | Rang: indigo `#6E7BFF` + saffron `#F5A524` (TUF ka neela + sona nahi) | Intezaar |
| 3 | Mascot: diya / ullu / pencil-robot (ya apna idea) + illustrator (~₹15–40k, 5 pose) | Intezaar |
| 4 | Naam: "Aaj ka Plan", "Abhyas", "Mera Daftar" theek? | Intezaar |
| 5 | Ek topic ka asli content (mock asli lage) | Intezaar |
| 6 | **Plugins enable karein:** claude.ai par "frontend-design" aur "Design" (Anthropic). Maine 20 Oct ko check kiya: account par abhi koi plugin enable nahi. Main khud install nahi kar sakta | Intezaar |
| 7 | Logo SVG (agar hai) | Intezaar |

Jawab aate hi D0 se shuru. Jawab ke bina bhi D0–D2 sujhaye gaye values se ban sakta hai; badlaav baad me tokens me ek
jagah.
