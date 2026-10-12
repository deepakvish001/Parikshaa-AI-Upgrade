# Staging: Supabase + Vercel + ek VM (G0)

[F1-GO-LIVE-PLAN.md](F1-GO-LIVE-PLAN.md) §8 ka runbook. Staging wo jagah hai jahan owner poora product khud chala kar dekhta hai, production se pehle. Production bilkul isi tareeke se banta hai, sirf naam aur secrets alag.

```
browser ──► Vercel  staging.<domain>          (web + console, static)
               │  /api/*  (+ X-Parikshaa-Edge header, Vercel ke env se)
               ▼
            VM  api.staging.<domain>          (Caddy → API + workers + runner/gVisor)
               │  Supavisor pooler (6543)          │  Storage REST
               ▼                                   ▼
            Supabase staging project (Mumbai): Postgres + proctor-media bucket
```

**Kyun aisa:** browser ko ek hi origin dikhta hai (`staging.<domain>`), isliye CSP `'self'`, cookies, purane links sab waise hi chalte hain, CORS ki zaroorat nahi. Vercel `/api` ko VM tak pahunchata hai; VM ka Caddy sirf wahi request maanta hai jisme Vercel ka lagaya **edge secret** ho. Isse client ka asli IP (Vercel `X-Forwarded-For` khud likhta hai) bharose layak rehta hai, aur login throttle sahi kaam karta hai. Seedha VM par aane wale ko 403.

Code me kya hai:

| Cheez | Kahan |
|---|---|
| Vercel ka build (web `/`, console `/console/`, `/api` proxy, security headers) | `packages/api/src/vercel-output.ts`, `npm run vercel-output -w @parikshaa/api` |
| Headers ek jagah (API aur Vercel dono) | `packages/api/src/page-headers.ts` |
| VM: Supabase DB ke saath sirf API + runner | `scripts/setup-server.sh` (`DATABASE_URL`, `APP_DOMAIN`), `deploy/vm/external-db.yml` |
| Photos Supabase Storage me | `packages/api/src/storage.ts`, migration 0066, `npm run media-move -w @parikshaa/api` |
| Deploy | `.github/workflows/deploy-web.yml` (Vercel), `deploy-api.yml` (migrate → VM → server check) |
| Tests | `vercel-output.test.ts`, `storage.test.ts`, `store/src/pooler.test.ts`, `proctor-store.test.ts`, `scripts/test/setup-server.test.sh` |

---

## 1. Owner: ek baar ke kaam

Har secret seedha us jagah daaliye jahan likha hai (Supabase, Vercel, GitHub, VM). **Chat me kabhi mat bhejiye.**

### 1.1 Domain

Do naam chahiye, jaise `staging.example.in` (pages, Vercel) aur `api.staging.example.in` (VM). Production ke liye baad me `example.in` aur `api.example.in`.

### 1.2 Supabase (staging project)

1. Supabase me naya project `parikshaa-staging`, region **ap-south-1 (Mumbai)**. Database password ek password manager me.
2. **Migrations:** GitHub → Settings → Environments → `staging` → secret `MIGRATE_DATABASE_URL` = Connect panel ka **session pooler** URL (user `postgres`). Pehli baar ek laptop/VM se, runtime role ka password set karne ke liye:
   ```bash
   DATABASE_URL='<session pooler URL>' PARIKSHAA_APP_PASSWORD='<naya lamba password>' \
     node packages/store/dist/migrate-cli.js
   ```
   (Uske baad har deploy `deploy-api.yml` se migrations khud chalata hai.)
3. **Runtime URL** (VM ke liye): **transaction pooler** (port 6543), user `parikshaa_app.<project-ref>`, password upar wala. Jaise:
   `postgresql://parikshaa_app.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`
   Transaction pooler theek hai: hamari RLS settings transaction ke andar hi lagti hain (`pooler.test.ts`).
4. **Storage:** Project Settings → API Keys → ek **naya secret key** (`sb_secret_…`) sirf is VM ke liye. Bucket `proctor-media` API pehli baar chalte hi khud banati hai, **private**; public bucket mile to API shuru hi nahi hoti.

