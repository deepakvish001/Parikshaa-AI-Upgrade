# Learn v2: clickable mock v3, "Kaagaz aur Blackboard" (20 Oct 2026)

Owner ne v2 dekh kar kaha: "bilkul ye same design nahi chahiye, TUF se better aur alag lagna chahiye; har page ke har
feature aur component ko soch samajh kar design karo; Build ke 3 screens bilkul pasand nahi; modern admin panel saare
roles ke saath, secure; Sahayak khole to usi screen me teesra pane jise hata sakein; home/landing, behtar branded logo;
professional, end to end." Ye wahi hai: **68 screens** (43 learner + naksha/brand, 25 admin), ek React app me, links
aur buttons se jude. Design ka faisla aur wajah: [../DESIGN-V3.md](../DESIGN-V3.md). Purane: v1
[../mock/README.md](../mock/README.md), v2 [../mock-v2/README.md](../mock-v2/README.md).

**Dekhne ka link (private, sirf owner):** https://claude.ai/artifact/LDK6qdh2qKj8WzWYAiN4Zn
Doosron ko dikhana ho to page ke Share menu se.

![Saare screens ek nazar me](screens/overview.jpg)

## Kaise dekhein

- Link kholte hi **naksha** (`#map`) aata hai: har screen ka card aur flow. Kisi card par click karo, ya `#landing` se
  shuru karke button dabate jao. Neeche **"All screens"** se kabhi bhi naksha par wapas.
- **Ctrl+K**: koi bhi screen dhoondo aur kholo. **Ctrl+J**: Sahayak pane kholo/band karo. **Ctrl+\\**: sidebar chhota.
- Upar **bhasha** (English / Hinglish / हिंदी) aur **theme** (light "kaagaz" / dark "blackboard"); dono yaad rehte hain.
  Pehli baar theme aapke system jaisi.
- **Problem, SQL, Studio, editorial ka code:** Statement | Code | Sahayak teen pane. Beech ki patti khinch kar size
  badlo, × se pane band (patli rail ban jaata hai, click se wapas), upar bar me teeno ke toggle. Kam se kam ek pane
  khula rehta hai. Phone par panes tabs ban jaate hain. Contest aur mock test me Sahayak par taala.
- **Admin:** `#admin-login` se shuru, ya seedha `#admin`. Upar **"Viewing as"** se role badlo (Finance, Editor,
  Analyst...): sidebar me band module par taala, band button par "Chahiye: ..." aur jo page role me nahi wahan
  "Request access". Risky kaam (bada refund, delete, role badalna, AI kill switch wapas on) par wajah + doosre insaan ki
  manzoori.
- Phone jaisa dekhna ho to browser 390px karo.

## v2 se kya badla

| v2 | v3 |
|---|---|
| Kaala page, upar tabs, baayein list, daayein rail: TUF jaisa | Light "kaagaz" default, dark "blackboard"; ek hi sidebar; rail sirf jahan kaam ka |
| Ek indigo accent | Stationery rang: neela pen = kaam, laal pen = galti, hara tick = pass, highlighter = zaroori, jamuni = Sahayak |
| Sab headings ek jaisi | Instrument Serif bade title, Geist UI, Geist Mono code/number, Kalam me laal-pen note |
| Sahayak drawer page dhakta tha | Sahayak teesra pane, page sikudta hai; har pane band/chhota/bada |
| Build ke 3 screens aam cards | Naya hub (asli preview), spec jaisa project page, poora Studio IDE |
| Admin nahi tha | 25 admin screens, 8 roles, 2FA, 4-eyes, audit log, DPDP |
| Logo sirf प | प jiske andar tick ✓ ("pariksha" + "pass"), wordmark, favicon; `#brand` par sab |

## Screens (route = link ke peeche `#naam`)

