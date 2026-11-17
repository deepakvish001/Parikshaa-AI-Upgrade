# Content kaise banayein: owner ki team ke liye (17 Nov 2026)

Learn launch ka content (DSA 1,000, SQL 300, aptitude 1,000, CN/OS/DBMS/LLD/OOD, C/C++/Python/Java/JS, system
design + projects) team **doosre AI** se banayegi. Ye file batati hai kaise: kadam, originality ke niyam, har type ki
quality checklist, aur review ka niyam. Format: [CONTENT-FORMAT.md](CONTENT-FORMAT.md). Prompts: [prompts/](prompts/).
Gold samples: [content/samples/](../../content/samples/). Tracker: plan row 141.

## 1. Kadam (har batch)

1. **Batch chuno:** ek type, ek topic, 20–50 items (jaise "DSA arrays L1, 30 problems"). Har item ka slug, tier,
   difficulty/level, track aur module pehle se ek sheet me likho (duplicate slug na bane).
2. **Prompt jodo:** `prompts/_shared-rules.md` + type ka prompt + `schema/common.schema.json` + type ka schema + 1–2
   samples (isi type ke, `content/samples/<type>/`) + request block (sheet se bhara hua). DSA me ek baar me **ek**
   problem maango (lamba editorial); MCQ me 10–20 ek saath.
3. **Output bilkul schema ka JSON ho.** Lambi cheezein (editorial, solutions) alag files me rakh sakte ho aur JSON me
   `{"$file": "editorial.md"}` likho (CONTENT-FORMAT §2e); samples isi tarah bane hain.
4. **Folder banao:** `<batch>/manifest.json` (bundle_id, version, author, licence, originality, tracks) aur har item
   apne folder me (`<batch>/<slug>/item.json` + files).
5. **Validator chalao** (repo ki jad me, `npm run build` ek baar ke baad):
   ```
   node scripts/content-validate.mjs <batch-folder>             # sab gates, runner par
   node scripts/content-validate.mjs <batch-folder> --no-run    # sirf schema + niyam (jaldi)
   node scripts/content-validate.mjs <batch-folder> --mutate    # DSA: tests kitne galat code pakadte hain
   node scripts/content-validate.mjs <batch-folder> --pack batch.json   # upload ke liye ek JSON
   ```
   Har item `PASS` ya `FAIL` ke saath kaaran. Runner ke liye machine par gcc, g++, Java (javac), Node aur python3
   chahiye.
6. **Jo laal ho, theek karo** (§3 ki table). AI ko error wapas do: "Validator ne ye kaha: ... Sirf ye theek karke
   poora JSON dobara do." Jab tak sab `PASS` na ho, upload mat karo.
7. **Khud padho** (§5 ka review niyam), `authoring.review.state` ko `self-checked` karo.
8. **Upload:** console → bulk upload → ZIP (folder) ya `--pack` wala JSON. Har item draft me jaata hai; reviewer
   padh kar **Publish** karta hai.
9. **Badlaav:** published item badlo to uska `version` +1 karo, manifest ka `version` bhi; dobara upload karo. Jo draft
   abhi publish nahi hua, use usi version par dobara upload kar sakte ho (draft badal jaata hai). Same version + same
   content: skip. Published version ko bina version badhaye badla to refuse ("raise the version"); chhota version bhi
   refuse (CONTENT-FORMAT §2a). Slug kabhi mat badlo.

## 2. Originality ke niyam (zaroori)

- **Kabhi copy nahi:** LeetCode, GeeksforGeeks, InterviewBit, HackerRank, Codeforces, CodeChef, IndiaBix, koi kitaab
  ya course: na statement, na kahani, na examples, na tests, na editorial. Idea (two pointers, percentages) sabka
  hai; shabd, kahani, numbers aur tests **hamare** hon.
- **Kahani badlo:** apni Indian kahani (chai stall, metro, hostel, canteen), apne naam aur numbers.
- **Apne tests:** generator + reference se bante hain; kisi site ke tests kabhi nahi.
- **Company tag** sirf saboot ke saath (`verified: true`, source). Andaaze ka "Amazon me poocha" nahi.
- **Jaanch:** har batch me 5 items ka statement Google me (pehli 2 line, quotes me) daal kar dekho; milta-julta mile
  to item dobara likhwao. Validator bundle ke andar duplicate pakadta hai; console bank se bhi milaata hai.
- AI ke bane content me **koi niji kissa** nahi ("maine interview me...").

## 3. Validator ke aam errors aur kya karein

| Error | Matlab | Kya karo |
|---|---|---|
| `missing "x"` / `unknown field` | Schema se bahar | AI se: "schema ke bilkul wahi fields" |
| `wrong solution ... passes every test` | Tests kamzor | Us galti ko pakadne wala test `anti`/`edge` me jodo |
| `reference (java) does not pass` | Bhashayein sahmat nahi | Usi bhasha ka reference theek karo (aksar overflow ya I/O) |
| `starter ... already passes` | Starter me jawab | Starter ka function default lautaye |
| `breaks the constraints (validator)` | Test niyam todta | Generator ke args ya validator theek karo |
| `editorial: N words, below 85%` | Chhota editorial | Gehrai badhao: aur examples, galat raaste, proof; bharti nahi |
| `## headings must be exactly ...` | Dhaancha galat | 5 headings isi kram me |
| `solver says ..., the key is ...` | Jawab galat | Sawaal ya key theek karo; solver ko sach maano jab tak galat na nikle |
| `links to another problem site` | Bahar ka link | Hatao; `related` me apne slugs |
| `banned phrase` | AI ke ghise shabd | Line dobara likho |
| `rubric: weights sum to N` | Rubric | Kul 100 |
| `input over 1 MiB` | Runner ki seema | Constraints chhote (n ≤ 10^5, values ≤ 10^6) |

