# Email through Amazon SES in Mumbai: invitations, reminders, results, OTPs.
# The domain is proved with DKIM, so mail is signed and lands in inboxes.
#
# Two steps are the owner's, in the SES console (docs/DEPLOY-AWS.md, "Email"):
# asking AWS to take the account out of the sandbox, and making the SMTP
# credentials that put-secrets.sh stores as SMTP_URL. Making them here would
# put a password in Terraform's state.

resource "aws_sesv2_email_identity" "mail" {
  email_identity = local.email_domain
  # Easy DKIM: SES makes and rotates the keys; 2048-bit.
  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

resource "aws_route53_record" "dkim" {
  count   = local.use_route53 ? 3 : 0
  zone_id = var.route53_zone_id
  name    = "${aws_sesv2_email_identity.mail.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${local.email_domain}"
  type    = "CNAME"
  ttl     = 1800
  records = ["${aws_sesv2_email_identity.mail.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

resource "aws_route53_record" "dmarc" {
  count   = local.use_route53 ? 1 : 0
  zone_id = var.route53_zone_id
  name    = "_dmarc.${local.email_domain}"
  type    = "TXT"
  ttl     = 1800
  records = ["v=DMARC1; p=quarantine; adkim=r; aspf=r"]
}
