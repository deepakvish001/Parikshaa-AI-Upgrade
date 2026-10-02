# Launch plan v2: tech-only, teen darwaze (2 Oct 2026)

Owner ne 2 Oct 2026 ko product ka focus pakka kiya. Ye file us focus ka poora plan hai, aur [MASTER-PLAN.md](MASTER-PLAN.md) ke us hisse ki jagah leti hai jo is focus se bahar hai. MASTER-PLAN ka jo epic yahan nahi hai, wo **ruka hua** hai (hataya nahi, launch ke baad dekhenge).

## 1. Product: sirf tech, teen darwaze

| Darwaza | Kiske liye | Kya | Paisa |
|---|---|---|---|
| **Learn** (B2C) | Students | LeetCode + takeUforward jaisa: structured DSA path, problems, CS subjects (DBMS, OS, CN, OOPs, SQL), aptitude, company questions, contests, AI tutor, interview prep | Free + Plus |
| **Hire** (B2B) | Companies | AI-proctored hiring assessments, AI interview, shortlist | Per attempt / plan |
| **Campus** (B2B) | Colleges | (a) admission aur scholarship test, (b) subject-wise coding internal test, (c) **Classes**: Java/Python/DSA/Full-stack/AIML/Data Science ke course, modules, content, questions, test, contest, progress, (d) TPO dashboard aur on-campus companies ke saath sharing | Per student / saal |

Sirf tech: programming, DSA aur technologies. Non-tech academic kaam (paper-pen copy, accreditation, har subject ke internal marks) is product ka nahi.

**Hamari jeet:** teeno ek account aur ek data par chalte hain. College ki class me padha student Learn par practice karta hai, Pramaan (viva se verified solve) kamata hai, aur company use Hire me dekhti hai. Bharat ki pricing, Hindi/Hinglish AI tutor, aur AI-cheating ke khilaaf micro-viva.

## 2. Competitors (Oct 2026)

| | Kaun | Unke paas | Hamara jawab |
|---|---|---|---|
| Learn | takeUforward (TUF+) | Paid passes (DSA, DBMS+SQL, OS, CN, Aptitude, OOPs, LLD, Company Qs, Planly), A2Z sheet (~450 items), AI assistant TUFY; AI pass 2027 | Free me poora DSA path, Hindi/Hinglish AI tutor jo jawab nahi deta, Pramaan jo companies dekhein |
| Learn | LeetCode | Mobile app, "Ask Leet" AI, contests, naye users ki alag rating | Bharat ke liye: company + college se juda, sasta Plus |
| Hire | HackerRank | AI interviewer (Chakra), AI-fluency IDE, cheating detection, secure app | Per-attempt INR pricing, micro-viva, ledger ka saboot |
| Hire | HackerEarth, Mettl, CodeSignal | Video-avatar AI interview; secure browser, awaaz ki jaanch; poore test me screen share | Wahi integrity, college pipeline ke saath |
| Campus | CodeTantra | College coding LMS, ~500 exercises/course, lab record, internal coding exam | Classes + internal test + TPO + Hire ek jagah |
| Campus | Superset | Placement cell platform, profile, drives | Placement ke saath padhai aur readiness |

## 3. Kya hataya ja raha hai (F0)

| Feature | Faisla |
|---|---|
| Handwritten copy checking (scan, OCR, marking, doosra examiner) | Hatao |
| NAAC/NIRF/NBA, CO-PO attainment reports | Hatao |
| CIA internal marks (har subject) | Hatao; coding test ke marks Classes me |
| Spoken answers (awaaz ke jawab) | Hatao; AI interview me awaaz baad me alag |
| Semester exam cell, multi-campus university, ERP sync, OMR, govt exams, coaching | Plan se bahar |
| Admit card + seat allocation | Rakho, admission test ke liye |
| Lab mode, proxy detection, recheck, scorecard, drives, offers, interview room, ATS | Rakho |

