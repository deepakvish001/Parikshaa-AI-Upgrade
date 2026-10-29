# Learn design system: code banane ke liye ek hi sach (21 Oct 2026, v4.3: 23 Oct, roop final: 24 Oct)

Ye file batati hai ki Parikshaa Learn **kaisa dikhega aur kaise chalega**, taaki koi bhi session ya account asli code me
**wahi design** banaye. Mock (`docs/learn/mock-v3/app`) is file ka chalta hua namoona hai: jahan ye file aur mock alag
dikhein, **mock sahi hai** aur is file ko theek karo.

- Owner ne manzoor kiya: font + kaala default (20 Oct), 8 roles + 4-eyes (20 Oct), **logo A "Pass"** (21 Oct).
- **v4.3 (23 Oct):** dark me teen parat aur naram card-dhaar (§3), focus bar me ek ⋯ menu (§7), brand ke 6 pal (§8–9),
  har mukhya screen ki 5 haalatein (§9), accessibility aur phone par 40 px touch (§5, §9).
- **Roop final (24 Oct, owner):** Aaj = **A "Ek kaam"**, Profile = **B "Saboot ka kaagaz"** (§7a). Baaki roop (Aaj B/C,
  profile A/C, dono ka v4.2) aur unka switch mock se hata diye.
- Purane docs ki jagah: [../LEARN-V2.md](../LEARN-V2.md) §9 (प mark, indigo + saffron, Noto) ab **purana** hai;
  [DESIGN-V4.md](DESIGN-V4.md) ka dhaancha sahi hai, bas logo aur v4.1/v4.2 ke badlav yahan.
- Link (owner ka, private): https://claude.ai/artifact/LDK6qdh2qKj8WzWYAiN4Zn · Screenshots:
  [mock-v3/screens/](mock-v3/screens/) · README: [mock-v3/README.md](mock-v3/README.md)

## 1. Reference kahan hai

| Cheez | File (mock) | Code me kahan jaayega |
|---|---|---|
| Rang, radius, font, motion ke tokens | `mock-v3/app/src/styles/tokens.css` (**poori list yahi**) | `packages/brand/src/tokens.css` |
| Fonts | `mock-v3/app/src/styles/fonts.css` + app ka `package.json` (`@fontsource*`) | `packages/brand/src/fonts.css` |
| Base, kit ke styles | `styles/base.css`, `styles/kit.css` | `packages/brand/src/base.css`, `ui.css` |
| Logo, kit components | `src/ui/kit.tsx` | `packages/brand/src/ui.tsx` (+ `react.tsx`) |
| Learner shell (side bar, top bar, Sahayak pane, `?` sheet, notifications) | `src/ui/shell.tsx`, `styles/shell.css` | `packages/web` (Learn area) |
| Workspace (problem/SQL panes) | `src/ui/focus.tsx`, `src/screens/problem.tsx`, `styles/focus.css`, `work.css` | `packages/web` |
| Code Studio, notebook, interview | `src/screens/studio.tsx`, `notebook.tsx`, `interview.tsx` + unki CSS | `packages/web` |
| Admin shell aur kit | `src/ui/admin-shell.tsx`, `src/admin/akit.tsx`, `styles/admin*.css` | `packages/console` |
| Har screen ki list | `src/screens/registry.ts` (76 routes: 49 learner + mock, 27 admin) | product router |

Mock chalana: `cd docs/learn/mock-v3/app && npx tsc -p tsconfig.json && npx vite build && node build-artifact.mjs`;
screenshots `node shots.mjs <out> <routes> 1440,390 dark en view` (`VAR="state=error"` se haalat; `lab=`, `drill=`, `ivmode=`/`ivphase=` se naye screens ke kadam); jaanch `node qa.mjs 390 dark hi` aur `node a11y.mjs 390 dark en`.

## 2. Logo (final: A "Pass")

P ka danda hi sunehre tick ki lambi line hai: **taiyari, phir pass**. Dono theme me rang wahi.

