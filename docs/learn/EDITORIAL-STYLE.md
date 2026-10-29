# Parikshaa editorial style (owner ki file se, 19 Oct 2026)

**Source:** owner ne 19 Oct 2026 ko "Introduction to Decode Your Coding Interview" di (Notion export, Markdown, 4,020
line; images file me nahi aayin). Repo me: [source/decode-your-coding-interview.md](source/decode-your-coding-interview.md). Usme: seekhne ka vigyan, interview ka process, Polya ke 4 kadam, 7 problems poore
hal ke saath (Two Sum, Missing Numbers, Obstacle Grid, Rotate List, No Repeating Characters, Point To Next, Jump Game),
system design ka tareeka (Twitter app), aur practice ka hafte-war plan. Har problem ka editorial **~2,000–3,450 shabd**
ka hai.

**Ye kitaab owner ki apni hai** (owner, 19 Oct 2026). Isliye: (1) iski **style** Parikshaa ke 5,000 editorials ka
niyam hai; (2) iska **text** (intro, seekhne ka vigyan, practice plan, 7 problems, system design) seedhe Parikshaa par
aa sakta hai, edit karke (§8). Factory ka generator aur style critic dono isi file ko padhte hain.

---

## 1. Dhaancha: 4 kadam (har coding editorial)

Har editorial in chaar hisson me, isi kram me. Hindi/Hinglish edition me naam bracket wale.

| # | Heading (English) | Hinglish | Lagbhag hissa |
|---|---|---|---|
| 0 | Problem + example | Samasya + udaharan | 5% |
| 1 | **Understand The Problem** | Samasya samjho | 25% |
| 2 | **Coming Up With The Solution** | Hal tak pahuncho | 50% |
| 3 | **Writing The Solution** | Code likho | 10% |
| 4 | **Testing / Reflection** | Jaancho aur seekho | 10% |

**Ye 4 headings hi hint ki seedhi hain** (source me bhi: "har kadam ko hint ki tarah use karo, phir jawab dekho").
Learner pehle sirf kadam 1 khol sakta hai, phir 2 ka pehla hissa, aur aage. Sahayak ka hint ladder isi se judta hai.

## 2. Har kadam ke niyam

### 0. Problem + example

- Statement **bold** me, ek-do line.
- Ek example code block me: input, kyun (`numbers[1] + numbers[3] = 4 + 13 = 17`), output.
- Grid, tree, graph wale problem me **visual** (renderer se): jaise grid me obstacle "X" aur ek rasta rang se, neeche
  italic me ek line ka matlab.

### 1. Understand The Problem

1. **Pehli line ka niyam:** "Turant hal par mat koodo; ek system se samjho, galti ka mauka kam hota hai."
2. **Note callout** (`> **Note:**`): interview me hal se pehle sawaal poochho.
3. **Statement ko tod kar** key hisse **bold** karo, phir bullets: input kya, output kya, aur jo galti ho sakti hai wo
   "ye zaroori hai" ke saath (jaise *index lautana hai, number nahi*).
4. **Function ka dhaancha** (signature) code block me, hal se pehle: `function twoSum(numbers, target) { return [i, j] }`.
   Phir: "Abhi hal nahi pata, par input, output aur algorithm ka andaaza hai."
5. **Input ki jaanch sawaal-jawab me**, har hisse ke liye alag heading:
   - container (array/string/list): khaali ho sakta hai? kam se kam kitne? sorted? duplicate?
   - elements: negative? zero? positive? range, overflow?
   - baaki parameter (jaise target): negative, zero, kisi element ke barabar?
   - Har sawaal ke neeche jawab ek shabd me (`Haan` / `Nahi` / range).
   - Note: "Sawaal chhote hain par zaroori; ek jawab badla to hal badal jaata hai."
6. **Output ki jaanch:** shakal, range (index `>= 0 && < length`), hamesha jawab milega ya nahi.
7. **Aur sawaal:** overflow, kai sahi jawab ho to kaunsa.
8. **Data structure khud chunna** jab problem saaf na de (Obstacle Grid: grid → 2D array, `0` khaali, `1` rukaavat).
9. Band karte waqt: "Ab basic samajh hai, hal ki taraf chalte hain" + Note: galti ho to apna system sudhaaro.

### 2. Coming Up With The Solution (sabse lamba)

