# AI ke daur me tech learning aur hiring: research aur Parikshaa ka plan (24 Oct 2026)

**Owner ne kya maanga (24 Oct 2026):** HackerRank ka "Sorry, we made you grind LeetCode" post aur Chakra ke
screenshots dekar kaha: "ise samajh kar batao future me learning aur hiring ke platform kaise rahenge; news aur X par
sab padho, deep research karo, phir plan banao ki hamare platform me kya add aur kya remove karna hoga."
Pehla input: [HACKERRANK-AGENTIC-2026.md](HACKERRANK-AGENTIC-2026.md).

**Ye kya hai:** research ka saar (sources ke saath) + **plan ka prastaav**. Kuch bhi bana nahi; har bada badlav owner
ki haan ke baad (§7). Learn abhi priority hai, Hire ruka hai (`CLAUDE.md`), isliye Hire wale hisse sirf plan hain.

**Imaandari:** kai figures vendor blogs ya company ke apne daave hain (HackerRank, Fabric, Greenhouse, CoderPad).
Unhe "daava" likha hai. Bharat ke placement numbers aapas me milte nahi. `hackerrank.com`, `techcrunch.com` aur
`news.ycombinator.com` is environment se nahi khule; unki baatein search ke saar aur owner ke chipkaye text se hain.

---

## 1. Ek line me

**Hiring "kya tum puzzle hal kar sakte ho" se "kya tum AI ke saath asli kaam kar sakte ho, aur samjha sakte ho kyun"
par ja rahi hai; par buniyaad (DSA, CS core) khatam nahi hui, uska wazan kam hua hai.** Jo platform dono sikhaye aur
dono ka **saboot** de, wahi jeetega.

## 2. Kya badal raha hai (research)

### 2a. HackerRank ka palatna

- **Maafi:** CEO Vivek Ravisankar ka post "Sorry, we made you grind LeetCode"; line San Francisco me billboards par.
  Post kehta hai: HackerRank ne algorithm interviews ko "normal" banaya; AI ne kaam badal diya; ab teen badlav:
  **Tasks** (algorithm → asli code repo), **Evaluation** (sahi output → AI fluency aur judgment), **Candidate
  experience** (IDE → agentic environment). Saath me: "algorithm sawaalon ki keemat hai, par unka wazan galat tha."
- **Chakra (AI-led screen):** 5 Oct 2026 ko sabke liye khula, ~6 mahine beta aur 500,000+ interviews ke baad
  (company ka daava); Snowflake, Capgemini jaise customers. Candidate ko asli problem + AI tools; phir Chakra poochta
  hai "ye tareeka kyun? kya badloge? AI ka code kaise jaancha?". Daava: cheating flags 70–80% kam, kyunki AI khula hai.
- **Interviews (human-led):** ek repo me pair programming; `PLAN.md` pehle; candidate model chunta hai.
- **Integrity:** "invisible" tools pakadna, webcam image + nazar (gaze) se bahar ki madad, bias audit, WCAG 2.1 AA.
- **Aalochana:** HN par ise "marketing pivot" kaha gaya (purana product bekaar ho raha tha). Aalochak kehte hain AI
  fluency grade ka koi swatantra saboot nahi ki wo naukri me achha kaam predict karta hai; candidate grade audit nahi
  kar sakta; jisne roz AI istemal nahi kiya wo peeche rahega; webcam/screen data se privacy ki chinta.
