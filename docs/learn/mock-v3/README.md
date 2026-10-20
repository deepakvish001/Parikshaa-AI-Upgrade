# Learn v2: clickable mock v4, "Kaagaz aur Syaahi" (20 Oct 2026)

Mock v3 dekh kar owner ne kaha: "sab achha laga, bas font AI wala lag raha hai; har page complete dark black, sab saaf
dikhe, light me bhi; har border, box, animation refine karo; Code Studio VS Code jaisa; admin ka har page har pehlu se;
human feel." Ye v4 wahi hai: **68 screens** (43 learner + naksha/brand, 25 admin), wahi app aur wahi link. Faisla aur
wajah: [../DESIGN-V4.md](../DESIGN-V4.md) (v3 ka dhaancha: [../DESIGN-V3.md](../DESIGN-V3.md)). Purane: v1
[../mock/README.md](../mock/README.md), v2 [../mock-v2/README.md](../mock-v2/README.md).

**Dekhne ka link (private, sirf owner):** https://claude.ai/artifact/LDK6qdh2qKj8WzWYAiN4Zn
Doosron ko dikhana ho to page ke Share menu se.

![Saare screens ek nazar me](screens/overview.jpg)

## Kaise dekhein

- Link kholte hi **naksha** (`#map`). Kisi card par click karo, ya `#landing` se shuru karo. Neeche **"All screens"**
  se kabhi bhi wapas.
- Ab **kaala theme default** hai. Upar ka chand/suraj button light "kaagaz" par le jaata hai; chuna hua yaad rehta hai.
  Bhasha: English / Hinglish / हिंदी.
- **Ctrl+K** koi bhi screen. **Ctrl+J** Sahayak. **Ctrl+\\** sidebar chhota.
- **Problem, SQL:** Statement | Code | Sahayak teen pane, khinch kar size, × se band.
- **Code Studio (`#studio`):** VS Code jaisa. Activity bar se Explorer / Search / Source control / Testing / Steps,
  Ctrl+B side bar, Ctrl+` panel, Ctrl+J Sahayak, Ctrl+Shift+P command palette, beech ki patti khinch kar size,
  tabs par × se band, "Check my work" se tests.
- **Admin:** `#admin-login` ya `#admin`. Upar **"Viewing as"** se role badlo (Finance, Editor, Analyst...): band module
  par taala, band button par "Chahiye: ...", page role me nahi to "Request access". Risky kaam par wajah + doosre
  insaan ki manzoori.

## v3 se kya badla

| v3 | v4 |
|---|---|
| Instrument Serif + Geist: AI-bane pages jaisa jod | **IBM Plex Sans** + **Plex Sans Devanagari** (Hindi aur English ek jaise), code ke liye **JetBrains Mono**; bade title bold sans, italic nahi |
| Light default, dark hara-kaala (blackboard) | **Kaala default** (`#000`), har dhaar aur icon dikhe; light "kaagaz" bhi utna hi saaf |
| Alag-alag radius aur halki dhaar | Ek radius set (6/8/12/14), dikhne wali dhaar, button/input/checkbox/table ki saaf haalat, popup kaale par alag |
| Studio: 4 pane wala editor | **VS Code jaisa workbench** (upar dekho) |
| Kuch admin pages patle | Learners, community, aptitude, companies, contests, problem editor gehre: saved views, tabs, bulk, loading haalat, editors |

## Screens (route = link ke peeche `#naam`)

