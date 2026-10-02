# Parikshaa on managed AWS (docs/DEPLOY-AWS.md, "Kadam 2"): the same two
# images docker-compose.yml runs, on machines that replace themselves, with
# the database AWS keeps.
#
#   internet ─ ALB (HTTPS, ACM) ─ API machines (Auto Scaling, 2 zones) ─ RDS Postgres
#                                      │
#                                      └─ internal NLB ─ runner machines (gVisor, no way out)
#
# What the code already guarantees, and this relies on: the API's background
# workers are safe on several machines at once (outbox claims use SKIP
# LOCKED, sweeps are idempotent); /api/health is liveness only; the runner
# refuses to start outside gVisor; the runtime role cannot rewrite the
# ledger. Migrations are a deliberate step (release.sh), never on boot.

terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 6.0"
      configuration_aliases = [aws.backup]
    }
  }
}

data "aws_caller_identity" "me" {}

data "aws_region" "here" {}

data "aws_availability_zones" "available" {
  state = "available"
}

# Canonical's current Ubuntu 24.04 LTS. A newer one changes the launch
# templates, and the next apply rolls the machines one by one: read the plan,
# and never apply on an exam day.
data "aws_ssm_parameter" "ubuntu" {
  name = "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id"
}

locals {
  prefix       = "${var.name}-${var.environment}"
  region       = data.aws_region.here.region
  account      = data.aws_caller_identity.me.account_id
  azs          = slice(data.aws_availability_zones.available.names, 0, 2)
  email_domain = var.email_domain == "" ? var.domain : var.email_domain
  use_route53  = var.route53_zone_id != ""
  ami          = data.aws_ssm_parameter.ubuntu.insecure_value
}
