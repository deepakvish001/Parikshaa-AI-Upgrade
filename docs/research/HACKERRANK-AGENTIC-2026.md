# HackerRank ka naya rukh: "Hire for the agentic era" (owner ne 24 Oct 2026 ko diya)

Owner ne ye input diya aur kaha: "pehle itna samajh kar yaad rakho, phir aur deta hoon, phir plan karte hain". Isliye
ye sirf **samajh ka note** hai, plan nahi. Plan owner ka baaki input aane ke baad banega (tab tracker "Plan" me row).

Sources: owner ka chipkaya hua hackerrank.com homepage ka text aur 5 screenshots (chat me). Link
(`hackerrank.com/writing/why-were-sorry`) is session se nahi khula: environment ki network policy `www.hackerrank.com`
rokti hai. Neeche sab apne shabdon me hai; unka text, design ya branding copy nahi karna (wahi niyam jo TUF/LeetCode
ke liye hai).

## 1. Unka kehna kya hai (seedhi baat)

- **Maafi wala post** ("See why we're sorry"): owner ke mutabiq HackerRank ne maana ki LeetCode jaise puzzle ratwaane
  wali hiring galat thi; ye khabar me bhi aaya. (Post khud nahi padh paaye; owner ke shabdon par.)
- **Naya daava:** developer ab "code nahi likhta", agents ko chalata hai: **plan → build → review, AI ke saath**. Isliye
  hiring me puzzle nahi, **asli kaam** jaanchna hai: engineering ki buniyaad + **AI fluency** + achhi samajh ("taste").
- Tagline jaisa: "Tech hiring ~~is changing~~ has changed".

## 2. Unke products (jo dikhaye gaye)

1. **Chakra (screening):** ek **agentic interviewer**. Asli duniya ka problem ek canvas par kholta hai, candidate kaise
   kaam karta hai dekhta hai (screenshot me "Listening..." yaani awaaz bhi), aur judgment, critical thinking, AI fluency
   jaanchta hai.
2. **Interview (pair programming):** interviewer aur candidate ek hi canvas par ek asli kaam par. Screenshot 1:
   - IDE ke tabs: **Editor, Diff, Browser, Terminal**; explorer me asli repo (`backend/` jest config, `frontend/`,
     `tickets/`, `README.md`, `setup.sh`, `PLAN.md` banana).
   - Sawaal: "Shipway Support Queue (MERN)": ek maujooda app me kai bug **tickets** ke roop me. Candidate ki zimmedari:
     har ticket ke liye "fixed" ka matlab tay karna, scope me kya/bahar kya, purane codebase me surakshit badlav,
     apne criteria par jaanch.
   - **Code se pehle `PLAN.md`:** samajh, high-level approach, step-by-step plan, **acceptance criteria** (dikhne wale,
     test ho sakne wale), risks/tradeoffs/assumptions.
   - Baayein ek **AI chat** ("New session"): **Plan mode**, `@file` mention, `/commands`, file attach, aur **model
     chunna** (screenshot 3: kai GPT aur Claude model). Yaani candidate apni pasand ka AI model le sakta hai.
3. **AI Add-on, Screen (purane tests), Certified Assessments, Plagiarism Detection, Real-World Questions, Integrations,
   MCP** footer me.

## 3. Wo jaanchte kaise hain (report, screenshot 4)

- Upar teen card: **Score** (400/575, 69.5%), **Benchmark** (72nd percentile), **Integrity Issues** ("No Issues
  Detected").
- **Performance Summary** aur **AI Fluency** (grade A–F jaisa, yahan C), teen hisse, har ek ka grade + ek line + signals:
  - **Context Quality:** prompt me technical context diya ya nahi ("Vague prompt, no technical context", transcript
    ke time +0:42 ke saath).
  - **Critical thinking:** AI ke output ko parkha ya nahi ("No evaluation of AI-generated outputs").
  - **Collaboration:** AI ke saath aage-peeche baat ki ya nahi ("No follow-up prompts after AI response").
  - Har hisse me "See all 6 signals": har signal **saboot se juda** (transcript + timestamp).
- Overall (homepage): "weighted across 4 sections, 9 competencies", jaise AI fluency 4, troubleshooting 3.5, APIs 3.5,
  hands-on coding 3.5, kul 3.6/5.
- **Interviewer scorecard (screenshot 5):** competency (jaise System Design) par 5 star + Yes/No, notes ka editor, aur
  AI ka likha suggestion "**Accept suggestion?**" (✗ / ✓): AI draft deta hai, insaan maanta ya hatata hai.

## 4. Unke chaar vaade (homepage)

1. Asli kaam, puzzle nahi (asli repo jaisa codebase).
2. AI fluency, sirf sahi jawab nahi (candidate AI ko kaise frame, judge aur steer karta hai).
3. AI ko apnao, par integrity bani rahe.
4. Saaf, samjhaane layak nateeje: har score rubric se, saboot se juda, bias ke liye audit (race, ethnicity, gender),
   EEOC compliance ke liye controls.

Aur: 3 crore+ developers ki community; customers ko "AI-fluent builders" ke database se seedhe hire karne ki pahunch.

## 5. Hamare paas pehle se kya hai (repo se, sirf mapping; koi faisla nahi)

| Unka hissa | Hamare paas | Kahan |
|---|---|---|
| AI-allowed test, AI fluency | AI-allowed tests ka zikr, viva se authorship ka saboot | MASTER-PLAN (competitors), LAUNCH-PLAN |
| Chakra (agentic interviewer) | AI interviewer (chat + code) 🟡: 2 Oct ko bana (har jawab par follow-up, transcript hash chain me); awaaz baad me | tracker row 86 (F1c), `HIRE-V2.md` |
| Pair interview IDE | Live interviews + panel; Learn me VS Code jaisa Studio (mock) | `HIRE-V2.md`, `learn/mock-v3` Studio |
| Integrity signals | Proctoring v2, code playback, bada paste (`code_large_paste`), AI interview ke paste/away/fast signals; sab `warn`, insaan faisla kare | `HIRE-V2.md` P8, F19 |
| Saboot se jude nateeje | Ledger (hash chain), candidate receipt, report v2 | MASTER-PLAN, `HIRE-V2.md` |
| Learn me AI ke saath kaam | Sahayak (hint deta hai, poora hal nahi), Studio me quick fix + diff, AI mock interview (mock) | `learn/DESIGN-SYSTEM.md`, mock v4.x |

## 6. Khule sawaal (plan ke waqt owner se)

- Ye input **Hire** ke liye hai, **Learn** ke liye, ya dono? (Abhi priority Learn hai; Hire ruka hai.)
- Learn me "AI fluency" sikhana/naapna (prompt me context, AI ka output parakhna, follow-up) chahiye?
- Puzzle (DSA) practice ka kya: Bharat me campus placement abhi bhi DSA/aptitude par chalta hai, to dono saath?
- Asli-repo wale tasks (tickets, PLAN.md, tests) hamare Studio/Build me aayein?
- Candidate apna AI model chune: hamare kharch aur niyam (Sahayak ki seema) se kaise mile?

Owner ka agla input aane par yahi file badhegi; plan tab bane.
