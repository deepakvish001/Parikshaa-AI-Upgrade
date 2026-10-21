# Learn design system: code banane ke liye ek hi sach (21 Oct 2026)

Ye file batati hai ki Parikshaa Learn **kaisa dikhega aur kaise chalega**, taaki koi bhi session ya account asli code me
**wahi design** banaye. Mock (`docs/learn/mock-v3/app`) is file ka chalta hua namoona hai: jahan ye file aur mock alag
dikhein, **mock sahi hai** aur is file ko theek karo.

- Owner ne manzoor kiya: font + kaala default (20 Oct), 8 roles + 4-eyes (20 Oct), **logo A "Pass"** (21 Oct).
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
| Har screen ki list | `src/screens/registry.ts` (72 routes: 45 learner + mock, 27 admin) | product router |

Mock chalana: `cd docs/learn/mock-v3/app && npx tsc -p tsconfig.json && npx vite build && node build-artifact.mjs`;
screenshots `node shots.mjs <out> <routes> 1440,390 dark en view`; jaanch `node qa.mjs 390 dark hi`.

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
| `--panel` / `--panel-2` / `--sunk` | Card / utha hua / track | `#FFFFFF` / `#FAFAF9` / `#ECECEA` | `#0C0C0E` / `#131316` / `#1C1C20` |
| `--line` / `--line-2` | Dhaar / zor wali dhaar | `#E2E2DE` / `#C9C9C3` | `#2A2A2F` / `#3F3F46` |
| `--ink` … `--ink-4` | Text 1–4 | `#0A0A0B` `#43444C` `#6A6C74` `#9A9CA3` | `#FAFAFA` `#C4C4CC` `#8F8F99` `#62626B` |
| `--pen` | Action, link, focus | `#2349E6` | `#3B62F5` |
| `--red` | Galti, khatra | `#D9352A` | `#FF5D50` |
| `--tick` | Pass, ho gaya | `#13803C` | `#2CCF78` |
| `--marker` | Zaroori (highlighter) | `#FFD84D` | `#FFD84D` |
| `--ai` | Sab kuch AI / Sahayak | `#6A45FF` | `#9F86FF` |
| `--coin` | Coins, streak, chetavani | `#A85A00` | `#FFAB2E` |

Har rang ke saath `-text`, `-soft`, `-line` (jaise `--pen-soft`) dono theme me. **Niyam:** padhne wala text 4.5:1 se kam
nahi; `--ink-4` sirf disabled ya sajawat; kaale par shadow nahi dikhti, isliye card ki pehchaan dhaar + `--edge` (upar 1 px
halki roshni). Code ke rang `--code-*`. Poori list: `tokens.css`.

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
| Workspace | Problem, SQL | **Default 2 pane** (Problem 0.31, Code 0.42, min 300/380); Sahayak teesra (0.3, min 320) `Ctrl+J`/button se, band par wapas 2; beech ki patti khinchti hai; phone par tabs |
| Code Studio | Projects | VS Code jaisa: activity bar, explorer/search/git/tests/steps, editor groups + preview, panel (problems/output/terminal/tests/ports), status bar, `Ctrl+Shift+P`; gutter me badlav ke nishaan, quick fix pehle diff dikhata hai, `Ctrl+I` line par Sahayak (sirf hint) |
| Notebook | Data & ML | Side (Files / Data / Variables + RAM) · cells · Sahayak; runtime: Browser Python (Pyodide) / Parikshaa CPU job / **Colab me GPU** (grade hamesha yahin, chhupa test bahar nahi) |
| Interview | Career | Setup → live (baat + code, Sahayak band) → report (rubric, "hiring score nahi") |
| Admin | Console | Side bar groups, "Viewing as" role, `Gate` (taala + kaun kar sakta), `FourEyes` (wajah + doosri manzoori), audit me sab |

## 8. Components

- **kit.tsx:** LogoMark, Logo, Diya, Tick, Hl, PenCircle, PenNote, Stamp, Badge, Kbd, Level, Avatar, SampleNote, Skel,
  Empty, usePresence, Tabs, Seg, Toggle, Check, Menu, Modal, Drawer, CountUp, Meter, Ring, Donut, Spark, LineChart, Bars,
  Heatmap, Code, PageHead, Card, Stat.
- **focus.tsx:** FocusBar, PaneToggles, Panes, PaneHead, usePanes. **shell.tsx:** Shell, CommandPalette (`Ctrl+K`),
  KeySheet (`?`, `G`+akshar), notifications drawer, ThemeButton, LangButton. **sahayak.tsx:** SahayakPanel (contexts:
  problem, sql, notebook, lesson, studio, general).
- **akit.tsx (admin):** AdmHead, Gate, FourEyes, RowMenu, Toolbar, Pager, useSelection, Status, Masked, useFirstLoad,
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
- **Admin:** jokhim wale kaam (refund ₹5,000+, role badalna, recruiter suspend, GPU chalu) 4-eyes; keys ki value kabhi
  screen par nahi, sirf "set hai ya nahi".

## 10. Asli code me laana (jab owner kahe "shuru karo")

1. **Brand ek jagah:** `packages/brand` ke tokens, fonts aur logo is file ke hisaab se. Abhi wahan purana look (Inter,
   प mark) hai jo exam app (`packages/web`) aur console bhi use karte hain. **Faisla chahiye:** naya brand sab jagah
   (sujhaav: haan, ek saath) ya sirf Learn. [CODE-READINESS.md](CODE-READINESS.md) §1.
2. Kit components ko `packages/brand/src/ui.tsx` me laana, tests ke saath (har component ka render + a11y).
3. Learner shell aur screens `packages/web` me, pehle fixtures (sample data) se, phir API se.
4. Admin pages `packages/console` me, roles matrix `ADMIN-PANEL.md` §1 + `runtime`, `recruiters`.
5. Har screen ki **visual baseline** mock ke screenshots se milao (1440/390, dono theme); axe 0 errors; bundle budget.
6. Har slice ke baad tracker (`PREP-TRACKER.md`) aur handoff update.

## 11. Naye session ke liye checklist (design wahi rahe)

- [ ] Ye file aur mock ka `tokens.css` padha.
- [ ] Logo sirf `LogoMark` se, upar wala SVG; koi doosra P ya प nahi.
- [ ] Naya rang ya font nahi; zaroorat ho to pehle token, phir use.
- [ ] Naya screen pehle mock me (registry + shots + qa), owner dekhe, phir code.
- [ ] Har text teen bhasha, dono theme, 390 px par jaancha.
