# What every environment shares, made once per AWS account (docs/DEPLOY-AWS.md,
# step 1): the bucket that holds Terraform's state for the pilot, staging and
# production, and the two image repositories every environment pulls from, so
# the image tested on staging is the very image production runs.
#
# Its own state is local (terraform.tfstate here) and holds no secrets. Keep it,
# or import the bucket and the repositories again if it is lost.

terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

variable "region" {
  description = "Where Parikshaa runs: Mumbai, so candidates' data stays in India."
  type        = string
  default     = "ap-south-1"
}

variable "name" {
  description = "Prefix for everything made here."
  type        = string
  default     = "parikshaa"
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project   = var.name
      Stack     = "bootstrap"
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "me" {}

# --- Terraform state ----------------------------------------------------------

resource "aws_s3_bucket" "state" {
  bucket = "${var.name}-tfstate-${data.aws_caller_identity.me.account_id}"
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    id     = "old-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "TlsOnly"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}

# --- Images -------------------------------------------------------------------

# Tags are the git commit and never move: a release names exactly what runs.
resource "aws_ecr_repository" "image" {
  for_each             = toset(["api", "runner"])
  name                 = "${var.name}/${each.key}"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
  encryption_configuration {
    encryption_type = "AES256"
  }
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_ecr_lifecycle_policy" "image" {
  for_each   = aws_ecr_repository.image
  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 60 releases: enough to roll back to any of them for months"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 60
      }
      action = { type = "expire" }
    }]
  })
}

# --- What the environments need -----------------------------------------------

output "backend_hcl" {
  description = "Save as deploy/aws/backend.hcl; every environment's `terraform init -backend-config=../../backend.hcl` reads it."
  value       = <<-EOT
    bucket       = "${aws_s3_bucket.state.id}"
    region       = "${var.region}"
    encrypt      = true
    use_lockfile = true
  EOT
}

output "repositories" {
  description = "Where release.sh pushes the images."
  value       = { for key, repo in aws_ecr_repository.image : key => repo.repository_url }
}
