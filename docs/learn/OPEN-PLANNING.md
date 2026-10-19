# Learn v2: aur kya planning baaki hai (19 Oct 2026)

Owner ka sawaal: "aur kya planning rah gayi hai?" Ab tak jo plan ho chuka (✅) aur jo baaki hai (🟡 aadha, ⬜ nahi),
kaam ke kram me.

## 1. Jo plan ho chuka

| Hissa | Doc |
|---|---|
| Poora Learn v2 (scope, content ginti, features, admin, architecture, DRM, test/launch, timeline, kharch) | [../LEARN-V2.md](../LEARN-V2.md) |
| Judge, servers, AI model, mahine ka kharch | [../LEARN-LAUNCH-PLAN.md](../LEARN-LAUNCH-PLAN.md) |
| Learner ke saare flows, design, icons | [USER-FLOWS.md](USER-FLOWS.md) |
| Database, API, AI gateway, judge, factory, suraksha | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Admin panel | [ADMIN-PANEL.md](ADMIN-PANEL.md) |
| Editorial style (owner ki kitaab) | [EDITORIAL-STYLE.md](EDITORIAL-STYLE.md) |
| Visuals aur dry-run sliders | [VISUAL-STYLE.md](VISUAL-STYLE.md) |
| Problem standard + owner ke problems ka audit | [PROBLEM-STANDARD.md](PROBLEM-STANDARD.md) |
| Code Studio, guided labs, har technology ke arenas, LLD/HLD | [CODE-STUDIO.md](CODE-STUDIO.md) |
| Courses, lessons, labs, articles, cheat sheets | [CONTENT-CATALOG.md](CONTENT-CATALOG.md) |
| Roadmaps + AI tutor + AI courses | [../LEARN-V2.md](../LEARN-V2.md) §4b |
| Hands-on labs (environments) | [../LEARN-BUILD-LABS.md](../LEARN-BUILD-LABS.md) |
| TUF se tulna, 10 saal | [../LEARN-TUF-GAP.md](../LEARN-TUF-GAP.md) |
| Owner ke accounts aur secrets | [../OWNER-SETUP.md](../OWNER-SETUP.md) |

## 2. Jo baaki hai (kram me)

| # | Hissa | Haalat | Kyun zaroori | Kya likhna hai |
|---|---|---|---|---|
| 1 | **Launch aur growth** | ⬜ | Platform bana, par learners kaise aayenge | Pehle 10,000 learners ka plan: college ambassadors, TPO partnership (Campus ✅), WhatsApp channels, referral (coins ✅), launch week contest, SEO ([CONTENT-CATALOG.md](CONTENT-CATALOG.md) §4) |
| 2 | **Daam aur packages** | 🟡 | Kamaai aur free ki seema | Plus tiers (mahina/saal), students ke liye daam, campus licence ka daam, coupons ✅, A/B test |
| 3 | **Legal (Learn v2)** | 🟡 | DPDP, copyright | Terms/Privacy me: AI chat retention (Plus: account tak), learner content ka licence (discussions, experiences), datasets ke licence, takedown process, 18 se kam umar |
| 4 | **Metrics aur experiments** | 🟡 | Sahi faisle data se | North star (jaise "hafte me 3+ din seekhne wale"), funnel, retention, content quality metrics, A/B ka dhaancha (feature flags ✅) |
| 5 | **Team aur reviewers** | ⬜ | ~1,750 + 900 ghante ki insaani jaanch | Kaun (owner, college TAs, freelancers), kitne, daam, training (style guide), quality naap |
| 6 | **Paise ka model** | ⬜ | Kab tak faayda | Kharch ([../LEARN-LAUNCH-PLAN.md](../LEARN-LAUNCH-PLAN.md) §5) vs kamaai ka andaaza, breakeven, cash kitne mahine |
| 7 | **Personalisation** | 🟡 | Har learner ko sahi agla kaam | Mastery model (L16), recommendation (agla problem/lesson), revision ✅ ke saath jod |
| 8 | **Community ke niyam** | 🟡 | Achha mahaul | Code of conduct, spoiler niyam, report ka SLA, moderators |
| 9 | **Support** | 🟡 | Learner atke na | Help center, ticket SLA, refund ✅ ka tareeka, FAQ |
| 10 | **Notifications ki niti** | 🟡 | Spam nahi, kaam ka | Kitni baar, kab, kaunse channel ([USER-FLOWS.md](USER-FLOWS.md) F21 par aage) |
| 11 | **Mobile app (Android)** | 🟡 | Zyaadatar learners phone par | Capacitor app: kaunse screens, offline, push, `FLAG_SECURE` (phase 2), Play Store ([../PLAY-STORE.md](../PLAY-STORE.md)) |
| 12 | **Aur bhashayein** | ⬜ | Hindi ke baad | Tamil, Telugu, Bengali, Marathi: UI ✅ (11 bhasha), content kab |
| 13 | **Content ka rakh-rakhaav** | ⬜ | Purana content galat ho jaata | Har content ka "jaancha" date, versions, deprecation, language updates (jaise React ke naye version) |
| 14 | **Creator program** | ⬜ | Zyada experts, zyada content | Bahar ke experts course likhein, review, kamaai ka hissa |
| 15 | **Partnerships** | ⬜ | Learn ↔ Hire ↔ Campus | Companies (Pramaan maanein), colleges (pilot) |
| 16 | **AI trust & safety** | 🟡 | Galat ya nuksaandeh jawab | Abuse, jailbreak, chhote learners, galat jawab report ka flow |
| 17 | **Incident aur DR (Learn)** | 🟡 | Contest ke din kuch toote to | Runbooks: judge down, AI down, DB restore ([../OPERATIONS.md](../OPERATIONS.md) exams ke liye ✅) |
| 18 | **Accessibility audit** | ⬜ | Sab ke liye | Bahar ka audit launch se pehle |
| 19 | **Brand aur marketing copy** | 🟡 | Pehla asar | Landing ka text, mascot, tone ([USER-FLOWS.md](USER-FLOWS.md) §1) |

## 3. Sujhav: agla kya plan karein

1. **#1 Launch aur growth** aur **#2 Daam**: inke bina launch adhoora hai.
2. **#5 Team** aur **#6 Paise ka model**: review ki rukaavat aur kharch inse tay hote hain.
3. **#3 Legal**: launch se pehle zaroori.

Owner kahe to inhe ek-ek doc me isi detail se likha jaayega.
