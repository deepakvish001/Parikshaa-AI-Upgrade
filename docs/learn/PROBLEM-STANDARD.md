# Problem standard v2: har problem, har test case (19 Oct 2026)

**Owner ne kya diya:** apne problem format ke 5 JSON (SQL template + `series_batch25/26/28/29`) aur kaha: "kuch aise,
aur isse better, difficult level problem set; saare test cases cover hon: sample, easy, small, long, hard, edge,
corner, minor se minor sab, Codeforces CP level." Files repo me: [source/problems-v1/](source/problems-v1/).

Ye doc batata hai: (1) owner ke format me kya accha hai, kya kami hai (audit, asli naap ke saath); (2) har problem ka
naya package (v2); (3) test cases ka niyam; (4) machine gates jo galat problem ko live nahi hone dete; (5) owner ke
purane batches ko upgrade karne ka tareeka.

---

## 1. Audit: owner ke 5 files (19 Oct 2026)

| Naap | Nateeja |
|---|---|
| Problems | 40 coding (4 batches × 10) + 1 SQL template |
| Mushkil | **40 me se 40 "easy"** (programming basics: digits, primes, strings, chhote arrays) |
| Tests | Har problem me **12** (3 sample + 9 hidden), sab haath se likhe |
| Sabse bada input | **29 characters** (koi bada ya max-size test nahi) |
| Reference vs tests | ✅ 40/40 sahi (koi mismatch nahi) |
| Mutation test (114 chhote galat badlaav reference me) | **11 bach gaye** (5 problems me), kill rate 90% |
| Starter code | ✅ 7 bhasha (C, C++, Java, Python, JS, TS, Go), function stub + I/O harness |

**Mutation test se mili asli kamiyan** (galat code jo saare tests pass kar gaya):
- `valid-variable-name`: `'z'`, `'Z'`, `'0'`, `'9'` wale naam galat sambhalne wala code bhi pass. `z`, `Zebra`, `0abc`
  ya `_9` jaisa koi test nahi.
- `valid-sentence-check`: `Z` se shuru hone wala vaakya reject karne wala code bhi pass. `Z` se shuru koi test nahi.
- Kuch bache hue badlaav "equivalent" hain, yaani nateeja same rehta hai (jaise `next-perfect-square` me `n > 0` vs
  `n >= 0`). Inhe reviewer ek baar mark karta hai.

**Padh kar mili kamiyan** (machine ab inhe pakdegi, §5):

| Problem | Kami | Kyun bura |
|---|---|---|
| `otp-max-min-prime` | Constraint `a < b`, par hidden tests me `2 2` aur `5 5` | Test apne hi niyam todta hai (validator pakadta) |
| `replace-vowels-ascending-digits` | Statement me sirf a,e,i,o,u (chhote); test `AEIOU → 12345` | Chhupa hua niyam; learner ki galti nahi |
| `sum-product-abs-difference` | a,b ≤ 10⁵ → product 10¹⁰; C/Java starter `int` lautata hai | Overflow ka jaal; tests 100 tak, pakda nahi jaata |
| `sum-divisible-by-seven` | b ≤ 10⁶ → jod ~7.1·10¹⁰; starter `int` | Wahi |
| `cube-ends-with-number` | n ≤ 10⁵ → n³ = 10¹⁵; `int` | Wahi |
| `circle-area-radius` | `3.14 * r * r` float, 2 decimal | Bhashaon me rounding alag ho sakti hai; integer se (`314·r²/100`) karo |
| `last-digit-power` | `0 0` allowed; 0⁰ ka jawab statement me nahi | Ambiguous |
| Sab arrays | n ≤ 1000, tests n ≤ 10 | O(n²) ya dheema I/O (Java `Scanner`) kabhi nahi pakda jaata |
| `top-3-earners` (SQL) | Ek hi dataset, koi hidden nahi; barabar salary par kram tay nahi; "3 se kam rows" ka test nahi | `order_matters` ke saath ties galat verdict dete |
| `companies` field | Meta 9.1, Uber 4.7 jaisi frequency, bina source | Bina saboot ke company data nahi dikhana (niyam) |

