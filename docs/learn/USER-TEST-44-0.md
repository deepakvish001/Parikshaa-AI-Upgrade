# Learn mock v4.4: 30 minute ka user test (kadam 44-0, 24 Oct 2026)

**Ye kya hai:** Learn ke clickable mock (sirf design ka namoona; asli product, data ya AI nahi) par 30 minute ka
moderated test. Owner khud chalayega, bina UX researcher ke: Google Meet par (screen share) ya saath baith kar. Test
**chune hue roop** par hai: Aaj = A "Ek kaam", Profile = B "Saboot ka kaagaz" (owner, 24 Oct). Roop ki tulna aur
"kaunsa pasand" wale task hat gaye; har task ab poochhta hai **kya samjha, kahan atka**.
Kram: [../LEARN-HANDOFF.md](../LEARN-HANDOFF.md) §5, tracker rows 136–138.

- **Gate G1:** kaun log aayenge aur kab, ye owner tay karega. Test ki raay ke bina 44-2 shuru nahi hoga.
- **Aage kya:** jo dikkat mili, sirf wahi 44-2 me theek hogi ("sirf wahi, naya design nahi"); tareeka §11 me.
- **Ye test kya nahi batayega:** daam, log kharidenge ya nahi, ya kaunsa roop behtar hai. 5–8 logon se "kitne pratishat"
  wala nateeja mat nikaalo. Ye test dikkat dhoondhne ke liye hai, naapne ke liye nahi.

## 1. Maksad

| # | Hum kya jaanna chahte hain | Screens |
|---|---|---|
| R1 | Kya student bina madad ke samajh leta hai ki **abhi** kya karna hai, pichhli baar kya gadbad hui, aur kaam kahan se shuru kare? | `#aaj` |
| R2 | Kya student problem par Sahayak (teesra pane) dhoondh kar **sirf ishaara** le pata hai, aur samajhta hai ki Sahayak poora hal nahi dega? | `#problem` |
| R3 | AI ke saath kaam ke screens (drill, code padhna, ticket lab) ke kadam samajh aate hain? "line chuno → test → theek karo" aur "plan → agent → wajah → tests → viva": kahan rukte hain, aur phone par chalta hai ya nahi? | `#ai-drill`, `#code-read`, `#ticket-lab` |
| R4 | Bharosa aur privacy: kya student maanta hai ki AI istemal report aur practice interview **sirf uske liye** hain, aur "AI ke saath" wala interview cheating nahi hai? | `#interview`, `#ai-track`, `#ai-report` |
| R5 | Kya student ek company ke liye expiry wala link bana leta hai? Kya HR/TPO "kaise jaancha" aur "AI ke saath kaam" wali line samajhte hain aur un par bharosa karte hain? | `#profile` |
| R6 | Company page par readiness ke do hisse (buniyaad, AI ke saath) aur "Interview ka format" (source + tareekh ke saath) samajh aate hain? Kya TPO ise students ko bhejega? | `#companies`, `#company` |

## 2. Kaun

| Kaun | Kitne | Mix |
|---|---|---|
| Students (engineering, placement ki taiyari) | 5–8 | Kam se kam 3 tier-2/3 college se; kam se kam 2 Hindi-first; kam se kam 2 **phone** par; ladke aur ladkiyan dono; 3rd/final year; AI tools roz use karne wale aur kam use karne wale, dono |
| Company recruiter (campus hiring karta/karti ho) | 1 | Jo resume ya coding profile dekh kar shortlist karta ho |
| College TPO (Training & Placement Officer) | 1 | Jo students ko company ki jaankari aage bhejta ho |

**Sabki umar 18+;** kam ho to test nahi. Jo Parikshaa team me hai ya jisne ye mock pehle dekha hai, wo bhi nahi.

