# Step one of going live (docs/DEPLOY-AWS.md, "Kadam 1"): one machine in
# Mumbai, set up by the same scripts/setup-server.sh a college's own server
# uses: Docker, gVisor, Caddy for HTTPS, Postgres on the machine, a nightly
# backup. This adds what AWS gives on top:
#
# - no SSH at all: a shell through Session Manager (aws ssm start-session),
#   so port 22 is never open and there is no key to lose;
# - an address that survives a stop and start (Elastic IP), for the DNS;
# - every nightly dump copied to S3, where the machine may add a backup but
#   never read or delete one;
# - a snapshot of the whole disk every night, kept a week;
# - the settings file (with the data key) copied to Secrets Manager on
#   request, so losing the machine does not lose the sealed answers;
# - recovery onto new hardware if AWS's side fails, and an email if it does.
#
# Step two (../envs/production) moves this data to managed Postgres.

terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
  # bucket and region from ../backend.hcl (bootstrap's output):
  #   terraform init -backend-config=../backend.hcl
  backend "s3" {
    key = "pilot/terraform.tfstate"
  }
}

variable "region" {
  type    = string
  default = "ap-south-1"
}

variable "name" {
  type    = string
  default = "parikshaa-pilot"
}

variable "domain" {
  description = "The address candidates open, e.g. exam.parikshaa.in. Point its A record at the elastic_ip output."
  type        = string
}

variable "alarm_email" {
  description = "Who hears when the machine fails or runs hot. Confirm the email AWS sends."
  type        = string
}

variable "instance_type" {
  description = "4 vCPUs and 16 GB hold a 500-candidate sitting with the code runner on the same machine (docs/OPERATIONS.md)."
  type        = string
  default     = "m7i.xlarge"
}

variable "disk_gb" {
  description = "Postgres, the images and two weeks of local dumps."
  type        = number
  default     = 100
}

variable "repo_url" {
  type    = string
  default = "https://github.com/deepakvish001/Parikshaa-AI-Upgrade.git"
}

variable "repo_ref" {
  description = "The branch or tag the machine checks out on first boot."
  type        = string
  default     = "main"
}

variable "backup_keep_days" {
  description = "How long S3 keeps each nightly dump."
  type        = number
  default     = 35
}

variable "termination_protection" {
  description = "Refuse to terminate the machine (and so `terraform destroy`) until this is turned off."
  type        = bool
  default     = true
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project   = "parikshaa"
      Stack     = var.name
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "me" {}

data "aws_availability_zones" "available" {
  state = "available"
}

# Canonical's current Ubuntu 24.04 LTS, the release setup-server.sh supports.
data "aws_ssm_parameter" "ubuntu" {
  name = "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id"
}

locals {
  backup_prefix = "pilot/"
  user_data = templatefile("${path.module}/user-data.sh.tftpl", {
    region          = var.region
    repo_url        = var.repo_url
    repo_ref        = var.repo_ref
    backup_target   = "s3://${aws_s3_bucket.backups.bucket}/${local.backup_prefix}"
    settings_secret = aws_secretsmanager_secret.settings.arn
  })
}

# --- Network: one public subnet of its own ------------------------------------

resource "aws_vpc" "pilot" {
  cidr_block           = "10.10.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = var.name }
}

resource "aws_internet_gateway" "pilot" {
  vpc_id = aws_vpc.pilot.id
  tags   = { Name = var.name }
}

resource "aws_subnet" "pilot" {
  vpc_id            = aws_vpc.pilot.id
  cidr_block        = "10.10.1.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]
  tags              = { Name = var.name }
}

resource "aws_route_table" "pilot" {
  vpc_id = aws_vpc.pilot.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.pilot.id
  }
  tags = { Name = var.name }
}

resource "aws_route_table_association" "pilot" {
  subnet_id      = aws_subnet.pilot.id
  route_table_id = aws_route_table.pilot.id
}

# HTTP (for the certificate and the redirect) and HTTPS in; nothing else, not
# even SSH.
resource "aws_security_group" "pilot" {
  name        = var.name
  description = "Parikshaa pilot: HTTP and HTTPS in, anything out"
  vpc_id      = aws_vpc.pilot.id
  tags        = { Name = var.name }
}

resource "aws_vpc_security_group_ingress_rule" "web" {
  for_each          = { http = 80, https = 443 }
  security_group_id = aws_security_group.pilot.id
  description       = each.key
  ip_protocol       = "tcp"
  from_port         = each.value
  to_port           = each.value
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "out" {
  security_group_id = aws_security_group.pilot.id
  description       = "Packages, the model, email, S3"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# --- Backups ------------------------------------------------------------------

resource "aws_s3_bucket" "backups" {
  bucket = "${var.name}-backups-${data.aws_caller_identity.me.account_id}"
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    id     = "expire"
    status = "Enabled"
    filter {}
    expiration {
      days = var.backup_keep_days
    }
    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}

resource "aws_s3_bucket_policy" "backups" {
  bucket = aws_s3_bucket.backups.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "TlsOnly"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.backups.arn, "${aws_s3_bucket.backups.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}

# The settings file holds PARIKSHAA_DATA_KEY: without it no sealed answer can
# be read again, and the database dumps deliberately do not contain it. Made
# empty here, so the value never passes through Terraform's state; the machine
# fills it with `sudo parikshaa-save-settings` after setup.
resource "aws_secretsmanager_secret" "settings" {
  name                    = "parikshaa/pilot/settings"
  description             = "The pilot's /etc/parikshaa.env, written by parikshaa-save-settings on the machine"
  recovery_window_in_days = 30
}

# --- The machine's own permissions --------------------------------------------

resource "aws_iam_role" "pilot" {
  name = var.name
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.pilot.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Add a backup, and nothing more: someone who takes the machine over cannot
# read the old dumps or delete them.
resource "aws_iam_role_policy" "pilot" {
  name = "backups-and-settings"
  role = aws_iam_role.pilot.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AddBackups"
        Effect   = "Allow"
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.backups.arn}/${local.backup_prefix}*"
      },
      {
        Sid      = "SaveSettings"
        Effect   = "Allow"
        Action   = ["secretsmanager:PutSecretValue", "secretsmanager:DescribeSecret"]
        Resource = aws_secretsmanager_secret.settings.arn
      },
    ]
  })
}