```svg
<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <rect width="40" height="40" rx="11" fill="#2349E6"/>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="3.4">
    <path d="M16 30.5V9.5h6.2a6.1 6.1 0 0 1 0 12.2H16" stroke="#FFFFFF"/>
    <path d="M10.2 25.2 16 30.5" stroke="#FFD84D"/>
  </g>
</svg>
```

- **Rang:** neela `#2349E6`, sunehra `#FFD84D`, safed `#FFFFFF`. Theme ke saath nahi badalte.
- **Banawat:** 40 ka grid, kona 11, line 3.4, gol sire. Har taraf mark ki chaudai ka **chauthai** khaali.
- **Sabse chhota:** 16 px (browser tab). Wordmark `parikshaa` chhote akshar, IBM Plex Sans 650, `-0.02em`.
- **Lockups:** mark + wordmark; product tag (`Learn`, `Admin`) wordmark ke baad chhote badge me. Devanagari wordmark
  `परीक्षा` sirf footer aur certificate me.
- **Favicon aur app icon:** wahi SVG (`index.html`, `build-artifact.mjs` me data URI).
- **Mat karo:** rang badalna, tirchha karna, kheenchna, shadow ya outline lagana.
- Code me: `LogoMark({ size, decorative })` (`kit.tsx`); wordmark ke saath ho to mark `decorative`.

## 3. Rang

Default **kaala** ("Syaahi"); light ("Kaagaz") toggle se, chuna hua `pk4-theme` me yaad. CSS ka shape: light values
bare `:root` par; dark do jagah: `@media (prefers-color-scheme: dark) :root:not([data-theme=light])` aur
`:root[data-theme=dark]`. App `data-theme="dark"` lagata hai jab tak learner light na chune.

| Token | Kaam | Light | Dark |
|---|---|---|---|
| `--page` | Page | `#F6F6F4` | `#000000` |
| `--panel` / `--panel-2` / `--sunk` | Card / utha hua / track | `#FFFFFF` / `#FAFAF9` / `#ECECEA` | `#101013` / `#16161A` / `#1F1F24` |
| `--raised` / `--overlay` | Menu, hover card / modal, drawer | `#FFFFFF` / `#FFFFFF` | `#1A1A1F` / `#1E1E23` |
| `--card-line` | Card ki dhaar (dividers se naram) | `rgba(10,10,12,.08)` | `rgba(255,255,255,.075)` |
| `--sheen` | Card par upar se halki roshni | none | `linear-gradient(180deg, rgba(255,255,255,.02), 0 140px)` |
| `--line` / `--line-2` | Divider / zor wali dhaar | `#E2E2DE` / `#C9C9C3` | `#2A2A2F` / `#3F3F46` |
| `--ink` … `--ink-4` | Text 1–4 | `#0A0A0B` `#43444C` `#5C5E66` `#66686F` | `#FAFAFA` `#C4C4CC` `#A3A3AD` `#86868F` |
| `--pen` | Action, link, focus | `#2349E6` | `#3B62F5` |
| `--red` | Galti, khatra | `#D9352A` | `#FF5D50` |
| `--tick` | Pass, ho gaya | `#13803C` | `#2CCF78` |
| `--marker` | Zaroori (highlighter) | `#FFD84D` | `#FFD84D` |
| `--ai` | Sab kuch AI / Sahayak | `#6A45FF` | `#9F86FF` |
| `--coin` | Coins, streak, chetavani | `#9A5300` | `#FFAB2E` |

Har rang ke saath `-text`, `-soft`, `-line` (jaise `--pen-soft`) dono theme me. **Niyam:**
- Padhne wala har text 4.5:1 se kam nahi, `--ink-3` aur `--ink-4` bhi (v4.3 me dono theme me har surface par jaancha).
- **Gehraai parat se, dhaar se nahi:** page kaala, card `--panel` + `--sheen` + `--card-line`, menu `--raised`, modal/drawer
  `--overlay`. Dividers aur table lines `--line`.
- Kisi cheez ko "band/locked" dikhane ke liye `opacity` nahi (contrast girta hai); dashed dhaar + `--panel-2` + taala.
- Rangeen bhare hisse par text: `--on-pen`, `--on-tick`, `--on-red`, `--on-ai` (safed hard-code nahi).
- Code ke rang `--code-*` (gutter aur comment bhi 4.5:1). Poori list: `tokens.css`.