**Screener (students; 2 minute, phone par ya form se):**
1. Aapki umar 18 ya usse zyada hai? (Nahi → shukriya, yahin band)
2. Abhi kya padh rahe ho, kaunsa saal, college kis shahar me? (sirf mix ke liye; college ka naam notes me nahi jaayega)
3. Placement ki taiyari kaise karte ho? (coding websites, YouTube, coaching, college ki class, abhi shuru nahi ki)
4. Padhna aur baat karna kis bhasha me aasaan hai? (English / Hinglish / Hindi)
5. Test kis device par doge? (phone / laptop) Net kaisa rehta hai?
6. AI tools (chatbot, code assistant) kitna use karte ho? (roz / kabhi-kabhi / kabhi nahi)

**HR/TPO ke liye:** kaam (recruiter / TPO); saal me kitne freshers; shortlist ke liye kya dekhte ho (resume, profile, test).

**Shukriya (optional, chhota):** students ko ₹200–300 ka recharge ya voucher; HR/TPO ko mail aur nateeje ka chhota saar.
Pehle se tay ho, aur raay achhi ho ya buri, ek jaisa.

## 3. Taiyari (owner ki checklist)

- [ ] **G1:** log aur samay tay; har session ke beech 15 minute (notes poore karna + reset).
- [ ] **Preview link:** [../LEARN-HANDOFF.md](../LEARN-HANDOFF.md) §5 "Preview link", sabse naya Version (AE6 + AE9 ke
  saath). Artifact private hai: participant ke device ke liye page ke Share menu se do, aur pehle private window me khud
  jaancho. `#code-read` ya "Interview ka format" tab na ho to S4, H5 chhodo, S10 ka sirf pehla hissa; sheet par likho.
- [ ] **Devices:** laptop (Chrome) aur ek Android phone, dono chaarge; hotspot backup. Phone wale students ke saath
  aamne-saamne test behtar; remote ho to Meet app se screen share.
- [ ] **Reset, har participant se pehle:** site data clear karo (Chrome: address bar ka taala → Site settings → Clear
  data) ya har participant ke liye nayi private window. Mock bhasha, theme aur mock-switch browser me yaad rakhta hai.
- [ ] **Bhasha:** participant ki pasand (English / Hinglish / Hindi): upar ki bar ka bhasha button (EN / HG / हि), focus
  screens par ⋯ menu → Bhasha. Reset ke baad mock English me khulta hai. Hindi me kai lines chhoti hain (mock ki seema):
  atke to likho, bhasha ki dikkat thi ya design ki. Theme sabke liye default (kaala); badalna pade to likho.
- [ ] **Mock ke switch (sirf moderator chhuye):** neeche-daayein "Saare screens" (isi se start screen kholo),
  neeche-baayein "Haalat", aur jo bhi "Mock:" se shuru ho. Participant ko shuru me bata do ki inhe na chhuen.
- [ ] **Har task se pehle:** "Saare screens" se start screen kholo; Sahayak khula ho to band (Ctrl+J); "Shuru" ka setup.
- [ ] **Recording:** sirf "haan" milne par (Meet ki recording ya screen recorder). Recording kabhi repo ya chat me nahi.
- [ ] **Task card:** har task ka "Bolo" wala text bade akshar me (print ya doosri screen); Hindi-first ke liye Devanagari
  me bhi. Card par UI ke shabd ya button ke naam nahi. Har participant ke liye §9 ki sheet print; stopwatch.
- [ ] **Pilot:** ek dost ke saath poora dry run (ginti me nahi). Samay aur shabd yahin theek karo.

## 4. Consent (shuru me padh kar sunao)

> Namaste, aur shukriya ki aapne samay diya. Ye Parikshaa ka ek design namoona hai, asli app nahi. Kai button kaam nahi
> karte aur saara data nakli hai.
> Hum design ko jaanch rahe hain, aapko nahi. Aap kahin atko to wo design ki galti hai, aapki nahi.
> Aap kabhi bhi ruk sakte ho ya koi sawaal chhod sakte ho, bina wajah bataye.
> Main notes likhunga. Kya main screen aur awaaz record kar sakta hoon? Sirf "haan" par; recording sirf hamari team
> dekhegi aur 30 din me delete hogi. Naam, phone ya email notes me nahi jaayega; aap "P3" jaise number se honge, aur aap
> kahoge to aapke notes bhi hata denge. Kya aap 18 saal ya usse bade ho, aur shuru karein?

