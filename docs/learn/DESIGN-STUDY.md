# Design study: TUF ka UI kya sahi karta hai, hamara mock v1 kyun kamzor tha (20 Oct 2026)

Owner ne mock v1 ([mock/README.md](mock/README.md)) pasand nahi kiya aur TUF ke 4 screenshots + Planly ka video bheja
(saath me pichhla platform-features video, [../LEARN-LAUNCH-PLAN.md](../LEARN-LAUNCH-PLAN.md) §1). Ye doc batata hai
kya seekha, aur mock v2 kaise banega. **Niyam:** pattern seekhna theek, TUF ka logo, mascot, naam, copy ya hubahu
layout nahi ([../LEARN-LAUNCH-PLAN.md](../LEARN-LAUNCH-PLAN.md) §11).

**Aage:** platform-features ke 3 clips se har feature ka flow, har component aur poora plan:
[DESIGN-PLAN-V2.md](DESIGN-PLAN-V2.md) (20 Oct).

## 1. TUF ke screens: kya dikha

| Screen | Layout | Kaam ka logic |
|---|---|---|
| **A2Z sheet** | Baayein sidebar tree (Prep Hub; Practice → DSA, SQL, Aptitude → Quant/Logical/Verbal; Planly; Community; Additionals → Blogs, Unlock). Upar patli bar: sale banner + countdown, search, coins, streak, Plus. Beech: title, ek line description, "Start Free" + "Plan with Planly", daayein **overall progress ring** + Easy/Medium/Hard ginti. Toolbar: search, filter, random, more. Neeche **collapse hone wale sections** (har ek par "0/31"), andar sub-sections. Daayein rail: "Too many tabs open?" upgrade card + Daily Planner | Har row: checkbox, naam, tag (Basic/Core/Pro), chhote icons (article, video, notes, revision, star, ⋯). Ek nazar me 400+ items, kuch bhi bada nahi |
| **Aptitude practice set** | Sidebar me Resources / Practice Set (Set 1–4) / Mock Test, neeche "0/7" progress. Beech: "Question 1", sawaal, 4 option poori chaudai ki patti. Daayein: **timer (Hours/Minutes/Seconds ke 3 dabbe)**, Retake, Pause; **question palette** 5×2 + legend (Correct, Incorrect, Current, Unanswered). Neeche Previous / Next / Submit | Jawab ke baad do accordion: **Video explanation** (thumbnail, instructor ka chehra) aur **Detailed solution** (Given values → conversion → formula → values daalo → jawab, har line alag). Mascot palette ke kinare se jhaankta hai |
| **Topic article** (Speed, Time, Distance) | Upar video thumbnail, phir lamba lekh: headings, **formula boxes** (math sahi typeset), "Downstream = b + c" jaise rule boxes, udaharan, **cheat sheet table** (Kya / Formula / Kab use karein), "Safe Shortcuts" list, **FAQ** | Padhne ka kram: concept → formula → udaharan → shortcut → galtiyan → FAQ. Har formula ke saath "kab nahi chalega" |
| **Planly** (video) | Bada heading "…built around your goals", chhota subtext, social proof (avatars + "48.7K+ plans"). Do column: baayein **vertical steps** (About you, Understanding your goals, Weekly sprints, Solve & Practice, Track your time, Progress tracker, Missed a Day?) ek line aur dot ke saath; daayein **chalta hua preview card** (sawaal + chips). Neeche daayein "Create my plan →" + "Takes less than 3 minutes" | Feature samjhaane ke liye **live demo**, screenshot nahi |
| **Platform-features** (pichhla video) | Har feature: baayein tab list, daayein animated demo; glow wale card; mascot; "orbit" chips | Ek page par poora product |

## 2. Unke design ki DNA (jo humein seekhna hai)

1. **Dark-first.** Lagbhag kaala background, thoda halka card, bahut patli border. Rang kam: ek neela action, hara
   (sahi/explore), sona (Plus). Baaki sab grey ki 4–5 shades.
2. **Ghana (dense) aur shaant.** Body 13–14 px, rows ~36 px, bade heading sirf page title par. Card nahi, **list aur
   section**. Har jagah zyada content, kam sajavat.
3. **Teen hisse ka shell.** Baayein tree sidebar (collapse hota), beech content, daayein rail (planner, upgrade).
   Har page ek hi shell me, isliye app "ek" lagta hai.