- **X par:** HackerRank ne khud likha "Leetcode is dead"; "LEETCODE IS DEAD" jaise viral posts; mazaak bhi ("HackerRank
  bhi to LeetCode jaisa hi hai"); beech ki raay: AI fluency tabhi kaam ki jab neeche algorithm ki samajh ho; ek podcast
  ke mutabiq LeetCode ka traffic ab bhi badh raha hai aur badi companies purana format saalon rakhengi.

### 2b. Badi companies

- **Meta:** Oct 2025 se do me se ek coding round **AI-assisted** (CoderPad me multi-file codebase + AI chat, model
  chun sakte ho); doosra round **bina AI**. Jaanch: problem solving, code quality, verification, communication.
- **Canva:** June 2025 se backend/frontend/ML candidates se Copilot, Cursor, Claude jaise tools ki ummeed; sawaal
  zyada "complex, ambiguous, realistic".
- **Google:** Gemini ke saath code-comprehension round ka pilot (reports alag-alag; pakka nahi).
- **Ulta rukh bhi:** Google, Cisco, McKinsey **in-person rounds** wapas la rahe (cheating ki wajah se; reports, official
  nahi).
- **Bazaar bata hua:** CoderPad ke mutabiq 34% hiring teams AI band rakhti, 46% shart ke saath allow. Karat survey:
  71% engineering leaders kehte AI ki wajah se skill jaanchna mushkil hua; live format ki keemat badhi.

### 2c. Cheating ki daud

- **Cluely** (Interview Coder ka agla roop; a16z se $15M, June 2025): screen-share me na dikhne wala overlay, awaaz par
  bhi. Browser ko na tab switch dikhta, na clipboard. Ek vendor (Fabric) ke 19,368 interviews me 38.5% par flag
  (vendor ka daava, false positive rate kisi ne nahi chhapa).
- **Seekh:** "Pakdo" se zyada kaam ka hai **sawaal aisa banana jahan rata hua jawab aur asli samajh alag dikhein**, aur
  phir "kyun" poochhna.

### 2d. Candidate ki taraf

- **Greenhouse (May 2026, 2,950 job seekers):** 63% ka AI interview hua; 38% ne AI interview ki wajah se process
  chhoda; 70% ko pehle saaf bataya nahi gaya; 57% chahte hain batana kanoon ho. Sabse bura: **AI se score hone wala
  recorded video, koi insaan nahi** (33%). Log AI ke khilaaf nahi, **behtar aur saaf AI** chahte hain.

### 2e. Seekhne par AI ka asar (sabse zaroori Learn ke liye)

- **Anthropic RCT (29 Jan 2026, 52 engineers, naya library):** AI wale group ka quiz ~17% kam (≈50% vs 67%), sabse
  bada fark **debugging** me. Jinhone AI se **samjha** (concept, "kyun") unka 65%+; jinhone **code likhwaya** unka <40%.
  Chhota study, ek ghante ka task.
- **METR (July 2025, 16 anubhavi devs):** AI ke saath 19% dheeme, jabki unhe laga 20% tez hue. METR ab ise "historical"
  kehta hai (naye tools par lagu nahi maan sakte).
- **Stack Overflow 2025:** 84% AI use karte/karenge; 46% uski sateekta par bharosa nahi karte (33% karte); 66% ki
  shikayat "almost right, but not quite".
- **Matlab:** AI se **seekhna** aur AI se **kaam karwana** alag hai. Learn me AI ko tutor rakhna (hint, sawaal) sahi
  hai; aur "AI ka galat output pakadna" khud ek hunar hai jo sikhana padega.

### 2f. Naukri ka bazaar (duniya aur Bharat)

- **Stanford "Canaries in the Coal Mine" (Brynjolfsson aur saathi):** AI-exposed kaam (jaise software) me 22–25 saal
  walon ki naukri ~13% (relative) ghati; anubhavi logon ki sthir. Firms naye log kam le rahi, salary nahi kaat rahi.
- **Bharat:** TCS ki fresher bharti pehle 40,000+ thi, is saal ~25,000 ka andaaza (ek report; doosri alag); TCS chahti
  80% naye log "AI-ready" hon. Indeed–Nasscom: "degree se zyada skill"; 50% employers ko skill mismatch. Nasscom 2026:
  early-career talent ka AI-native index 62. IITs: AI/ML roles badhe, salary sthir; data aapas me nahi milta.
- **Campus ka asli format ab bhi:** aptitude → coding → technical + HR interview. Ek blog ke mutabiq 2026 me FAANG
  AI-allowed, services companies AI band, GCCs mili-juli. **Bharat "do-raftaar" bazaar hai.**

### 2g. Kanoon aur bharosa

- **NYC Local Law 144:** automated hiring tool ka saalana swatantra bias audit + candidate ko suchna (lagu).
- **EU AI Act:** hiring wale AI "high-risk"; obligations ki tareekh Aug 2026 se Dec 2027 khiskne ki report (pakka karna).
- **Illinois HB 3773** 1 Jan 2026 se; **Colorado** 1 Jan 2027.
- **Bharat DPDP Rules 2025:** charanbaddh, aakhri charan ~13 May 2027 (notice, consent, bachchon ka data). 18 se kam
  umar walon ke liye verifiable parental consent; webcam/proctoring data par khaas dhyaan.

## 3. Future: learning aur hiring platform kaise honge (hamara andaaza, 2026–2029)

Ye research se nikla **andaaza** hai, tathya nahi.

1. **Hiring do parat ki:** (a) chhota **bina-AI buniyaad** check (proctored ya in-person), (b) **AI ke saath asli
   kaam** (repo, ticket) + "kyun" ke follow-up. DSA rahega, par 100% se ghat kar ek hissa.
2. **Score se zyada saboot:** transcript, replay, timestamps, verify hone wale certificate. "Black box cheating score"
   aur "black box AI fluency score" dono par sawaal uthenge; jo saboot dikhaye wahi tikega.
3. **Integrity ka tareeka badlega:** "AI pakdo" se "sawaal ka design + kyun poochho + pehchaan pakki karo". Invisible
   tools aur in-person rounds ki daud chalti rahegi.
4. **Junior ke liye naukri tang:** fresher ko dikhana hoga ki wo AI ke output ko **parakh** sakta hai, chhoti asli
   cheez **ship** kar sakta hai, aur samjha sakta hai. Portfolio + saboot ki keemat badhegi.
5. **Bharat do-raftaar rahega (2–3 saal):** mass recruiters (TCS NQT jaise) aptitude + coding par; GCC aur product
   companies AI-on rounds par. Jo platform sirf ek taraf khada hoga wo aadha bazaar khoyega.
6. **Learning platform:** AI tutor sab ke paas hoga, isliye fark ye banega: (a) AI jo **seekhne de** (jawab nahi,
   sawaal), (b) **AI ke saath kaam karna** khud ek subject, (c) har seekh ka **saboot**.
7. **Bharosa aur kanoon:** AI istemal ki suchna, insaan ka aakhri faisla, bias audit aur data ki seema "achha ho to"
   se "zaroori" banenge.

## 4. Parikshaa pehle se kahan sahi khada hai

| Bazaar ki disha | Hamare paas | Kahan |
|---|---|---|
| "Kyun" ke follow-up (Chakra jaisa) | **Micro-viva** (`packages/viva`): jawab ke baad AI ke sawaal, "samjha ya copy" | MASTER-PLAN, `packages/viva` |
| Saboot, score nahi | **Integrity ledger** (hash chain), candidate receipt, profile ka "saboot ka kaagaz" | MASTER-PLAN, mock v4.4 `#profile` |
| AI seekhne de, kaam na kare | **Sahayak:** Seekho mode me hint aur sawaal, poora hal nahi; test/Pramaan me band | `learn/DESIGN-SYSTEM.md` §8 |
| Asli kaam | **Build Labs** (milestone, Check, "samjhao" sawaal), Studio (VS Code jaisa, diff, quick fix) | `LEARN-BUILD-LABS.md`, `learn/CODE-STUDIO.md` |
| AI-on assessment | **M-B5 AI-allowed assessment** (plan: diya hua AI, har prompt ledger me) | MASTER-PLAN |
| AI interviewer | AI interviewer (chat + code) 🟡, AI mock interview (mock) | tracker row 86, `#interview` |
| Integrity signals jo faisla na karein | Paste, tab, playback, proxy; sab `warn`, insaan faisla kare | `HIRE-V2.md` |
| Bharat-first | Hindi/Hinglish, mass-recruiter mocks, aptitude, campus | LEARN-V2 §1, §4 |

**Matlab:** hamari neev (viva + ledger + hint-only AI) is badlav ke liye pehle se sahi hai. Kami hai: **AI ke saath
kaam karna sikhana aur naapna**, aur **repo/ticket wale asli tasks**.

## 5. Plan: kya jodna, kya badalna, kya hatana

### 5a. Jodna (Learn; priority)

| # | Kya | Kyun (research) | Kaise (mock → code) | Mehnat |
|---|---|---|---|---|
| **AE1** | **"AI ke saath kaam" track** (AI Fluency): context dena, plan likhna, AI ka diff padhna, galat output pakadna, test se jaanchna, kab AI **na** use karein, data/privacy ki seema | HackerRank, Meta, Canva yahi jaanchte; Anthropic study: tareeka hi seekh tay karta hai | Roadmap ke naye nodes + lessons + labs; har node ka Pramaan | M |
| **AE2** | **Ticket labs** (repo me asli kaam): chhota MERN / Spring / Python app, 3–5 bug tickets; learner pehle `PLAN.md` (samajh, scope, acceptance criteria, risk), phir AI ke saath fix, tests se jaanch, aakhir me "samjhao" viva | "Tasks: algorithm → real repos"; Meta ka multi-file round | Build Labs ka naya project type; check scripts + hidden tests; Studio me "Agent" panel | L |
| **AE3** | **"Galat AI pakdo" drills** (roz 5 min): AI ka likha code jisme chhupi galti; galti dhoondho, failing test likho, theek karo | Stack Overflow: 66% "almost right"; Anthropic: sabse bada nuksaan debugging me | Problem bank me naya type; judge test se jaanch | S–M |
| **AE4** | **Sahayak ki "AI istemal report"** (sirf learner ke liye): session ke baad context kaisa diya, AI ka output jaancha ya nahi, follow-up kiya ya nahi; har baat transcript ke time ke saath | Wahi teen hisse jo HackerRank grade karta (context, critical thinking, collaboration); practice me khud dekhna | Sahayak transcript par chhota rubric + eval set; "hiring score nahi" | M |
| **AE5** | **Mock interview v2: do roop**: (a) **bina AI** buniyaad (DSA/CS, 30 min), (b) **AI ke saath** ticket + "kyun" ke sawaal (micro-viva engine) | Hiring do parat ki (§3.1); Meta ka ek round AI-on, ek AI-off | `#interview` me format chunna; report me saboot + timestamps | M |
| **AE6** | **Code padhna aur samjhana drills**: anjaan code (200–400 line) do, sawaal poochho "ye kya karta, bug kahan, kya badloge" | Google ka code-comprehension round; agentic kaam me padhna > likhna | Lesson + MCQ + chhota likhit jawab (AI rubric, insaan sample) | S–M |
| **AE7** | **Readiness ke do hisse**: "Buniyaad (bina AI)" + "AI ke saath kaam"; company type ke hisaab se wazan (service: buniyaad zyada; GCC/product: dono) | Bharat do-raftaar (§3.5) | Readiness formula khula, `M-S16` skill graph me | S |
| **AE8** | **Profile ke kaagaz me nayi line**: "AI ke saath kaam" (ticket lab + viva se jaancha, kab) | Saboot > score (§3.2) | `ProofSheet` ki row; sirf jaancha hua | S |
| **AE9** | **Interview format guide** (company type ke hisaab se: kaunsa round AI-on/off, kya laayein); **sirf source ke saath** | Candidates ko pata hi nahi kya allowed (Greenhouse) | Companies page me hissa; har tathya ka link | S |

### 5b. Badalna

| # | Abhi | Badal kar | Kyun |
|---|---|---|---|
| **AC1** | Coding content: 5,000 problems, jisme **CP bank 2,000** (launch par 0) | A2Z 520 + interview bank rakho; **CP bank aage khiskao** (2027+), wo budget AE2/AE3/AE6 par | "Wazan galat tha"; CP sirf chhote hisse ke kaam ka |
| **AC2** | Editorial ke 5 hisse | Chune hue problems me chhota 6th hissa: **"AI ke saath ye problem"**: kaisa prompt diya, AI ne kya galat diya, kaise pakda | AI ko seekhne ka saathi, nakal ka nahi |
| **AC3** | Pramaan ek tarah ka | Do tier: **Pramaan Buniyaad** (bina AI, proctored) + **Pramaan AI-Saath** (ticket lab + viva) | Recruiter dono maangega |
| **AC4** | Leaderboard/streak "kitne solve" par | Sirf **viva-verified** solve gino (M-T2 pehle se plan); streak me seekhne wale kaam (revision, drill, lab step) bhi | Grind ko inaam dena band |
| **AC5** | Landing ki bhasha "LeetCode/TUF se behtar" | "AI ke daur ki taiyaari, saboot ke saath"; grind ki jagah buniyaad + AI ke saath kaam | Bazaar ki baat; kisi ka naam lekar copy nahi |
| **AC6** | Sahayak ke 2 mode (Seekho, Banao) | Seekho waisa hi (hint-only); **Banao/Agent** sirf labs me, aur har maani hui badlav par chhota "kyun" | Anthropic: delegation se seekh ghatti |

### 5c. Hatana / na banana

| # | Kya | Kyun |
|---|---|---|
| **AR1** | **AI se score hone wala recorded video interview, bina insaan** (na Learn me, na Hire me) | Candidates ka sabse bada gussa (Greenhouse 33%) |
| **AR2** | **"Cheating score" ya "AI fluency score" jo saboot na dikhaye** | Hamari neev saboot hai; bias aur kanoon ka jokhim |
| **AR3** | Learn practice me **har AI istemal ko cheating maanna** | Practice me AI seekhne ka saathi; band sirf contest, Pramaan, mock aur test me (abhi ka niyam) |
| **AR4** | **"Problems solved" ko profile ka sabse bada number** banana | Kaagaz (B roop) pehle se "kya jaancha" par; ginti chhoti rakho |
| **AR5** | Invisible tools (Cluely jaise) ko browser se pakadne ka **daava** | Browser se mumkin nahi; jhootha vaada nahi; sawaal ka design + viva + lab/in-person tier |

### 5d. Hire ke liye (abhi ruka; sirf plan, owner ke "Hire shuru" ke baad)

| # | Kya | Note |
|---|---|---|
| **AH1** | **AI-on assessment** (M-B5 ko aage): repo/ticket task, diya hua AI (hamare provider), har prompt ledger me, rubric ke 3 hisse (context, jaanch, saath kaam) har ek ke saath transcript ka saboot | Faisla hamesha insaan |
| **AH2** | **Do hisse wala screen:** 20–30 min bina-AI buniyaad + 45–60 min AI-on task + viva | Service companies sirf pehla hissa le sakti hain |
| **AH3** | **Candidate ko suchna screen:** "AI kya jaanchega, kya record hoga, faisla kaun karega"; opt-out ka raasta jahan kanoon maange | Greenhouse 70% ko bataya nahi gaya; NYC LL144; DPDP |
| **AH4** | **Interviewer scorecard me AI ka sujhaav**, insaan maane ya hataye (HackerRank jaisa "Accept suggestion?") | AI sirf draft |
| **AH5** | **Bias audit export** (selection rate, group-war, jahan data mile) | Bahar ke clients ke liye kanoon |

## 6. Kram (Learn ke chal rahe kaam ke saath)

1. **Abhi (docs):** ye plan + owner ke faisle (§7). Mock v4.4 (row 136) chalta rahe.
2. **Mock me (v4.4 ka kadam 44-4 "owner ke chune feature screens" me, ya alag v4.5):** AE1 track page, AE2 ticket lab
   (Studio me PLAN.md + Agent panel + tests), AE3 drill, AE4 report, AE5 interview ke do roop, AE7 readiness, AE8 kaagaz
   ki row. Pehle mock, owner ki haan, phir code (`learn/DESIGN-SYSTEM.md` §11).
3. **Sample-first content:** 2 ticket labs (MERN, Python), 20 "galat AI pakdo" drills, 5 code-padhna sets; owner manzoor
   kare (LEARN-V2 §3g jaisa gate).
4. **Code:** F1 "shuru karo" ke baad, Learn ke phase P0 ke baad; AE4/AE5 ke liye eval set pehle (MASTER-PLAN M-A2).
5. **Hire:** AH1–AH5 tab, jab owner Hire ko dobara shuru kare.

## 7. Owner se faisle

**24 Oct 2026, owner: "haa sab sujhaav theek hai, AE2 AE3 AE5 mock me banao"**, aur AE1–AE9 Learn me jodo. Isliye 1, 2, 3, 6: haan; 4: sasta model labs me, mehnga sirf viva/report me, labs ki ginti daam ke saath; 5: AE2 + AE3 + AE5 mock me. Faisle tracker "Faisle" me, features [../LEARN-V2.md](../LEARN-V2.md) §4c me.

1. **Disha:** "Buniyaad + AI ke saath kaam, dono ka saboot" ko Learn ki mukhya pehchaan banayein? (Sujhaav: haan.)
2. **CP bank 2,000** ko 2027+ khiskana (AC1)? (Sujhaav: haan; budget AE2/AE3/AE6 par.)
3. **Pramaan ke do tier** (AC3)? (Sujhaav: haan.)
4. **Labs me AI ka kharch:** ticket labs me AI agent har learner par mehnga; Free me kitne lab, Plus me kitne? Model kaunsa
   (sasta model labs me, mehnga sirf viva/report me)?
5. **Kaunse AE mock me pehle:** sujhaav AE2 + AE3 + AE5 (sabse alag dikhne wale), phir AE1, AE4, AE7, AE8.
6. **Landing ki nayi bhasha** (AC5) theek?

## 8. Khatre

- **AI fluency naapna abhi kachcha:** koi swatantra saboot nahi ki ye naukri predict karta hai. Isliye Learn me sirf
  **seekhne ki report**, "hiring score" nahi; Hire me rubric + saboot + insaan.
- **Kharch:** agent wale labs AI tokens khaate; fair use aur sasta model zaroori (LEARN-V2 §4b ka niyam).
- **Bharat me pehunch:** sab ke paas laptop aur tez net nahi; ticket labs phone par mushkil. AE3/AE6 phone par chalein.
- **Bazaar palat sakta:** in-person aur bina-AI rounds bhi badh rahe; isliye buniyaad chhodni nahi (do-raftaar).
- **Data aur kanoon:** labs aur interview ke transcript, webcam: DPDP ke hisaab se suchna, consent, rakhne ki seema;
  18 se kam umar ke learners.

## 9. Sources

- HackerRank: [Sorry, we made you grind LeetCode](https://www.hackerrank.com/writing/why-were-sorry) (owner ne text
  chipkaya), [Chakra](https://www.hackerrank.com/chakra), [How Chakra works](https://www.hackerrank.com/blog/how-chakra-by-hackerrank-works/),
  [HackerRank on X](https://x.com/hackerrank/status/2020809406741696775)
- Launch coverage: [TechCrunch, 5 Oct 2026](https://techcrunch.com/2026/10/05/hackerranks-ai-interviewer-offers-a-glimpse-into-what-job-interviews-could-become/),
  [Dealroom](https://app.dealroom.co/news/feed/hackerrank-launches-chakra-ai-interviewer-after-500k-beta-tests),
  [Progressive Robot (risks)](https://www.progressiverobot.com/2026/10/06/hackerrank-chakra-ai-interviewer-future-of-job-interviews/),
  [Beri listing](https://www.beri.net/tools/hackerrank-chakra), [byteiota](https://byteiota.com/hackerrank-chakra-ai-interviewer/)
- Reactions: [Hacker News](https://news.ycombinator.com/item?id=50050762), [Dhanush N on X](https://x.com/Dhanush_Nehru/status/2109613694841721116),
  [Ekue Kpodar on X](https://x.com/ekpodar/status/2021769064356696360), [Medium](https://dhanushnehru.medium.com/hackerrank-just-apologized-on-billboards-for-making-us-grind-leetcode-861dc6049ab0),
  [Hashnode](https://arpittiwari.hashnode.dev/leetcode-is-dead-what-ai-actually-killed-and-what-it-didn-t),
  [Programming Podcast](https://open.spotify.com/episode/7ga0wm2h5CglKbGbmPhCaC)
- Companies: [Meta/Google AI-assisted rounds](https://www.refontelearning.com/blog/ai-assisted-coding-interviews-at-google-and-meta-in-2026),
  [Companies that allow AI](https://www.finalroundai.com/blog/companies-that-allow-ai-during-interviews),
  [In-person shift](https://redirecruit.com/tech-giants-shifting-back-to-in-person-interviews/),
  [CoderPad 2026 recap](https://coderpad.io/blog/product-updates/2026-product-recap/),
  [Karat survey](https://www.interviewquery.com/p/technical-interviews-2026-ai-shift)
- Cheating: [Fabric: Cluely aur Interview Coder](https://www.fabrichq.ai/blogs/interview-cheating-in-2026-the-rise-of-ai-tools-like-cluely-and-interview-coder),
  [Proctor360](https://proctor360.com/blog/ai-proctoring-online-hiring-exams)
- Candidates: [Greenhouse, May 2026](https://www.greenhouse.com/newsroom/63-of-job-seekers-have-faced-an-ai-interview-most-havent-had-a-good-one-yet),
  [Fortune](https://fortune.com/2026/05/04/4-in-10-job-candidates-bailed-hiring-rounds-required-ai-interview/)
- Learning: [Anthropic: AI assistance and coding skills](https://www.anthropic.com/news/AI-assistance-coding-skills),
  [InfoQ](https://infoq.com/news/2026/02/ai-coding-skill-formation/),
  [METR (eWeek)](https://eweek.com/news/news-ai-tools-slow-developer-productivity-study),
  [Stack Overflow 2025 (TechRepublic)](https://www.techrepublic.com/article/news-developer-trust-in-ai-declines/)
- Jobs: [Stanford study (LeadDev)](https://leaddev.com/hiring/young-devs-steepest-losses-exposed-roles-stanford-study-finds),
  [Nasscom AI-native talent](https://nasscom.in/knowledge-center/publications/state-ai-native-talent-india-decoding-readiness-early-career),
  [Indeed–Nasscom](https://www.cioandleader.com/top-skills-employers-prioritise-in-2026-as-ai-redefines-jobs-across-industries-indeed-nasscom-report/),
  [TCS AI hiring](https://www.careerindia.com/news/tcs-ai-hiring-2026-80-percent-new-jobs-require-ai-skills-get-selected-011-66979.html),
  [Indian IT fewer people](https://sarkari.finance/blogs/the-pyramid-is-collapsing-why-indian-it-is-making-more-money-with-fewer-people/),
  [IIT placements (Careers360)](https://news.careers360.com/iit-placements-2025-2026-delhi-madras-kanpur-roorkee-hyderabad-more-freshers-reject-ppo-btech-ai-jobs-india-salary-package-static),
  [Fresher playbook 2026](https://www.ownyourcareer.in/blog/freshers-final-year-india-2026-ownyourcareer-playbook-hardest-entry-level-market)
- Law: [AI hiring laws 2026–27](https://www.metaview.ai/resources/blog/ai-hiring-laws-2026-2027),
  [NYC LL144 / EU AI Act](https://resources.rework.com/libraries/ai-for-hr/ai-hiring-laws),
  [DPDP Rules (EY)](https://www.ey.com/en_in/insights/cybersecurity/transforming-data-privacy-digital-personal-data-protection-rules-2025),
  [DPDP phases (Mondaq)](https://www.mondaq.com/india/privacy-protection/1708314/update-indias-digital-personal-data-protection-framework-comes-into-effect)