Sheet par likho: recording haan/nahi, 18+ haan. "Nahi" ya shak ho to test mat karo.

## 5. 30 minute ka run sheet

| Minute | Moderator kya kahe / kare |
|---|---|
| 0–2 | Swagat. Consent (§4) padho. Recording haan ho tabhi chalu karo. Device aur bhasha set karo. |
| 2–5 | **Warm-up (3 min):** "Placement ki taiyari abhi kaise chal rahi hai?" "AI tools kab use karte ho?" Phir think-aloud samjhao: "Jo dekh rahe ho, soch rahe ho, bolte jao. Main zyada nahi bolunga, ye jaan-boojh kar hai." 20 second ki practice: "Is pehli screen par kya dikh raha hai, bolo." Mock ke switch na chhoone ko kaho. |
| 5–23 | **Core tasks** (students: S1, S2, S3, S5, S6, S9; HR/TPO: §7). Har task: start screen kholo → card padho → chup raho → 3 min ki seema → ek follow-up sawaal. |
| 23–25 | **Ek rotating task** (§6 ki table). Der ho gayi ho to ye chhodo; yahi buffer hai. |
| 25–30 | **Wrap-up (§10).** Shukriya, recording band, shukriya ka tareeka batao. |
| Baad me (15 min) | Sheet poori karo jab tak yaad taaza hai. Reset (§3). |

## 6. Student ke task

**Core:** S1, S2, S3, S5, S6, S9 (sabke saath). **Rotating:** S4, S7, S8, S10 (har participant ek; samay bache to
doosra). Rotation aisi ki 8 logon me har rotating task kam se kam 2 log karein:

| Participant | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 |
|---|---|---|---|---|---|---|---|---|
| Pehla rotating | S4 | S7 | S8 | S10 | S4 | S7 | S8 | S10 |
| Samay bache to | S10 | S8 | S7 | S4 | S8 | S10 | S4 | S7 |

Har task: **Shuru** (start screen + setup), **Bolo** (card ka text; Hindi me bolo to matlab mat badlo aur UI ke shabd
mat jodo), **Kamyaab** (kab "haan"), **Dhyan do**, **Baad me** (ek follow-up).

### S1. Aaj: abhi kya karna hai (core)
- **Shuru:** `#aaj`, Sahayak band.
- **Bolo:** "Maan lo shaam ko aapne ye app khola. Pehle bina kuch dabaye batao: abhi kaunsa kaam karna hai, aur pichhli
  baar us kaam me kya hua tha? Phir: code par wapas jaane se pehle aap samajhna chahte ho ki gadbad kyun hui. Wo karo."
- **Kamyaab:** "Pair with target sum" ko abhi wala kaam bataya; samjha ki ye test 23 par fail hua; **Fail kyun? Poochho**
  se Sahayak khola. "Jaari rakho" se problem me jaakar wahan Sahayak khola to bhi haan; raasta likho.
- **Dhyan do:** nazar pehle kahan gayi (bada card, "Phir" list, rail); galat line ka gola dikha?; "kaam 2 / 5", "2 din
  aage", readiness ring ka kya matlab nikala; dono buttons ka fark samjha?
- **Baad me:** "Is screen se aapko kya samajh aaya, aur kahin atke?"

### S2. Problem: sirf ek ishaara (core)
- **Shuru:** `#problem`, Sahayak band. Fail wali haalat (default) rehne do.
- **Bolo:** "Aapka code ek test par fail ho raha hai. Hal khud karna hai, bas chhota ishaara chahiye. Wo lo, phir ek aur."
- **Kamyaab:** Sahayak teesre pane me khula (focus bar ka Sahayak button, "Sahayak se poochho" ya Ctrl+J) aur kam se kam
  ek hint dekha / "Ek aur hint" dabaya. Statement ke "Hints" se liya to bhi haan, par alag likho.
- **Dhyan do:** Sahayak dhoondhne ka samay; teesra pane khulne par code chhota hua to uljhan?; samjha ki Sahayak poora
  code nahi dega?; "Sabse chhota fail test" padha?; phone par panes ke tabs.
- **Baad me:** "Aapko kya laga, Sahayak poora jawab de deta? Kahin atke?"

