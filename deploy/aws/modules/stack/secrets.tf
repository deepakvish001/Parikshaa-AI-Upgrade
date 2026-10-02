# The secrets, made empty here so no value ever passes through Terraform's
# state. deploy/aws/scripts/put-secrets.sh fills them: it makes the service's
# own secrets once (ATTEMPT_TOKEN_SECRET, PARIKSHAA_DATA_KEY, RUNNER_TOKEN,
# PARIKSHAA_APP_PASSWORD) or carries them over from the pilot, and never
# replaces them: a new PARIKSHAA_DATA_KEY makes every sealed answer unreadable.
#
#   <name>/<env>/app     JSON: everything the API needs that is secret
#   <name>/<env>/runner  JSON: RUNNER_TOKEN only; the runner sees nothing else

resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.name}/${var.environment}/app"
  description             = "Parikshaa API secrets (put-secrets.sh). Holds PARIKSHAA_DATA_KEY: never delete it."
  kms_key_id              = aws_kms_key.data.arn
  recovery_window_in_days = 30
}

resource "aws_secretsmanager_secret" "runner" {
  name                    = "${var.name}/${var.environment}/runner"
  description             = "Parikshaa code runner's token (put-secrets.sh)"
  kms_key_id              = aws_kms_key.data.arn
  recovery_window_in_days = 7
}

# Deleting the app secret loses the data key. Refused for everyone while
# deletion_protection is on; turning it off is a deliberate apply.
resource "aws_secretsmanager_secret_policy" "app" {
  count      = var.deletion_protection ? 1 : 0
  secret_arn = aws_secretsmanager_secret.app.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "NeverDeleteTheDataKey"
      Effect    = "Deny"
      Principal = "*"
      Action    = "secretsmanager:DeleteSecret"
      Resource  = "*"
    }]
  })
}

# The released image tag. release.sh moves it; machines read it as they start.
# "none" until the first release: the machines answer health checks with a
# placeholder, so they are not replaced over and over before there is anything to run.
resource "aws_ssm_parameter" "image_tag" {
  name        = "/${var.name}/${var.environment}/image-tag"
  description = "The git commit every Parikshaa machine runs (deploy/aws/scripts/release.sh)"
  type        = "String"
  value       = "none"
  lifecycle {
    ignore_changes = [value]
  }
}

# Where a pilot's dump waits to be imported (host/parikshaa-import); a week at most.
resource "aws_s3_bucket" "ops" {
  bucket = "${local.prefix}-ops-${local.account}"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "ops" {
  bucket = aws_s3_bucket.ops.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "ops" {
  bucket                  = aws_s3_bucket.ops.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "ops" {
  bucket = aws_s3_bucket.ops.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "ops" {
  bucket = aws_s3_bucket.ops.id
  rule {
    id     = "expire"
    status = "Enabled"
    filter {}
    expiration {
      days = 7
    }
  }
}

resource "aws_s3_bucket_policy" "ops" {
  bucket = aws_s3_bucket.ops.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "TlsOnly"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.ops.arn, "${aws_s3_bucket.ops.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}
