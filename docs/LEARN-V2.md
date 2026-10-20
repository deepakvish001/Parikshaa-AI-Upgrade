# Learn v2: poora platform, poora content (design, 19 Oct 2026)

**Owner ka faisla (19 Oct 2026):** "Learn pehle karo." Hire v2 ruka hai (agla kadam H2d kadam 2), Learn v2 ab pehli
priority hai. Kaam kaise aage badhega: [LEARN-HANDOFF.md](LEARN-HANDOFF.md).

**Owner ne kya maanga:** Learn ka poora platform aur content:
- **5,000 coding problems**, LeetCode aur Codeforces ke level ke, har ek par lamba editorial (TUF jaisa gehra, par
  **hamari PDF wali style** me), images aur visuals ke saath, jo insaan ka banaya lage;
- **5,000 aptitude** (quant, reasoning, verbal);
- DBMS, CN, OS, OOPs, LLD, HLD, design patterns, har programming language, CP ke liye math, SQL;
- compiler, saare features, poora UI, **poora admin panel**, security, scalable architecture;
- contests; LeetCode aur TUF se **sach me behtar** features;
- platform pehle **text-based**; video doosre phase me (record, edit, upload hoti rahengi), **DRM** ke saath: download
  na ho, screenshot/recording na ho sake.

**Poora build spec (har choti-badi baat):** [learn/USER-FLOWS.md](learn/USER-FLOWS.md) (learner ke har screen ka flow,
design, icons) · [learn/ARCHITECTURE.md](learn/ARCHITECTURE.md) (database, API, AI, judge, factory, suraksha) ·
[learn/ADMIN-PANEL.md](learn/ADMIN-PANEL.md) (roles, har admin screen) · [learn/VISUAL-STYLE.md](learn/VISUAL-STYLE.md)
(sketch visuals, dry-run sliders) · [learn/EDITORIAL-STYLE.md](learn/EDITORIAL-STYLE.md) (owner ki kitaab wali style) ·
[learn/PROBLEM-STANDARD.md](learn/PROBLEM-STANDARD.md) (problem package v2, tests) · [learn/CODE-STUDIO.md](learn/CODE-STUDIO.md)
(browser me VS Code jaisa IDE, guided labs, har technology ka "LeetCode", LLD/HLD practice) ·
[learn/CONTENT-CATALOG.md](learn/CONTENT-CATALOG.md) (~65 courses, ~2,200 lessons, ~320 labs, articles, cheat sheets) ·
[learn/OPEN-PLANNING.md](learn/OPEN-PLANNING.md) (aur kya plan karna baaki hai) ·
[learn/ALL-IN-ONE.md](learn/ALL-IN-ONE.md) (all-in-one platform: 7 stambh, 25 nayi cheezein, launch kharch, $200 plan par samay) ·
[learn/UX-BLUEPRINT.md](learn/UX-BLUEPRINT.md) (har page ka UX, phone-first, UX ka naap) ·
[learn/mock-v3/README.md](learn/mock-v3/README.md) (**clickable mock v3 "Kaagaz aur Blackboard", 68 screens incl. 25 admin, owner ki raay baaki**; faisla [learn/DESIGN-V3.md](learn/DESIGN-V3.md)) · [learn/mock-v2/README.md](learn/mock-v2/README.md) (mock v2, 41 screens; owner ne nakaara: "TUF jaisa") · [learn/mock/README.md](learn/mock/README.md) (mock v1, 46 screens; owner ne nakaara) ·
[learn/DESIGN-STUDY.md](learn/DESIGN-STUDY.md) (v1 kyun kamzor) · [learn/DESIGN-PLAN-V2.md](learn/DESIGN-PLAN-V2.md) (TUF ke clips se
har feature ka flow, 47 components, hamara look, mock v2 ka kram).

Saath ki docs: [LEARN-LAUNCH-PLAN.md](LEARN-LAUNCH-PLAN.md) (judge, servers, AI model ka kharch, TUF video ka map),
[LEARN-TUF-GAP.md](LEARN-TUF-GAP.md) (tulna, 10 saal), [LEARN-BUILD-LABS.md](LEARN-BUILD-LABS.md) (labs),
[ROADMAP-END-TO-END.md](ROADMAP-END-TO-END.md) (content factory), [OWNER-SETUP.md](OWNER-SETUP.md).

---

## 0. Pehle teen imaandar baatein

1. **Editorial ki style owner ki file se** ("Decode Your Coding Interview", Markdown, 19 Oct 2026): har problem 4 kadam
   me (Understand → Coming Up With The Solution → Writing → Testing/Reflection), sawaal-jawab se input samajhna, "index
   0 se shuru karo", complexity se hal sudhaarna, galat raasta bhi dikhana. Poora niyam:
   [learn/EDITORIAL-STYLE.md](learn/EDITORIAL-STYLE.md). **5,000 ka generation tab tak nahi** jab tak aap 10 sample
   editorials manzoor na kar dein (§3g).
2. **"LeetCode/Codeforces level" ka matlab mushkil ka level, unke sawaal nahi.** Unke statements, tests ya editorials
   copy karna copyright aur unki terms ke khilaaf hai. Classic idea (jaise "do number jinka jod target ho") kisi ka
   nahi; statement, kahani, tests aur editorial hamare apne honge.
3. **Screenshot ko poori tarah rokna web par mumkin nahi.** Phone se camera se video banana koi nahi rok sakta. Jo
   mumkin hai: download band, encrypted video, kai devices par recording me kaala screen, app me screenshot band, aur
   har learner ka **naam/ID wala chalta watermark** taaki leak pakda ja sake. Poori sachchai §8 me.

---

## 1. Kis ke liye, aur hum kyun jeetenge

**Learner:** B.Tech/BCA/MCA (2nd–4th saal), freshers, aur 0–3 saal ke engineers jo naukri badalna chahte hain.
Zyaadatar Android phone + kabhi-kabhi laptop, Hindi/English dono, mass recruiters (TCS, Infosys, Wipro, Accenture)
se le kar product companies tak.