## 4. Type

- **IBM Plex Sans** (UI, 400–700) + **IBM Plex Sans Devanagari** (Hindi; Plex ke saath bana, isliye Hinglish aur हिंदी
  ek jaise) · **JetBrains Mono** (code) · **IBM Plex Serif 600** (sirf certificate ka naam, mohar) · **Kalam** (sirf
  teacher ke laal-pen note).
- Scale: body 14.5/1.55 · label 12.5–13 (500) · card title 15 (600) · page title 28–30 (700) · hero 56 (700, −0.03em).
- Number hamesha tabular. Paragraph 68 akshar tak. Bade title bold sans, italic nahi (AI-jaisa look se bachne ke liye).

## 5. Aakar

- Radius: 6 (chip), 8 (button, input), 12 (card), 14–18 (bade panel, modal).
- Button 36 px (sm 30, lg 44), 600; primary bhara, secondary dhaar wala, ghost sirf hover par; dabane par 1 px neeche.
- Input 38 px, dhaar `--line-2`, focus par 2 px neela ring + 2 px gap.
- **Phone / touch par** har control kam se kam **40 × 40 px** (button 40, icon button 40, chip/tab/menu row 40); switch aur
  checkbox kam se kam 24 px. List me akele link ko upar-neeche 4 px jagah; vakya ke andar wale link waise hi.
- Table: header uthe rang me, number daayein, row hover halka.

## 6. Motion

- Ek easing: `--ease: cubic-bezier(0.2, 0.7, 0.2, 1)`. 120–280 ms; 360 ms sirf panes ke liye.
- Page aane par 6 px upar se fade (`rise`), cards ki halki stagger (30–40 ms).
- **Aana aur jaana dono:** modal, drawer, menu, toast `usePresence(open, ms)` se band hote waqt bhi animate.
- Tab ki neeche wali line khisakti hai (`.tab-ink`); meter bharta hua aata hai; toast 3 se zyada nahi.
- **Panes:** flex-grow 0.36 s; Sahayak pane column ki chaudai 0 se badhti/ghatti (0.26 s), phone par neeche se sheet.
- `prefers-reduced-motion` par sab band; screenshots (`html.shots`) me bhi.

## 7. Layout