| Hissa | Route | Kya dikhata hai | Screenshot |
|---|---|---|---|
| Naksha | `#map` | Har screen ka card aur flow; yahin se kuch bhi kholo | [desktop](screens/desktop/map-1440-light.jpg) |
|  | `#brand` | Naya logo (प jiske andar tick ✓), lockups, rang, font, components, motion | [desktop](screens/desktop/brand-1440-light.jpg) |
| Pehli baar | `#landing` | Home: hero me kaagaz par aaj ka plan, din kaise chalta hai, kya alag hai (sabse chhota fail test, scrub hone wala editorial, Sahayak pehle poochhta), aptitude, company prep source ke saath, Banao | [desktop](screens/desktop/landing-1440-light.jpg) · [dark](screens/dark/landing-1440-dark.jpg) · [phone](screens/phone/landing-390-light.jpg) · [हिंदी](screens/hindi/landing-1440-light-hi.jpg) |
|  | `#login` | Google, phone OTP, email; graph-paper par | [desktop](screens/desktop/login-1440-light.jpg) |
|  | `#onboarding` | 6 sawaal, side me plan banta dikhta hai | [desktop](screens/desktop/onboarding-1440-light.jpg) |
| Roz ka loop | `#aaj` | Aaj ke kaam, jahan chhoda wahan se, streak, kamzor vishay | [desktop](screens/desktop/aaj-1440-light.jpg) · [dark](screens/dark/aaj-1440-dark.jpg) · [phone](screens/phone/aaj-390-light.jpg) · [हिंदी](screens/hindi/aaj-1440-light-hi.jpg) |
|  | `#plan` | Sprints → din → kaam; din chhoota to raaste | [desktop](screens/desktop/plan-1440-light.jpg) |
|  | `#revision` | Revision cards aur galtiyon ki copy (laal pen) | [desktop](screens/desktop/revision-1440-light.jpg) |
|  | `#daily` | Daily 10: phone par 10 chhote sawaal | [desktop](screens/desktop/daily-1440-light.jpg) |
| Seekho | `#courses` | Notebook covers jaise courses, goal se filter | [desktop](screens/desktop/courses-1440-light.jpg) |
|  | `#roadmap` | Role roadmap; node dabao to drawer | [desktop](screens/desktop/roadmap-1440-light.jpg) · [dark](screens/dark/roadmap-1440-dark.jpg) |
|  | `#course` | Syllabus, pragati, project | [desktop](screens/desktop/course-1440-light.jpg) |
|  | `#lesson` | Copy jaisi margin me teacher ke note, chalne wala code, quiz | [desktop](screens/desktop/lesson-1440-light.jpg) · [dark](screens/dark/lesson-1440-dark.jpg) · [phone](screens/phone/lesson-390-light.jpg) · [हिंदी](screens/hindi/lesson-1440-light-hi.jpg) |
| Abhyas | `#practice` | Tracks, sheets, aaj ka problem, agla contest | [desktop](screens/desktop/practice-1440-light.jpg) · [phone](screens/phone/practice-390-light.jpg) |
|  | `#sheet` | Kadam-dar-kadam DSA sheet | [desktop](screens/desktop/sheet-1440-light.jpg) · [dark](screens/dark/sheet-1440-dark.jpg) |
|  | `#problem` | **Statement | Code | Sahayak** teen pane; har pane khinch kar chhota/bada, × se band; "Mock: see each state" se WA/TLE/AC | [desktop](screens/desktop/problem-1440-light.jpg) · [dark](screens/dark/problem-1440-dark.jpg) · [phone](screens/phone/problem-390-light.jpg) · [हिंदी](screens/hindi/problem-1440-light-hi.jpg) |
|  | `#editorial` | Brute → better → best, dry run slider | [desktop](screens/desktop/editorial-1440-light.jpg) · [dark](screens/dark/editorial-1440-dark.jpg) |
|  | `#sql` | Schema | query | nateeja, Sahayak pane | [desktop](screens/desktop/sql-1440-light.jpg) |
|  | `#aptitude` | Quant, logical, verbal, mocks | [desktop](screens/desktop/aptitude-1440-light.jpg) |
|  | `#apt-set` | Tareeka aur shortcut ke saath practice set | [desktop](screens/desktop/apt-set-1440-light.jpg) |
|  | `#apt-mock` | Asli jaisa timed mock (Sahayak band, taala) | [desktop](screens/desktop/apt-mock-1440-light.jpg) · [dark](screens/dark/apt-mock-1440-dark.jpg) · [phone](screens/phone/apt-mock-390-light.jpg) |
|  | `#apt-result` | Score, har sawaal ka samay | [desktop](screens/desktop/apt-result-1440-light.jpg) |
|  | `#potd` | Roz ek problem, streak | [desktop](screens/desktop/potd-1440-light.jpg) |
|  | `#contests` | Aane wale, pichhle, rating | [desktop](screens/desktop/contests-1440-light.jpg) · [phone](screens/phone/contests-390-light.jpg) |
|  | `#contest-brief` | Niyam, shuru | [desktop](screens/desktop/contest-brief-1440-light.jpg) |
|  | `#contest-live` | Timer, problems, editor (Sahayak band) | [desktop](screens/desktop/contest-live-1440-light.jpg) · [dark](screens/dark/contest-live-1440-dark.jpg) |
|  | `#contest-result` | Rank, rating, kya seekhna | [desktop](screens/desktop/contest-result-1440-light.jpg) |
| Career aur Banao | `#companies` | Company ke hisaab se taiyari (naam nakli) | [desktop](screens/desktop/companies-1440-light.jpg) |
|  | `#company` | Rounds, topics, readiness | [desktop](screens/desktop/company-1440-light.jpg) · [dark](screens/dark/company-1440-dark.jpg) · [phone](screens/phone/company-390-light.jpg) |
|  | `#experiences` | Round-dar-round interview experiences | [desktop](screens/desktop/experiences-1440-light.jpg) |
|  | `#build` | **Naya Banao hub:** jaari project ka asli preview, tracks, project gallery, labs | [desktop](screens/desktop/build-1440-light.jpg) · [phone](screens/phone/build-390-light.jpg) |
|  | `#project` | **Naya project page:** spec, milestones (acceptance + tests), rubric, Studio me kholo | [desktop](screens/desktop/project-1440-light.jpg) |
|  | `#studio` | **Naya Code Studio:** files, editor, live preview, Terminal/Tests, steps, Sahayak pane | [desktop](screens/desktop/studio-1440-light.jpg) · [dark](screens/dark/studio-1440-dark.jpg) · [phone](screens/phone/studio-390-light.jpg) |
|  | `#pramaan` | Proctored certificate test | [desktop](screens/desktop/pramaan-1440-light.jpg) |
|  | `#certificate` | Mohar wala certificate, QR se verify | [desktop](screens/desktop/certificate-1440-light.jpg) |
|  | `#profile` | Verified vs khud bataya | [desktop](screens/desktop/profile-1440-light.jpg) · [phone](screens/phone/profile-390-light.jpg) |
|  | `#jobs` | Jobs, applications, resume par laal-pen check | [desktop](screens/desktop/jobs-1440-light.jpg) |
| Mera | `#lists` | Problem lists | [desktop](screens/desktop/lists-1440-light.jpg) |
|  | `#notes` | Apni galtiyon se notes | [desktop](screens/desktop/notes-1440-light.jpg) |
|  | `#community` | Charcha aur groups | [desktop](screens/desktop/community-1440-light.jpg) |
|  | `#sahayak` | Sahayak poora page | [desktop](screens/desktop/sahayak-1440-light.jpg) |
|  | `#plus` | Free vs Plus (daam owner tay karega) | [desktop](screens/desktop/plus-1440-light.jpg) |
|  | `#settings` | Bhasha, theme, privacy | [desktop](screens/desktop/settings-1440-light.jpg) |
| Admin | `#admin-login` | Staff sign-in: SSO ya email, phir 6 ank ka 2FA; naya device, IP list | [desktop](screens/desktop/admin-login-1440-light.jpg) |
|  | `#admin` | Dashboard: KPI (role ke hisaab se chhupe), "aapka dhyan chahiye", pipeline, kamaai | [desktop](screens/desktop/admin-1440-light.jpg) · [dark](screens/dark/admin-1440-dark.jpg) · [phone](screens/phone/admin-390-light.jpg) |
|  | `#adm-review` | Review queue: learner jaisa preview, machine checks, checklist poora hone tak approve band | [desktop](screens/desktop/adm-review-1440-light.jpg) · [dark](screens/dark/adm-review-1440-dark.jpg) |
|  | `#adm-approvals` | 4-eyes: risky kaam doosre insaan ki manzoori tak ruke; apni request khud approve nahi | [desktop](screens/desktop/adm-approvals-1440-light.jpg) |
|  | `#adm-problems` | Saare problems: filter, bulk, delete par 4-eyes | [desktop](screens/desktop/adm-problems-1440-light.jpg) |
|  | `#adm-problem` | Problem editor, 8 tab: statement (EN/HG/हि), tests, solutions, editorial, visuals, meta, checks, history | [desktop](screens/desktop/adm-problem-1440-light.jpg) |
|  | `#adm-aptitude` | Aptitude items, option analysis | [desktop](screens/desktop/adm-aptitude-1440-light.jpg) |
|  | `#adm-lessons` | Course tree + block editor (text, code, visual, callout, quiz) | [desktop](screens/desktop/adm-lessons-1440-light.jpg) |
|  | `#adm-roadmaps` | Roadmap graph editor | [desktop](screens/desktop/adm-roadmaps-1440-light.jpg) |
|  | `#adm-companies` | Company data: har fact ka source, bina source chhupa | [desktop](screens/desktop/adm-companies-1440-light.jpg) |
|  | `#adm-factory` | AI content factory: batches, stages, kharch, pause/stop | [desktop](screens/desktop/adm-factory-1440-light.jpg) |
|  | `#adm-learners` | Learners khojo, filter | [desktop](screens/desktop/adm-learners-1440-light.jpg) |
|  | `#adm-learner` | Ek learner: email/phone masked (reveal log hota), plan, activity, "learner ki nazar se" 4-eyes | [desktop](screens/desktop/adm-learner-1440-light.jpg) · [phone](screens/phone/adm-learner-390-light.jpg) |
|  | `#adm-support` | Ticket aur "galti batao" ek inbox, andar ka note | [desktop](screens/desktop/adm-support-1440-light.jpg) |
|  | `#adm-community` | Flags: rakho, spoiler, mute, ban (4-eyes) | [desktop](screens/desktop/adm-community-1440-light.jpg) |
|  | `#adm-commerce` | Plans, limits, coupons, orders, ₹5,000+ refund par 4-eyes, GST invoice | [desktop](screens/desktop/adm-commerce-1440-light.jpg) |
|  | `#adm-contests` | Contest banao, live monitor, copy check, rating publish | [desktop](screens/desktop/adm-contests-1440-light.jpg) |
|  | `#adm-ai` | Sahayak AI: kharch, cap, limits, prompts (A/B), evals, har mode ka kill switch | [desktop](screens/desktop/adm-ai-1440-light.jpg) |
|  | `#adm-analytics` | Funnel, weekly retention, kis content par kaam chahiye | [desktop](screens/desktop/adm-analytics-1440-light.jpg) |
|  | `#adm-notify` | WhatsApp/email/push campaign, shant samay, preview | [desktop](screens/desktop/adm-notify-1440-light.jpg) |
|  | `#adm-roles` | 8 roles ka matrix; cell dabao, badlav 4-eyes ke baad | [desktop](screens/desktop/adm-roles-1440-light.jpg) · [dark](screens/dark/adm-roles-1440-dark.jpg) · [phone](screens/phone/adm-roles-390-light.jpg) |
|  | `#adm-staff` | Staff invite, 2FA haalat, sessions, role badlo | [desktop](screens/desktop/adm-staff-1440-light.jpg) |
|  | `#adm-audit` | Audit log: kaun, kya, kab, wajah, pehle/baad; hash chain | [desktop](screens/desktop/adm-audit-1440-light.jpg) |
|  | `#adm-security` | SSO, IP allowlist, session, 4-eyes niyam, learner data, API keys, DPDP requests | [desktop](screens/desktop/adm-security-1440-light.jpg) |
|  | `#adm-system` | Health, feature flags, maintenance, site settings | [desktop](screens/desktop/adm-system-1440-light.jpg) |