**Faisla:** owner ke format ki achhi cheezein **rakhenge**: 7 bhasha ke starter, function stub + harness, examples me
explanation, 3 hint, SQL spec. Tests aur jaanch ko v2 me badlenge. Ye 40 (aur baaki series batches) **"Basics"
track** banenge: beginners aur service-company coding rounds ke liye, upgrade ke baad (§6).

## 2. Mushkil ki seedhi

| Level | Kiske barabar | Kahan |
|---|---|---|
| **L0 Basics** | Programming basics; TCS NQT jaise coding rounds | Basics track (**500**, owner ke series batches + naye) |
| **L1 Easy** | LeetCode Easy · Codeforces 800–1100 | A2Z, bank |
| **L2 Medium** | LeetCode Medium · CF 1200–1700 | A2Z, bank |
| **L3 Hard** | LeetCode Hard · CF 1800–2300 | A2Z, bank, CP |
| **L4 Expert** | CF 2400+ | CP |

Kul: **5,000** (A2Z 520 + interview bank 2,480 + CP 2,000) **+ 500 Basics**.

## 3. Package v2 (JSON; v1 ke saath chalta hai)

v1 ke saare naam wahi (`slug`, `title`, `difficulty`, `topics`, `description`, `examples`, `constraints`, `hints`,
`starter_code`, `reference_solution`, `sample_tests`, `hidden_tests`, `cpu_time_limit_sec`, `memory_limit_kb`,
`is_published`, `sql_spec`, `companies`). v2 ye jodta hai:

```jsonc
{
  "schema": "parikshaa.problem/v2",
  "version": 3,
  "level": "L2",                       // §2
  "rating": 1500,                      // CP ke liye; baaki me andaaza
  "patterns": ["sliding-window", "hashing"],
  "io": { "style": "stdin" },          // ya "function" (LeetCode jaisa); starter isi se bante hain
  "constraints_structured": [          // har variable ki seema, machine padh sake
    { "name": "n", "type": "int", "min": 1, "max": 200000 },
    { "name": "a[i]", "type": "int", "min": -1000000000, "max": 1000000000 },
    { "name": "k", "type": "int64", "min": 0, "max": 200000000000000 }
  ],
  "statement_rules": {                 // jo aksar chhoot jaata hai, wo yahan saaf
    "case": "lowercase only",
    "ties": "smallest index first",
    "no_answer": "print -1",
    "multiple_answers": "any (checker)"
  },
  "validator": { "lang": "cpp", "src": "…testlib.h…" },
  "generators": [
    { "name": "random", "lang": "cpp", "src": "…", "params": ["n", "maxv", "seed"] },
    { "name": "all_equal", "lang": "cpp", "src": "…" },
    { "name": "anti_quadratic", "lang": "cpp", "src": "…" }
  ],
  "test_plan": [                       // literal tests sirf chhote; bade generator se bante hain
    { "group": "samples", "tests": [ { "input": "…", "expected": "…" } ] },
    { "group": "minimal", "tests": [ "n=1", "all values at min" ] },
    { "group": "boundary", "gen": "random", "args": [ [200000, 1000000000, 1], [200000, 1, 2] ] },
    { "group": "anti", "gen": "anti_quadratic", "args": [ [200000, 7] ] }
  ],
  "tests_uri": "s3://…/p_123/v3.zip", "tests_hash": "sha256:…", "tests_count": 48,
  "checker": { "kind": "exact" },      // "tokens" | "float" (1e-6) | "custom" (src)
  "interactor": null,
  "solutions": [
    { "role": "reference", "lang": "cpp", "src": "…" },
    { "role": "reference", "lang": "python3", "src": "…" },
    { "role": "brute", "lang": "python3", "src": "…" },
    { "role": "wrong", "expect": "WA", "why": "int overflow", "lang": "cpp", "src": "…" },
    { "role": "wrong", "expect": "TLE", "why": "O(n^2)", "lang": "cpp", "src": "…" },
    { "role": "wrong", "expect": "WA", "why": "off-by-one at window end", "lang": "python3", "src": "…" }
  ],
  "limits": { "time_ms": { "cpp": 1000, "c": 1000, "java": 2000, "go": 1500, "python3": 3000, "pypy3": 1500,
                           "javascript": 2500, "typescript": 2500 }, "memory_mb": 256 },
  "editorial_ref": "ed_123@v3", "visual_ref": "vz_123@v2",
  "companies": [ { "name": "…", "source": "interview-experience:exp_88", "verified": true } ]
}
```

