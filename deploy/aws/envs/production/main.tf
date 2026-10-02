# Production: two zones throughout, a standby database, backups copied to
# Hyderabad, and nothing deletable by accident (docs/DEPLOY-AWS.md).

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
    key = "production/terraform.tfstate"
  }
}

variable "domain" {
  description = "The address of this environment, e.g. exam.parikshaa.in."
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

variable "monthly_budget_usd" {
  description = "An email at 80% of the month's AWS bill, and when the forecast crosses it."
  type        = number
  default     = 1200
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
      Stack     = "parikshaa-production"
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
      Stack     = "parikshaa-production"
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

  environment           = "production"
  domain                = var.domain
  email_domain          = var.email_domain
  route53_zone_id       = var.route53_zone_id
  alarm_email           = var.alarm_email
  settings              = var.settings
  api_repository_url    = data.aws_ecr_repository.image["api"].repository_url
  runner_repository_url = data.aws_ecr_repository.image["runner"].repository_url

  vpc_cidr     = "10.20.0.0/16"
  nat_gateways = 2
  flow_logs    = true

  # docs/OPERATIONS.md: one API machine serves a 1,000-candidate drive; two
  # are for a machine failing, not for capacity.
  db_instance_class   = "db.m7g.large"
  db_storage_gb       = 100
  db_max_storage_gb   = 1000
  db_multi_az         = true
  db_backup_days      = 14
  db_backup_copy      = true
  deletion_protection = true

  api_instance_type    = "m7i.large"
  api_min              = 2
  api_max              = 6
  runner_instance_type = "c7i.xlarge"
  runner_min           = 2
  runner_max           = 8

  monthly_budget_usd = var.monthly_budget_usd
  log_retention_days = 180
}

output "stack" {
  value = module.stack
}