**Teen vaade:**
1. **Ek hi jagah poori taiyaari:** DSA + CP + aptitude + CS core + design + languages + mocks + contests.
2. **Sirf padhna nahi, sach me seekhna:** har galti se seekh, samajh ka saboot, revision jo yaad dilaye.
3. **Taiyaari se naukri tak:** wahi platform college (Campus) aur companies (Hire) bhi use karti hain, isliye
   Pramaan aur profile seedha recruiter tak jaata hai. TUF aur LeetCode ke paas ye nahi.

---

## 2. Learn me kya-kya hoga (information architecture)

```
Home (aaj ka plan, streak, revision due, contest)
├─ Roadmap (onboarding → goal → sprints, adjust/break)
├─ Roadmaps (role aur skill ke interactive roadmaps, apne banao ya AI se banwao; §4b)
├─ AI courses aur guides (kisi bhi topic par, Sahayak ke saath; §4b)
├─ DSA A2Z (520 problems, 18 step, apna kram)
├─ Sheets (Placement 150, Aakhri 30 din, Company-style, Topic sheets)
├─ Problems (5,000 ka bank: filter topic, mushkil, pattern, rating)
├─ CP (rating-wise 800–2600, CP math, interactive)
├─ Aptitude (quant, reasoning, verbal → topic lessons, practice sets, timed mocks, company-pattern mocks)
├─ CS Core (DBMS, OS, CN, OOPs → lessons, interview Q&A, MCQ)
├─ Design (LLD, HLD, design patterns → lessons, case studies, diagrams)
├─ Languages (C, C++, Java, Python, JavaScript/TypeScript, Go → basics se advanced, output-predict)
├─ SQL (lessons + 300 problems, SQL runner)
├─ Contests (weekly, rated, virtual, upsolve)
├─ Mock interview (AI interviewer, rubric)
├─ Workspace (mera code, lists, notes, mistake notebook, downloads)
├─ Profile (portfolio, heatmap, Pramaan, certificate)
└─ Plus (pricing, campus licence)
```

---

## 3. Content

### 3a. Kitna aur kya

| Hissa | Kul | Launch par (text) | Kaise jaanch |
|---|---|---|---|
| **Coding problems** | **5,000** | 1,500 (A2Z 520 + bank 980) | Runner par reference = brute, validator, doosra model hal kare |
| ↳ DSA A2Z path | 520 | 520 | Upar + **100% insaan review** |
| ↳ Interview bank (LeetCode level; Easy 30% · Medium 50% · Hard 20%) | 2,480 | 980 | Upar + 10% insaan |
| ↳ CP bank (Codeforces level, rating 800–2600) | 2,000 | 0 | Upar + validator + wrong solutions fail hon |
| **Basics** (owner ke series batches + naye; TCS NQT jaise coding rounds) | **500** (5,000 ke upar) | 200 | Upgrade v1 → v2 ([learn/PROBLEM-STANDARD.md](learn/PROBLEM-STANDARD.md) §6) |
| **Aptitude** | **5,000** | 2,000 | Har sawaal ka Python solver = sahi option |
| ↳ Quant | 2,200 | 900 | |
| ↳ Logical reasoning | 1,500 | 600 | Puzzles brute force se |
| ↳ Verbal | 1,300 | 500 | Do model sahmat + insaan sample |
| Aptitude mocks | 50 (40 general + 10 company-pattern) | 15 | Section time, mushkil ka balance |
| **DBMS / OS / CN** | 55 + 55 + 55 lessons; 400 + 400 + 400 Q&A; 600 + 600 + 600 MCQ | Sab lessons, aadhe Q&A/MCQ | Do model + insaan |
| **OOPs** | 35 lessons (4 bhasha me examples), 250 Q&A, 400 MCQ | Sab | Code runner par |
| **SQL** | 60 lessons, 300 problems | 30 lessons, 100 problems | SQL runner |
| **LLD** | 20 concept + 30 case studies (class diagram + code 3 bhasha) | 10 + 10 | Code compile + tests |
| **HLD** | 30 concept + 30 case studies (architecture diagram, numbers ka hisaab) | 10 + 10 | Insaan review (100%) |
| **Design patterns** | 33 (23 GoF + 10 modern: DI, repository, circuit breaker, retry, CQRS, event sourcing, saga, outbox, pub-sub, rate limiter) | 15 | Code runner par |
| **Languages** | C 40 · C++ 60 (STL) · Java 60 (collections, streams, concurrency) · Python 50 · JS/TS 50 · Go 35 lessons; har bhasha 300 output-predict MCQ | C++, Java, Python | Har code snippet runner par |
| **CP math** | 60 lessons (number theory, modular, combinatorics, probability/EV, matrix expo, game theory, geometry, bits, FFT) | 0 | Code + insaan |

### 3b. Coding problems ka bantwara

**A2Z + interview bank (3,000), topic se:**

| Topic | Ginti | Topic | Ginti |
|---|---|---|---|
| Basics, math | 120 | Linked list | 110 |
| Arrays | 300 | Stack, queue, monotonic | 160 |
| Strings | 220 | Heap, priority queue | 110 |
| Hashing | 130 | Trees, BST | 270 |
| Two pointers, sliding window | 180 | Graphs | 270 |
| Binary search (answer par bhi) | 180 | Dynamic programming | 380 |
| Sorting, greedy | 220 | Trie | 40 |
| Recursion, backtracking | 160 | Bit manipulation | 60 |
| Segment tree, Fenwick | 50 | Design (LRU, LFU, iterator…) | 40 |

**CP bank (2,000), rating se:** 800–1200: 600 · 1300–1600: 600 · 1700–2000: 450 · 2100–2400: 250 · 2500+: 100.
Topic: number theory, combinatorics, constructive, greedy, DP (bitmask, digit, tree, DP+DS), graphs (DSU, shortest
path, MST, SCC, flows basic), data structures, strings (KMP, Z, hashing, suffix array), geometry, games, **interactive**.