- **Literal tests** sirf chhote (≤ 2 KB). Bade tests generator + seed se banke S3 me zip, hash ke saath.
- **Starter code** 7 bhasha me, **fast I/O** ke saath (Java me `BufferedReader`/`StreamTokenizer`, `Scanner` nahi; C++ me
  `ios::sync_with_stdio(false)`), aur **sahi type** (64-bit jahan zaroori: `long long`/`long`/`int64`).

## 4. Test cases ka niyam ("minor se minor")

### 4a. Har problem me ye groups (zaroori)

| Group | Kya | Kam se kam |
|---|---|---|
| `samples` | Statement wale | 2–3 |
| `minimal` | Sabse chhota input (n=1, khaali string agar allowed, 1×1 grid, ek node) | 2 |
| `boundary` | Har variable ki **min aur max** dono; max size (n = max) par | har variable ke 2 |
| `edge` | Data type ke hisaab se (§4b) | 5–15 |
| `random_small` | Chhote random (brute se jaanche) | 10 (Basics 5) |
| `random_large` | Max ke paas random | 3–10 |
| `anti` | Galat tareekon ko todne wale: O(n²) ke liye max, overflow, anti-hash, anti-greedy, deep recursion | har known galat tareeke ke 1+ |
| `output_edge` | Jawab: 0, -1, khaali output, sabse bada jawab (64-bit), kai jawab | jo lagu ho |

**Kul tests kam se kam:** L0 15 · L1 20 · L2 30 · L3 40 · L4 50 (CP me zaroorat ho to 100+).

### 4b. Data type ke hisaab se edge checklist

| Type | Zaroor test karo |
|---|---|
| Integer | 0, 1, −1, min, max, max−1, prime/composite (agar matter kare), 2³¹ ke paar (overflow), negative jahan allowed |
| Array | n=1, n=max, sab barabar, sorted asc, sorted desc, alternating, sab negative, zero mix, duplicates bahut, sab distinct, answer shuru/aakhir/beech me |
| String | length 1, max, sab ek hi char, sab alag, palindrome, boundary chars (`a z A Z 0 9 _` aur allowed special), spaces (agar allowed), upper/lower dono (agar allowed) |
| Matrix / grid | 1×1, 1×m, n×1, max×max, sab blocked/sab khula, start ya end blocked |
| Tree | ek node, line (depth = n, recursion ka jaal), star, complete binary, random |
| Graph | ek node, disconnected, line, star, complete (chhota), self-loop/multi-edge (agar allowed), negative weight (agar allowed), max edges |
| Intervals | overlap nahi, poora overlap, touching ends, nested, ek hi interval |
| Queries | sirf update, sirf query, mix, same index baar-baar, max queries |
| Floating | tolerance ke saath checker; ya integer se hisaab (statement me saaf) |
| Output | khaali output (kaise chhapna, saaf likha), `-1`/"none", bahut bada output (fast I/O) |
| SQL | khaali table, NULL, barabar values (ties), duplicate rows, rows kam (jaise "top 3" me 2), bahut rows |

### 4c. Time limit ka niyam

- Reference (C++) ka sabse dheema test ≤ TL ka 25%; Python reference ≤ Python TL ka 50%.
- Intended se ek level dheema (jaise O(n log² n) jahan O(n log n) chahiye) **pass** hona chahiye ya nahi, statement
  aur editorial me saaf.
- Galat complexity wala solution (O(n²)) har bhasha me **TLE** hona chahiye.
- Bhasha ke hisaab se TL (§3 `limits`); Python ke liye PyPy bhi.

