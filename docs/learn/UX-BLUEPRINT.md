# UX blueprint: har page, har flow ka sabse accha anubhav (19 Oct 2026)

Flows aur screens ki list: [USER-FLOWS.md](USER-FLOWS.md). Ye doc batata hai **kaise** har page best bane: niyam,
har bade page ka dhaancha (desktop + phone), chhoti-chhoti baatein, aur UX ko naapne ka tareeka. Sab cheezein
[ALL-IN-ONE.md](ALL-IN-ONE.md) ke 7 stambh par. Clickable mock (46 screens): [mock/README.md](mock/README.md).

---

## 1. Das niyam (har page par)

1. **Ek page, ek kaam.** Har page ka ek primary action (saffron button ✅ niyam); baaki secondary.
2. **Agla kadam hamesha dikhe.** "Jaari rakho", "Agla lesson", "Agla step": learner kabhi na soche "ab kya?".
3. **Phone pehle.** 390 px par design shuru; angootha tak pahunch (neeche action), 48 px touch targets, ek haath se.
4. **Turant feedback.** Click par 100 ms me jawab (optimistic UI); lamba kaam ho to progress ("12/40 tests").
5. **Galti par madad, sharam nahi.** WA par saaf wajah + agla kadam; laal sirf asli galti par ✅ niyam (calm, not alarming).
6. **Dheere khulna (progressive disclosure).** Naye learner ko 3 cheezein; jaise-jaise aage, zyada.
7. **Apni bhasha.** Har screen English/हिंदी/Hinglish; Devanagari ki line-height aur font ✅.
8. **Sab ke liye.** Keyboard, screen reader, contrast AA dono theme ✅, reduced motion, dyslexia font option.
9. **Tez aur halka.** LCP < 2 s (4G, beech ka Android), JS budget ✅, skeleton (spinner nahi) ✅, offline note ✅.
10. **Bharosa.** Asli numbers hi, AI ka label, privacy saaf, koi dark pattern nahi (nakli timer, chhupa cancel, raat ki
    notifications).

## 2. Har bade page ka dhaancha

Har page: **Maqsad · Primary action · Desktop · Phone · Haalatein · Naap.**

### 2.1 Home (roz ka darwaza)

- **Maqsad:** 10 second me "aaj kya karna hai" pata chale. **Primary:** "Jaari rakho".
- **Desktop:** upar greeting + goal chip ("SDE · 3 mahine") + streak/league; beech me **Aaj ka plan** (3–6 cards, samay
  ke saath) aur **Daily 10**; daayein: revision due, contest, readiness ring; neeche: "naya kya" (1 card).
- **Phone:** ek column: Jaari rakho (bada) → Daily 10 → aaj ka plan (swipe cards) → baaki fold me.
- **Haalatein:** naya learner (sirf 3 cards + "pehla course"), din chhoota ("plan badlein ya break?"), sab ho gaya
  ("aaj ke liye kaafi" + kal ka preview, koi guilt nahi).
- **Naap:** Home → pehla kaam shuru ka samay < 10 s; D7 retention.

### 2.2 Explore / catalog

- **Maqsad:** sahi course/roadmap 30 s me. **Primary:** "Shuru karo".
- Goal ke hisaab se upar "Aapke liye"; filters (stambh, level, samay, bhasha, free/Plus); search Ctrl+K; har card:
  naam, level, ghante, kya banega, progress.
- **Phone:** filter bottom sheet, cards ek column.
- **Naap:** search se kuch na milna (< 3%), card → shuru conversion.

### 2.3 Course page

[CONTENT-CATALOG.md](CONTENT-CATALOG.md) §3a. **Primary:** "Shuru karo / Jaari rakho". Syllabus accordion me jahan
ruke the wahi khula; har item par samay; project ka screenshot upar. Phone: sticky "Jaari rakho" neeche.

### 2.4 Lesson

- **Desktop:** 45rem text, baayein TOC, daayein (wide screen) "Sahayak / notes" panel band-khulne wala.
- **Phone:** poori chaudai, upar reading progress, neeche sticky "Agla" + "Quiz"; code blocks horizontal scroll +
  "Run" (sheet me output).
- **Chhoti baatein:** text select → "Sahayak se poocho / note me daalo"; visuals tap par fullscreen; padhne ki position
  yaad.

### 2.5 Phone micro-learning (N1)

```
┌────────────────────────┐
│ ← Arrays · 3/10    🔥 12 │
│ Is code ka output kya?  │
│ ┌────────────────────┐ │
│ │ a = [1,2,3]        │ │
│ │ for x in a[::-1]:  │ │
│ │   print(x, end='') │ │
│ └────────────────────┘ │
│ ( ) 123   ( ) 321      │
│ ( ) 3 2 1 ( ) Error    │
│                        │
│ [  Jaanchein  ]        │  ← angoothe ki pahunch
└────────────────────────┘
```
Prakaar: output predict, **Parsons** (lines khinch kar kram), fill-the-blank (code keyboard row: `{ } ( ) [ ] ; : = < > "`),
"bug wali line chuno", dry-run "agla state", flashcard. Har ek 30–90 s; galat par 1 line samjhaana + visual.