| Hissa | Route | Kya dikhata hai | Screenshot |
|---|---|---|---|
| Naksha | `#map` | Har screen ka card aur flow; yahin se kuch bhi kholo | [desktop](screens/desktop/map-1440-dark.jpg) |
|  | `#brand` | Naya logo (प jiske andar tick ✓), lockups, rang (kaala aur kaagaz), IBM Plex font, components, motion | [desktop](screens/desktop/brand-1440-dark.jpg) |
| Pehli baar | `#landing` | Home: hero me kaagaz par aaj ka plan, din kaise chalta hai, kya alag hai (sabse chhota fail test, scrub hone wala editorial, Sahayak pehle poochhta), aptitude, company prep source ke saath, Banao | [desktop](screens/desktop/landing-1440-dark.jpg) · [light](screens/light/landing-1440-light.jpg) · [phone](screens/phone/landing-390-dark.jpg) · [हिंदी](screens/hindi/landing-1440-dark-hi.jpg) |
|  | `#login` | Google, phone OTP, email; graph-paper par | [desktop](screens/desktop/login-1440-dark.jpg) |
|  | `#onboarding` | 6 sawaal, side me plan banta dikhta hai | [desktop](screens/desktop/onboarding-1440-dark.jpg) |
| Roz ka loop | `#aaj` | Aaj ke kaam, jahan chhoda wahan se, streak, kamzor vishay | [desktop](screens/desktop/aaj-1440-dark.jpg) · [light](screens/light/aaj-1440-light.jpg) · [phone](screens/phone/aaj-390-dark.jpg) · [हिंदी](screens/hindi/aaj-1440-dark-hi.jpg) |
|  | `#plan` | Sprints → din → kaam; din chhoota to raaste | [desktop](screens/desktop/plan-1440-dark.jpg) |
|  | `#revision` | Revision cards aur galtiyon ki copy (laal pen) | [desktop](screens/desktop/revision-1440-dark.jpg) |
|  | `#daily` | Daily 10: phone par 10 chhote sawaal | [desktop](screens/desktop/daily-1440-dark.jpg) |
| Seekho | `#courses` | Notebook covers jaise courses, goal se filter | [desktop](screens/desktop/courses-1440-dark.jpg) · [light](screens/light/courses-1440-light.jpg) |
|  | `#roadmap` | Role roadmap; node dabao to drawer | [desktop](screens/desktop/roadmap-1440-dark.jpg) |
|  | `#course` | Syllabus, pragati, project | [desktop](screens/desktop/course-1440-dark.jpg) |
|  | `#lesson` | Copy jaisi margin me teacher ke note, chalne wala code, quiz | [desktop](screens/desktop/lesson-1440-dark.jpg) · [light](screens/light/lesson-1440-light.jpg) · [phone](screens/phone/lesson-390-dark.jpg) · [हिंदी](screens/hindi/lesson-1440-dark-hi.jpg) |
| Abhyas | `#practice` | Tracks, sheets, aaj ka problem, agla contest | [desktop](screens/desktop/practice-1440-dark.jpg) · [phone](screens/phone/practice-390-dark.jpg) |
|  | `#sheet` | Kadam-dar-kadam DSA sheet | [desktop](screens/desktop/sheet-1440-dark.jpg) |
|  | `#problem` | **Statement | Code | Sahayak** teen pane; har pane khinch kar chhota/bada, × se band; "Mock: see each state" se WA/TLE/AC | [desktop](screens/desktop/problem-1440-dark.jpg) · [light](screens/light/problem-1440-light.jpg) · [phone](screens/phone/problem-390-dark.jpg) · [हिंदी](screens/hindi/problem-1440-dark-hi.jpg) |
|  | `#editorial` | Brute → better → best, dry run slider | [desktop](screens/desktop/editorial-1440-dark.jpg) · [light](screens/light/editorial-1440-light.jpg) |
|  | `#sql` | Schema | query | nateeja, Sahayak pane | [desktop](screens/desktop/sql-1440-dark.jpg) |
|  | `#aptitude` | Quant, logical, verbal, mocks | [desktop](screens/desktop/aptitude-1440-dark.jpg) |
|  | `#apt-set` | Tareeka aur shortcut ke saath practice set | [desktop](screens/desktop/apt-set-1440-dark.jpg) |
|  | `#apt-mock` | Asli jaisa timed mock (Sahayak band, taala) | [desktop](screens/desktop/apt-mock-1440-dark.jpg) · [phone](screens/phone/apt-mock-390-dark.jpg) |
|  | `#apt-result` | Score, har sawaal ka samay | [desktop](screens/desktop/apt-result-1440-dark.jpg) |
|  | `#potd` | Roz ek problem, streak | [desktop](screens/desktop/potd-1440-dark.jpg) |
|  | `#contests` | Aane wale, pichhle, rating | [desktop](screens/desktop/contests-1440-dark.jpg) · [phone](screens/phone/contests-390-dark.jpg) |
|  | `#contest-brief` | Niyam, shuru | [desktop](screens/desktop/contest-brief-1440-dark.jpg) |
|  | `#contest-live` | Timer, problems, editor (Sahayak band) | [desktop](screens/desktop/contest-live-1440-dark.jpg) |
|  | `#contest-result` | Rank, rating, kya seekhna | [desktop](screens/desktop/contest-result-1440-dark.jpg) |
| Career aur Banao | `#companies` | Company ke hisaab se taiyari (naam nakli) | [desktop](screens/desktop/companies-1440-dark.jpg) |
|  | `#company` | Rounds, topics, readiness | [desktop](screens/desktop/company-1440-dark.jpg) · [light](screens/light/company-1440-light.jpg) · [phone](screens/phone/company-390-dark.jpg) |
|  | `#experiences` | Round-dar-round interview experiences | [desktop](screens/desktop/experiences-1440-dark.jpg) |
|  | `#build` | **Naya Banao hub:** jaari project ka asli preview, tracks, project gallery, labs | [desktop](screens/desktop/build-1440-dark.jpg) · [phone](screens/phone/build-390-dark.jpg) |
|  | `#project` | **Naya project page:** spec, milestones (acceptance + tests), rubric, Studio me kholo | [desktop](screens/desktop/project-1440-dark.jpg) |
|  | `#studio` | **VS Code jaisa Code Studio:** title bar + command center (Ctrl+Shift+P), activity bar, explorer (git M/U, error ginti), tabs + breadcrumbs, code lens, galat line ke neeche error, minimap, live preview doosre group me, panel (Problems, Output, Terminal, Test results, Ports), status bar, Sahayak daayein (Ctrl+J), Ctrl+B / Ctrl+` | [desktop](screens/desktop/studio-1440-dark.jpg) · [light](screens/light/studio-1440-light.jpg) · [phone](screens/phone/studio-390-dark.jpg) |
|  | `#pramaan` | Proctored certificate test | [desktop](screens/desktop/pramaan-1440-dark.jpg) |
|  | `#certificate` | Mohar wala certificate, QR se verify | [desktop](screens/desktop/certificate-1440-dark.jpg) |
|  | `#profile` | Verified vs khud bataya | [desktop](screens/desktop/profile-1440-dark.jpg) · [phone](screens/phone/profile-390-dark.jpg) |
|  | `#jobs` | Jobs, applications, resume par laal-pen check | [desktop](screens/desktop/jobs-1440-dark.jpg) |
| Mera | `#lists` | Problem lists | [desktop](screens/desktop/lists-1440-dark.jpg) |
|  | `#notes` | Apni galtiyon se notes | [desktop](screens/desktop/notes-1440-dark.jpg) |
|  | `#community` | Charcha aur groups | [desktop](screens/desktop/community-1440-dark.jpg) |
|  | `#sahayak` | Sahayak poora page | [desktop](screens/desktop/sahayak-1440-dark.jpg) |
|  | `#plus` | Free vs Plus (daam owner tay karega) | [desktop](screens/desktop/plus-1440-dark.jpg) |
|  | `#settings` | Bhasha, theme, privacy | [desktop](screens/desktop/settings-1440-dark.jpg) |
| Admin | `#admin-login` | Staff sign-in: SSO ya email, phir 6 ank ka 2FA; naya device, IP list | [desktop](screens/desktop/admin-login-1440-dark.jpg) |
|  | `#admin` | Dashboard: KPI (role ke hisaab se chhupe), "aapka dhyan chahiye", pipeline, kamaai | [desktop](screens/desktop/admin-1440-dark.jpg) · [light](screens/light/admin-1440-light.jpg) · [phone](screens/phone/admin-390-dark.jpg) |
|  | `#adm-review` | Review queue: learner jaisa preview, machine checks, checklist poora hone tak approve band | [desktop](screens/desktop/adm-review-1440-dark.jpg) |
|  | `#adm-approvals` | 4-eyes: risky kaam doosre insaan ki manzoori tak ruke; apni request khud approve nahi | [desktop](screens/desktop/adm-approvals-1440-dark.jpg) |
|  | `#adm-problems` | Saare problems: filter, bulk, delete par 4-eyes | [desktop](screens/desktop/adm-problems-1440-dark.jpg) |
|  | `#adm-problem` | Problem editor, 8 tab: statement (EN/HG/हि), tests, solutions, editorial editor (outline + preview), visuals (dry-run frames JSON + frames), meta, checks, history | [desktop](screens/desktop/adm-problem-1440-dark.jpg) · [light](screens/light/adm-problem-1440-light.jpg) |
|  | `#adm-aptitude` | Items (selection + bulk), practice sets, mock pattern builder (sections, minute, negative marking, live total), answer-key reports | [desktop](screens/desktop/adm-aptitude-1440-dark.jpg) |
|  | `#adm-lessons` | Course tree + block editor (text, code, visual, callout, quiz) | [desktop](screens/desktop/adm-lessons-1440-dark.jpg) |
|  | `#adm-roadmaps` | Roadmap graph editor | [desktop](screens/desktop/adm-roadmaps-1440-dark.jpg) |
|  | `#adm-companies` | Companies, verify karne wale facts (saboot ke saath), source ke niyam; bina source fact chhupa | [desktop](screens/desktop/adm-companies-1440-dark.jpg) |
|  | `#adm-factory` | AI content factory: batches, stages, kharch, pause/stop | [desktop](screens/desktop/adm-factory-1440-dark.jpg) |
|  | `#adm-learners` | Saved views (Plus, Campus, risk me, reported), summary, loading haalat, 10 learners | [desktop](screens/desktop/adm-learners-1440-dark.jpg) · [light](screens/light/adm-learners-1440-light.jpg) |
|  | `#adm-learner` | Ek learner: email/phone masked (reveal log hota), plan, activity, "learner ki nazar se" 4-eyes | [desktop](screens/desktop/adm-learner-1440-dark.jpg) · [phone](screens/phone/adm-learner-390-dark.jpg) |
|  | `#adm-support` | Ticket aur "galti batao" ek inbox, andar ka note | [desktop](screens/desktop/adm-support-1440-dark.jpg) |
|  | `#adm-community` | Flags (rakho, spoiler, mute, ban 4-eyes), experiences, saare posts, mute/ban + appeal | [desktop](screens/desktop/adm-community-1440-dark.jpg) |
|  | `#adm-commerce` | Plans, limits, coupons, orders, ₹5,000+ refund par 4-eyes, GST invoice | [desktop](screens/desktop/adm-commerce-1440-dark.jpg) |
|  | `#adm-contests` | Saare contests ki list, live monitor, setup, copy check, rating publish | [desktop](screens/desktop/adm-contests-1440-dark.jpg) |
|  | `#adm-ai` | Sahayak AI: kharch, cap, limits, prompts (A/B), evals, har mode ka kill switch | [desktop](screens/desktop/adm-ai-1440-dark.jpg) |
|  | `#adm-analytics` | Funnel, weekly retention, kis content par kaam chahiye | [desktop](screens/desktop/adm-analytics-1440-dark.jpg) |
|  | `#adm-notify` | WhatsApp/email/push campaign, shant samay, preview | [desktop](screens/desktop/adm-notify-1440-dark.jpg) |
|  | `#adm-roles` | 8 roles ka matrix; cell dabao, badlav 4-eyes ke baad | [desktop](screens/desktop/adm-roles-1440-dark.jpg) · [light](screens/light/adm-roles-1440-light.jpg) · [phone](screens/phone/adm-roles-390-dark.jpg) |
|  | `#adm-staff` | Staff invite, 2FA haalat, sessions, role badlo | [desktop](screens/desktop/adm-staff-1440-dark.jpg) |
|  | `#adm-audit` | Audit log: kaun, kya, kab, wajah, pehle/baad; hash chain | [desktop](screens/desktop/adm-audit-1440-dark.jpg) |
|  | `#adm-security` | SSO, IP allowlist, session, 4-eyes niyam, learner data, API keys, DPDP requests | [desktop](screens/desktop/adm-security-1440-dark.jpg) |
|  | `#adm-system` | Health, feature flags, maintenance, site settings | [desktop](screens/desktop/adm-system-1440-dark.jpg) |