resource "aws_iam_instance_profile" "pilot" {
  name = var.name
  role = aws_iam_role.pilot.name
}

# --- The machine --------------------------------------------------------------

resource "aws_instance" "pilot" {
  ami                     = data.aws_ssm_parameter.ubuntu.insecure_value
  instance_type           = var.instance_type
  subnet_id               = aws_subnet.pilot.id
  vpc_security_group_ids  = [aws_security_group.pilot.id]
  iam_instance_profile    = aws_iam_instance_profile.pilot.name
  disable_api_termination = var.termination_protection
  # An address of its own from the first second, so the first boot can fetch
  # packages before the Elastic IP is attached (which then takes its place).
  associate_public_ip_address = true

  # IMDSv2 only, and one hop: the containers on the machine cannot reach the
  # metadata service, so candidate code cannot borrow the machine's role.
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = var.disk_gb
    encrypted   = true
    tags        = { Name = var.name, Snapshot = var.name }
  }

  user_data = local.user_data

  tags = { Name = var.name }

  # A newer Ubuntu image or an edited first-boot script must never replace a
  # machine that holds the database. Upgrades happen on the machine.
  lifecycle {
    ignore_changes = [ami, user_data]
  }
}

resource "aws_eip" "pilot" {
  domain   = "vpc"
  instance = aws_instance.pilot.id
  tags     = { Name = var.name }
}

# --- Nightly disk snapshots, a week of them -----------------------------------

resource "aws_iam_role" "snapshots" {
  name = "${var.name}-snapshots"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "dlm.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "snapshots" {
  role       = aws_iam_role.snapshots.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSDataLifecycleManagerServiceRole"
}

resource "aws_dlm_lifecycle_policy" "snapshots" {
  description        = "${var.name} disk nightly"
  execution_role_arn = aws_iam_role.snapshots.arn
  state              = "ENABLED"
  policy_details {
    resource_types = ["VOLUME"]
    target_tags    = { Snapshot = var.name }
    schedule {
      name = "nightly"
      create_rule {
        interval      = 24
        interval_unit = "HOURS"
        times         = ["22:00"] # 03:30 IST, after the 02:30 IST dump
      }
      retain_rule {
        count = 7
      }
      copy_tags = true
    }
  }
}

# --- When something is wrong --------------------------------------------------

resource "aws_sns_topic" "alarms" {
  name = "${var.name}-alarms"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# AWS's hardware or network failed: move the machine to healthy hardware (same
# disk, same address) and say so.
resource "aws_cloudwatch_metric_alarm" "recover" {
  alarm_name          = "${var.name}-system-check"
  alarm_description   = "AWS's side of the pilot machine failed; it is being recovered onto new hardware."
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_System"
  dimensions          = { InstanceId = aws_instance.pilot.id }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  alarm_actions       = ["arn:aws:automate:${var.region}:ec2:recover", aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "instance_check" {
  alarm_name          = "${var.name}-instance-check"
  alarm_description   = "The pilot machine itself stopped answering (out of memory, a full disk, a kernel fault). Reboot it from the EC2 console."
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_Instance"
  dimensions          = { InstanceId = aws_instance.pilot.id }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "cpu" {
  alarm_name          = "${var.name}-cpu"
  alarm_description   = "The pilot machine has been above 85% CPU for 15 minutes. If a sitting is on, it is near its limit: see docs/DEPLOY-AWS.md, 'Bada exam'."
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  dimensions          = { InstanceId = aws_instance.pilot.id }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}

# --- What to do next ----------------------------------------------------------

output "elastic_ip" {
  description = "Point the domain's A record here."
  value       = aws_eip.pilot.public_ip
}

output "instance_id" {
  value = aws_instance.pilot.id
}

output "shell" {
  description = "A shell on the machine, through Session Manager (needs the AWS CLI's session-manager-plugin)."
  value       = "aws ssm start-session --region ${var.region} --target ${aws_instance.pilot.id}"
}

output "backups_bucket" {
  value = aws_s3_bucket.backups.id
}

output "settings_secret" {
  value = aws_secretsmanager_secret.settings.name
}

output "next" {
  value = <<-EOT
    1. DNS: A record ${var.domain} -> ${aws_eip.pilot.public_ip}
    2. Shell: aws ssm start-session --region ${var.region} --target ${aws_instance.pilot.id}
    3. On the machine: sudo parikshaa-setup        (asks for the API key, SMTP, price)
    4. On the machine: sudo parikshaa-save-settings (the data key, off the machine)
  EOT
}