**Har problem ka package aur test ka niyam:** [learn/PROBLEM-STANDARD.md](learn/PROBLEM-STANDARD.md) (owner ke format par
v2, test groups, "minor se minor" edge checklist, mutation score ≥ 95%, 10 machine gates; owner ke 40 problems ka audit).
Saar (Codeforces Polygon jaisa, apna format):

| Hissa | Kya |
|---|---|
| Statement | Apni kahani (Bharat ke udaharan: UPI, train, cricket, mandi), input/output, constraints |
| Validator | Har test constraints maanta hai, ye jaanchta hai (C++ `testlib.h`, MIT licence) |
| Generators | Seed wale; random, edge, max, anti-hash, worst-case |
| Tests | Sample + 20–60 hidden; S3 me versioned zip |
| Checker | Exact, tokens, float (1e-6), ya apna (kai sahi jawab) |
| Interactor | Interactive problems ke liye |
| Solutions | Reference (C++, Java, Python, JS), brute, aur **galat solutions** jo fail hone chahiye (WA, TLE) |
| Time limit | Sabse dheeme sahi solution ka 2–3× (bhasha ke hisaab se multiplier) |
| Metadata | Topic, pattern, rating/mushkil, prerequisites, related, "kahan aata hai" (sirf sach) |

### 3c. Editorial ka dhaancha (owner ki file wali style)

Poora niyam [learn/EDITORIAL-STYLE.md](learn/EDITORIAL-STYLE.md) me. Saar:

1. **Problem + example** (bold statement, code block, grid/tree ho to visual).
2. **Understand The Problem / Samasya samjho:** key hisse bold, function ka dhaancha, input aur output ki jaanch
   sawaal-jawab me (khaali? sorted? duplicate? negative? overflow? kai jawab?), zaroorat ho to data structure khud chunna.
3. **Coming Up With The Solution / Hal tak pahuncho:** 3–4 examples "Kyun ye example?" ke saath, ek chuna hua example,
   observations, "index 0 se shuru" se brute force, complexity ke dabbe (`O(N log N)` → sort/heap, `O(N)` → set/hash,
   `O(log N)` → binary search), har idea aazmana, **galat raasta aur uski seekh**, recap, pseudocode. Brute → Better →
   Optimal isi safar se nikalte hain; upar ke tabs inhi hisson par le jaate hain.
4. **Writing The Solution / Code likho:** sanity checks, final code 4 bhasha ke tabs me (runner par pass).
5. **Testing / Reflection / Jaancho aur seekho:** dry run (frames), time/space, 3–5 observations, related problems
   (apne bank se), revision card, edge cases, aam galtiyan, follow-ups.

Lambai: Easy ~1,800–2,500 shabd, Medium ~2,500–3,500, Hard ~3,500–5,000 (owner ki file me 2,000–3,450). Ye 4 headings
hi hint ki seedhi hain. Mentor ki awaaz, `Note` callouts, banaye hue niji kisse nahi, bahar ke problem sites ke link
nahi.

**CP editorial me aur:** observations ki chain (Observation 1, 2, 3…), proof, constraints ka math, doosre solution,
implementation tricks.

**Aptitude ka hal:** kaunsa concept, kadam-kadam hal, **shortcut** (kab chalta hai), time target (jaise 45 s), har
galat option kis galti se aata hai, aur milte-julte sawaal.

**Lesson (CS core, design, languages):** kyun zaroori (interview + asli system), concept + diagram, udaharan,
galat-fehmiyan, interview sawaal (chhota + gehra jawab), 5 MCQ ka quiz, revision card, aage practice.

### 3d. Visuals: insaan ke banaye jaise

**Owner ke reference images (19 Oct 2026)** ki style: safed kaagaz, kaali haath jaisi lakeer, ek coral highlight,
tirchhi chhaaya, haath ki likhawat. **Har DSA problem ka dry run isi style ke slider me.** Poora niyam:
[learn/VISUAL-STYLE.md](learn/VISUAL-STYLE.md).

Haath se 5,000 images banana mumkin nahi, aur AI se bani images me galti hoti hai. Isliye **visuals code se
banenge**:

- AI har editorial ke saath ek **visual spec** (JSON) likhta hai; dry run ke frames **runner par code chala kar**
  (trace se) bante hain, isliye galat nahi ho sakte.
- **Hamara renderer** spec ko SVG banata hai, **sketch style** me (rough.js jaisi haath ki lakeer, MIT licence) aur
  haath ki likhawat wale font me (**Kalam**: Devanagari + English, SIL OFL; app ke saath bundled). Isse whiteboard
  par samjhaane jaisa lagta hai, aur poore platform par ek jaisa.
- **Step slider:** har kadam ek frame; aage/peeche, autoplay; har frame ka alt text (screen reader).
- **Kaun-kaun se visual:** array cells + pointers, sliding window, hash buckets, linked list, stack/queue, tree
  (binary, BST, heap), graph (BFS layers, Dijkstra table), DP table bharte hue, recursion tree, bits, grid/matrix path,
  intervals timeline, segment tree, trie, DSU jungle, sorting bars; aptitude ke liye number line, Venn, DI charts,
  clock, dice/cube net, disha (compass), seating (gol/line), family tree; CS ke liye ER diagram, UML class/sequence,
  architecture (HLD), process states, Gantt chart (scheduling), page table, TCP handshake, OSI layers.
- UML, ER, sequence aur architecture ke liye Mermaid (MIT) ya D2 (MPL-2.0) hamare theme me.
- Har visual ka **visual regression test**; galat frame CI me pakda jaata hai.

### 3e. "Insaan ka banaya lage": likhne ka niyam