### 1.3 VM (AWS Mumbai)

1. Ubuntu 24.04, `t3.large` ya bada, disk 40 GB. Security group: 80 aur 443 sabke liye, 22 sirf GitHub Actions/owner ke liye (ya SSM).
2. DNS: `api.staging.<domain>` → VM ka IP.
3. Machine par, repo clone karke (private repo ho to ek read-only deploy key):
   ```bash
   git clone https://github.com/deepakvish001/Parikshaa-AI-Upgrade.git ~/parikshaa && cd ~/parikshaa
   sudo DOMAIN=api.staging.<domain> APP_DOMAIN=staging.<domain> \
        DATABASE_URL='<runtime URL, 1.2.3>' \
        SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY='<sb_secret_…>' \
        ./scripts/setup-server.sh
   ```
   Ye baaki sab poochh leta hai (admin email, Anthropic key, SMTP), `/etc/parikshaa.env` likhta hai (600), aur ek **edge secret** banata hai: `sudo grep PARIKSHAA_EDGE_SECRET /etc/parikshaa.env`. Isi file ki ek copy password manager me rakhiye: `PARIKSHAA_DATA_KEY` kho gaya to sealed jawab kabhi nahi khulenge.

### 1.4 Vercel

1. Naya project `parikshaa-staging` (Git se mat jodiye: deploy GitHub Actions karta hai, `--prebuilt`).
2. Project → Settings → Environment Variables: `PARIKSHAA_EDGE_SECRET` = VM wala value (Production aur Preview dono).
3. Domain `staging.<domain>` jodiye.
4. Account → Tokens → ek token (sirf is team ke liye).

### 1.5 GitHub (Settings → Environments → `staging`)

| Kya | Naam | Value |
|---|---|---|
| secret | `VERCEL_TOKEN` | 1.4.4 |
| variable | `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Vercel project → Settings → General |
| variable | `API_ORIGIN` | `https://api.staging.<domain>` |
| variable | `APP_URL` | `https://staging.<domain>` |
| secret | `MIGRATE_DATABASE_URL` | 1.2.2 |
| secret | `VM_SSH_KEY` | deploy ke liye ek naya SSH key (private half) |
| variable | `VM_HOST`, `VM_USER` | VM ka naam/IP, jaise `ubuntu` |
| variable | `VM_KNOWN_HOSTS` | `ssh-keyscan api.staging.<domain>` ki line |

`production` environment me wahi naam, production ke values, aur **Required reviewers** (owner) on.

Jab tak ye set nahi, dono workflows kuch nahi karte aur "Not deployed: set …" likh dete hain.

---

## 2. Har roz

- `main` par merge → `deploy-web.yml` Vercel staging, `deploy-api.yml` migrations → VM update → server check. PR par Vercel ka preview link (staging ki API se).
- Production: Actions → *Deploy API (VM)* → Run → `production`, phir *Deploy pages (Vercel)* → `production`. Pehle API, phir pages.
- Purane photos (Storage se pehle ke) ek baar: VM par `docker compose … exec api npm run media-move -w @parikshaa/api`. Dobara chalane par jahan ruka tha wahin se.

## 3. Jaanch (owner, staging par)

1. `https://staging.<domain>/console/` khule; `https://staging.<domain>/api/health` → ok.
2. `https://api.staging.<domain>/api/health` seedha kholiye → **403** aana chahiye.
3. Ek proctored exam do: photos Supabase → Storage → `proctor-media` me `org/attempt/photo` naam se dikhen, file kholne par kuch padha na jaaye (sealed).
4. Galat password 10 baar → sirf aapka email/IP ruke, baaki log nahi.

## 4. Abhi kya baaki hai (G0)

- Sentry aur uptime monitor (Better Stack/UptimeRobot): naya dependency aur account; jab staging URL ho tab.
- Question images aur community logos abhi bhi Postgres me (chhote hain, 100 KB tak); sirf proctoring photos Storage me gaye.
- Load balancer ke saath 2+ API VM: production me jab zaroorat ho (stateless hai, judge queue per-process).
