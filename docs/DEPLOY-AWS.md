# Parikshaa AWS par: go-live runbook (M-F1)

MASTER-PLAN ka **M-F1 Production go-live**. Owner ne chuna: **AWS Mumbai (ap-south-1)**, **do kadam me**:

- **Kadam 1, pilot (is hafte):** ek EC2 machine, wahi `scripts/setup-server.sh` jo college ke apne server par chalta hai. Jaldi live, kam kharcha.
- **Kadam 2, managed (saath-saath):** Terraform se pura setup. RDS Postgres, load balancer, machines jo khud badal jaati hain, alag code-runner machines. Pilot ka data baad me RDS me aata hai, **usi data key ke saath**.

Saara code `deploy/aws/` me hai. Ye file batati hai kya kab chalana hai. Har command laptop se chalti hai (Mac/Linux), jab tak "machine par" na likha ho.

> **Sach:** ye Terraform abhi tak kisi asli AWS account par apply nahi hua hai. Ye `terraform validate` aur `terraform test` (mocked provider, 13 tests) se guzra hai, aur scripts fake AWS ke saath (43 tests). Pilot ka data RDS jaise server me import CI me har PR par chalta hai. Pehla asli test **staging** par hoga; isliye production se pehle staging hamesha.

---

## 1. Ek nazar me

```
Kadam 1 (pilot)                         Kadam 2 (managed, staging + production)

internet                                 internet
   │ :80 :443                               │ :80 :443
EC2 m7i.xlarge (Elastic IP)              ALB (HTTPS, ACM certificate)
 ├─ Caddy (HTTPS)                           │ :3000
 ├─ API (Docker)                         API machines (Auto Scaling, 2 zones)  ──:5432──  RDS Postgres 16
 ├─ runner (gVisor)                         │ :4000                                       (Multi-AZ, PITR,
 └─ Postgres (Docker)                    internal NLB                                      backup copy Hyderabad)
nightly: pg_dump → S3, disk snapshot     runner machines (gVisor, koi bahar ka connection nahi)
```

| Cheez | Pilot | Managed |
|---|---|---|
| Database | Machine par Postgres, raat ka `pg_dump` S3 me, disk snapshot 7 din | RDS: encrypted (apni KMS key), TLS zaroori, point-in-time recovery 14 din, prod me standby (Multi-AZ), backups Hyderabad me bhi |
| Machine kharab | AWS ki taraf ki kharabi par khud recover; baaki email | Load balancer health check fail → machine khud replace |
| Code runner | Usi machine par gVisor me | Alag machines, gVisor, iptables se har container ka naya connection band, metadata service tak pahunch nahi |
| Andar jaana | SSH nahi; Session Manager | SSH kahin nahi; Session Manager |
| Secrets | `/etc/parikshaa.env`, ek copy Secrets Manager me | Secrets Manager (Terraform state me kabhi nahi) |
| Release | Machine par `git pull` + `sudo parikshaa-setup` | `release.sh`: image → migration → ek-ek machine badli → server check |

---

## 2. Shuru se pehle (owner)

1. **AWS account**: root par MFA. Ek admin user (IAM Identity Center) bhi chahiye, MFA ke saath. Region **Mumbai**.
2. Laptop par ye tools:
   - AWS CLI v2 (`aws configure sso` ya access key), plus `session-manager-plugin`;
   - Terraform **1.10 ya naya**;
   - Docker (buildx ke saath), `jq`, Node 22, `git`.
3. **Domain** ka DNS jahan hai (GoDaddy, Cloudflare, Route 53…), wahan record jodne ka access.
4. **Anthropic API key** (grading, follow-up sawaal).
5. Email: SES (neeche section 7) ya pilot ke liye koi bhi SMTP.

---

## 3. Kadam 0: ek baar, har account me (bootstrap)

State bucket (Terraform ki yaad) aur do image repositories (`parikshaa/api`, `parikshaa/runner`), jo staging aur production dono use karte hain. Isse production wahi image chalata hai jo staging par test hui.

```bash
cd deploy/aws/bootstrap
terraform init
terraform apply
terraform output -raw backend_hcl > ../backend.hcl
```

`bootstrap/terraform.tfstate` sambhal kar rakho. Isme koi secret nahi hai, par bucket isi se pehchana jaata hai.

---

## 4. Kadam 1: pilot machine (is hafte)

```bash
cd deploy/aws/pilot
cat > terraform.tfvars <<'EOF'
domain      = "exam.parikshaa.in"
alarm_email = "ops@parikshaa.in"
EOF
terraform init -backend-config=../backend.hcl
terraform apply
terraform output next
```