- **Awaaz:** dost jaisa senior mentor; "hum" aur "aap"; chhote-bade vaakya mila kar; Bharat ki misaalein.
- **Bachna:** AI ke ghise-pite shabd ("delve", "crucial", "In today's world"), har jagah bullet, khokhli taareef.
- **Asli galtiyan:** jo students sach me karte hain (WA data se).
- **Imaandari:** content "Parikshaa team" ka, AI ki madad se, insaan ki jaanch ke saath. **Banayi hui niji kahaniyan**
  ("jab main Google me tha…") nahi. About page par saaf likha.
- **Style guide + 30 "achhe" udaharan** generator ko diye jaate hain; ek "style critic" model har draft ko in niyamon par
  jaanchta hai.

### 3f. Content factory v2 (kaise banega)

```
Topic plan (kram, ginti) ─▶ Draft (Opus 5.5, Batch API) ─▶ Package: statement + validator + generators
     ─▶ Runner: reference vs brute (random tests), galat solutions fail, TL calibrate
     ─▶ Doosra model sirf statement padh kar hal kare → outputs mile (statement saaf hai)
     ─▶ Duplicate jaanch (embeddings, hamare bank se) ─▶ Editorial + visual spec ─▶ Renderer + code runner par
     ─▶ Style critic ─▶ Insaan review (A2Z 100%, baaki 10%) ─▶ Publish (version) ─▶ Live feedback ("galti batao")
```

- Raat ko apne aap (GitHub Actions/VM), API spend limit ke saath, subah report.
- **Purana content:** pichhle app ki 1,260 problems (778 tests ke saath) ka importer bana hai (plan 91). Unhe bhi isi
  jaanch se guzaarenge, **aur originality jaanchenge** (agar wo kahin se copy thi, to nahi chhapenge).

### 3g. Sample-first (zaroori gate)

1. Main 10 problems (Easy 3, Medium 4, Hard 2, CP 1) + 10 aptitude + 2 lessons poore banata hoon, visuals ke saath.
2. Aap dekhte hain (apni file "Decode Your Coding Interview" ki style se milate hain), badlaav batate hain.
3. Template aur style guide pakke → tab hi 5,000 ka generation.

### 3h. Content ka kharch aur samay

| Kaam | API (andaaza) | Insaan review |
|---|---|---|
| 5,000 coding (draft, tests, 4 bhasha code, editorial, visual spec, jaanch, ~30% dobara) | ~$2,000–3,500 | A2Z 520 × 45 min + 10% bank × 30 min ≈ 600 ghante |
| 5,000 aptitude + solver | ~$100–200 | 10% × 5 min ≈ 40 ghante |
| ~800 lessons + ~10,000 Q&A/MCQ | ~$300–500 | Lessons 20 min har ek ≈ 270 ghante |
| Hinglish edition (Haiku 5.5) | ~$10–50 | Sample |
| **Kul** | **~$2,500–4,500** (₹2.1–3.8 lakh) | **~900 ghante** (₹4–8 lakh agar part-time reviewers; ya aap/college TAs) |

**Samay:** generation raat ko ~150–250 items; review asli rukaavat hai. Launch ka content (§3a) **~6–8 hafte**, poora
5,000 + 5,000 + lessons **~14–18 hafte**.

---

## 4. Features: LeetCode aur TUF se behtar kya (sach me kaam ka)

Har feature ka "kyun" aur kaise naapenge. ✅ = code me pehle se.

| # | Feature | Student ko kya milta hai | Naap |
|---|---|---|---|
| 1 | **"Chhota galat test" (counterexample finder)** | WA par hamara system chhote random inputs par aapka code aur brute chalata hai, aur **sabse chhota input dikhata hai jahan galat hai** (hidden tests nahi khulte). LeetCode bas "Wrong Answer" bolta hai | WA ke baad AC tak ka samay |
| 2 | **Complexity jaanch (asli naap se)** | AC ke baad bhi: input ko 2×, 4×, 8× karke chala kar batata hai "aapka O(n²) lag raha hai, chahiye O(n log n)" | Optimal tak pahunchne wale % |
| 3 | **Mistake notebook (apne aap)** | Har WA/TLE ki wajah (off-by-one, overflow, galat pattern, edge case) apne aap category me; usi kamzori par chhote drills | Wahi galti dobara kitni baar |
| 4 | **Pattern pehchaan drills** | 60 second me statement padh kar pattern chuno (code nahi); interview ka asli hunar | Drill accuracy |
| 5 | **Dry run "agla kadam batao"** | Visual player me agla state khud bharo, phir dekho; sirf dekhne se zyaada yaad rehta hai | Retention quiz |
| 6 | **Samajh ka saboot (micro-viva / Pramaan)** | AC ke baad apne code par 2 chhote sawaal; pass par **verify hone wala** certificate | Recruiter ke views |
| 7 | **Spaced revision** ✅ | SM-2 se sahi din par wahi problem; placement season se pehle revision sprint | 30 din baad yaad |
| 8 | **Hindi/Hinglish har jagah** | UI, editorial, AI: apni bhasha me | Hindi users ka retention |
| 9 | **Mass-recruiter mocks** | TCS/Infosys/Accenture jaisa **pattern** (section, time, negative marking), percentile | Mock score ka sudhaar |
| 10 | **Readiness score** (khula formula) | Har company type ke liye kahan khade ho, aur agla kya karna | Score vs asli selection |
| 11 | **AI mock interviewer** | Code + baat, rubric, replay me feedback | Interview pass rate (khud bataya) |
| 12 | **Teach-back** | Apne shabdon me samjhao; AI saaf-pan aur galti batata hai (Feynman) | Explanation score |
| 13 | **Adaptive roadmap** ✅ | Din chhoota to plan khud badle; "break lo" | Sprint poora karne wale % |
| 14 | **Contest upsolve plan** | Contest ke baad jo nahi bana uska plan + virtual contest | Upsolve rate |
| 15 | **College ke group aur leaderboard** | Dost aur college ke saath; TPO ko readiness | Group me active % |
| 16 | **Recruiter tak pahunch (Hire)** | Pramaan + profile seedha companies ko (aapki marzi se) | Interview calls |
| 17 | **Low data mode + offline** | Text-first, PWA; kam net par bhi | Tier-2/3 shehron me usage |
| 18 | **Accessibility** | Screen reader, bade font, dyslexia-friendly font option | axe 0 errors |