1. **3–4 examples**, har ek ke neeche **"Kyun ye example?"**: sabse aasan (shuru karne ke liye), random, edge (khaali,
   `[[]]`, ek cell), bina jawab wala (agar mumkin ho).
2. **Ek example chuno** jo kai edge cases dhake, aur likho kyun: jawab hai, zero/negative/random hai, na bahut chhota, na
   bahut bada ("dimaag me load ho sake").
3. **Observations** bullets me (jaise "kam se kam O(N), kyunki jawab kahin bhi ho sakta hai").
4. **"Index 0 se shuru karo"** ka tareeka: example par haath se chalo, har line ek hisaab:
   `numbers[0] + numbers[1] = -3 + 0 = -3; -3 ≠ 4`. Isse **brute force** shabdon me, phir code/pseudocode.
5. **Complexity ke dabbe:** jo mila uski complexity, phir har behtar dabbe ka matlab:
   - `O(N log N)` → sorting (ya heap, agar min/max ho);
   - `O(N)` → ek pass, har kadam `O(1)` (set, hashtable);
   - `O(log N)` → binary search;
   - aur jo problem me lage (DP table, two pointers, stack).
   Note: "Abhi mat socho kaunsa observation kaam aayega; sab dekho."
6. **Har idea aazmao, aur galat raasta bhi dikhao:** jaise sort karke two pointers → "**Lekin ye galat jawab hai!**"
   (index badal gaye). Phir **seekh** ek line me, "auzaar ke thaile" ke liye: "Agar asli kram chahiye, to sort sochke".
