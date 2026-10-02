# The way in: one HTTPS address, a certificate AWS renews, HTTP sent to HTTPS.
# The API serves the candidate's app, the console and /api from one origin,
# so there is nothing else to route.
#
# No WAF in front, on purpose (docs/PREP-TRACKER.md, "Faisle"): the managed
# rule sets block request bodies that look like SQL or script, and candidates'
# coding answers are exactly that; a per-address rate limit would block a
# whole college lab behind one address. The API's own limits are per
# organisation and per attempt (docs/OPERATIONS.md, "Rate limits").

resource "aws_acm_certificate" "site" {
  domain_name       = var.domain
  validation_method = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "certificate" {
  for_each = local.use_route53 ? {
    for option in aws_acm_certificate.site.domain_validation_options : option.domain_name => option
  } : {}
  zone_id         = var.route53_zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 300
  allow_overwrite = true
}

# Waits for the certificate to be issued: at once with Route 53, or once the
# record from the dns_records output is in place at your DNS provider
# (docs/DEPLOY-AWS.md, "Kadam 2").
resource "aws_acm_certificate_validation" "site" {
  certificate_arn         = aws_acm_certificate.site.arn
  validation_record_fqdns = local.use_route53 ? [for record in aws_route53_record.certificate : record.fqdn] : null
  timeouts {
    create = "2h"
  }
}

resource "aws_lb" "site" {
  name                       = "${local.prefix}-site"
  load_balancer_type         = "application"
  subnets                    = aws_subnet.public[*].id
  security_groups            = [aws_security_group.alb.id]
  idle_timeout               = 120
  drop_invalid_header_fields = true
  enable_deletion_protection = var.deletion_protection

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    prefix  = "alb"
    enabled = true
  }

  depends_on = [aws_s3_bucket_policy.alb_logs]
}

resource "aws_lb_target_group" "api" {
  name                 = "${local.prefix}-api"
  port                 = 3000
  protocol             = "HTTP"
  vpc_id               = aws_vpc.main.id
  deregistration_delay = "30"
  health_check {
    path                = "/api/health"
    matcher             = "200"
    interval            = 15
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.site.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      protocol    = "HTTPS"
      port        = "443"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.site.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.site.certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_route53_record" "site" {
  count   = local.use_route53 ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.domain
  type    = "A"
  alias {
    name                   = aws_lb.site.dns_name
    zone_id                = aws_lb.site.zone_id
    evaluate_target_health = true
  }
}

# --- The load balancer's access logs, 90 days ---------------------------------

data "aws_elb_service_account" "here" {}

resource "aws_s3_bucket" "alb_logs" {
  bucket = "${local.prefix}-alb-logs-${local.account}"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  bucket                  = aws_s3_bucket.alb_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  rule {
    id     = "expire"
    status = "Enabled"
    filter {}
    expiration {
      days = 90
    }
  }
}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "LoadBalancerWrites"
        Effect    = "Allow"
        Principal = { AWS = data.aws_elb_service_account.here.arn }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.alb_logs.arn}/alb/AWSLogs/${local.account}/*"
      },
      {
        Sid       = "LogDeliveryWrites"
        Effect    = "Allow"
        Principal = { Service = "logdelivery.elasticloadbalancing.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.alb_logs.arn}/alb/AWSLogs/${local.account}/*"
      },
      {
        Sid       = "TlsOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [aws_s3_bucket.alb_logs.arn, "${aws_s3_bucket.alb_logs.arn}/*"]
        Condition = { Bool = { "aws:SecureTransport" = "false" } }
      },
    ]
  })
}