### 2.6 Code Studio / guided lab

[CODE-STUDIO.md](CODE-STUDIO.md) §1. UX ki baatein: pehli baar 4-step tour (task, editor, run/test, submit); test fail
par **pehla fail test khud khulta hai** diff ke saath; "Submit" tabhi sabse aage jab visible tests hare; phone par Task +
chhote edit, aur "laptop par jaari rakho" (QR).

### 2.7 Arena / DSA problem

[USER-FLOWS.md](USER-FLOWS.md) F6. UX: statement aur editor ke beech divider yaad rahe; verdict card upar se slide
(screen reader ko bhi); AC par chhota jashn (confetti nahi, mascot ka ek pose ✅ reduced motion me band); "chhota galat
test" ek button.

### 2.8 Project brief (N3)

- **Maqsad:** design dekh kar banana. **Primary:** "Studio me kholo".
- Upar design images (desktop/phone), requirements checklist, assets download, API spec, acceptance tests ki list;
  neeche community ke submissions (galleries) + feedback.
- **"Ship it":** ek click me live link (static), portfolio me jud jaata.

### 2.9 Hackathon / contest (N4, ✅)

Countdown, niyam, team (bana ho to members), milestones, submit (repo/link + video-less demo: screenshots + notes),
judging rubric, nateeje; Hire company wale challenge par "interview ke liye shortlist" ka saaf likha niyam.

### 2.10 Certification exam (N6)

Exam engine ✅ ka flow (system check, rules, proctoring notice ✅ calm tone), pass par certificate + verify link +
LinkedIn par jodne ka button.

### 2.11 Career hub (N7)

Tabs: **Resume** (form + live preview, ATS check, AI salah), **Portfolio** (auto bana site ka preview, theme 3, apna
domain baad me), **Jobs/Internships** (Hire ✅: filter, apply ek click, status), **Mock interviews** (AI/peer),
**Certificates**. Phone par resume ek-ek section (wizard).

### 2.12 Community / forum / cohort (N5, N9, N15, N16)

Thread list (topic, college, "jawab mila"), post me code + spoiler; cohort page: hafte ka goal, members ki progress (sirf
consent wali), deadline; mentor request ka flow (AI review pehle).

### 2.13 Profile (public)

Upar naam, headline, Pramaan/certificates, top skills (radar), projects (live links), heatmap ✅, contest rating; privacy
chip (public/link/recruiters). Phone: sections fold me.

### 2.14 Search (Ctrl+K)

Ek box me sab: courses, lessons, problems, labs, articles, roadmaps, settings, "Sahayak se poocho" (agar kuch na mile).
Keyboard se upar-neeche; recent; phone par full-screen sheet.

## 3. Chhoti baatein (micro-interactions)

| Jagah | Kya |
|---|---|
| Button | Press par 1 px dabna, loading par text ("Jaanch ho rahi hai…"), double submit band |
| Save | "Saved" halka chip 1.5 s, offline par "Phone me rakha, net aane par bhejenge" |
| Streak | Din poora → flame ka chhota animation (reduced motion par nahi) |
| League | Hafte ke aakhir upar/neeche jaane ka saaf card, sharam wali bhasha nahi |
| Empty state | Sketch illustration + 1 line + 1 button |
| Error | Kya hua + kya karein + "Dobara" |
| Toast | 4 s, undo jahan ho sake (delete) |

## 4. Design system ka jod

Tokens ✅ ([../DESIGN.md](../DESIGN.md)) + [USER-FLOWS.md](USER-FLOWS.md) §1a ke Learn tokens. Naye components: Parsons
board, code keyboard row, league card, skill radar, project brief header, portfolio themes, cohort board, forum thread,
certificate card. Sab ki **Storybook-jaisi gallery** ✅ (design gallery pehle se), visual baselines ✅, axe ✅.

## 5. UX kaise naapenge aur sudhaarenge

| Kaam | Kab | Kitna |
|---|---|---|
| Student interviews (tier 1/2/3 colleges, phone-only bhi) | Build se pehle | 20 students |
| Mockups par usability test (Hindi + English) | Har bade page se pehle | 5–8 har round |
| Beta me test | Private beta | 300–500 |
| **SUS score** | Har milestone | ≥ 80 |
| Task success (jaise "pehla problem submit") | Har milestone | ≥ 90% |
| Time to first value (signup → pehla AC/lesson) | Lagaataar | < 5 min |
| Rage clicks, drop-off (PostHog ✅) | Lagaataar | Hafte ki review |
| Accessibility (axe ✅ + manual screen reader) | Har release | 0 critical |
| Speed (Lighthouse, field data) | Har release | LCP < 2 s |

**Design QA gate (har UI slice):** screenshots 1440/390 × light/dark × en/hi ✅, axe 0, budget ✅, ek mobile device par
haath se check, owner ko screenshot (bade pages).