Screenshots: `screens/desktop` (68, 1440 light), `screens/dark` (14), `screens/phone` (14, 390), `screens/hindi` (4).

## Jaanch (20 Oct)

- 68 screens × (1440 light, 1440 dark, 1024, 390 light, 390 dark, 1440 हिंदी, 390 हिंदी): page side me nahi khisakta
  (horizontal overflow 0), console me koi error nahi.
- Admin ke 26 route Finance, Analyst, Editor, Moderator role me bhi khol kar dekhe: taala aur "Request access" sahi.

## Imaandari

Saara data sample hai aur screen par likha hai; company naam nakli; koi nakli testimonial, user ginti ya logo nahi;
Plus aur campus ka daam `₹[...]` (owner tay karega); TUF/LeetCode ka koi naam, copy, logo ya layout nahi.

## Abhi mock me nahi (code ke waqt)

- Asli login, data, judge, AI, payment: sab dikhawa hai; buttons toast dikhate hain.
- Har haalat (loading, khaali, error) har screen par nahi; loading aur khaali ke namoone `#brand` par, aur problem
  screen par "Mock: see each state" se WA / TLE / AC.
- Hindi poori nahi: menus aur mukhya text teen bhasha me, lambe paragraph kai jagah English me.

## Owner ke faisle

1. Look pasand hai? Light "kaagaz" default rakhein ya dark "blackboard"?
2. Naya logo (प + tick) theek hai?
3. Plus, campus aur Pramaan test ke daam.
4. Admin ke 8 roles aur 4-eyes ke niyam (`#adm-security` → "4-eyes rules") theek hain?
5. Haan ho to: isi design se asli code shuru (Learn v2 handoff ka agla kadam).

## Chalana aur badalna

```bash
cd docs/learn/mock-v3/app
npm install            # sirf pehli baar; baaki packages repo ke root se
npx tsc -p tsconfig.json && npx vite build && node build-artifact.mjs   # dist/artifact.html (ek file)
node shots.mjs <out> <route,route> 1440,390 light en view               # screenshots; ROLE=finance se role
node qa.mjs 390 dark hi                                                 # har screen: overflow, console error; ROLE=finance bhi
node overview.mjs                                                       # screens/overview.jpg dobara
```

Code: `src/screens/*` (learner), `src/admin/*` (admin), `src/ui/*` (shell, focus panes, Sahayak, kit), `src/styles/*`
(tokens.css me saare rang, light + dark).