### S3. Galat AI pakdo (core)
- **Shuru:** `#ai-drill`. Setup: daayein card me kadam "1 Line dhoondho" dabao, phir doosri screen par jaakar wapas aao
  (reset ke baad drill doosre kadam par khulta hai aur line 4 pehle se chuni dikhti hai, yaani jawab).
- **Bolo:** "Kisi ne AI se chhota code likhwaya. Usme ek galti chhupi hai. Galti kahan hai, batao, saabit karo, theek karo."
- **Kamyaab:** ek line par tap kiya; test wale kadam ka matlab apne shabdon me bataya; "Ab theek karo" → "Phir chalao" →
  "Save karo, agla drill" tak gaye. **Pehli** chuni line sheet par likho: mock har tap ko line 4 maan leta hai.
- **Dhyan do:** samjha ki line par tap karna hai?; "sabse chhota input" ka matlab; pehle se bhare dabbon par kya bole
  (mock ki seema); timer se dabaav; phone par lambi code lines.
- **Baad me:** "Ye drill aapke kis kaam aayegi? Kahan atke?"

### S4. Code padhna, AE6 (rotating; sirf jab `#code-read` preview me ho)
- **Shuru:** `#practice` (Abhyas hub). `#code-read` pehle kadam par ho (reset ke baad hota hai).
- **Bolo:** "Naukri ke pehle din aksar kisi aur ka likha lamba code samajhna padta hai. Yahan se uski practice dhoondho.
  Phir code padh kar batao: ye kya karta hai, galti kahan hai, aur aap kya badloge."
- **Kamyaab:** hub ki patti (ya drill page ki rail) se `#code-read` khola; sawaal 1 ("kya karta hai") me option chuna;
  sawaal 2 ("bug kahan hai") me line par tap kiya; sawaal 3 ("kya badloge") me ek-do line likh kar bheja; nateeja padha.
- **Dhyan do:** 219 line par reaction (phone par scroll); Sahayak dhoondha? band kyun, samjha?; poora padhe bina option
  chuna?; sawaal 3 me "kaise saabit karoge" chhoota?; rubric wala nateeja samajh aaya?
- **Baad me:** "Sahayak band tha, kaisa laga? Aapke hisaab se band kyun tha?"

### S5. Ticket lab 1: samjho aur plan (core)
- **Shuru:** `#ticket-lab`. Setup: upar ki kadam-patti me "1 Samjho" dabao (reset ke baad lab "Banao" par khulta hai).
- **Bolo:** "Ek chhote canteen app (sample) me teen bug ki shikayat aayi hai. Aapko AI ki madad se inhe theek karna hai.
  Pehle samjho kya karna hai, phir us jagah tak pahuncho jahan AI aapke saath code par kaam shuru kare."
- **Kamyaab:** kam se kam do bug apne shabdon me bataye; Plan tak gaye; plan ki jaanch ki peeli chetavani (T-103) padh kar
  bataya ki agent abhi kyun band hai; "Plan pakka, agent kholo" dabaya.
- **Dhyan do:** `PLAN.md`, scope, acceptance shartein, risk jaise shabd; lamba text padha ya chhoda; agent band: jhunjhlahat?
- **Baad me:** "AI se pehle plan likhna aapko zaroori laga ya rukawat? Kyun?"

### S6. Ticket lab 2: AI ka badlav jaancho (core)
- **Shuru:** `#ticket-lab`, kadam "3 Banao".
- **Bolo:** "AI ne aapke code me ek badlav sujhaya hai jis par abhi faisla nahi hua. Tay karo ki use rakhoge ya nahi.
  Phir pakka karo ki bug sach me theek hua. Uske baad agla kadam kholo."
- **Kamyaab:** khula diff card (`client/src/lib/time.js`) mila; ek line wajah likh kar **Maano** ya **Mana karo**; "Tests
  chalao" dabaya aur bataya kaunsa ticket baaki hai; upar ki kadam-patti se Viva tak gaye.