## 5. Machine gates (inme ek bhi laal → publish nahi)

1. **Validator:** har test constraints maanta hai (`otp-max-min-prime` ka `2 2` yahin rukta).
2. **References sahmat:** C++ aur Python reference har test par same output.
3. **Brute sahmat:** `random_small` par brute = reference.
4. **Galat solutions fail:** har `wrong` apne `expect` verdict se fail (WA/TLE/MLE/RE).
5. **Mutation score ≥ 95%:** reference ke auto-mutants (`<`/`<=`, ±1, `int`/`long long`, `and`/`or`, loop bounds) me se
   ≥ 95% tests se pakde jaayein. Equivalent mutants reviewer mark karta hai. Basics ke liye bhi ≥ 95%.
6. **TL check:** §4c.
7. **Starters:** 7 bhasha me compile/chalein, max input ko TL ke 20% me padh lein, sahi type.
8. **Statement lint:** har variable ki seema, case rule, tie rule, "jawab nahi" rule, output format (khaali bhi),
   floating ka niyam; example ka output reference se.
9. **Duplicate:** embeddings se bank me bahut milta-julta nahi.
10. **Companies:** sirf `verified: true` + source; warna field hatao.

Gates factory ka hissa hain ([ARCHITECTURE.md](ARCHITECTURE.md) §6–§7); admin me "Checks" tab ([ADMIN-PANEL.md](ADMIN-PANEL.md) §3.2).

## 6. Owner ke purane batches ka upgrade (v1 → v2)

1. **Import:** v1 JSON jaisa hai waisa (`legacy`/`series` source tag ke saath).
2. **Structure:** `constraints` text se `constraints_structured` + `statement_rules` (AI draft; reviewer check). Chhupe
   niyam (jaise uppercase vowels) statement me likhe jaate hain, ya test hata.
3. **Validator + generators** (AI draft, runner par jaanch).
4. **Tests badhao:** §4 ke groups; overflow wale problems me 64-bit starter + 64-bit tests.
5. **Solutions:** C++ reference + brute + 2–3 galat (overflow, off-by-one, O(n²) jahan matter kare).
6. **Gates (§5)**; fail ki list reviewer ko (jaise §1 ki table).
7. **Publish** Basics track me; editorial owner ki kitaab wali style me ([EDITORIAL-STYLE.md](EDITORIAL-STYLE.md)), dry-run
   slider ke saath.

**Owner se:** saare series batches (1 se aage, jitne hain) aur SQL problems isi repo me
`docs/learn/source/problems-v1/` me daal dein, ya chat me bhejein. Har batch ka upgrade raat ko factory karegi.

## 7. Naye mushkil problems (L1–L4) kaise banenge

CP jaisa tareeka: **idea → proof (kyun sahi) → reference (C++ + Python) → brute → validator → generators (random +
special + anti) → galat solutions → TL calibration → gates → editorial + dry run → review.** Har problem ka apna
statement aur kahani; LeetCode/Codeforces ka text ya tests kabhi nahi.

## 8. Udaharan: ek Basics problem ka upgrade

`sum-product-abs-difference` (|(a+b) − a·b|, 0 ≤ a, b ≤ 10⁵):

| Group | Tests |
|---|---|
| samples | 35 67 → 2243 · 37 66 → 2339 · 74 99 → 7153 |
| minimal | 0 0 → 0 · 0 1 → 1 · 1 0 → 1 |
| boundary | 100000 100000 → **9999800000** (64-bit chahiye) · 0 100000 → 100000 · 100000 1 → 1 |
| edge | 1 1 → 1 · 2 2 → 0 (sum = product) · 1 x → 1 · 2 3 → 1 |
| random_small | 10 random (brute = reference) |
| random_large | 5 random, a,b ∈ [9·10⁴, 10⁵] |
| anti | `int` wala C/Java solution: 100000 100000 par **WA** |

Starter v2: C/C++ `long long`, Java `long`, Go `int64`; statement me "jawab 64-bit me aa sakta hai" nahi likhte (ye
seekhne ka hissa), par seema (10⁵) saaf likhte hain.