Phir:

1. **DNS:** `exam.parikshaa.in` ka **A record** `elastic_ip` output par.
2. **AWS ka email confirm karo** (alarms ke liye).
3. **Machine par jao:** `terraform output -raw shell` wali command. Pehli boot me 2–3 minute lagte hain (git, AWS CLI).
4. **Machine par setup:**
   ```bash
   sudo parikshaa-setup
   ```
   Ye `setup-server.sh` hai, AWS ki settings ke saath. Ye domain, email, API key, SMTP aur price poochta hai. Raat ke backup ab S3 me bhi jaate hain.
5. **Settings ki copy machine ke bahar rakho:**
   ```bash
   sudo parikshaa-save-settings
   ```
   Ye `/etc/parikshaa.env` (jisme `PARIKSHAA_DATA_KEY` hai) Secrets Manager me `parikshaa/pilot/settings` naam se save karta hai. **Setup ke baad aur har badlaav ke baad.**
6. **Data key ki ek aur copy AWS ke bahar bhi rakho** (password manager). Is key ke bina koi sealed answer kabhi nahi khulega.
7. **Server check:** setup ke end me jo do commands chhapti hain, unse test organisation banao aur `smoke.mjs` chalao.

**Backup dekhna:** agli subah `aws s3 ls s3://$(terraform output -raw backups_bucket)/pilot/`. Machine backup **jod** sakti hai, padh ya mita nahi sakti.

**Release (pilot):** machine par `cd /opt/parikshaa && sudo git pull && sudo parikshaa-setup` chalao. Ye secrets wahi rakhta hai, rebuild karta hai aur check karta hai.

**Bada exam (pilot):** `m7i.xlarge` 500 candidates ke liye hai (OPERATIONS.md). Usse bada exam ho to ek din pehle `instance_type = "m7i.2xlarge"` karke `terraform apply` karo. Isme machine 2–3 minute band rehti hai; Elastic IP aur data wahi rehte hain. Exam ke din kabhi nahi.

---

## 5. Kadam 2: managed setup (pehle staging, phir production)

### 5.1 Infra

```bash
cd deploy/aws/envs/staging          # production ke liye: envs/production
cp terraform.tfvars.example terraform.tfvars   # domain, alarm_email, settings bharo
terraform init -backend-config=../../backend.hcl
```

**DNS Route 53 me hai** to `route53_zone_id` bharo aur seedha `terraform apply` karo. Saare records khud ban jaate hain.

**DNS kahin aur hai** to do baar apply karna hoga, kyunki HTTPS certificate ke liye pehle ek record chahiye:

```bash
terraform apply -target=module.stack.aws_acm_certificate.site -target=module.stack.aws_sesv2_email_identity.mail
terraform output -json stack | jq '.dns_records'
# Ye records apne DNS me jodo. Site wala CNAME abhi mat jodo agar pilot chal raha hai.
terraform apply                     # certificate issue hone tak rukta hai (~5–30 min)
```

Apply ke baad machines ek placeholder page dikhati hain ("nothing released yet"). Ye isliye hai ki release se pehle unhe baar-baar badla na jaaye.

### 5.2 Secrets

Values `read -rs` se lo, taki wo shell history me na rahein:

```bash
cd ../..    # deploy/aws
read -rs -p "Anthropic API key: " ANTHROPIC_API_KEY; echo
read -r  -p "SES SMTP user: " SES_SMTP_USER
read -rs -p "SES SMTP password: " SES_SMTP_PASSWORD; echo
scripts/put-secrets.sh staging ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  SMTP_URL="smtps://$SES_SMTP_USER:$SES_SMTP_PASSWORD@email-smtp.ap-south-1.amazonaws.com:465" \
  EMAIL_FROM='Parikshaa <no-reply@parikshaa.in>'
```

- `ATTEMPT_TOKEN_SECRET`, `PARIKSHAA_DATA_KEY`, `RUNNER_TOKEN` aur `PARIKSHAA_APP_PASSWORD` script khud ek baar banati hai. Doobara chalane par ye wahi rehte hain.
- Alag data key dene par script **mana kar deti hai**.
- **Pilot ka data aana hai to production ka pehla `put-secrets` `--from-pilot` ke saath hi chalao** (section 6). Warna production apni nayi data key bana lega, aur pilot ke sealed answers nahi khulenge.
- MSG91, WhatsApp, Razorpay, VAPID: `NAME=value` ke roop me. Jo cheezein jodi me aati hain (jaise Razorpay ki teen), unme se ek bhi kam ho to script pehle hi rok deti hai.
- Jo settings secret nahi hain (`SELF_SIGNUP`, price), wo `terraform.tfvars` ke `settings` me jaati hain.