- **Dhyan do:** kab samjha ki wajah zaroori hai; diff ke +/− aur hari lines padhi?; pehle wale cards ki wajah padhi?;
  teen pane (laptop) ya tabs (phone); AI par andha bharosa ya shak; Banao par "aage" button nahi: Viva tak kaise gaye?
- **Baad me:** "AI ka badlav maanne se pehle aapne kya dekha? Kahin atke?"

### S7. Mock interview: bina AI ya AI ke saath (rotating)
- **Shuru:** `#interview`. Setup: upar "Mock: har kadam" me **Setup**; roop **Bina AI** (default) rehne do.
- **Bolo:** "Agle hafte aapka ek interview hai. Wahan AI tool use karne denge, aur interviewer poochhega ki aapne AI ka
  code kaise jaancha. Iski practice ke liye interview set karo. Shuru hone se theek pehle ruk jaana."
- **Kamyaab:** "AI ke saath · asli kaam" chuna; dono roop ka fark apne shabdon me bataya; "Interview shuru" par ruke.
- **Dhyan do:** card aur upar ka switch, dono se uljhan?; "Mock: har kadam" ko asli control samjha?; "AI ke saath" ko
  cheating samjha?; "companies practice interview kabhi nahi dekhtin" wali line dekhi?
- **Baad me:** "Bina AI wala roop aap kab chunoge, aur kyun?"

### S8. AI istemal report (rotating)
- **Shuru:** `#ai-track`.
- **Bolo:** "Pichhle hafte aapne kai baar AI se madad li. Aap jaanna chahte ho ki AI ka istemal achhe se kar rahe ho ya
  nahi. Ye pata karo. Aur batao: ye jaankari aur kaun-kaun dekh sakta hai?"
- **Kamyaab:** "Meri AI istemal report" (track ki rail) se `#ai-report` khola; ek mazboot aur ek kamzor hissa apne shabdon
  me bataya; kaha "sirf main" (rail: "Ye report sirf aap dekhte ho").
- **Dhyan do:** shabd wale level (Mazboot / Theek, badh raha / Sudhaar chahiye) bina number ke samajh aaye?; saboot ke
  card (asli prompt aur samay) se madad lagi ya dar?; download aur delete dikhe?; "galat ho sakti hai" wali line.
- **Baad me:** "Ye report dekh kar AI ka istemal badloge? Ise kisi ko dikhaoge?"

### S9. Profile: HR ke liye link (core)
- **Shuru:** `#profile`, apna view (HR wala nahi).
- **Bolo:** "Ek company ki recruiter ne aapka kaam dekhna chaha hai. Aisa link banao jo sirf us company ke liye ho, ek
  hafte me band ho jaaye, aur jisme aapka phone number na dikhe. Phir pakka karo ki unhe kya dikhega."
- **Kamyaab:** share modal; "Ek company ke liye link", 7 din, phone band, "Link banao"; phir "HR ki nazar se" se jaancha.
- **Dhyan do:** button dhoondhne ka samay; private aur public link ka fark; "certificates hamesha dikhte hain" wali line;
  "HR ki nazar se" ka matlab; kaagaz par tick (jaancha) aur dashed gola (khud bataya) ka fark dikha?
- **Baad me:** "Is kaagaz ki kaunsi line HR ko sabse pehle dikhni chahiye? Kahin atke?"

### S10. Company: kitna taiyaar, aur AI ka niyam (rotating)
- **Shuru:** `#companies`. Bata do: "Is mock me company ke naam banaye hue hain." (Nimbu Labs ek sample naam hai.)
- **Bolo:** "Aapka target ek company hai. Pata karo aap uske liye kitne taiyaar ho aur kis cheez me kamzor ho. Phir pata
  karo ki uske interview ke kis round me AI use kar sakte ho, aur ye baat kahan se pata chali."
- **Kamyaab:** target card se `#company` khola; readiness ke do hisse (buniyaad, AI ke saath) apne shabdon me bataye;
  "Interview ka format" tab me ek round ke liye AI haan / nahi / pata nahi bataya, aur source + jaanch ki tareekh dikhayi.
- **Dhyan do:** kul number ko "hiring score" samjha?; wazan ka matlab; "pata nahi" par kya bole; source dekha ya nahi?
- **Baad me:** "Is page ki kis baat par bharosa karoge, kis par nahi?"