| Layout | Kahan | Niyam |
|---|---|---|
| Learner shell | Aaj, Seekho, Abhyas, Career, Mera | Side bar 248 (chhota hone wala, `Ctrl+\`), top bar 56, rail 320 (≥1180 px), Sahayak **push pane** (overlay nahi), phone par neeche 5 tabs |
| Focus bar | Problem, SQL, Studio, notebook, interview | Sirf har minute kaam aane wali cheezein (wapas, title, kaam + timer, panes); bhasha, theme, shortcuts, pichhla/agla ek **⋯ menu** me |
| Workspace | Problem, SQL | **Default 2 pane** (Problem 0.31, Code 0.42, min 300/380); Sahayak teesra (0.3, min 320) `Ctrl+J`/button se, band par wapas 2; beech ki patti khinchti hai; phone par tabs |
| Code Studio | Projects | VS Code jaisa: activity bar, explorer/search/git/tests/steps, editor groups + preview, panel (problems/output/terminal/tests/ports), status bar, `Ctrl+Shift+P`; gutter me badlav ke nishaan, quick fix pehle diff dikhata hai, `Ctrl+I` line par Sahayak (sirf hint) |
| Notebook | Data & ML | Side (Files / Data / Variables + RAM) · cells · Sahayak; runtime: Browser Python (Pyodide) / Parikshaa CPU job / **Colab me GPU** (grade hamesha yahin, chhupa test bahar nahi) |
| Interview | Career | Setup → live (baat + code, Sahayak band) → report (rubric, "hiring score nahi") |
| Admin | Console | Side bar groups, "Viewing as" role, `Gate` (taala + kaun kar sakta), `FourEyes` (wajah + doosri manzoori), audit me sab |

### 7b. AI ke saath kaam: ticket lab, drill, code padhna, interview ke do roop, interview ka format (owner, 24 Oct 2026)

Code: `src/screens/ailab.tsx` (`TicketLabScreen`, `AiDrillBody`, `AiDrillRail`), `src/screens/interview.tsx`; CSS
`src/styles/ai.css`. LEARN-V2 §4c ke AE2, AE3, AE5.

- **Ticket lab** (focus layout): focus bar ke beech **5 kadam ka stepper** (Samjho, Plan, Banao, Viva, Nateeja; ho chuke
  par tick, abhi wala utha hua; ≤1100 px par sirf abhi wale ka naam; phone par body ke upar poori chaudai, har button
  40 px aur `aria-label` me naam). Page wale kadam 1080 px tak, do column (content + 340 px aside), 960 se neeche ek.
  **Banao** = `Panes` (code 0.4, Agent 0.34 `tone: "ai"`, tests 0.26); phone par tabs, Agent pehle. Agent ke jawab me
  **diff card**: file, +/−, aur "kyun" ki ek line bina "Maano"/"Mana karo" band; maana = hari dhaar, mana = dashed. Tests
  ticket-war (tick/cross) + terminal. Plan me jaanch **niyamon** se (AI nahi), dheeli shart peeli. Nateeja par `Moment`
  (stamp LAB · 3/3 · AI-SAATH) aur "hiring score nahi" banner.
- **Galat AI pakdo** (shell layout + rail): upar timer pill aur 3 drill ke gole; code ki **har line ek button**
  (`aria-pressed`, `aria-label` me line), chuni = laal dhaar, theek = hari; daayein card me 4 kadam ki goli-patti aur
  us kadam ka kaam; nateeja `dr-run` (laal/hari). Rail me kismon ke meter.
- **Interview ke do roop:** setup me do bade card (`iv-mode`: bina AI = `pen`, AI ke saath = `ai`); focus bar me daayein
  `Seg` (phone par body me). AI roop me code ke neeche **AI saathi** patti (har prompt report me); report ke har hisse
  me `iv-ev` chip "transcript mm:ss".
- **AI track** (`#ai-track`, `src/screens/aitrack.tsx`): roadmap jaisa khada raasta (`at-path`, baayein 2 px ki line,
  36 px gole: poora = tick, abhi = pen + halki chhaya, band = dashed); har padaav ek card, sar par naam + hisson ki
  goliyan (`at-parts`) + badge; abhi wala khula: do-do card ki tulna (`at-weak` peela sar, `at-good` hari dhaar).
- **AI istemal report** (`#ai-report`): har hissa ek poori chaudai ka card: rang wala icon + **shabd me level** (Mazboot /
  Theek, badh raha / Sudhaar chahiye; number nahi) + 6 hafte ki `Spark`; neeche saboot ke chhote card (2 column tak),
  har ek me kahan se + samay, quote (mono), ek line, aur us pal par teer. Rail me data ke niyam, download, delete.
- **Readiness ke do hisse** (`ReadinessSplit`): ring me kul, neeche do patli patti: buniyaad (`pen`) aur AI ke saath (`ai`),
  wazan likha hua. Aaj ki rail aur company page par.
- **Code padhna** (`#code-read`, AE6, `src/screens/coderead.tsx`, CSS `.cr-*` in `ai.css`): focus layout, ticket lab
  wala stepper (`StepPills`: Padho, Jawab, Nateeja) aur `Panes` (code 0.58, sawaal 0.42; phone par tabs, sawaal pehle).
  Code `Code` component me; jawab ke kadam me line par click se chunav (`.mark` + 3 px pen ki dhaar), nateeje me galti wali
  line `.bad` + laal dhaar. Har click ka keyboard raasta bhi: line ka number likhne ka field, aur "Is file me" ke function
  buttons se code me us line par jaana. Sawaal 1 `.option` + `.radio`; nateeje me har sawaal ek card (sahi tick, galat
  cross, aadha dashed gola `--coin`), phir diff (`bad`/`good`) aur test. FocusBar me "Sahayak band" badge (phone par chhupa).
  Chuni aur galti wali line ke aage likha nishaan ("← aapki chuni" / "← galti"), sirf rang nahi. Phone par line chunte
  waqt har line 40 px. Kadam badle to us kadam ki heading par focus; bina jawab ke Nateeja nahi khulta (pill se bhi), aur
  seedha khule to "namoona jawab" ka banner. Galti ka sandesh batata hai kya chhoota, aur focus wahin jaata.