7. **Recap** jab koi insight mile (1, 2, 3).
8. **Equation me likho** (`numberTwo = target - numberOne`) jahan madad kare.
9. **Bache masle** number ke saath (#1 index chahiye, #2 duplicate) aur har ek ka hal.
10. **Pseudocode**, phir aage.
11. **Har approach (Brute → Better → Optimal) isi safar se nikle**, alag-alag tukdon me nahi. Platform par upar tabs
    (Brute / Better / Optimal) seedhe inhi hisson par le jaate hain.
12. **Draw karo:** jahan source "visualize and draw" kehta hai, wahan hamara renderer frames deta hai (§4).

### 3. Writing The Solution

- Ek line: "Agar example aur pseudocode ho gaya, to ye hissa aasan hai."
- **Sanity checks** ki list: har variable use hua? counter badha? seemaayein (`< n` ya `<= n`)? khaali input?
- **Final code** 4 bhasha (C++, Java, Python, JavaScript) ke tabs me; samjhaane me Python (source jaisa). Har code runner
  par saare tests pass karta hai (CI).
- Note: "Dekho ye hissa kitna chhota hai: asli kaam sochne me tha."

### 4. Testing / Reflection

- Chune hue example par **code ko kadam-kadam chalao** (dry-run table ya frames).
- **Sawaal aur jawab:**
  - Time complexity? Space complexity? (kaise nikli, ek line)
  - **Kya dilchasp observations?** 3–5 bullets jo seekh ko "chunk" karein (brute force ne search space khatam kiya;
    sort ne nayi property di; dict ne jagah ke badle samay diya; input pehle se sorted hota to…).
  - **Related problems:** hamare bank ke link (3Sum, 4Sum jaise variants), aasan se mushkil.
- Aakhri line bold: "Reflection se seekh purane idea se judti hai."
- **Parikshaa ka jod:** revision card (3 line + complexity), edge cases jo judge me test hain, aam galtiyan, interview
  follow-ups.

## 3. Awaaz aur likhne ke niyam

- **Mentor jaisa, "hum" aur "chalo":** "Let's start…", "Cool. We sorted the array, but what does that give us?"
  Hinglish me: "Chalo index 0 se shuru karte hain."
- **Chhote paragraph**, bold me key insight, aur `> **Note:**` callouts seekhne ki tip ke liye (har editorial me 3–6).
- Kabhi-kabhi **"Science of learning"** tidbit (spaced repetition, galti se seekhna, likh kar yaad rakhna).
- **Imaandari:** kitaab me owner ka apna kissa hai ("isse maine Google ka hiring committee paar kiya"); owner ke likhe
  content me wo rahega. **AI se bane content me koi niji kissa nahi banega**; tip seedhi likhenge.
- **Bahar ke problem links nahi:** source me ~120 LeetCode links hain; hamare editorial sirf **apne bank** ke problems
  se judte hain.
- **Lambai:** Easy ~1,800–2,500 shabd, Medium ~2,500–3,500, Hard ~3,500–5,000 (source: 2,000–3,450).
- Code: saaf naam (`numberOne`, `numberTwo`), example usage ke saath, comments kam aur kaam ke.

## 4. Visuals (source me images thin; hum code se banayenge)

Source me images grid (Obstacle Grid), linked list (Point To Next) aur system design (Twitter feed, profile, model
layer) par hain. Hamare renderer ([LEARN-V2.md](../LEARN-V2.md) §3d) se, sketch style me:

| Kahan | Visual |
|---|---|
| Problem ka example | Array/grid/list/tree ki tasveer, jawab highlight |
| "Index 0 se shuru" | Har line ka frame: pointer, jod, ✓/✗ |
| Approach badalte waqt | Pehle vs baad (unsorted → sorted, set/map ka bharna) |
| Dry run (kadam 4) | Step slider, har kadam par variables ki table |
| DP/grid | Table bharte hue, arrows kis cell se aaya |
| System design | App flow sketch, sub-systems, layers (model/view/controller; API/DB/cache) |

Har editorial me kam se kam: 1 example visual + 1 dry-run slider (5–12 frames). Har visual ka alt text.

## 5. Doosre content ke liye wahi soch

- **CP editorial:** wahi 4 kadam; kadam 2 me "Observation 1, 2, 3…" ki chain aur proof; constraints se complexity ka
  hisaab (`n ≤ 2·10⁵` → `O(n log n)`).
- **Aptitude:** chhota roop: *Samjho* (kya poocha, kaunsa data) → *Plan* (concept/formula, shortcut kab chalta hai) →
  *Hal* (kadam) → *Jaancho* (option, unit, andaaze se mel; har galat option kis galti se). Time target.
- **System design (HLD):** source ka tareeka: manager ka task samjho, 45 minute; Polya ke 4 kadam; scope ke sawaal
  (naya app ya purana, kitne users, kaunse features); **app flow sketch**; sub-systems pehchano; har sub-system ko
  layers me todo; checklists (main + situational).
- **LLD:** requirements ke sawaal → entities → class diagram → patterns kyun → code 3 bhasha → extension ke sawaal.
- **Lessons (CS core, languages):** kyun zaroori → concept + diagram → udaharan → galat-fehmi → interview sawaal →
  quiz → revision card.

## 6. Machine checks (factory ka style critic)

Ek editorial tab hi review me jaata hai jab:

- 4 headings sahi kram me; kadam 1 me input/output ke Q&A; kadam 2 me ≥ 3 examples, har ek par "Kyun"; ek chuna
  hua example uski wajah ke saath; complexity dabbe; **brute se optimal tak ka safar**; kadam 3 me sanity checks;
  kadam 4 me time + space + ≥ 3 observations + ≥ 2 related (apne bank se).
- Har code 4 bhasha me runner par sab test pass; har dry-run frame code chala kar bana.
- Mana shabd nahi (AI ke ghise-pite shabd, banaye hue niji kisse), bahar ke problem sites ke link nahi.
- Lambai mushkil ke hisaab se.
- Duplicate jaanch: hamare bank se bahut milta-julta nahi.

## 7. Sample-first

Pehle 10 editorial isi style me (§1–§6), aapki manzoori ke liye ([LEARN-V2.md](../LEARN-V2.md) §3g). Source wale 7
problems ke **idea** (Two Sum jaise classic) hamare apne statement, example aur kahani ke saath bana sakte hain, taaki
aap seedhe milan kar sakein.

## 8. "Kaise padhein" course (owner ki kitaab se, free)

Kitaab ka shuru ka hissa (seekhne ka vigyan, interview ka process, terminology kaise seekhein, Polya ke 4 kadam,
deliberate practice, hafte-war plan, topic-war checklists) Learn me **pehla free course** banega: "Interview ki taiyaari
kaise karein", owner ke naam ke saath. Kitaab ke 7 problems (Two Sum, Missing Numbers, Obstacle Grid, Rotate List, No
Repeating Characters, Point To Next, Jump Game) unhi editorials ke saath A2Z me, hamare tests aur dry-run sliders ke
saath. System design wala hissa HLD track ka shuruaati lesson. Kaam: slice LV-C15. Kitaab ke LeetCode links hatenge,
apne problems se judenge. Images (export me nahi aayin) sketch renderer se dobara banengi.