### 5.3 Release

```bash
scripts/release.sh staging                      # HEAD build, migrate, machines, check
scripts/release.sh production --tag <staging wala tag>   # wahi image, build nahi
scripts/release.sh production --tag <purana tag>         # code rollback
```

- Migration fail ho to aur kuch nahi badalta.
- Machines badalna fail ho to tag wapas purane par aa jaata hai.
- Migrations sirf aage jaati hain, isliye har migration pichhli release ke saath bhi chalni chahiye (expand/contract).
- **Exam ke din release ya `terraform apply` kabhi nahi.**

### 5.4 Server check

Test organisation API machine par banta hai (Session Manager se, EC2 console me `parikshaa-<env>-api` machine):

```bash
read -rs -p "Server check ka password (lamba): " CHECK_PASSWORD; echo
sudo docker exec -e PARIKSHAA_OWNER_PASSWORD="$CHECK_PASSWORD" parikshaa-api \
  node packages/api/dist/admin-cli.js --org server-check --org-name "Server check" --email check@parikshaa.in --name "Server check"
```

Phir laptop se, wahi password:

```bash
read -rs -p "Server check ka password: " SMOKE_PASSWORD; echo; export SMOKE_PASSWORD
SMOKE_EMAIL=check@parikshaa.in node scripts/smoke.mjs https://staging.parikshaa.in
```

---

## 6. Pilot se RDS (data le jaana)

Pehle **staging par poora rehearsal**, phir production par. Isme ~30 minute ka down time hai, jab koi exam na ho.

1. **Ek din pehle:** domain ke record ka TTL 60 second.
2. **Production secrets pilot se** (data key aur token secret wahi, taki sealed answers khulein aur candidates ke links chalte rahein):
   ```bash
   scripts/put-secrets.sh production --from-pilot    # API key aur SMTP bhi pilot se aate hain
   ```
3. **Images, bina migration ke** (import ke liye database khaali chahiye):
   ```bash
   tag=$(scripts/release.sh production --images-only | tail -1)
   ```
4. **Pilot rokna aur aakhri backup** (pilot machine par):
   ```bash
   cd /opt/parikshaa && sudo docker compose --env-file /etc/parikshaa.env stop api
   sudo ./scripts/backup.sh          # S3 me bhi jaata hai
   ```
5. **Dump ko stack ke ops bucket me** (laptop se):
   ```bash
   aws s3 ls s3://<pilot backups_bucket>/pilot/ | tail -1
   aws s3 cp s3://<pilot backups_bucket>/pilot/parikshaa-….dump s3://<ops_bucket>/import/pilot.dump
   ```
6. **Import** (API machine par, Session Manager se):
   ```bash
   sudo parikshaa-import s3://<ops_bucket>/import/pilot.dump <tag>
   ```
   Isme ye hota hai:
   - database khaali na ho to mana karta hai;
   - `parikshaa_app` role banata hai;
   - restore karta hai owner ki tarah (RDS superuser nahi deta, aur ye usi tarah chalta hai);
   - migrations chalata hai;
   - **har ledger chain verify** karta hai.

   CI har PR par yahi karta hai, RDS jaise khaali server par.
7. **Release:** `scripts/release.sh production --tag <tag>`. Isme migration kuch nahi karti; machines aur server check hote hain.
8. **Jaanch:** console me ek purana attempt kholo. Answers dikhne chahiye, kyunki data key sahi hai.
9. **DNS:** domain ka record pilot ke IP se hata kar load balancer (`load_balancer` output) par.
10. **Pilot ek hafta band rakho** (terminate mat karo). Phir `termination_protection = false` → `terraform apply` → `terraform destroy`. S3 ke backups 35 din rehte hain.

---

## 7. Email (SES, Mumbai)

1. `dns_records` me se DKIM ke teen CNAME aur DMARC jodo. Route 53 ho to ye khud ban jaate hain.
2. SES console → **Request production access**: naya account sandbox me hota hai aur sirf verified pato par bhejta hai. AWS 1–2 din leta hai.
3. SES console → **SMTP settings → Create SMTP credentials**. Jo user aur password mile, unse `SMTP_URL` banta hai (port 465, `smtps`). Use `put-secrets.sh` se daalo, section 5.2 ki tarah `read -rs` ke saath.

   Ye Terraform se nahi banta, kyunki tab password Terraform ki state me chala jaata.