- **Interview ka format** (`#company` ka tab, AE9, `src/screens/format.tsx`, CSS `.fmt-*` in `career.css`): upar saar
  card (ginti wali heading + role ka `Seg`); har round ek card, baayein 3 px dhaar (bina AI = `pen`, AI ke saath = `ai`,
  pata nahi = dashed `--line-2`) aur `.rn` gola (pata nahi = `.rn.unk`, dashed); daayein **AI ka badge** (`pen` BotOff /
  `ai` Bot / saada CircleHelp) aur zaroorat ho to `coin` "naya" badge. Har tathya `dt`/`dd`; `dd` ke neeche **source chip**
  (`.fmt-src`: kism ka icon tick rang me, chhota naam · tareekh; 90 din se purana = dashed + `coin` "purana ho sakta").
  Chip ek button hai: neeche source ki list me us source par le jaata. Round ki lambai/jagah, AI ka badge aur "naya" badge
  ka bhi apna source ("Round aur AI ka niyam:" wali line); jo round sirf purane source par tika, uski ginti saar me.
  **Niyam:** source ke bina koi tathya nahi; chhupe tathyon ki sirf ginti, unka text kabhi nahi. Neeche source ki list
  (icon ka dabba, naam, kaise jaancha, tareekh). Phone par fact ek column, badges gole ke neeche.
- **Niyam:** in screens par kahin "hiring score" nahi; AI ka har sujhaav record; maanne/mana karne ki wajah zaroori;
  chuna hua AI tab/toggle `--on-ai` text ke saath.

### 7a. Aaj aur profile: chune hue roop (owner, 24 Oct 2026)

**Aaj = A "Ek kaam"** (`src/screens/today.tsx`: `AajBody`, `AajRail`; CSS `v43.css` `.af-*`, `.agenda`). Agla kaam sabse
upar aur sabse bada; baaki ek chhoti list. Sab ek saath barabar zor se nahi bolta.

1. **Sir:** tareekh · din 38/90 (eyebrow), "Shubh sandhya, Aarav." aur usi heading me halki line "4 kaam baaki, lagbhag
   105 min"; daayein ek hi badge ("2 din aage").
2. **Abhi wala kaam** (`.af-now`, pen ki halki roshni wala card): "Abhi · kaam 2/5" + minute; kaam ka naam (display 28);
   verdict badge + ek line kyun; galat line `PenCircle` ke saath; **Jaari rakho** (pri, lg) aur **Fail kyun? Poochho** (ai);
   neeche har kaam ki ek patti, abhi wali dheere dhadakti hai (reduced motion me ruk jaati hai).
3. **Phir** (card): baaki kaam, har line par check, kaam ka icon, naam + meta + level, minute, aur teer wala link
   (`aria-label` me kaam ka naam). Neeche "Bhaari din? Halka karo" → `LighterModal` → `DayMoment` (plan halka / chhutti
   me streak bachi / sab poora).
4. **Rail:** "Is hafte" (readiness ring + streak aur freeze), "Aage" agenda (aaj ka problem timer, sprint test, weekly
   round, semester exams). Phone par sir ek ke neeche ek, dono button ek line me 44 px, rail page ke neeche.

**Profile = B "Saboot ka kaagaz"** (`src/screens/profile.tsx`: `ProfileBody`, `ProofSheet`, `ProfileRail`; CSS `.ps-*`).
Profile dashboard nahi, ek **document** hai jo HR ek nazar me maan le: har line batati hai kya jaancha, kaise aur kab.

1. **Upar:** "Aapki profile" + "HR aapke link se yahi kaagaz kholta hai"; buttons: **HR ko share karo** (pri, `ShareModal`),
   Resume PDF, HR ki nazar se, Edit.
