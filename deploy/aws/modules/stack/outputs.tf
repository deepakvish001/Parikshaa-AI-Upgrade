# release.sh and put-secrets.sh read these (terraform output -json), and
# dns_records is what to add at your DNS provider when Route 53 is not it.

output "region" {
  value = local.region
}

output "environment" {
  value = var.environment
}

output "domain" {
  value = var.domain
}

output "load_balancer" {
  description = "Point domain here: a CNAME (or an ALIAS at the apex)."
  value       = aws_lb.site.dns_name
}

output "dns_records" {
  description = "Every record the stack needs. Made already when route53_zone_id is set; otherwise add them at your DNS provider."
  value = concat(
    [{ name = var.domain, type = "CNAME", value = aws_lb.site.dns_name, why = "the site (an ALIAS to the load balancer if this is the domain's apex)" }],
    [for option in aws_acm_certificate.site.domain_validation_options : {
      name  = option.resource_record_name
      type  = option.resource_record_type
      value = option.resource_record_value
      why   = "proves the domain to ACM, for the HTTPS certificate; keep it, renewals use it"
    }],
    [for token in try(aws_sesv2_email_identity.mail.dkim_signing_attributes[0].tokens, []) : {
      name  = "${token}._domainkey.${local.email_domain}"
      type  = "CNAME"
      value = "${token}.dkim.amazonses.com"
      why   = "signs Parikshaa's email (DKIM)"
    }],
    [{ name = "_dmarc.${local.email_domain}", type = "TXT", value = "v=DMARC1; p=quarantine; adkim=r; aspf=r", why = "tells inboxes to trust only signed mail from this domain" }],
  )
}

output "app_secret" {
  value = aws_secretsmanager_secret.app.arn
}

output "runner_secret" {
  value = aws_secretsmanager_secret.runner.arn
}

output "image_tag_parameter" {
  value = aws_ssm_parameter.image_tag.name
}

output "api_group" {
  value = aws_autoscaling_group.role["api"].name
}

output "runner_group" {
  value = aws_autoscaling_group.role["runner"].name
}

output "api_repository" {
  value = var.api_repository_url
}

output "runner_repository" {
  value = var.runner_repository_url
}

output "ops_bucket" {
  description = "Where a pilot's dump waits for parikshaa-import (kept 7 days)."
  value       = aws_s3_bucket.ops.id
}

output "database" {
  value = aws_db_instance.main.address
}

output "smtp_host" {
  description = "SES's SMTP endpoint, for SMTP_URL (smtps on port 465, with the SMTP credentials made in the SES console)"
  value       = "email-smtp.${local.region}.amazonaws.com"
}