LeetCode/TUF ke barabar wale (ye bhi honge): editorial 3 approach, kai bhasha, company tags (sirf sach), discussions,
interview experiences ✅, contests + rating ✅, POTD ✅, lists ✅, notes ✅, streak/coins ✅, AI hint/review ✅,
roadmap ✅, profile ✅.

### 4b. Roadmaps, AI tutor aur AI courses (roadmap.sh jaisa, apne content se)

**Owner ne kya diya (19 Oct 2026):** roadmap.sh ke Pro plan ki list (unlimited AI tutor messages; unlimited AI
courses, guides aur roadmaps; unlimited quizzes; expert-written premium content; poori chat history; 100 tak custom
roadmaps; naye features pehle) aur repo `github.com/nilbuild/developer-roadmap`.

**Wo repo kya hai:** roadmap.sh ka content repo. ~88 roadmaps (Frontend, Backend, DevOps, AI Engineer, Data Analyst,
Android, Cyber Security, System Design, DSA, React, Python, Java, Docker, Kubernetes, AWS, SQL, Git…). Har roadmap
topics ka graph hai; har topic ek Markdown file (`roadmaps/<roadmap>/content/<topic>@<node-id>.md`) jisme samjhaana aur
bahar ke free links hain. Site par: topic par click → padho, progress (done / seekh raha / skip), best-practice guides,
question sets, project ideas; Pro me AI tutor, AI courses, AI roadmaps, quizzes, personal coach. Pro ka daam ~$10/mahina
(unke premium page par; pakka nahi).

**Licence (zaroori):** repo ki `license` file kehti hai ki content sirf **niji istemaal** ke liye hai; images, project
files ya content ko kisi bhi roop me chhapna mana hai, sirf link share kar sakte hain, aur baaki ke liye pehle se
ijaazat chahiye. **Isliye unke roadmaps, text ya images Parikshaa par nahi aayenge.** Hum wahi **features** banayenge,
apne roadmaps aur apne content ke saath (jaise TUF ke saath kiya). Bahar ke docs ke **link** (MDN, Python docs,
official guides) dena theek hai.

**Kya banayenge:**

| Feature | Parikshaa me | Free | Plus |
|---|---|---|---|
| **Role roadmaps** | Bharat ke career raaste: SDE (product), SDE (service companies: TCS/Infosys jaisi), Frontend, Backend (Node / Java Spring / Python), Full-stack (MERN, Java), Data Analyst, Data Engineer, ML Engineer, AI Engineer (LLM apps), DevOps/Cloud, Android, Cyber Security, QA/SDET | Sab | Sab |
| **Skill roadmaps** | DSA, CP, System design, DBMS/OS/CN, SQL, Git, Linux, Docker, Kubernetes, AWS, har language, React, Node, Spring Boot, prompt engineering | Sab | Sab |
| **Har topic (node) par** | Hamara lesson + problems + quiz + Build Lab project (jahan ho) + bahar ke free links; progress (done / seekh raha / skip); **node ka Pramaan** (quiz/viva pass karke) | Haan | Haan |
| **Custom roadmap** | Drag-drop editor se apna roadmap; share link; teacher class ko de (Campus); company job ke liye "taiyaari ka roadmap" de (Hire) | 3 | **100** |
| **AI roadmap** | Goal + samay + abhi ka level → AI roadmap banata hai, hamare content se jud kar; phir aap badal sakte hain | 1/mahina | 100 tak (custom ke andar) |
| **AI tutor (Sahayak)** | Har topic, problem, lesson par: doubt, hint, review; hamare content se jawab, sources ke saath | Roz ki seema | **Unlimited (fair use)** |
| **AI courses aur guides** | Kisi bhi topic par: modules → lessons (maangne par banta hai), quiz, revision card; ek jaisa topic do log maangein to ek hi course (sasta, aur review ho sakta hai). Label: "AI ka banaya" ya "Expert ne jaancha" | 2/mahina | **Unlimited (fair use)** |
| **Quizzes** | Kisi bhi lesson, roadmap node ya topic par; hamare bank (5,000 aptitude + MCQ) se, ya AI se jo do model se jaanche gaye | Roz ki seema | **Unlimited** |
| **Expert-written premium content** | Insaan ke jaanche A2Z editorials ke gehre hisse, LLD/HLD case studies, company-pattern mocks | Bada hissa free (TUF jaisa) | Sab |
| **Chat history** | Sahayak ki baatein | 180 din (abhi ka niyam ✅) | **Jab tak account hai** (owner, 19 Oct 2026); export/delete kabhi bhi |
| **Naye features pehle** | Feature flags me "Plus beta" group | — | Haan |
| **Projects** | Har roadmap ke projects **Build Labs** me: live environment, apne aap jaanch ([LEARN-BUILD-LABS.md](LEARN-BUILD-LABS.md)) | Kuch | Sab |

**roadmap.sh se behtar kya:** (1) roadmap sirf padhne ki list nahi: har node par **practice, judge aur labs** jo
apne aap jaanchte hain; (2) **node ka Pramaan**, jo recruiter verify kar sake; (3) Hindi/Hinglish; (4) Bharat ke career
raaste (service vs product companies, campus placement); (5) college aur company roadmap assign kar sakte hain;
(6) roadmap seedha Hire ki job tak.

**"Unlimited" ka imaandar matlab:** AI har message par paisa leta hai. Plus me **fair use**: roz ~200 Sahayak messages
tak poori speed, uske baad bhi chalega par sasta model ya thoda dheema; ye pricing page par saaf likha. Kharch: ek bhaari
Plus user (100 message/din × ~₹0.04) ≈ ₹120/mahina; Plus ka daam ₹199–399 isse upar.

