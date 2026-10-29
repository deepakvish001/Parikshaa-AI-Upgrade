# Owner setup: aapko kya karna hai, taaki baaki Claude kare (19 Oct 2026)

[ROADMAP-END-TO-END.md](ROADMAP-END-TO-END.md) §2a ki list ka poora tareeka. Har cheez me teen hisse: **kya hai**, **aap kya
karein**, **phir Claude kya karega**.

## 0. Teen niyam

1. **Secret kabhi chat me nahi.** Har secret ek hi jagah jaata hai: GitHub → repo → Settings → Environments →
   `staging` ya `production` → **Environment secrets**. Wahan se workflow use AWS Secrets Manager, Vercel ya server
   tak le jaata hai.
2. **Jo secret nahi hai** (AWS role ARN, WhatsApp phone number ID, project ID), wo aap chat me bata sakte hain.
3. **Har kharch ya khareed se pehle** Claude daam batayega, aur aapki "haan" ke baad hi karega. Production par deploy
   GitHub me aapke ek "Approve" click ke baad hi hoga.

## 1. Abhi ki haalat (19 Oct 2026 ko connectors se jaancha)

| Cheez | Haalat |
|---|---|
| GitHub Actions | Billing ki wajah se band. Iske bina koi workflow (CI, deploy, AWS) nahi chalta |
| Vercel | Team "deepakvish001's projects". Parikshaa ka koi project abhi nahi |
| Domain | Sirf `byteskill.in` (DNS Namecheap par). Parikshaa ka koi domain nahi |
| Supabase | `parikshaa-mumbai` (Mumbai) **ruka hua (INACTIVE)**, kyunki free plan khaali project rok deta hai. Ye org Vercel Marketplace se bana hai, isliye iska bill Vercel se aata hai. Singapore wala `Parikshaa` chal raha hai (purana data) |
| AWS | Account abhi nahi |

## 2. Kram

GitHub billing → domain → Vercel Pro → Supabase Pro → AWS + role → SES → Razorpay → WhatsApp.
Razorpay aur WhatsApp ki jaanch me kai din lagte hain, isliye unke form **aaj hi** bhar dein. Baaki saath-saath chalega.

## 3. Har cheez

### 3.1 GitHub billing (5 minute)

- **Aap:** github.com → Settings → Billing and plans → payment method theek karein. Actions ki spending limit $0 se
  upar rakhein (jaise $20).
- **Claude:** PR #66 ka CI chalayega aur use hara karega.

### 3.2 Domain (10 minute + ~₹1,000/saal)

- **Kya:** website (`parikshaa.in`), API (`api.parikshaa.in`), email (`no-reply@parikshaa.in`) ka naam.
- **19 Oct ko Vercel par jaancha:** `parikshaa.com` aur `parikshaa.app` le liye gaye hain. `.in` Vercel nahi bechta.
  Khaali hain: `getparikshaa.com` ($11.25/saal), `parikshaa.dev` ($9.99, phir $13), `parikshaa.io` ($14.99, phir $46),
  `parikshaa.ai` ($160 / 2 saal).
- **Sujhav:** `parikshaa.in` (Bharat ke liye bharosa, sasta). Agar khaali ho to Namecheap se lein (wahan aapka account
  pehle se hai). Nahi to `getparikshaa.com` Vercel se. Brand ya trademark ka faisla aapka hai.
- **Aap:**
  1. Domain khareedein (ya bolein, to Claude Vercel par daam dikha kar aapki haan ke baad khareede).
  2. Namecheap se liya ho to: Domain List → Manage → Nameservers → Custom DNS → `ns1.vercel-dns.com`,
     `ns2.vercel-dns.com`.
- **Claude:** Vercel par domain jodega. Saare DNS record khud banayega: web, API, SES ke DKIM aur DMARC, Razorpay aur
  Meta ki domain verification.

### 3.3 Vercel Pro (5 minute, $20/mahina har member)

- **Kya:** Vercel ka Hobby plan sirf niji, non-commercial kaam ke liye hai. Parikshaa paise kamata hai, isliye Pro
  chahiye.