4. **Har cheez ka status dikhta hai.** Progress ring, "0/31", palette ke rang, timer. Learner ko pata hai wo kahan hai.
5. **Content asli aur bharpoor.** Lamba lekh, video, solution ki har line. Design content ko jagah deta hai.
6. **Ek mascot**, chhota, kinare par, mood ke liye; har jagah nahi.
7. **Marketing me motion**, app me nahi. App me sirf hover aur halka transition.

## 3. Hamara mock v1 kyun kamzor tha (sach)

| Kami | Asar |
|---|---|
| Light theme, kai pastel rang (peach, hara, lavender, neela chips) | "Template" jaisa, premium nahi; brand ki pehchaan dhundhli |
| Bade heading (28–34 px), bade card, zyada padding | Tool kam, landing page zyada lagta; ek screen par kam kaam |
| Har cheez card me | Ghanapan nahi; lists aur sections ki jagah dabbe hi dabbe |
| Asli content nahi (chhote nakli text) | Lekh, solution, video jaise "bhare" hisse dikhe hi nahi |
| Koi image, video thumbnail, math typeset, mascot nahi | Bejaan lagta hai |
| Maine render karke dekha hi nahi (canvas ka niyam) | Galtiyan pakadne ka mauka nahi mila |
| 46 screens ek saath, gehraai kam | Har screen aadhi-adhuri |

## 4. Mock v2 kaise banega (badla hua tareeka)

1. **Pehle 5 screens, gehraai se:** A2Z jaisa sheet page, aptitude practice set (timer + palette + solution),
   topic article (formula, cheat sheet, FAQ), problem workspace (editor + verdict), Home/Planner. Owner haan kare tab
   baaki.
2. **Asli code me, asli tokens se:** `apps/web` ke andar ek `/mock` route (ya alag chhota Vite app), React + hamara
   brand package. Jo mock bane wahi baad me product ka code ho, phenkna na pade.
3. **Har baar render + screenshot:** Playwright (Chromium pehle se hai) se 1440 aur 390, dark aur light. Main khud
   screenshot dekh kar sudhaarunga, phir owner ko bhejunga. Screenshots `docs/learn/mock-v2/` me.
4. **Look (prastaav):**
   - Dark-first, light toggle. Surfaces: `#0B0D12` page, `#12151C` panel, `#181C25` hover, border `#232836`.
   - Text `#E6E8EE`, secondary `#9AA1B2`, muted `#6B7285`.
   - Action: Parikshaa indigo dark ke liye `#6E7BFF`. Saffron `#F5A524` sirf Plus, streak, premium. Sahi `#22C55E`,
     galat `#EF4444`. TUF ka neela/hara combo nahi, taaki pehchaan alag rahe.
   - Font: UI ke liye Geist ya Plus Jakarta Sans (OFL), code JetBrains Mono, Hindi Noto Sans Devanagari. Body 14 px,
     lekh 17 px / 1.75.
   - Icons Lucide 1.5 px stroke. Radius 8 (row), 12 (panel). Shadow lagbhag nahi, border se alag.
   - Hamara mascot (owner banwayein), hamare sketch visuals (coral + ink, [VISUAL-STYLE.md](VISUAL-STYLE.md)).
5. **Open-source libraries (MIT/ISC, code me):** Radix primitives (dialog, popover, tabs; a11y), Lucide icons, KaTeX
   (formula), Shiki (code rang), CodeMirror 6 (editor), react-resizable-panels (workspace split), cmdk (Ctrl+K),
   Motion (marketing animation), Embla (dry-run slider), rough.js (sketch). Sab ka licence package add karte waqt
   jaanchenge.

## 5. Owner se kya chahiye

| # | Kya | Kyun |
|---|---|---|
| 1 | 3–5 products jinka design pasand hai (TUF ke alawa) aur har ek me **kya** pasand hai | Seedha nishaana |
| 2 | Dark-first theek? (sujhav: haan, light toggle ke saath) | Poora look isi par |
| 3 | Brand rang: indigo + saffron hi rakhein? (sujhav: haan) | TUF se alag pehchaan |
| 4 | Logo SVG; mascot ke liye illustrator (6–8 poses, ~₹15–40k) | Premium feel, AI se nahi |
| 5 | Ek topic ka asli content (jaise aapke Speed-Time-Distance notes ya ek DSA problem) | Mock asli lage |
| 6 | Plugins: **frontend-design** aur **Design** (Anthropic) | Behtar UI aur critique ke niyam |
| 7 | (Optional) Figma: sirf agar designer rakhein; tab Figma plugin | Designer ↔ code |