Screenshots: `screens/desktop` (68, 1440, kaala), `screens/light` (12), `screens/phone` (14, 390, kaala), `screens/hindi` (4).

## Jaanch (20 Oct, v4)

- 68 screens × 7 (1440 kaala, 1440 light, 1024 kaala, 390 kaala, 390 light, 1440 kaala हिंदी, 390 light हिंदी): page side me
  nahi khisakta (horizontal overflow 0), console me koi error nahi.
- Admin ke 26 route Finance, Analyst, Editor, Moderator role me bhi khole: taala aur "Request access" sahi.
- Text contrast (WCAG): kaale par mukhya text 12:1, doosra 6:1, neela button par safed 4.9:1; light par mukhya 9.7:1,
  doosra 4.8:1. Sabse halka grey (`ink-4`) sirf disabled aur sajawat me, padhne wale text me nahi.
- Studio ke naye tabs aur admin ke naye tabs (editorial, visuals, mock patterns, posts) click karke dekhe: error nahi.

## Imaandari

Saara data sample hai aur screen par likha hai; company naam nakli; koi nakli testimonial, user ginti ya logo nahi;
Plus aur campus ka daam `₹[...]` (owner tay karega); TUF/LeetCode ka koi naam, copy, logo ya layout nahi.

## Abhi mock me nahi (code ke waqt)