- **Aap:**
  1. Vercel → team Settings → Billing → Upgrade to Pro.
  2. Account Settings → Tokens → naya token (scope: sirf ye team, expiry 1 saal). Use GitHub ke dono environments me
     secret `VERCEL_TOKEN` bana kar daalein.
- **Claude:** Vercel MCP se `parikshaa-web` aur `parikshaa-console` projects, env variables, domains aur deploy
  sambhalega.

### 3.4 Supabase Pro (5 minute, ~$25/mahina + compute)

- **Kya:** database. Pro par project kabhi rukta nahi, roz backup hota hai, aur zyaada jagah milti hai.
- **Aap:**
  1. Ye org Vercel se bana hai, isliye upgrade bhi Vercel se: Vercel → Storage (ya Integrations) → Supabase →
     Manage → plan **Pro**.
  2. Supabase → `parikshaa-mumbai` → Connect → **Session pooler** URL copy karein (password aapke password manager
     se). Use GitHub secret `MIGRATE_DATABASE_URL` me daalein.
  3. Supabase → Project Settings → API Keys → naya **secret key**. Use GitHub secret `SUPABASE_SECRET_KEY` me daalein.
- **Claude:** Supabase MCP se project chalu karega, migrations chalayega, security advisors dekhega, aur runtime
  password khud banayega (`put-secrets.sh`).

### 3.5 AWS account + ek role (~30 minute, ek baar)

- **Kya:** API server, code runner, Judge0, backups aur email (SES) AWS Mumbai par chalte hain. Claude AWS ko **kabhi
  key se nahi chhuega**. GitHub Actions ko ek "role" milega jo sirf is repo ke `staging`/`production` environment se
  chalta hai (OIDC), aur aap use kabhi bhi hata sakte hain.
- **Aap:**
  1. aws.amazon.com par account banayein: PAN, pata, card, phone OTP. Bharat me ye AISPL account hota hai, aur GST
     number ho to daalein.
  2. Root user par MFA lagayein. Region **Asia Pacific (Mumbai) ap-south-1**.
  3. Billing → Budgets → $300/mahina ka alert apne email par.
  4. Claude ek file `deploy/aws/github-role.yaml` dega. AWS console → CloudFormation → Create stack → Upload a template
     file → wo file → Create. 2 minute baad Outputs me `RoleArn` milega. Wo chat me bata dein (ye secret nahi hai).
- **Claude:** `AWS_ROLE_ARN` GitHub variable me daalega. Phir GitHub Actions se Terraform chalayega: state bucket,
  VM/servers, backups, alarms, Secrets Manager. Staging khud, production aapke Approve click ke baad.
- **Abhi repo me nahi hai (Claude banayega, lagbhag ek slice):** ye role file, `infra.yml` workflow (Terraform), aur
  `secrets-sync.yml` workflow (GitHub secrets → AWS Secrets Manager). Aaj ka [DEPLOY-AWS.md](DEPLOY-AWS.md) laptop se
  Terraform maanta hai. Iske baad laptop ki zaroorat nahi rahegi.

### 3.6 Email: SES (5 minute aapka + AWS ke 1–2 din)

- **Kya:** AWS ki email service: invites, OTP, results, Hire ke mails.
- **Claude (role ke baad):** SES me domain jodega, DKIM aur DMARC DNS me daalega, SMTP user banayega, aur password
  seedha Secrets Manager me rakhega (chat, repo ya Terraform state me kabhi nahi).
- **Aap:** SES console → Account dashboard → **Request production access**. Bharein: mail type **Transactional**,
  website URL, aur Claude ka likha use-case text (bounce aur complaint kaise sambhalte hain, unsubscribe). Isse pehle
  SES sirf verified pato par mail bhejta hai.

### 3.7 Razorpay KYC (~1 ghanta aapka + Razorpay ke 2–7 din)

