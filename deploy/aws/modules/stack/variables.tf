variable "name" {
  description = "Prefix for everything in the stack."
  type        = string
  default     = "parikshaa"
}

variable "environment" {
  description = "staging or production."
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment is staging or production."
  }
}

variable "domain" {
  description = "The address candidates and staff open, e.g. exam.parikshaa.in. Its certificate is made here."
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9.-]+\\.[a-z]{2,}$", var.domain))
    error_message = "domain is a host name like exam.parikshaa.in, with no https:// and no path."
  }
}

variable "email_domain" {
  description = "The domain Parikshaa's email is sent from (SES checks it with DKIM). Empty means the same as domain."
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "A Route 53 hosted zone holding domain. Given one, every DNS record is made here; without, the dns_records output lists what to add at your DNS provider."
  type        = string
  default     = ""
}

variable "api_repository_url" {
  description = "ECR repository of the API image (bootstrap's output)."
  type        = string
}

variable "runner_repository_url" {
  description = "ECR repository of the code runner image (bootstrap's output)."
  type        = string
}

variable "alarm_email" {
  description = "Who hears about failures and the monthly bill. Confirm the email AWS sends."
  type        = string
}

variable "monthly_budget_usd" {
  description = "An email at 80% of this month's spend and when the forecast crosses it. 0 turns the budget off."
  type        = number
  default     = 0
}

# --- Network ------------------------------------------------------------------

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "nat_gateways" {
  description = "1 is cheaper; 2 keeps the app's way out when one zone fails."
  type        = number
  default     = 1
  validation {
    condition     = contains([1, 2], var.nat_gateways)
    error_message = "nat_gateways is 1 or 2."
  }
}

variable "flow_logs" {
  description = "Record the VPC's accepted and rejected connections, for an incident."
  type        = bool
  default     = true
}

# --- Database -----------------------------------------------------------------

variable "db_instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "db_engine_version" {
  description = "Postgres major version, as docker-compose.yml runs."
  type        = string
  default     = "16"
}

variable "db_storage_gb" {
  type    = number
  default = 50
}

variable "db_max_storage_gb" {
  description = "Storage grows by itself up to this."
  type        = number
  default     = 500
}

variable "db_multi_az" {
  description = "A standby in a second zone, taking over in a minute or two."
  type        = bool
  default     = false
}

variable "db_backup_days" {
  description = "Point-in-time recovery window. docs/OPERATIONS.md asks for at least 14 in production."
  type        = number
  default     = 7
  validation {
    condition     = var.db_backup_days >= 1 && var.db_backup_days <= 35
    error_message = "db_backup_days is 1 to 35."
  }
}

variable "db_backup_copy" {
  description = "Copy the automated backups to the aws.backup provider's region (Hyderabad), for a whole region failing."
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "The database, the load balancer and the secrets refuse deletion until this is turned off."
  type        = bool
  default     = true
}

# --- Machines -----------------------------------------------------------------

variable "api_instance_type" {
  type    = string
  default = "t3.medium"
}

variable "api_min" {
  description = "Two or more in production: one machine failing must not stop a sitting."
  type        = number
  default     = 1
}

variable "api_max" {
  type    = number
  default = 4
}

variable "runner_instance_type" {
  description = "The code runner: CPU-bound, one run per vCPU at a time."
  type        = string
  default     = "c7i.large"
}

variable "runner_min" {
  type    = number
  default = 1
}

variable "runner_max" {
  type    = number
  default = 4
}

variable "database_pool_max" {
  description = "Connections per API machine. Keep api_max × this under the database's max_connections."
  type        = number
  default     = 20
}

variable "settings" {
  description = "Settings that are not secret, for every API machine (SELF_SIGNUP, SIGNUP_PRICE_RUPEES, LOG_LEVEL, …). Secrets go in Secrets Manager through put-secrets.sh."
  type        = map(string)
  default     = {}
  validation {
    condition = alltrue([for key in keys(var.settings) : !contains([
      "ANTHROPIC_API_KEY", "ATTEMPT_TOKEN_SECRET", "PARIKSHAA_DATA_KEY", "RUNNER_TOKEN", "PARIKSHAA_APP_PASSWORD",
      "DATABASE_URL", "SMTP_URL", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET", "WHATSAPP_TOKEN", "MSG91_AUTH_KEY", "VAPID_PRIVATE_KEY",
    ], key)])
    error_message = "A secret does not belong in settings (it would sit in Terraform's state and the launch template): put it in Secrets Manager with deploy/aws/scripts/put-secrets.sh."
  }
}

variable "log_retention_days" {
  description = "How long the API's and the runner's logs are kept."
  type        = number
  default     = 180
}

variable "latency_alarm_seconds" {
  description = "Alarm when the API's 95th-percentile response time stays above this. Tune it once a real sitting has been watched."
  type        = number
  default     = 5
}