- Asli login, data, judge, AI, payment: sab dikhawa hai; buttons toast dikhate hain.
- Har haalat (loading, khaali, error) har screen par nahi; loading aur khaali ke namoone `#brand` par, aur problem
  screen par "Mock: see each state" se WA / TLE / AC.
- Hindi poori nahi: menus aur mukhya text teen bhasha me, lambe paragraph kai jagah English me.

## Owner ke faisle

1. Naya font (IBM Plex) aur kaala default ab "human" lagta hai? Kahin aur badlav?
2. Code Studio VS Code jaisa theek hai? Kuch aur chahiye (jaise extensions, debug)?
3. Naya logo (प + tick) theek hai?
4. Plus, campus aur Pramaan test ke daam.
5. Admin ke 8 roles aur 4-eyes ke niyam (`#adm-security` → "4-eyes rules") theek hain?
6. Haan ho to: isi design se asli code shuru (Learn v2 handoff ka agla kadam).

## Chalana aur badalna

```bash
cd docs/learn/mock-v3/app
npm install            # sirf pehli baar; baaki packages repo ke root se
npx tsc -p tsconfig.json && npx vite build && node build-artifact.mjs   # dist/artifact.html (ek file)
node shots.mjs <out> <route,route> 1440,390 dark en view                # screenshots; ROLE=finance se role
node qa.mjs 390 dark hi                                                 # har screen: overflow, console error; ROLE=finance bhi
node overview.mjs                                                       # screens/overview.jpg dobara
```

Code: `src/screens/*` (learner; Studio `studio.tsx`), `src/admin/*` (admin), `src/ui/*` (shell, focus panes, Sahayak, kit),
`src/styles/*` (tokens.css me saare rang, light + dark; fonts.css me IBM Plex, JetBrains Mono).