---

## 8. Roz ka kaam

- **Logs:** CloudWatch → Log groups → `/parikshaa/<env>/api`. Har line me `reqId` hai, aur support ke sawaal par response ka `x-request-id` usse milao. Answers aur passwords logs me kabhi nahi hote (OPERATIONS.md "Logs").
- **Machine par jaana:** EC2 console → machine → Connect → Session Manager. First boot ka log `/var/log/cloud-init-output.log` me hai, service ka `journalctl -u parikshaa`.
- **Alarms:** har alarm ka description batata hai uska matlab aur pehla kadam.
  - Alarms: 5xx, healthy machines, p95 latency, runner, DB CPU/storage/memory/connections.
  - Budget: production me har mahine $1,200 par email; `monthly_budget_usd` se badlo.
- **Bada exam (managed):** ek din pehle `api_min` / `runner_min` badhao aur `terraform apply` karo. Ek API machine 1,000 candidates sambhalti hai (OPERATIONS.md); runner me CPU jitne slots hote hain.
- **Database restore:** RDS → *Restore to point in time* naya instance banata hai. Use check karo, phir `terraform` me `identifier` badal kar ya DNS se switch karo. Ye kaam akele mat karo; pehle staging par ek baar practice karo.
- **Restore drill (har mahine):** RDS snapshot se scratch instance banao, phir `verify-all` chalao (OPERATIONS.md "The restore drill").

---

## 9. Kharcha (andaza)

Mumbai on-demand rate, Oct 2026 ka andaza, $1 = ₹84. AWS Pricing Calculator se pakka karo. 1 saal ke Savings Plan se 30–40% kam hota hai. **Model (Anthropic) ka kharcha alag hai**, aur wahi sabse bada hai (`npm run cost-run`, OPERATIONS.md).

| | Pilot | Staging | Production |
|---|---|---|---|
| Machines | m7i.xlarge ~$146 | API t3.medium + runner c7i.large ~$98 | 2× m7i.large + 2× c7i.xlarge ~$406 |
| Database | machine par | db.t4g.medium ~$55 | db.m7g.large Multi-AZ + 100 GB ~$310 |
| Network | Elastic IP ~$4 | ALB + NLB + 1 NAT + IPs ~$95 | ALB + NLB + 2 NAT + IPs ~$165 |
| Backups, logs, secrets | ~$15 | ~$10 | ~$45 |
| **Mahina** | **~$165 (≈ ₹14,000)** | **~$255 (≈ ₹21,500)** | **~$925 (≈ ₹78,000)** |

Staging par kaam na ho tab uski machines band ki ja sakti hain (database aur NAT phir bhi chalte hain):

```bash
for g in api runner; do aws autoscaling update-auto-scaling-group --region ap-south-1 \
  --auto-scaling-group-name parikshaa-staging-$g --min-size 0 --desired-capacity 0; done
```

Wapas chalane ke liye `terraform apply` karo; ye `api_min` aur `runner_min` wapas le aata hai.

---

## 10. Abhi kya nahi hai (aage ke tukde)

- **Ek bhi `terraform apply` asli account par nahi hua.** Pehla staging apply hi asli test hai, aur jo galti mile wo isi file aur code me theek hogi.
- **Uploads (scans, photos) abhi Postgres me hain**, S3 me nahi. Storage khud badhta hai (1 TB tak). Inhe S3 me le jaane ke liye code badalna padega; ye M-F1 ka agla tukda hai.
- **CDN (CloudFront) nahi hai.** Candidate Mumbai ke load balancer se seedha bundle leta hai. Bharat ke liye ye theek hai; bundle budget CI me pehle se hai.
- **CI se deploy (M-F2) abhi nahi.** Release abhi laptop se `release.sh` hota hai. GitHub OIDC role aur "main → staging apne aap" M-F2 me aayega.
- **Machine ki memory/disk metrics nahi aati**, kyunki CloudWatch agent nahi hai. Abhi sirf CPU, health aur load balancer ke metrics hain.
- **SES bounce/complaint** ka SNS par aana abhi nahi juda.
- **PgBouncer / RDS Proxy nahi hai.** Connections ki seema `api_max × DATABASE_POOL_MAX` hai, aur uske paar jaane par alarm aata hai; tab jodenge.
- **WAF nahi lagaya**, jaan-boojh kar (tracker "Faisle").