## 7. HR / TPO ke task

Recruiter: H1, H2, H3 core; H4, H5 samay bache to. TPO: H1, H2, H3, H5 core; H4 samay bache to. H1–H4 ek hi screen par:
`#profile`, jahan moderator pehle **HR ki nazar se** daba deta hai. Bata do: "Ye ek sample student ki profile hai jo
usne link se bheji. Side ka menu aur upar ka banner mock ke hain; asli link par nahi honge." (Mock ki seema, dikkat nahi.)

### H1. Pehli nazar (core)
- **Bolo:** "Ek student ne placement ke liye ye link bheja hai. 30 second dekho, phir batao: ye student kaisa lagta hai,
  aur nazar sabse pehle kahan gayi?"
- **Kamyaab:** student ka saar apne shabdon me (role, skills, kam se kam do jaanchi hui baatein).
- **Dhyan do:** nazar ka kram (naam, stamp, table, heatmap); kya dhoondha jo nahi mila; "Verified profile", No. PK-….
- **Baad me:** "Roz jo resume dekhte ho, usse ye kaise alag laga?"

### H2. Kaise jaancha (core)
- **Bolo:** "Is kaagaz ki kaunsi baatein aap bina dobara check kiye maan loge, aur kaunsi khud check karoge? Kyun?"
- **Kamyaab:** "Kaise jaancha" column dekha; tick (jaancha) aur dashed gola (khud bataya, jaise Machine learning) ka fark.
- **Dhyan do:** "Official API", "Bio me code", "Offer letter jaancha", proctoring ka matlab; kis line par shak; koi line
  jo jaanchi hui lagi par thi nahi.
- **Baad me:** "Kis line ka 'kaise jaancha' aapko sabse kamzor laga?"

### H3. "AI ke saath kaam" wali line (core)
- **Bolo:** "Kai companies ab dekhti hain ki candidate AI ke saath theek se kaam kar sakta hai ya nahi. Is kaagaz se is
  student ke baare me is par kya pata chala?"
- **Kamyaab:** "AI ke saath kaam (ticket labs)" line dhoondhi; 1 / 3, 3/3 tickets, viva 2½, "Pramaan AI-Saath baaki" ka
  matlab apne shabdon me bataya.
- **Dhyan do:** "ticket lab", "viva" ka matlab; "AI se cheating" samjha?; aur kya saboot chahiye tha; bharosa badha/ghata.
- **Baad me:** "Shortlist ke faisle me ye line kitna wazan rakhegi?"

### H4. Projects aur coding sites (samay bache to)
- **Bolo:** "Aap dekhna chahte ho ki student ne asli project banaya ya nahi, aur doosri coding sites par record kaisa hai."
- **Kamyaab:** Projects tab me "18/18 tests · mentor review" jaisa saboot; Coding sites tab me har number ka kaise jaancha.
- **Dhyan do:** "Live" / "Kholo" se kya ummeed ki; "sample number" wala note; kya dhoondha jo nahi mila.
- **Baad me:** "Aisa kya hai jo dekhna chahte the par nahi mila?"

### H5. Interview ka format, AE9 (TPO: core; recruiter: samay bache to)
- **Shuru:** `#company`, Overview tab. Bata do: "Company ka naam sample hai, banaya hua."
- **Bolo:** "Aapke college me jald ek company aa rahi hai. Students poochte hain: kis round me AI use kar sakte hain aur
  saath kya laana hai. Ye page dekh kar unhe jawab do. Kya aap ye page students ko bhejoge?"
- **Kamyaab:** "Interview ka format" tab; ek round ka AI haan / nahi / pata nahi aur kya laana; source + tareekh dekhi.
- **Dhyan do:** source + tareekh se bharosa bana?; "pata nahi" ko kaise padha; source ke bina chhupe tathyon ki kami
  mehsoos hui?; recruiter: candidates ko aisi jaankari dena theek lagta hai?
- **Baad me:** "Students ke group me ye page bhejoge? Kya chahiye taaki bhejo?"

## 8. Moderator ke niyam