## 4. Quality checklist (type ke hisaab se)

**Editorial ki lambai (owner ki checklist: yahi `editorial_length.target_words` me jaata hai).** Owner ne DSA ke liye
lamba editorial maanga (7,000–8,000 shabd). Shuru ke targets, owner badal sakte hain:

| Type | Public | Premium |
|---|---|---|
| DSA easy (L1) | standard 2,500 | long 7,000 |
| DSA medium (L2) | standard 3,500 | long 7,500 |
| DSA hard (L3+) | long 5,000 | long 8,000 |
| SQL | standard 600 (easy) · 900 (medium) · 1,200 (hard) | +30% |
| Aptitude explanation | 120–300 shabd | 200–400 |
| Lesson | 1,200–2,500 shabd | wahi |
| HLD/LLD reference solution | 1,200–2,500 | 2,000–3,500 |

Gate 85% se neeche fail karta hai. **Lamba matlab gehra, bhara hua nahi:** har example poora hal, galat raaste aur
kyun galat, sahi hone ka proof sketch, follow-up variants hal ke saath, aam galtiyan.

**DSA**
- [ ] Statement apna; har variable ki seema; "jawab nahi" aur khaali output ka niyam likha; ties ka niyam.
- [ ] 5 bhasha ke reference sab tests pass; brute random_small par sahmat; 2+ galat solution fail (TLE aur WA).
- [ ] Tests: samples, minimal, boundary (har variable ka min/max), edge (§4b ki list), random_small 10+,
      random_large 3+, anti; kul L1 20 · L2 30 · L3 40.
- [ ] Overflow: jahan 2^31 paar ho, starter 64-bit aur ek test jo `int` ko todta hai.
- [ ] Starter 5 bhasha, fast I/O, compile hota hai, pass nahi.
- [ ] Editorial: 5 headings, 3+ Note, 3+ "Why this example?", brute → better → optimal, ek galat raasta,
      `[[code-tabs]]`, dry run visual, time/space, observations, related, lambai.
- [ ] `--mutate` me 95%+ (bache hue mutants equivalent hain, reviewer ne dekha).

**SQL**
- [ ] SQLite me chalta; stem me result ke columns aur kram saaf; NULL aur ties ka niyam.
- [ ] Datasets: sample, empty, null, ties, duplicates/fewer-rows, many-rows; har galat query kisi dataset par fail.
- [ ] `order_matters` sirf poore tie-break ke saath.

**Aptitude / MCQ**
- [ ] Ek hi sahi option; options ek jaise roop me; har galat option ek asli galti (`distractors`).
- [ ] Quant me solver; variants me har set ka jawab solver se.
- [ ] Samjhaav: Understand → Plan → Solve → Check; har number dikhaya; shortcut sirf jahan sahi.
- [ ] Verbal: passage apna; ek hi jawab defensible.

**Lesson**
- [ ] why → concept (diagram ke saath) → example → misconception → interview Q&A → summary.
- [ ] Har chalne wala code `expected_output` ke saath runner par sahi; language lesson me hands-on task.
- [ ] Quiz samajh jaanchta hai, ratta nahi.

**Project / LLD**
- [ ] Starter build hota, tests fail; solution sab pass; driver ka protocol saaf.
- [ ] Tests me har error message aur edge case; rubric kul 100, AI feedback ≤ 20.
- [ ] LLD: 2+ bhasha, change request ke tests purane solution ko fail karte.

**HLD**
- [ ] Scope ke sawaal + maane hue jawab; numbers wale requirements; estimates solver ke saath.
- [ ] 6+ components (must/nice), 2+ deep dives, trade-offs, failure modes, rubric kul 100.

**Sab par**
- [ ] Hinglish/English niyam (EDITORIAL-STYLE §3): mentor jaisa, chhote paragraph, key line bold; Hinglish me
      technical shabd English me.
- [ ] Accessibility: har visual/image ka alt; tables me header; rang par nirbhar nahi; code ki bhasha likhi.
- [ ] Mana shabd nahi; bahar ke problem sites ke link nahi.

## 5. Review ka niyam (owner, F6)

- **Premium:** har item poora padha jaata hai (statement, tests ki list, editorial), phir Publish.
- **Public:** har bundle me kam se kam **10 me 1** item poora padha jaata hai; nayi author/AI ka pehla bundle poora.
  A2Z path ke items poore.
- Sample me ek bhi gambhir galti (galat jawab, copy, galat test) mile to **poora bundle** wapas.
- Reviewer `authoring.review` bharta hai (`reviewed`/`approved`, naam, tareekh).
- Pehle **samples ki manzoori** (ye 70): owner inhe padh kar haan kahein, tabhi bada batch shuru ho.