Git history me sab rehta hai; har hatane ke saath ek migration jo uske tables saaf kare, aur tests.

## 4. Infra: hybrid (owner ne chuna)

| Hissa | Kahan |
|---|---|
| Learn, Console, marketing (frontend) | **Vercel**: GitHub se deploy, har PR ka preview |
| Postgres | **Supabase, Mumbai (ap-south-1)**: backups, PITR, har PR ki branch DB |
| Files (photos, snapshots, uploads) | **Supabase Storage** |
| API + workers + code runner (gVisor) | **Ek VM, Mumbai** (`deploy/aws/pilot` ya DigitalOcean/E2E) |
| AI | Anthropic API |
| Errors / analytics / uptime | Sentry / PostHog / Better Stack |

Auth apna hi rahega (staff, candidate link, TOTP, OIDC, LTI). Supabase ka "Data API" band ya hamare tables private schema me, taaki public key se kuch na khule: iska test CI me.

Kaam ka tareeka: PR → CI (typecheck, tests, e2e, security) → Vercel preview + Supabase branch → merge → staging apne aap → smoke → production ek click (rollback ke saath). Claude ke connectors: GitHub, Supabase, Vercel, Sentry.

## 5. Phases

| Phase | Kya | Done kab | Owner se |
|---|---|---|---|
| **F0 Safai + neev** | Section 3 ka hatana; Supabase + Vercel + VM par shift; uploads Storage me; preview har PR; Sentry; CI me Supabase ka security check | Har PR ka preview link; staging chal raha; extra features gaayab; saare tests green | Supabase + Vercel account, unke connectors; VM ke liye cloud account |
| **F1 Hire** | Proctoring v2 (secure mode, screen + camera + awaaz ki jaanch, photo ID); AI interviewer (pehle chat + code, phir awaaz); AI-fluency IDE test (AI allowed, uska use dikhe); 60 role templates; frontend, SQL/data, take-home sawaal; self-serve kharid; candidate report v2 | Startup khud signup karke test bheje, shortlist kare; 10 proxy me se 9 pakde | Prices |
| **F2 Campus** | **Classes** (naya): course → module → content → practice → test → contest, attendance + progress, lab record; admission/scholarship test (bada scale, rank list, result); subject-wise coding internal test; TPO dashboard + company sharing | Ek college: ek class poora semester, ek admission test, ek drive | Ek college ka asli course/syllabus |
| **F3 UI/UX** | Teeno ka ek shell, design system v3, marketing site + help center, phone par tez (LCP < 2 s) | Visual baselines, axe, Lighthouse | Naam/brand, logo, domain |
| **F4 Learn** (aakhir me) | Ek Parikshaa ID; A2Z jaisa DSA path; CS subjects; aptitude; company questions; contests v3; AI tutor v3 (hint, code review, mock interview); discuss/solutions; PWA → app; Free vs Plus; **500 problems** | Signup → path → solve → contest → Pramaan; 500 problems | Content ki haan |
| **F5 Rehearsal** | Sab flows production jaisa; 5,000 exam + 2,000 contest; crash test; restore; security review; `docs/READINESS.md` | Readiness report, sab fix | — |
| **F6 Asli AI test** | Har AI feature ka eval aur kharcha (`cost-run`) | Eval reports, pricing pakki | `ANTHROPIC_API_KEY` |
| **F7 Live** | Production, 3 college pilot, pehli companies, Learn ka public launch, `v1.0` | Asli exam bina incident | Email/SMS/WhatsApp/Razorpay keys, legal text, pilot colleges |

## 6. Ruke hue epics (MASTER-PLAN se, launch ke baad)

M-C1 multi-campus, M-C3 semester exam cell, M-C5 checking v2, M-C6 accreditation, M-C8, M-C9, M-S18 govt exams, coaching, OMR, M-A5 handwriting OCR, M-B10/M-B11 enterprise ATS/SCIM, M-T3 Parikshaa Score, M-T6 certifications, M-F7 multi-region DR.
