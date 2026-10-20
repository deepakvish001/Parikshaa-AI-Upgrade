# Learn: design v4, "Kaagaz aur Syaahi" (20 Oct 2026)

Owner (20 Oct, mock v3 dekh kar): "mujhe sab achha laga, bas font thoda AI wala lag raha hai; dark, bold, neat, clean,
aankh ko saaf dikhe, human psychology se dekh kar attract kare. Har page complete dark black background me, usme saare
font, icon, border, box, component, shade theek se dikhein; light mode me bhi waisa hi saaf. Har border, box, animation
refine karo. Code Studio ko VS Code jaisa banao. Admin ke har page ko soch samajh kar har pehlu se banao. Kahin se na
lage ki AI ne banaya hai; human feel."

Ye v3 ([DESIGN-V3.md](DESIGN-V3.md)) ka refine hai: dhaancha, flows, screens, Sahayak ka teesra pane, admin ke roles
sab wahi rehte hain. Badalta hai: font, rang (kaala default), har component ki dhaar aur dikhna, Studio, aur admin ki
gehraai. Mock wahi app hai (`docs/learn/mock-v3/app`) aur wahi link; README me v4 likha.

## 1. Font: AI wala kyun lagta tha, ab kya

| v3 | Kyun AI jaisa | v4 |
|---|---|---|
| Instrument Serif (bade title, italic highlight) | 2025 ke AI-bane landing pages ka sabse aam jod: patla serif + italic shabd | Bade title bhi sans, **bold 700**, tight letter-spacing. Zor rang se, italic se nahi |
| Geist (UI) | v0/Vercel ka default; har doosra AI mock isi me | **IBM Plex Sans**: insaan ke haath jaisa (humanist) grotesk, kaale par bhi saaf, 400–700 |
| Noto Sans Devanagari (alag parivaar) | Hindi aur English ka wazan aur unchai mel nahi khaate the | **IBM Plex Sans Devanagari**: Plex ke saath hi bana, isliye Hinglish aur हिंदी ek jaisi dikhti hai |
| Geist Mono | | **JetBrains Mono**: code ke liye bana, `0 O l 1` alag dikhte hain |
| Kalam (laal pen note) | Theek, par zyada jagah | Sirf teacher ke note me (revision, galti) |
| — | | Certificate ke naam aur mohar: IBM Plex Serif 600 (asli dastavez jaisa) |

Specimen (6 font, kaala aur safed, Hinglish + हिंदी + number + button) dekh kar chuna: Plex ka bold sabse saaf aur
apna sa laga; Onest/Figtree saaf the par aam; Source Sans aur Mukta chhote dikhe.

**Scale:** body 14.5px / 1.55; label 12.5–13px weight 500; card title 15px 600; page title 28–30px 700; hero 56px 700
(-0.03em). Number hamesha tabular. Paragraph 68 akshar tak.

## 2. Rang: kaala default, dono theme me saaf

- **Dark ab default** (har page complete kaala), light toggle se. Pehli baar bhi kaala.
- **Dark "Syaahi":** page `#000`, card `#0C0C0E`, utha hua `#131316`, track `#1C1C20`. Dhaar `#2A2A2F` (dikhne wali),
  zor wali dhaar `#3F3F46`. Text `#FAFAFA`, doosra `#C4C4CC`, teesra `#8F8F99`. Kaale par shadow nahi dikhti, isliye
  card ki pehchaan dhaar + upar 1px ki halki roshni se.
- **Light "Kaagaz":** page `#F6F6F4`, card safed, dhaar `#E2E2DE` / `#CACAC4`, text `#0A0A0B` / `#45464E`.
- **Accent:** neela pen `#4069FF` (dark) / `#2349E6` (light), button par safed text (dono me 4.5:1 se upar). Laal =
  galti, hara = pass, peela = zaroori, jamuni = Sahayak, sona = coins. Har ek ka soft fill + dhaar dono theme me.
- **Niyam:** koi text 4.5:1 se kam nahi (chhota label bhi teesre text rang se upar); har dabne wali cheez ki dhaar
  dikhe; focus ring 2px neela + 2px gap.

## 3. Dhaar, box, motion

- Radius: 6 (chip), 8 (button, input), 12 (card), 16 (bada panel). Ek hi set, har jagah.
- Button: 36px (sm 30, lg 44), weight 600, dabane par 1px neeche; primary bhara, secondary dhaar wala, ghost sirf hover
  par.
- Input: 38px, dhaar `line-2`, focus par neela ring; placeholder teesre rang me.
- Table: header uthe rang me, row ki dhaar, hover par halka rang, number daayein.
- Motion: 120–180ms, ek hi easing; page aane par 6px upar se halka fade; kuch bhi 300ms se lamba nahi; reduce-motion
  par sab band.
- AI ki pehchaan wali cheezein nahi: gradient text, chamakti "sparkle" har jagah, glass blur, bina wajah emoji.

## 4. Code Studio = VS Code jaisa

Title bar (menu + beech me command center "hostel-split") · activity bar (Explorer, Search, Source control, Run &
tests, Steps, Sahayak) · side bar (file tree, folder chevron, file type ke rang wale icon, git M/U nishaan) · editor
group (tabs: dirty dot, ×, preview italic) + breadcrumbs + line numbers + current line + minimap · doosra group me
live preview (browser frame) · neeche panel (Problems, Output, Terminal, Tests, Ports) · status bar (branch, sync,
errors/warnings, Ln/Col, Spaces, UTF-8, language, "Tests 7/10") · daayein secondary side bar me Sahayak · Ctrl+Shift+P
command palette. Phone par: editor + neeche tabs.

## 5. Admin: har page har pehlu se

Har list page: search, filter chips, saved views, column sort, bulk bar, row menu, pagination, khaali aur loading
haalat, detail drawer. Har detail page: header (status, owner, last change), tabs, activity/history, permission ke
hisaab se buttons, 4-eyes jahan risk. Har settings page: section nav, save bar ("3 badlav, save / wapas"), audit link.

## 6. Kram

R0 ye file + tracker row 132 → R1 font, rang, base, kit → R2 learner pages → R3 Studio → R4 admin pages → R5 QA,
screenshots, README, publish.
