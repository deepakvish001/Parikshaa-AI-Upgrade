# Learn ko asli code me badalna: aapse kya chahiye (21 Oct 2026)

Owner ka sawaal (21 Oct): "code me convert karne ke liye mujhe tumko kya karke dena hoga ya kya connector chahiye honge,
taaki tum baaki build kar doge?" Ye uska poora jawab hai. Design ka sach: [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md). Accounts
ke kadam-dar-kadam tareeke: [../OWNER-SETUP.md](../OWNER-SETUP.md).

**Chhota jawab:** code likhna, tests, CI, deploy ke scripts, database migrations, sab Claude karega. Aapko chahiye:
**(1)** kuch faisle, **(2)** kuch accounts jinke liye aapka naam, card ya KYC lagta hai, aur **(3)** unki keys GitHub me
daalna (chat me kabhi nahi). Pehla phase (design ko code me laana) **bina kisi key ke** shuru ho sakta hai.

## 0. Aaj ki asli haalat (24 Oct 2026, connectors se jaanchi)

| Cheez | Haalat | Aage kya |
|---|---|---|
| GitHub Actions | ❌ ab bhi band. Aakhri run (19 Oct, PR #66): "The job was not started because an Actions budget is preventing further use" | Owner: GitHub → Settings → Billing and plans → payment method ya Actions budget |
| PR #66 (`main` ka toota lockfile) | Khula, merge nahi | Billing ke baad CI hara, phir merge |
| Supabase org | Free plan | Asli users se pehle Pro (backup + PITR) |
| Supabase `parikshaa-mumbai` (ap-south-1) | **ACTIVE_HEALTHY** (25 Oct 2026: owner ki haan par connector se restore; pehle INACTIVE tha). 29 Oct: **saari migrations 0001–0074 lag gayi** (0054, 0055, 0059–0074 `migrate.yml` se, pehle dry run, phir [asli run](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/actions/runs/40866066876): "18 migration(s) applied"); Supabase security advisor: koi chetavani nahi. Purana Singapore project `Parikshaa` owner ki haan par pause (29 Oct). Free plan par kuch din bina use ke phir ruk sakta hai | Baaki migrations (0054/0055, 0059+) aur DB URL GitHub secret me (Kadam 2 se pehle) |
| Supabase `Parikshaa` (Singapore) | Chalu; purane problems, legacy import ke liye | Kuch nahi |
| Vercel | 29 Oct: project **`parikshaa-staging`** bana (team `team_hHiIq4Q4bLICj8Oniijioz7j`, project `prj_i0KLOZmGov0IcwGOArdSSL3n84vM`, functions `bom1`; dono ID secret nahi). GitHub env `staging`: secret `VERCEL_TOKEN` ✅ (owner, 29 Oct; pehla token ek variable me khul gaya tha, owner ko badalne ko kaha). Baaki: `staging` ke Variables `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (owner), `API_ORIGIN` (VM ke baad). `.vercel.app` address par Vercel Authentication chalu; custom domain ke baad khula | Commercial launch ke liye Pro |
| `ANTHROPIC_API_KEY` | Is cloud environment me nahi | AI ke kadam (P3) se pehle |

## 1. Faisle (sirf aap le sakte hain)

| # | Faisla | Sujhaav | Kab tak |
|---|---|---|---|
| F1 | "Shuru karo": mock v4.2 ke design se asli code | Haan, phase P0 se (neeche §4) | **✅ Haan (owner, 24 Oct 2026)** |
| F2 | Naya brand (logo A, IBM Plex, kaala default) **sab jagah** (exam app + console bhi) ya sirf Learn | Sab jagah, ek saath; warna do brand dikhenge | **✅ Sab jagah (owner, 24 Oct 2026)** |
| F3 | Pehle launch me kaunse screens | Aaj, plan, DSA sheet + workspace, SQL, revision, aptitude, profile + share, Studio (web projects); notebook aur interview doosre launch me | P0 me |
| F4 | LeetCode / CodeChef ka data | Inka official public API nahi. Shuru me sirf **link + khud bataya**; "bio code" se padhna tabhi jab unki terms dekh li jaayein. Codeforces (official API) aur GitHub (OAuth) seedhe | P4 se pehle |
| F5 | Merge kaun kare | Har PR aap, ya likh kar haan ki CI hara ho to Claude kare ([../ROADMAP-END-TO-END.md](../ROADMAP-END-TO-END.md) §2a) | **✅ Har PR owner merge karega (24 Oct 2026)** |
| F6 | Content ki manzoori | 10 editorial + 10 aptitude + 2 lesson ke samples ([../LEARN-V2.md](../LEARN-V2.md) §13) | P2 se pehle |
| F7 | Daam | Testing ke baad (aapka 20 Oct ka faisla); tab tak `₹[...]` | Launch se pehle |

## 2. Accounts aur keys

Har secret **sirf** GitHub → repo → Settings → Environments → `staging` / `production` → Environment secrets me.
Jo secret nahi hai (project ID, client ID), wo chat me bata sakte hain. Har kharch se pehle Claude daam batayega.

| Cheez | Kis kaam | Aap kya karein | Key ka naam (GitHub env) | Kharch (andaaza) | Kab chahiye |
|---|---|---|---|---|---|
| **GitHub billing** | CI, deploy, sab workflows | Billing theek karein (12 Oct se Actions band) | — | GitHub plan ke hisaab se | **Abhi** (P0) |
| Domain | `parikshaa.in` jaisa naam | Khareedein, DNS ka access | — | ~₹1,000/saal | P1 |
| Vercel Pro | Web aur console host | Pro lein, token banayein | `VERCEL_TOKEN` | ~$20/mahina | P1 |
| Supabase Pro | Database, login, files | Mumbai project chalu + Pro | `MIGRATE_DATABASE_URL`, `SUPABASE_SECRET_KEY` | ~$25–60/mahina | P1 |
| Google OAuth client | "Google se sign in" + Colab ke liye Drive | Google Cloud me OAuth client; scope `drive.file` (sirf apni banayi file) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Free (Google ki app jaanch lag sakti hai) | P1 (login), P3 (Colab) |
| AWS account + role | Judge0, CPU jobs (notebook, tests), backups | Account, MFA, ek role ([../DEPLOY-AWS.md](../DEPLOY-AWS.md)) | role ARN (secret nahi) | ~$150–300/mahina pilot | P2 |
| Judge0 | Code chalana aur jaanchna | Repo variable `PYTHON_SHA256`, phir "Judge0 image" workflow | `JUDGE0_AUTH_TOKEN` (Claude banata hai) | AWS me shaamil | P2 |
| **Anthropic API key** | Sahayak, interview, reviews | console.anthropic.com par key + **mahine ki spend limit** | `ANTHROPIC_API_KEY` | Aapki limit tak | P3 |
| GitHub OAuth app | Learner ka GitHub jodna | GitHub → Developer settings → OAuth app | `GITHUB_OAUTH_ID`, `GITHUB_OAUTH_SECRET` | Free | P4 |
| Razorpay | Plus ka payment | KYC (2–7 din), Test aur Live keys | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | ~2% har payment | P5 |
| Email (SES) | OTP, reminders | AWS me domain verify | SES role | Bahut kam | P5 |
| WhatsApp Business | Reminders, daily problem | Meta verification (2–14 din), templates | `WHATSAPP_TOKEN` | Har message | P5 |
| Push notifications | Browser reminders | Kuch nahi; Claude keys banata hai, aap env me daalein | `VAPID_*` | Free | P5 |

Codeforces ke liye key nahi chahiye (public official API). Colab ke liye alag account nahi; learner apna Google account
use karta hai.

## 3. Connectors (is Claude session me) aur unse kya hoga

| Connector | Haalat | Claude kya kar sakta hai | Kya aapka kaam rehta hai |
|---|---|---|---|
| GitHub | ✅ is session me | Code, branch, PR, CI dekhna aur theek karna | Billing; merge ka niyam (F5) |
| Supabase | ✅ is session me | Project dekhna, migrations lagana, logs aur advisors | Pro plan khareedna, project chalu karna |
| Vercel | ✅ is session me | Project banana, deploy, env names, domains jodna | Pro plan; domain khareed (daam ki "haan" ke baad hi) |
| Sentry | ✅ is session me | Errors dekhna, issues theek karna | Kuch nahi |
| PostHog | ✅ is session me | Funnel aur usage ke dashboards | Kuch nahi |
| UptimeRobot | ✅ is session me | Uptime monitors aur status page | Kuch nahi |
| Notion | ✅ is session me | Docs (zaroori nahi; repo me sab hai) | — |
| AWS | ❌ connector nahi | GitHub Actions ke role se (OIDC), bina key ke | Account + role ek baar |
| Anthropic, Razorpay, Google Cloud, Meta | ❌ | Code aur webhook taiyaar; keys GitHub env se | Account, KYC, key banana |

Plugins (frontend-design, Design) zaroori nahi; design ab is repo me tay hai. Account ki haalat 19 Oct ko
connectors se jaanchi thi ([../OWNER-SETUP.md](../OWNER-SETUP.md) §1); code shuru karte waqt Claude dobara jaanchega.

## 4. Kram: kaunsa phase, kya chahiye

| Phase | Kya banega | Aapse chahiye |
|---|---|---|
| **P0 Design ko code me** | `packages/brand` me tokens, fonts, logo A, kit; Learn shell + screens sample data se (`packages/web`); admin shell (`packages/console`); visual baselines, axe, tests | F1, F2, F3, F5 + **GitHub billing** |
| P1 Login aur database | Supabase Mumbai, Google + phone OTP login, profile, plan ka data | Supabase Pro, Google OAuth client, domain, Vercel Pro |
| P2 Practice engine | Judge (C++/Java/Python/JS), SQL (browser me PGlite + server par jaanch), DSA sheet, revision, aptitude | AWS + Judge0 variable; F6 content |
| P3 Sahayak aur AI | Sahayak (hint-first), quick fix, interview, notebook (Pyodide + CPU jobs + Colab hand-off) | Anthropic key + spend limit; Google `drive.file` |
| P4 Profile aur HR | Verified profile, share links (expiry, view log), card PNG, PDF resume; Codeforces + GitHub jodna; recruiters admin | GitHub OAuth app; F4 |
| P5 Paise aur sandesh | Plus checkout, invoices, email/WhatsApp/push reminders, launch monitoring | Razorpay KYC, SES, WhatsApp, daam (F7) |

Har phase ke baad: tracker update, PR, aur aapke dekhne ke liye staging link.

### 4b. Kram (24 Oct 2026): contract-first frontend

Owner (24 Oct): "complete frontend ho jaye phir database and backend and baki ai". Learn ka backend kaafi bana hua hai
(`packages/api` me ~160 Learn/Practice raaste, ~30 tables, tracker me 110 ✅), isliye frontend pehle, par do niyam:
jahan backend hai wahan naya screen **seedha asli API** se judta hai; jahan nahi hai wahan pehle API ka **contract**
(types + OpenAPI) aur us par nakli data, taaki backend aane par sirf nakli data hate, screen dobara na bane. Naya UI
feature flag ke peeche; purani practice site tab tak chalti rahe jab tak naya uske barabar na ho. Tracker plan row 138.

| Kadam | Kya banega | Phase (upar) | Aapse chahiye |
|---|---|---|---|
| 0 Design freeze | Mock me AE6 (code padhna) + AE9 (interview format guide); 44-0 user-test script; ho sake to 5–8 students se mock ka test | — | Test ke log aur samay (G1), zaroori nahi |
| 1 Frontend ki neev | `packages/brand` me v4.4 tokens, fonts, logo A; kit (Panes, FocusBar, Seg, Ring, Meter, states); Learn shell (nav, rail, phone tabs, Ctrl+K); en/hi; CI me visual + axe; `packages/web/package.json` ki dohri dependencies (`lucide-react`, `@tanstack/react-query`) theek | P0 | F1, F2, F5 + GitHub billing (§0) |
| 2 Screens jinka backend hai | Aaj, plan/onboarding, DSA sheet + workspace + editorial, SQL, revision, aptitude, POTD, contests, profile + share, Plus, community, Sahayak panel. Har slice: screen + asli API + tests + screenshot; chhoti API kami usi slice me | P0, P1, P2 | Supabase Mumbai chalu (haan), DB URL GitHub secret me, AWS VM, Vercel token, domain, Google OAuth client; F6 samples |
| 3 Screens jinka backend nahi | Contract + nakli data par: ticket lab, AI track, drill, AI report, readiness split, interview ke do roop, Studio, notebook. Yahan frontend poora | P0 | Kuch nahi |
| 4 Database + backend | Kadam 3 ke liye migrations, store, service, routes; nakli data hatao | P2, P4 | Judge0 VM + `PYTHON_SHA256` |
| 5 AI | Evals pehle; Sahayak v3, sandbox me lab agent, viva, interview ka AI mode, AI report | P3 | Anthropic key + spend limit; content factory ke kharch ki haan |

Saath-saath: content ke S0 samples (Kadam 1 ke saath shuru), aur launch ki cheezein (P5: Razorpay KYC, SES,
WhatsApp, daam), jinme din lagte hain.

## 5. Aapko ye nahi karna

Code, tests, CI, Docker, Terraform, migrations, keys ke naam, webhooks, monitoring, docs: sab Claude. Aap sirf F1–F7, §2 ke
accounts aur keys, aur har production deploy par GitHub me ek "Approve".

## 6. Ek nazar me checklist

- [ ] F1 "shuru karo" · [ ] F2 brand sab jagah? · [ ] F3 pehle launch ke screens · [ ] F5 merge ka niyam
- [ ] GitHub billing theek
- [ ] Domain · [ ] Vercel Pro · [ ] Supabase Pro + project chalu · [ ] Google OAuth client
- [ ] AWS account + role · [ ] `PYTHON_SHA256` variable
- [ ] Anthropic key + spend limit
- [ ] GitHub OAuth app · [ ] F4 LeetCode/CodeChef niyam
- [ ] Razorpay KYC · [ ] SES · [ ] WhatsApp · [ ] F7 daam