- **Think-aloud:** shuru me ek baar samjhao. Participant chup ho jaaye to: "Abhi kya soch rahe ho?" Bas itna.
- **Madad mat karo.** Button mat dikhao, "sahi" / "galat" mat kaho, click par sir mat hilao. Design ka bachaav mat karo.
- **Neutral sawaal:** "Aap kya dhoondh rahe ho?" · "Yahan kya hone ki ummeed thi?" · "Ye dekh kar kya laga?" · "Aur
  kuch?" Participant sawaal poochhe to ulta poochho: "Aapko kya lagta hai?"
- **Hint kab:** 2 minute tak koi aage badhna nahi, ya participant pareshan ho. Ek-ek karke: (1) "Screen par ek baar aur
  dekho" → (2) jagah batao: "upar wali patti dekho" → (3) seedha dikha do. Koi bhi hint = **"madad se"** + hint 1/2/3.
- **3 minute ki seema:** 3:00 par roko: "Theek hai, ye bahut kaam ki baat hai, aage chalte hain." Task = **"nahi"**.
- **Mock ki seema:** button na chale to: "Ye mock hai, ye abhi kaam nahi karta. Aap kya hone ki ummeed kar rahe the?"
  Jawab likho. Pehle se bhare jawab par: "Maan lo ye aapne likha." Inhe design ki dikkat mat gino (§11).
- Participant khud ko dosh de ("main hi bewakoof hoon") to: "Aap nahi, design atka. Isiliye test kar rahe hain."
- **Sirf jo dikha, wo likho**; andaaza alag; quote shabdashah. Sabke saath wahi kram, wahi shabd: card se padho.

## 9. Observation sheet

**Sir par:** ID (P1–P8 / H1 recruiter / H2 TPO) · tareekh · Meet ya saamne · device (phone / laptop) · bhasha ·
recording haan/nahi · rotating task kaunse. Naam, phone, email, college ka naam sheet par nahi.

| Task | Kamyaab (haan / madad se + hint 1-2-3 / nahi) | Samay (mm:ss) | Kahan atke (screen + element) | Quote (shabdashah) | Severity 1–4 | Mock ki seema? |
|---|---|---|---|---|---|---|
| S1 Aaj | | | | | | |
| S2 Problem + Sahayak | | | | | | |
| S3 Galat AI pakdo (pehli chuni line: __) | | | | | | |
| S4 Code padhna | | | | | | |
| S5 Lab: samjho + plan | | | | | | |
| S6 Lab: badlav + tests | | | | | | |
| S7 Interview ke roop | | | | | | |
| S8 AI report | | | | | | |
| S9 Profile share | | | | | | |
| S10 Company | | | | | | |
| H1–H5 (HR/TPO, har ek alag line) | | | | | | |

Ek task me kai dikkat = kai lines. "Kahan atke" me route + element, jaise "`#problem` · focus bar ka Sahayak button".

| Severity | Naam | Matlab |
|---|---|---|
| 1 | Halki | Dikhne ki baat; kaam par asar nahi (rang, shabd ajeeb laga, 10 second se kam ulajhna) |
| 2 | Chhoti | Thodi der ya ek-do galat click; participant khud nikal aaya |
| 3 | Badi | Hint chahiye tha; ya aisi galat samajh jo galat faisla karwaye ya bharosa ghataye (jaise "report company dekhegi", "AI ke saath = cheating", readiness ko hiring score maanna) |
| 4 | Rukawat | Task 3 minute me nahi hua; ya aisi galti jo asli app me nuksaan kare (jaise private ki jagah public link, phone dikhta chhod diya) |

## 10. Wrap-up ke sawaal

**Students:**
1. "1 se 5 me, aaj ke kaam kitne aasaan lage? (1 = bahut mushkil, 5 = bahut aasaan) Kyun?"
2. "Sabse zyada uljhan kahan hui?"
3. "AI wale hisse (drill, lab, report, interview) dekh kar Parikshaa par aapka bharosa badha ya ghata? Kyun?"
4. "Kya aap apni profile ka link sach me kisi HR ko bhejoge? Kya chhupana chahoge?"
5. "Ek cheez jo aap turant badalna chahoge?"
6. "Kuch aisa jo dhoondha par mila nahi?"