- **Kya:** learners ka Plus aur companies ke credits ka payment.
- **Aap:**
  1. dashboard.razorpay.com par signup karein. Business type chunein (proprietorship / Pvt Ltd / LLP).
  2. Documents: PAN (company ka, ya proprietor ka), business proof (GST certificate, ya Udyam/Shop Act), business ke
     naam ka bank account (cancelled cheque ya statement), aur signatory ka PAN + Aadhaar.
  3. Website URL: Razorpay dekhta hai ki site par **Terms, Privacy, Refund/Cancellation, Contact (pata ke saath) aur
     Pricing** pages live hain. Claude ye pages banayega. Text aap (ya lawyer) manzoor karein.
  4. Activation ke baad: Account & Settings → API Keys → **Live** key banayein. `RAZORPAY_KEY_ID` aur
     `RAZORPAY_KEY_SECRET` GitHub `production` secrets me daalein.
  5. Account & Settings → Webhooks → do webhook, ek hi secret ke saath: `https://api.<domain>/billing/razorpay/webhook`
     (company credits) aur `https://api.<domain>/practice-billing/razorpay/webhook` (Plus). Events Claude batayega. Wo
     secret `RAZORPAY_WEBHOOK_SECRET` me daalein.
- **Claude:** KYC ke intezaar me **Test mode** keys se poora flow staging par chala kar jaanchega (Test keys turant
  milti hain, unhe `staging` secrets me daalein). Live keys ke baad production par ₹1 ka asli payment test karega.

### 3.8 WhatsApp Business (~1 ghanta aapka + Meta ke 2–14 din)

- **Kya:** invites, reminders, results aur offer WhatsApp par (Meta Cloud API). Meta har message ka paisa leta hai.
- **Aap:**
  1. business.facebook.com par Business portfolio banayein. Naam wahi rakhein jo GST/PAN documents par hai.
  2. Security Center → **Business verification**: documents (GST, Udyam ya incorporation), aur website. Domain ki
     jaanch ke liye Meta jo TXT record dega, wo Claude DNS me daal dega.
  3. WhatsApp Manager → Add phone number. Aisa number chahiye jo kisi WhatsApp app par chalu na ho (naya SIM theek
     hai). Display name **Parikshaa** rakhein, aur payment method jodein.
  4. Business settings → System users → naya Admin system user → WhatsApp account assign → Generate token: expiry
     "Never", permissions `whatsapp_business_messaging` aur `whatsapp_business_management`. Token ko GitHub secret
     `WHATSAPP_TOKEN` me daalein. **Phone number ID** aur **WhatsApp Business Account ID** chat me bata dein (ye
     secret nahi hain).
- **Claude:** templates (invite, reminder, new time, result, offer, drive; [PILOT.md](PILOT.md)) API se jama
  karega, manzoori dekhega, aur khud ko test message bhejega.
- **Asaan raasta (thoda mehnga):** Gupshup, Interakt jaise BSP verification me madad karte hain, par har message par
  apna hissa lete hain.

## 4. GitHub me aap kaunse secrets daalenge

Settings → Environments → (`staging` / `production`) → Add environment secret. Baaki saare secrets (data key, runner
token, app password, SMTP) Claude ke scripts khud banate hain.

| Naam | Kahan se | Environment |
|---|---|---|
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens | dono |
| `MIGRATE_DATABASE_URL` | Supabase → Connect → Session pooler | dono (alag project) |
| `SUPABASE_SECRET_KEY` | Supabase → API Keys → secret key | dono |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys (Limits me mahine ki spend limit lagayein) | dono |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Razorpay (staging me Test, production me Live) | dono |
| `WHATSAPP_TOKEN` | Meta system user token | production (staging optional) |

`production` environment me **Required reviewers** = aap. Isse har production deploy aapke click ke baad hi hoga.

## 5. Kharch ka saar (mahina, pilot)

| Cheez | Andaaza |
|---|---|
| Vercel Pro | $20 |
| Supabase Pro | $25–60 |
| AWS (VM, Judge0, backups, SES) | $150–300 |
| Domain | ~$1/mahina |
| WhatsApp | Har message ka; kitne message, us par |
| Razorpay | Har payment par ~2% (koi mahine ka kharch nahi) |

Daam vendor ki site se pakka karein. Ye 19 Oct 2026 ke andaaze hain.
