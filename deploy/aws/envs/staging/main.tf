# Staging: the same stack as production, small and in one zone, where every
# release lands first (release.sh staging) and where the pilot's data is
# rehearsed into RDS before production (docs/DEPLOY-AWS.md).

terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
  # bucket and region from ../../backend.hcl (bootstrap's output):
  #   terraform init -backend-config=../../backend.hcl
  backend "s3" {
    key = "staging/terraform.tfstate"
  }
}

variable "domain" {
  description = "The address of this environment, e.g. staging.parikshaa.in."
  type        = string
}

variable "email_domain" {
  description = "The domain email is sent from; empty means domain."
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Set if the domain's DNS is in Route 53; otherwise add the dns_records output at your DNS provider."
  type        = string
  default     = ""
}

variable "alarm_email" {
  type = string
}

variable "settings" {
  description = "Settings that are not secret (SELF_SIGNUP, SIGNUP_PRICE_RUPEES, …)."
  type        = map(string)
  default     = {}
}

provider "aws" {
  region = "ap-south-1"
  default_tags {
    tags = {
      Project   = "parikshaa"
      Stack     = "parikshaa-staging"
      ManagedBy = "terraform"
    }
  }
}

# Hyderabad, for the copy of the database's backups.
provider "aws" {
  alias  = "hyderabad"
  region = "ap-south-2"
  default_tags {
    tags = {
      Project   = "parikshaa"
      Stack     = "parikshaa-staging"
      ManagedBy = "terraform"
    }
  }
}

# Made once by ../../bootstrap, shared by every environment.
data "aws_ecr_repository" "image" {
  for_each = toset(["api", "runner"])
  name     = "parikshaa/${each.key}"
}

module "stack" {
  source = "../../modules/stack"
  providers = {
    aws        = aws
    aws.backup = aws.hyderabad
  }

  environment           = "staging"
  domain                = var.domain
  email_domain          = var.email_domain
  route53_zone_id       = var.route53_zone_id
  alarm_email           = var.alarm_email
  settings              = var.settings
  api_repository_url    = data.aws_ecr_repository.image["api"].repository_url
  runner_repository_url = data.aws_ecr_repository.image["runner"].repository_url

  vpc_cidr     = "10.30.0.0/16"
  nat_gateways = 1
  flow_logs    = false

  db_instance_class   = "db.t4g.medium"
  db_storage_gb       = 20
  db_max_storage_gb   = 100
  db_multi_az         = false
  db_backup_days      = 7
  db_backup_copy      = false
  deletion_protection = false

  api_instance_type    = "t3.medium"
  api_min              = 1
  api_max              = 2
  runner_instance_type = "c7i.large"
  runner_min           = 1
  runner_max           = 2

  monthly_budget_usd = 0
  log_retention_days = 30
}

output "stack" {
  value = module.stack
}