**HR / TPO:**
1. "1 se 5 me, ye profile samajhna kitna aasaan laga? Kyun?"
2. "Kya is profile par aap interview call doge? Kyun, ya kyun nahi?"
3. "AI ke saath kaam wali line se candidate par bharosa badha ya ghata?"
4. "Kis line par sabse zyada bharosa hua, kis par sabse kam?"
5. TPO: "Format wala page students ko bhejoge? Kya chahiye?" Recruiter: "Ye kaagaz aur kya dikhaye to kaam aasaan ho?"

## 11. Nateeje se fix list tak

1. **Har session ke 15 minute ke andar** sheet poori karo. Recording sirf quote jaanchne ke liye dekho.
2. **Saare sessions ke baad dikkat list (§12c):** ek row = ek dikkat (screen + element + kya hua). Wahi dikkat doosre
   insaan ko bhi hui to nayi row nahi, "kitne log" badhao. Severity = jo sabse oonchi kisi ke saath dikhi.
3. **44-2 me kya jaayega:** jo dikkat **2 ya zyada logon** ko hui, **ya** jiski severity **3 ya 4** hai. Baaki §12c me.
4. **Mock ki seema** (pehle se bhare jawab, mock ke switch, na chalne wale button, Hindi ki chhoti lines) 44-2 me nahi:
   §12c me "mock" likho, 44-5 (mock ki safai) me kaam aayengi. Na chalne wale button par participant ki ummeed bhi.
5. **Fix sirf wahi, naya design nahi:** shabd ya label, cheezon ka kram, ek line ki madad, button ka zor (pri / ghost),
   default haalat, touch size, contrast; sab [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) ke components se. Jis fix ke liye naya
   screen ya feature chahiye, wo 44-2 me nahi: owner ke saamne idea ke roop me ([FEATURE-IDEAS.md](FEATURE-IDEAS.md)).
6. **Kram:** severity 4 → 3 → 2 → 1; barabar ho to jise zyada logon ne dekha wo pehle.
7. **Fix list §12d ke format me:** screen, dikkat, kitne log, severity, sujhaya fix, aur **pehle / baad screenshot** (44-2
   me har fix ke saath, `shots.mjs`). Tracker ([../PREP-TRACKER.md](../PREP-TRACKER.md) row 136) main session update karega.

**Privacy:** is file me sirf ID (P1–P8, H1, H2). Naam, phone, email, college ka naam, recording ya aisa screenshot jisme
participant pehchana jaaye, kuch bhi repo me nahi. Quote me pehchaan wali baat ho to hata do.

## 12. Nateeje

*Test ke baad bharna. Abhi koi session nahi hua; neeche sab khaali hai. Aakhir me §12e me owner ke liye saar: sabse badi
5 dikkat, R1–R6 ke chhote jawab, aur 44-2 me kitne fix.*

### 12a. Sessions

| ID | Kaun (student / recruiter / TPO) | Tareekh | Meet / saamne | Device | Bhasha | Rotating task | Recording |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

### 12b. Task-war kamyaabi aur wrap-up

| Task | Kitne logon ne kiya | Haan | Madad se | Nahi | Ausat samay |
|---|---|---|---|---|---|
| S1 … S10, H1 … H5 (har ek alag row) | | | | | |

| Wrap-up | Jawab (ginti ya saar) |
|---|---|
| Kitna aasaan (1–5): students / HR-TPO | |
| AI wale hisse se bharosa: badha / ghata / wahi | |
| HR: interview call doge? · TPO: format page bhejoge? | |

### 12c. Dikkat list (sab)

| # | Screen (route) + element | Kya hua | Kitne log | Severity | Design ya mock? | 44-2 me? (haan / nahi, kyun) |
|---|---|---|---|---|---|---|
| | | | | | | |

### 12d. 44-2 fix list

| # | Screen (route) | Dikkat | Kitne log | Severity | Sujhaya fix (sirf wahi, naya design nahi) | Pehle / baad screenshot | Haalat |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

### 12e. Owner ke liye saar

—