2. **Tabs:** Saboot ka kaagaz · Coding sites · Projects · Profile card (card ka tab HR ki nazar me nahi).
3. **Kaagaz** (`article.ps-sheet`): upar pen rang ki patti; letterhead (logo, *Verified profile* serif italic, No.
   PK-…); pehchaan (avatar, naam serif 32, ek line, college + CGPA, shahar + join; phone sirf maalik ko); Pramaan ka
   `Stamp`; table (skill/record, level, saboot, kaise jaancha, kab; tick = jaancha, dashed gola = khud bataya, halka
   rang); pichhle 26 hafte ka practice heatmap; neeche haath se "Parikshaa ne jaancha" + QR aur link.
4. **HR ki nazar:** upar banner + "Apne view par wapas"; phone, buttons aur card tab chhupe.
5. **Phone:** table ki har line ek label wala chhota card (`td::before` me `data-label`), stamp chhupa, tabs side me
   scroll.

## 8. Components

- **kit.tsx:** LogoMark, Logo, Diya, Tick, Hl, PenCircle, PenNote, Stamp, Badge, Kbd, Level, Avatar, SampleNote, Skel,
  Empty, usePresence, Tabs, Seg, Toggle, Check, Menu, Modal, Drawer, CountUp, Meter, Ring, Donut, Spark, LineChart, Bars,
  Heatmap, Code, PageHead, Card, Stat.
- **focus.tsx:** FocusBar, PaneToggles, Panes, PaneHead, usePanes. **shell.tsx:** Shell, CommandPalette (`Ctrl+K`),
  KeySheet (`?`, `G`+akshar), notifications drawer, ThemeButton, LangButton. **sahayak.tsx:** SahayakPanel (contexts:
  problem, sql, notebook, lesson, studio, general).
- **v4.3:** `Moment` (kit: Diya + ek haath ki line + kabhi stamp), `ui/states.tsx` (`StateBody` khaali/loading/error,
  `FirstCard` pehli baar, `OfflineBanner`), FocusBar ka `more` (⋯ menu). Sirf mock: `lib/variant.tsx` (`useVariant`: haalat, lab/drill
  ke kadam, interview ka roop/kadam; roop ka switch 24 Oct ko hata) aur `StateFab` (haalat ka switch), product me nahi jaayenge.
- **akit.tsx (admin):** `Gate` ko icon-only button par `label` dena zaroori. AdmHead, Gate, FourEyes, RowMenu, Toolbar, Pager, useSelection, Status, Masked, useFirstLoad,
  SkelRows.
- Har component ki haalatein (hover, focus, disabled, loading, khaali, error) `#brand` page par dikhti hain.

## 9. Niyam jo har screen par lagte hain

- **Verified vs khud bataya** hamesha alag; har bahar ke number ke saath "kaise jaancha" (judge, official API, OAuth,
  bio me code). Password kabhi nahi.
- **Sahayak:** Seekho mode me hint aur sawaal, poora hal nahi; contest, mock, Pramaan aur interview me band; liye hint
  submission par dikhte; "galat ho sakta hoon" likha rehta. Quick fix lene par "madad li" note.
- **Sample data** par "sample" likha; nakli testimonial, user ginti ya company logo nahi; daam `₹[...]` jab tak owner tay
  na kare.
- **Share links:** ek company ka link expiry ke saath; HR kya dekhe learner tay kare; har view ka log; phone default
  chhupa.
- **Bhasha:** har text `t(en, hinglish, hindi)`; Hinglish default; code code hi rehta hai.
- **Keyboard:** `Ctrl+K`, `Ctrl+J`, `Ctrl+\`, `?`, `G` phir akshar; Studio me `Ctrl+Shift+P`, `Ctrl+B`, ``Ctrl+` ``, `Ctrl+.`, `Ctrl+I`.
- **Khaas pal (Moments), sirf 6:** pehla AC kisi pattern par, streak bachi (freeze), Pramaan pass, plan halka hua, HR ne
  profile kholi, contest me naya best; aur din ka kaam poora. Kahin aur Moment nahi, warna khaas nahi rehta. Confetti nahi.
