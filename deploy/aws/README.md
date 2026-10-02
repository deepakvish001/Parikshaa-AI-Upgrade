# Parikshaa on AWS (Mumbai)

The runbook is [docs/DEPLOY-AWS.md](../../docs/DEPLOY-AWS.md): what to run, in what order, and why.

| Directory | What it makes |
|---|---|
| `bootstrap/` | Once per account: the bucket for Terraform's state, and the two image repositories every environment shares |
| `pilot/` | Step one: one machine set up by `scripts/setup-server.sh`, with backups to S3, nightly disk snapshots and Session Manager in place of SSH |
| `modules/stack/` | Step two: VPC, RDS Postgres, the load balancer, the API and code-runner machines, secrets, email, alarms |
| `envs/staging`, `envs/production` | The stack, sized for each |
| `scripts/` | `put-secrets.sh` (fills the secrets, never replaces the data key), `release.sh` (images → migrations → machines → server check), `import-dump.sh` (a pilot's database into RDS) |

Checked in CI (`deploy` job) without an AWS account:

```bash
terraform fmt -check -recursive deploy/aws
terraform -chdir=deploy/aws/pilot test            # after terraform init -backend=false
terraform -chdir=deploy/aws/modules/stack test
deploy/aws/scripts/test/scripts.test.sh
```