**AI course ka tareeka:** topic → outline (Opus/Sonnet, ek baar) → lesson tab bane jab koi khole (Haiku 5.5, cache) →
hamare content aur official docs se jod (galat tathya kam) → quiz (do model se jaancha) → bahut log padhein to
reviewer ki queue → "Expert ne jaancha" label. Har AI course par "galti batao".

**Admin me:** roadmap editor (graph, nodes, content se jod), AI courses ki queue (popular → review), fair-use ki seema,
abuse dekhna.

---

## 5. Compiler aur judge

Poora detail (CPU, kharch, scaling) [LEARN-LAUNCH-PLAN.md](LEARN-LAUNCH-PLAN.md) §4 me. 5,000 problems aur CP ke
liye aur kya:

| Kya | Kyun | Haalat |
|---|---|---|
| In-house gVisor runner (primary) + Judge0 (doosra) | Apne server par, per-submission paisa nahi | ✅ code, staging baaki |
| Queue API se bahar (Postgres `SKIP LOCKED`) + alag worker machines + autoscale | Kai API processes, bheed | ⬜ |
| Problem package import (tests S3 se, hash, worker par cache) | Bade test sets | ⬜ |
| `testlib.h` validators/checkers/generators | CP ka standard | ⬜ |
| **Interactive judge** (do process, pipe) | CP interactive problems | ⬜ |
| Bhashayein: C, C++17/20, Java 21, Python 3.12, **PyPy 3**, JS ✅/⬜; Go, Kotlin, Rust, C#, TypeScript | CP aur interview | Pehle 6 ✅ (PyPy ⬜) |
| Function-style (LeetCode jaisa) + stdin (CP jaisa) | Dono tarah ke problems | ✅ |
| Stress-test service (§4 #1) aur complexity analyzer (§4 #2) | Behtar feedback | ⬜ |
| Code similarity (plagiarism) | Contests | ✅ |
| Compile cache, C++ precompiled header, ek process me saare test | CPU bachana | ⬜ |
| Contest se pehle scheduled scaling | p95 < 5 s | ⬜ |

---

## 6. Admin panel (poora)

Console (`packages/console`) me pehle se: staff, roles, 2FA (TOTP), audit log, Practice → Tracks/Problems/Lessons,
Plus, Campus cohorts, Sahayak usage aur evals, contests, code similarity. **Learn v2 ke liye:**

| Module | Kya | Kaun |
|---|---|---|
| **Roles v2** | Super admin, content admin, editor, reviewer, support, finance, moderator; har ek ki alag permission; admin ke liye 2FA zaroori + IP allowlist | Super admin |
| **Content CMS** | Problem package editor (statement, tests, validator, checker, solutions), editorial editor (template ke sections, preview, visuals), lessons, MCQ/aptitude, sheets/paths, mocks | Editor |
| **Review workflow** | Draft → machine checks (hare/laal) → review → publish; diff view, comments, versions, rollback | Reviewer |
| **Factory control room** | Batches, kitna bana, kya fail hua aur kyun, API kharch, dobara chalao | Content admin |
| **Media library** | Images/visuals, video upload (phase 2), DRM status | Editor |
| **Users aur support** | Khojo, plan, ban, refund, data export/delete (DPDP), support tickets, "galti batao" reports | Support |
| **Billing** | Plus, coupons, campus licence ✅, refunds ✅, GST invoice ✅ | Finance |
| **Contests** | Banana, schedule, scaling, plagiarism review ✅, rating | Content admin |
| **Community** | Discussions, experiences, reports, moderation | Moderator |
| **AI** | Usage aur kharch ✅, evals ✅, prompt versions, kill switch, roz ki seema | Super admin |
| **Analytics** | Funnel, retention, har problem ka acceptance, editorial "kaam aaya?", drop-off, search jo kuch nahi mila | Sab |
| **Notifications** | Email/WhatsApp/push campaigns, templates | Content admin |
| **System health** | Judge queue, p95, errors, feature flags | Super admin |

---

## 7. Architecture (scalable aur secure)

```
               Learners (web, PWA, Android app)          Admin (console)
                         │                                    │
                 Vercel CDN (static, prerendered public pages, WAF)
                         │
                 API (Fastify, stateless, 2+ machines, autoscale)  ── Sahayak (AI gateway: Claude, adapter, cache, seema)
                    │          │            │             │
        Postgres (Supabase,  Redis*      S3 (tests,     Outbox ✅ → email, WhatsApp, push
        RLS ✅, replicas)  (rate limit,  images, video)
                    │       leaderboard)     │
          judge_jobs (queue) ──▶ Judge workers (gVisor) / Judge0 VM — network band
                                             │
                             Video (phase 2): provider (DRM) → CDN → player
        Search: Postgres FTS + pgvector · Analytics: PostHog · Errors: Sentry · Logs/metrics: OpenTelemetry
```
\* Redis padaav B (20k DAU) se; tab tak Postgres.

**Performance:** public pages (problem, lesson, landing) **prerender** (SEO + tez); editor aur visual player lazy-load;
editorial aur visuals versioned URLs par hamesha cache; SVG visuals (halke); fonts subset aur bundled. Seema: LCP < 2 s
(4G, beech ka Android), landing JS < 150 KB gzip. Abhi web Vite + React 19 SPA hai; public pages ke liye prerender
jodna padega.

**Database:** submissions mahine ke hisaab se partition; content tables versioned; read-heavy (problems, lessons)
replica + cache.

**Security (OWASP ASVS level 2 ka lakshya):**
- Auth ✅ (sessions, Google sign-in, email verification), staff 2FA ✅; admin ke liye IP allowlist + chhota session.
- RLS ✅, har query org/learner ke hisaab se.
- Rate limit (per user, per IP), signup par bot rok (Cloudflare Turnstile), content scraping par seema aur pehchaan.
- CSP, security headers, WAF; dependencies aur secrets ka scan CI me ✅ (CodeQL).
- Judge: gVisor/isolate, alag VM, network band, metadata band ✅.
- Payment webhook signature ✅; secrets Secrets Manager me ✅.
- Backups + point-in-time restore; restore ki rehearsal.
- DPDP: consent, data export/delete, grievance officer, **18 se kam umar par parental consent** (ya 18+ signup).
- Launch se pehle bahar ka **pen test**.

**Scale ke numbers** (2k / 20k / 1 lakh roz ke learners) aur mahine ka kharch: [LEARN-LAUNCH-PLAN.md](LEARN-LAUNCH-PLAN.md)
§5.

---

## 8. Video aur DRM (phase 2)

**Plan:** launch text-only. Aap video record + edit karke admin panel se upload karte rahenge; har video apne lesson
ya problem se judega.

### 8a. Kya ho sakta hai, kya nahi (sachchai)

| Kya | Web (Chrome/Firefox, desktop) | Edge (Windows) / Safari (Mac) | Android app | iPhone |
|---|---|---|---|---|
| Video download | ❌ band (encrypted, koi file nahi) | ❌ band | ❌ band | ❌ band |
| Screen recording me video | **Dikh sakta hai** (Widevine L3, software) | Aksar **kaala** (hardware DRM) | **Kaala** (Widevine L1 + `FLAG_SECURE`) | **Kaala** (FairPlay) |
| Screenshot (text pages) | **Rok nahi sakte** | Rok nahi sakte | **Band** (`FLAG_SECURE`) | Rok nahi sakte; recording pakad kar blur |
| Phone ke camera se | Koi nahi rok sakta | — | — | — |

### 8b. Isliye hum kya banayenge

1. **Encrypted streaming:** HLS/DASH, multi-DRM (Widevine, FairPlay, PlayReady), chhote samay ke signed links, koi
   MP4 nahi.
2. **License sirf hamari ijaazat se:** hamara API har play par token deta hai (login, plan, device ki ginti); ek
   account par 2 device, ek waqt me 1 stream.
3. **Chalta watermark:** learner ka naam/phone/ID aur samay, video par ghoomta hua; leak hua to pata chalega kisne kiya.
   Text pages par halka watermark.
4. **HD sirf hardware DRM par** (app, Edge, Safari); desktop Chrome par SD + watermark (Netflix jaisa niyam).
5. **Android app** (Capacitor + native video player): `FLAG_SECURE` se poore app me screenshot/recording band.
   **iPhone:** recording pakad kar video blur.
6. **Text ki suraksha:** scraping par rate limit aur pehchaan, ToS me saaf niyam, leak par takedown. Copy-paste
   band karna accessibility todta hai, isliye sirf premium editorial ke code par (free me nahi).

### 8c. Banayein ya khareedein

DRM ka license server khud nahi bana sakte: Widevine (Google) aur FairPlay (Apple) sirf manzoor companies ko milte
hain. Isliye **DRM provider** lenge, aur baaki sab hum banayenge (upload, player, token, watermark, device limit,
analytics), ek `VideoProvider` adapter ke peeche taaki provider badal sakein.

| Provider | Kya | Note |
|---|---|---|
| **VdoCipher** (Bharat) | DRM + chalta watermark + hosting | Edtech me aam; daam bandwidth ke hisaab se (unki site par $199/saal se, pakka karein) |
| Bunny Stream | Hosting + Widevine/FairPlay | Sasti bandwidth |
| AWS MediaConvert + MediaPackage + DRM partner (SPEKE) | Sab apne control me | Zyaada kaam |

**Sujhav:** pehle VdoCipher (watermark aur Bharat ka support pehle se), adapter ke saath.

---

## 9. UI (poora design)

Brand [DESIGN.md](DESIGN.md) par: प mark, ink-indigo + saffron, dark aur light, Noto fonts, WCAG AA. Learn v2 me:

- **Dark-first, premium:** glow, glass surface, gol pills, saaf typography; sab tokens me.
- **Mascot "Sahayak"** (illustrator se), 6 pose.
- **Pages:** Landing, Pricing, Onboarding/roadmap, Home, Subjects, Sheet, Problems bank, Problem workspace, Editorial
  (tabs + visual player), CP page, Aptitude topic / practice (palette) / mock (timer) / analysis, Lesson reader, SQL
  workspace, Contest (brief, live, scoreboard, upsolve), Mock interview, Workspace (code, lists, notes, mistake
  notebook), Profile/portfolio, Certificate verify, Settings, Plus checkout, Help.
- **Admin:** console ke kit par (§6).
- **Process:** har bade page ka mockup pehle (aap manzoor karein), phir code; Playwright screenshots 1440 aur 390 par,
  light/dark; visual regression CI me ✅.
- **Gunvatta:** LCP < 2 s, axe 0 errors dono theme me, phone par 390 px, keyboard se sab.

---

## 10. Test aur launch (aapke liye saaf)

| Kadam | Kahan | Kaun | Kya hota hai |
|---|---|---|---|
| 1. Unit + integration tests | Har commit, CI | Claude | `npm run check`: har function aur API |
| 2. E2E (browser) | CI | Claude | Playwright: signup → problem → submit → editorial → aptitude mock → contest → Plus |
| 3. Visual + accessibility | CI | Claude | Har page ka screenshot match, axe |
| 4. Staging | Asli servers, nakli payment | Claude + aap | Aap 25 flows ki checklist se clicks karte hain (main banaunga) |
| 5. Load + security | Staging | Claude | 20k DAU ka din, 2,000 ka contest; ZAP scan; bahar ka pen test |
| 6. Private beta | Production, 300–500 students | Aap + college | 2 hafte; crash-free 99.5%, "galti batao" ki report |
| 7. Public launch | Production | Sab | Monitoring, on-call, rollback ka tareeka |

**Launch ke baad ke vaade (SLO):** API 99.9% uptime, page p95 < 2 s, verdict p95 < 5 s, AI hint p95 < 6 s.

---

## 11. Timeline

Ek account, har slice naya session. Slices ki poori list [LEARN-HANDOFF.md](LEARN-HANDOFF.md) §4 me (~55 build
slices + content batches).

| Hafta | Phase | Kya |
|---|---|---|
| 0–1 | **0: Neev** | Aapka [OWNER-SETUP.md](OWNER-SETUP.md); mockups ki manzoori; sample-first (§3g) |
| 1–4 | **1: Factory aur judge** | Problem package, CMS + review, visual renderer, factory (DSA, aptitude, lessons), judge queue/workers/testlib/PyPy, design v2, Learn shell, landing |
| 3–9 | **2: MVP** | Onboarding/roadmap, home, workspace + editorial v2, aptitude module, lessons reader, SQL v2, profile, workspace page, contests v2, search; behtar features 1–4; admin modules; content raat ko |
| **8** | **Private beta** | Text-only, launch wala content (§3a) |
| 9–11 | **Readiness** | Load, pen test, DPDP, SEO, beta fixes → **public launch (hafta 10–11)** |
| 11–20 | **3: Poora** | Bank 5,000, aptitude 5,000, LLD/HLD/patterns, languages, CP math + interactive; features 5–18; Android app |
| 13–20 | **4: Video + DRM** | Upload pipeline, DRM player, watermark, device limit, app me `FLAG_SECURE`; aap upload karte rahein |

**Subscription par:** ~55 slices + content chalana ≈ **$200 plan par 3–4 mahine** (ek account), do accounts se
~2–2.5 mahine.

---

## 12. Kharch

| Ek-baari | Kam | Zyaada |
|---|---|---|
| Claude subscription (3–4 mahine) | $600 | $800 |
| Content API (§3h) | $2,500 | $4,500 |
| Insaan review (~900 ghante) | ₹0 (aap/TAs) | ₹8 lakh |
| Infra launch tak | $500 | $1,000 |
| Mascot/illustrations | ₹30k | ₹1 lakh |
| Pen test (bahar) | ₹0 | ₹3 lakh |
| Apple developer ($99/saal), Google Play ($25 ek baar) | $124 | $124 |
| DRM provider shuru | $200 | $1,500 |
| **Kul** | **~₹3.7 lakh** | **~₹19 lakh** |

**Mahine ka:** [LEARN-LAUNCH-PLAN.md](LEARN-LAUNCH-PLAN.md) §5c (2k DAU par ₹31–60k, 20k par ₹1.5–2.5 lakh, 1 lakh
par ₹6.6–12 lakh) + video bandwidth (phase 2).

---

## 13. Aapse kya chahiye

| # | Kya | Kab |
|---|---|---|
| 1 | ✅ Editorial style mili; kitaab owner ki apni (19 Oct): text bhi platform par ("Kaise padhein" course + 7 problems) | — |
| 2 | 10 sample editorials + 10 aptitude + 2 lessons ki manzoori (§3g) | Hafta 1 |
| 3 | Bade pages ke mockups ki manzoori | Hafta 1–2 |
| 4 | [OWNER-SETUP.md](OWNER-SETUP.md): GitHub billing, domain, Vercel/Supabase Pro, AWS, **Anthropic API key** (factory ke liye), Razorpay | Hafta 0–1 |
| 5 | Reviewer: aap, college TAs, ya part-time (~900 ghante) | Hafta 2 se |
| 6 | Mascot illustrator ka budget | Hafta 1 |
| 7 | Plus ka daam aur free ki seema | Hafta 6 |
| 8 | Beta ke 1–2 college | Hafta 6 |
| 9 | Phase 2: DRM provider account (KYC), Apple/Google developer accounts, video recording ka schedule | Hafta 10 |
| 10 | ✅ Plus me chat history jab tak account hai (19 Oct); privacy notice me likhna | — |
| 11 | ✅ Fair use: 200 message/din poori speed (19 Oct) | — |

---

## 14. Khatre

| Khatra | Bachaav |
|---|---|
| 5,000 me galtiyan | Machine jaanch har item par, review, "galti batao", version, galti ki dar ka dashboard |
| Copyright (LeetCode/CF/TUF jaisa text) | Apna statement, tests, editorial; duplicate aur web spot-check; purane import ki originality jaanch |
| AI jaisa lagna | Style guide, critic, insaan ka edit, A2Z 100% review |
| Review rukaavat ban jaaye | Pehle A2Z, phir bank; reviewers jaldi tay karein |
| DRM se zyaada ummeed | §8a ki sachchai; watermark + app |
| Scope bahut bada | Launch scope (§3a) pakka; baaki phase 3 |
| Limit/accounts | Har slice naya session, handoff, do accounts |
| CI band (billing) | Pehla kaam |

## 15. Sources (DRM research, 19 Oct 2026)

- [BuyDRM: Widevine aur screen capture (Android)](https://go.buydrm.com/thedrmblog/managing-widevine-drm-for-preventing-screen-capture-and-recording-on-android-devices)
- [Bunny: Widevine security levels](https://bunny.net/docs/stream/widevine-security-levels)
- [Axinom: DRM protection and screen recording](https://102.docs.axinom.com/services/drm/technical-articles/drm-protection-and-screen-recording/)
- [Gumlet: screen recording protection compared](https://www.gumlet.com/learn/video-hosting-screen-recording-protection-compared/)
- [VdoCipher pricing (blog)](https://www.vdocipher.com/blog/tag/vdocipher-pricing), [GetApp: VdoCipher](https://www.getapp.com/all-software/a/vdocipher)
- [roadmap.sh premium](https://roadmap.sh/premium), [developer-roadmap repo](https://github.com/nilbuild/developer-roadmap) aur uski `license` file (19 Oct 2026)
- Baaki (judge, GPU, model, server): [LEARN-LAUNCH-PLAN.md](LEARN-LAUNCH-PLAN.md) §12.