- **Har mukhya screen ki 5 haalatein** (mock me 12 screens): pehli baar (3 kadam ka card), khaali (Diya + ek agla kadam),
  loading (page ke shape ka skeleton + likha hua "load ho raha hai"), error (kya hua, "aapka kuch nahi gaya", phir koshish,
  reference), offline (patti; padhna-likhna chalta rahe, submit aur Sahayak net ka intezaar karein). Focus screens me top
  bar har haalat me rahe.
- **Accessibility (har PR me):** axe (WCAG 2.2 A/AA) me serious/critical 0, dono theme, computer + phone, English + Hindi
  (`mock-v3/app/a11y.mjs`). Icon-only control ka `aria-label` = uska tooltip; har field ka label; meter/progress ka naam;
  scroll hone wale code, table, canvas `tabIndex=0`; tab ke andar button nahi; rang ke alawa bhi farq (tick, shabd).
- **Admin:** jokhim wale kaam (refund ₹5,000+, role badalna, recruiter suspend, GPU chalu) 4-eyes; keys ki value kabhi
  screen par nahi, sirf "set hai ya nahi".

## 10. Asli code me laana (jab owner kahe "shuru karo")

1. ✅ **Brand ek jagah, sab jagah naya** (owner F2 "sab jagah", K1-1, 25 Oct 2026): exam app (`packages/web`), console
   aur Learn ek hi brand par. Rang `packages/brand/src/tokens.css` (purane naam, v4.4 ke maan; dark me `--primary`
   `#5A7DFF` gehre text ke saath, kyunki `#3B62F5` link aur safed-text button dono nahi ban sakta); mock ke naam
   (`--page`, `--ink`, `--pen` …) `packages/brand/src/learn.css` me (sirf Learn ke pages load karein); fonts
   `packages/brand/src/fonts.css` (IBM Plex Sans + Plex Sans Devanagari; Plex Serif aur Kalam `learn.css` me); logo
   `packages/brand/src/react.tsx` ka `LogoMark` (logo A) + `Wordmark`, favicons `packages/web/index.html`,
   `packages/console/index.html`, PWA icons `packages/web/public/icons/`. Contrast test
   `packages/console/src/tokens.test.ts`. Baaki: achievement card SVG aur `docs/screenshots/` purane rang me.
2. ✅ **Kit `packages/brand` me** (K1-2, 25 Oct 2026): `packages/brand/src/kit.tsx` + `packages/brand/src/kit.css`
   (export `@parikshaa/brand/kit`, `@parikshaa/brand/kit.css`; tokens.css aur learn.css ke baad load karo): `Panes`,
   `usePanes`, `PaneHead`, `useMedia`, `FocusBar`, `Seg`, `Ring`, `Meter`, `Empty`, `Skeleton`/`Skel`, `ErrorState`,
   `OfflineBanner`, `FirstTime`. Har shabd app prop se deta (bhasha andar nahi; default aria label badle ja sakte); link
   `href` + `onNavigate`, isliye router app ka. Dialog, Drawer, Tabs, Tooltip, Menu (⋯), toasts pehle se
   `packages/brand/src/ui.tsx` me. Tests (render, behaviour, axe-core) `packages/console/src/components/kit.test.tsx`.
   Mock ke baaki kit (Diya, Badge, Modal, charts …) jab koi screen maange tab.
3. 🟡 **Learner shell `packages/web` me, flag `learn_v2` ke peeche** (K1-3, 25 Oct 2026; screens abhi baaki): shell
   `packages/web/src/learn/LearnApp.tsx` (sidebar 5 group, ≤1180 px par chhota aur har link ka naam bacha, top bar me
   breadcrumb + ⋯ menu (bhasha en/hg/hi, theme) + Sahayak, Aaj par right rail, ≤860 px par neeche 5 tab + "Aur" sheet,
   `Ctrl+K` search, `Ctrl+J` Sahayak, `Ctrl+\` chhota side bar, skip link, landmarks); screens ki list `screens.ts`
   (mock registry ke 24 `nav` screens), shabd `text.ts` (en/hg/hi, Learn ke chunk me), Aaj A sample data par `Aaj.tsx`,
   CSS `learn.css` (learn.css, ui.css, kit.css isi chunk me). Flag `src/learn/flag.ts`: `?learn_v2=1` se chalu, `=0` se
   band, device par yaad; build `VITE_LEARN_V2=on` sabke liye. Flag band par purani practice site wahi
   (`src/PracticeRoot.tsx`). **Kadam 2 (27 Oct se):** data `src/learn/data.tsx` (practice site ka hi client + session,
   react-query hooks, kit ki haalatein `Loading`/`Failed`/`Offline`/`SignedOut`); Aaj asli data par (K2-1), jinka backend
   nahi wo chhupe (sample nahi dikhate). K2-2: sign-in/sign-up aur onboarding "bare" pages (side bar nahi, upar logo + ⋯;
   `LearnAccount.tsx`, mock ka `.auth`) aur Mera plan (`LearnPlan.tsx`, mock ka `PlanBody`), dono apne chunk aur CSS
   (`learn-account.css`, `learn-plan.css`); form fields `.ln-field`/`.ln-input` aur notice line `.ln-notice` `learn.css` me.
   Sign-in ke art me namoona card par "Namoona" likha (§9). K2-3: Revision (`LearnRevise.tsx`, mock ka `.flash`/`.grades`:
   kaagaz ka card, margin ki laal line, laal-pen ki line Kalam me, 4 grade apne rang me) aur Meri lists + Notes (`LearnMine.tsx`,
   mock ka `.lists-grid`, `.list-card`, `.note-paper`), apne chunk aur CSS (`learn-revise.css`, `learn-mine.css`); learner ka
   Markdown brand ke `Markdown` se (elements, HTML kabhi nahi), styles `.ln-md` (`learn.css`). Card jaise button (list, note,
   grade) base `button` ke hover/shadow ko apni specificity se rokte hain. K2-4: DSA sheet (`LearnSheet.tsx`, mock ka `.sheet-head`,
   `.lvl-strip`, `.acc`: modules ki tah ek poori-chaudai button `aria-expanded` ke saath, item ki haalat icon + chhupa shabd) aur lesson
   reader (`LearnLesson.tsx`, mock ka `.lesson`, `.try`, `.toc`: 76ch tak padhai, 1180 px se upar daayein module ki list, neeche quiz,
   apna note, pichhla/agla); apne chunk aur CSS (`learn-sheet.css`, `learn-lesson.css`). Sub-address `sheet/<track>`, `lessons/<slug>`
   side bar me apne screen ko chunte hain. Abhyas = problems bank (`LearnProblems.tsx`, mock ke `.tracks`/`.track` card + table; phone par
   har problem ek card) aur POTD (`LearnPotd.tsx`, mock ka `.potd-hero` + `.cal`: calendar ek `<table>` Som se, har din ka haal rang ke saath
   chhupe shabd me bhi, aaj `aria-current="date"`). Baaki screens apne K2 tukde me (tracker row 140).
4. Admin pages `packages/console` me, roles matrix `ADMIN-PANEL.md` §1 + `runtime`, `recruiters`.
5. 🟡 (shell ki baselines CI me: K1-4, 26 Oct 2026, `packages/e2e/visual/learn.visual.ts`, 1440/390 × dark/light; K2-1 se Aaj seeded din par (`packages/e2e/tests/learn-day.ts`), tareekh wala text `.ln-dated` me aur mask; har naye screen ki apni baseline uske K2 tukde me) Har screen ki **visual baseline** mock ke screenshots se milao (1440/390, dono theme); axe serious/critical 0; phone par
   touch 40 px; har mukhya screen ki 5 haalatein; bundle budget.
6. Har slice ke baad tracker (`PREP-TRACKER.md`) aur handoff update.

## 11. Naye session ke liye checklist (design wahi rahe)

- [ ] Ye file aur mock ka `tokens.css` padha.
- [ ] Logo sirf `LogoMark` se, upar wala SVG; koi doosra P ya प nahi.
- [ ] Naya rang ya font nahi; zaroorat ho to pehle token, phir use.
- [ ] Naya screen pehle mock me (registry + shots + qa), owner dekhe, phir code.
- [ ] Har text teen bhasha, dono theme, 390 px par jaancha.
- [ ] `node a11y.mjs` (1440 + 390, dono theme) me 0; `node qa.mjs` me overflow aur console error 0.
