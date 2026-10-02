# The managed stack's promises, checked without an AWS account:
#   terraform init -backend=false && terraform test
# The provider is mocked, so these hold the configuration to what it says
# (who may reach whom, what is encrypted, what production keeps), not AWS to
# what it does; staging is where that is checked (docs/DEPLOY-AWS.md).

mock_provider "aws" {
  mock_data "aws_availability_zones" {
    defaults = { names = ["ap-south-1a", "ap-south-1b", "ap-south-1c"] }
  }
  mock_data "aws_ssm_parameter" {
    defaults = { insecure_value = "ami-0123456789abcdef0" }
  }
  mock_data "aws_caller_identity" {
    defaults = { account_id = "123456789012" }
  }
  mock_data "aws_region" {
    defaults = { region = "ap-south-1" }
  }
  mock_data "aws_elb_service_account" {
    defaults = { arn = "arn:aws:iam::718504428378:root" }
  }
  # Real ARNs where the provider checks the shape of one.
  mock_resource "aws_sns_topic" {
    defaults = { arn = "arn:aws:sns:ap-south-1:123456789012:parikshaa-alarms" }
  }
  mock_resource "aws_iam_role" {
    defaults = { arn = "arn:aws:iam::123456789012:role/parikshaa" }
  }
  mock_resource "aws_iam_instance_profile" {
    defaults = { arn = "arn:aws:iam::123456789012:instance-profile/parikshaa" }
  }
  mock_resource "aws_s3_bucket" {
    defaults = { arn = "arn:aws:s3:::parikshaa-bucket" }
  }
  mock_resource "aws_kms_key" {
    defaults = { arn = "arn:aws:kms:ap-south-1:123456789012:key/00000000-0000-0000-0000-000000000000" }
  }
  mock_resource "aws_secretsmanager_secret" {
    defaults = { arn = "arn:aws:secretsmanager:ap-south-1:123456789012:secret:parikshaa-AbCdEf" }
  }
  mock_resource "aws_cloudwatch_log_group" {
    defaults = { arn = "arn:aws:logs:ap-south-1:123456789012:log-group:/parikshaa" }
  }
  mock_resource "aws_ssm_parameter" {
    defaults = { arn = "arn:aws:ssm:ap-south-1:123456789012:parameter/parikshaa/image-tag" }
  }
  mock_resource "aws_sesv2_email_identity" {
    defaults = { dkim_signing_attributes = { tokens = ["tok1", "tok2", "tok3"] } }
  }
  mock_resource "aws_launch_template" {
    defaults = { id = "lt-0123456789abcdef0", latest_version = 1 }
  }
  mock_resource "aws_lb" {
    defaults = {
      arn        = "arn:aws:elasticloadbalancing:ap-south-1:123456789012:loadbalancer/app/parikshaa/0123456789abcdef"
      arn_suffix = "app/parikshaa/0123456789abcdef"
      dns_name   = "parikshaa-0123456789.ap-south-1.elb.amazonaws.com"
    }
  }
  mock_resource "aws_lb_target_group" {
    defaults = {
      arn        = "arn:aws:elasticloadbalancing:ap-south-1:123456789012:targetgroup/parikshaa/0123456789abcdef"
      arn_suffix = "targetgroup/parikshaa/0123456789abcdef"
    }
  }
  mock_resource "aws_acm_certificate" {
    defaults = {
      arn = "arn:aws:acm:ap-south-1:123456789012:certificate/00000000-0000-0000-0000-000000000000"
      domain_validation_options = [{
        domain_name           = "exam.example.in"
        resource_record_name  = "_abc.exam.example.in."
        resource_record_type  = "CNAME"
        resource_record_value = "_xyz.acm-validations.aws."
      }]
    }
  }
  mock_resource "aws_acm_certificate_validation" {
    defaults = { certificate_arn = "arn:aws:acm:ap-south-1:123456789012:certificate/00000000-0000-0000-0000-000000000000" }
  }
  mock_resource "aws_db_instance" {
    defaults = {
      arn     = "arn:aws:rds:ap-south-1:123456789012:db:parikshaa"
      address = "parikshaa.abcdefghij.ap-south-1.rds.amazonaws.com"
      master_user_secret = [{
        secret_arn    = "arn:aws:secretsmanager:ap-south-1:123456789012:secret:rds!db-AbCdEf"
        secret_status = "active"
        kms_key_id    = "arn:aws:kms:ap-south-1:123456789012:key/00000000-0000-0000-0000-000000000000"
      }]
    }
  }
}

mock_provider "aws" {
  alias = "backup"
  mock_resource "aws_kms_key" {
    defaults = { arn = "arn:aws:kms:ap-south-2:123456789012:key/00000000-0000-0000-0000-000000000000" }
  }
}

variables {
  domain                = "exam.example.in"
  alarm_email           = "ops@example.in"
  api_repository_url    = "123456789012.dkr.ecr.ap-south-1.amazonaws.com/parikshaa/api"
  runner_repository_url = "123456789012.dkr.ecr.ap-south-1.amazonaws.com/parikshaa/runner"
}

run "production_keeps_everything" {
  variables {
    environment         = "production"
    db_multi_az         = true
    db_backup_days      = 14
    db_backup_copy      = true
    deletion_protection = true
    nat_gateways        = 2
    api_min             = 2
  }

  assert {
    condition     = aws_db_instance.main.multi_az && aws_db_instance.main.deletion_protection
    error_message = "Production's database has a standby and refuses deletion."
  }
  assert {
    condition     = aws_db_instance.main.storage_encrypted && !aws_db_instance.main.publicly_accessible
    error_message = "The database is encrypted and never public."
  }
  assert {
    condition     = aws_db_instance.main.manage_master_user_password && aws_db_instance.main.username == "parikshaa_owner"
    error_message = "RDS keeps the owner's password; Terraform never sees it."
  }
  assert {
    condition     = aws_db_instance.main.backup_retention_period >= 14 && !aws_db_instance.main.skip_final_snapshot
    error_message = "Fourteen days of point-in-time recovery, and a final snapshot (docs/OPERATIONS.md)."
  }
  assert {
    condition     = one([for p in aws_db_parameter_group.main.parameter : p.value if p.name == "log_parameter_max_length"]) == "0"
    error_message = "The database's statement log never carries values (answers, emails, tokens)."
  }
  assert {
    condition     = alltrue([for g in aws_cloudwatch_log_group.db : g.retention_in_days == 30])
    error_message = "RDS's logs expire."
  }
  assert {
    condition     = length(aws_db_instance_automated_backups_replication.copy) == 1
    error_message = "The backups are copied to Hyderabad."
  }
  assert {
    condition     = one([for p in aws_db_parameter_group.main.parameter : p.value if p.name == "rds.force_ssl"]) == "1"
    error_message = "The database refuses connections without TLS."
  }
  assert {
    condition     = length(aws_nat_gateway.main) == 2 && [for r in aws_route_table.app[1].route : r.nat_gateway_id] == [aws_nat_gateway.main[1].id] && [for r in aws_route_table.app[0].route : r.nat_gateway_id] == [aws_nat_gateway.main[0].id]
    error_message = "Each zone leaves through its own NAT."
  }
  assert {
    condition     = length(aws_secretsmanager_secret_policy.app) == 1 && strcontains(aws_secretsmanager_secret_policy.app[0].policy, "secretsmanager:DeleteSecret")
    error_message = "Nobody can delete the secret holding the data key."
  }
  assert {
    condition     = aws_lb.site.enable_deletion_protection
    error_message = "The load balancer refuses deletion in production."
  }
}

run "staging_is_small_and_disposable" {
  variables {
    environment         = "staging"
    deletion_protection = false
  }

  assert {
    condition     = !aws_db_instance.main.multi_az && length(aws_db_instance_automated_backups_replication.copy) == 0
    error_message = "Staging has one database and no copy."
  }
  assert {
    condition     = length(aws_nat_gateway.main) == 1 && [for r in aws_route_table.app[1].route : r.nat_gateway_id] == [aws_nat_gateway.main[0].id]
    error_message = "One NAT, shared by both zones."
  }
  assert {
    condition     = length(aws_secretsmanager_secret_policy.app) == 0
    error_message = "Staging can be torn down."
  }
}

run "only_the_load_balancer_faces_the_internet" {
  variables {
    environment = "staging"
  }

  assert {
    condition     = toset([for rule in aws_vpc_security_group_ingress_rule.alb : rule.from_port]) == toset([80, 443])
    error_message = "The internet reaches ports 80 and 443 of the load balancer, nothing else."
  }
  assert {
    condition = alltrue([for rule in [
      aws_vpc_security_group_ingress_rule.api_from_alb,
      aws_vpc_security_group_ingress_rule.runner_lb_from_api,
      aws_vpc_security_group_ingress_rule.runner_from_lb,
      aws_vpc_security_group_ingress_rule.db_from_api,
    ] : rule.cidr_ipv4 == null && rule.referenced_security_group_id != null])
    error_message = "Every tier behind the load balancer takes connections from the tier in front of it only, never from an address range."
  }
  assert {
    condition     = aws_vpc_security_group_ingress_rule.db_from_api.referenced_security_group_id == aws_security_group.api.id
    error_message = "Only the API reaches the database; the runners cannot."
  }
  assert {
    condition     = aws_vpc_security_group_ingress_rule.runner_from_lb.referenced_security_group_id == aws_security_group.runner_lb.id && aws_vpc_security_group_ingress_rule.runner_lb_from_api.referenced_security_group_id == aws_security_group.api.id
    error_message = "Only the API reaches the runners, through their load balancer."
  }
  assert {
    condition     = length(aws_route_table.data.route) == 0
    error_message = "The database's subnets have no way out."
  }
  assert {
    condition     = aws_lb.runner.internal
    error_message = "The runners' load balancer is inside the VPC only."
  }
}

run "machines_are_locked_down" {
  variables {
    environment = "staging"
  }

  assert {
    condition     = alltrue([for t in aws_launch_template.role : t.metadata_options[0].http_tokens == "required" && t.metadata_options[0].http_put_response_hop_limit == 1])
    error_message = "IMDSv2 only, one hop: no container can reach the metadata service."
  }
  assert {
    condition     = alltrue([for t in aws_launch_template.role : t.block_device_mappings[0].ebs[0].encrypted == "true"])
    error_message = "Every machine's disk is encrypted."
  }
  assert {
    condition     = strcontains(local.cloud_config["runner"], "/usr/local/bin/parikshaa-start") && strcontains(file("${path.module}/host/parikshaa-start"), "iptables -I DOCKER-USER -i docker0 ! -o docker0 -m conntrack --ctstate NEW -j DROP")
    error_message = "A runner drops every connection its containers open."
  }
  assert {
    condition     = strcontains(file("${path.module}/host/parikshaa-start"), "--runtime runsc --read-only")
    error_message = "The runner runs under gVisor, read-only, as docker-compose.yml runs it."
  }
  assert {
    condition     = !strcontains(local.cloud_config["runner"], "parikshaa-migrate") && !strcontains(local.stack_env["runner"], "rds!db")
    error_message = "A runner machine has neither the migration command nor the database owner's secret."
  }
  assert {
    condition     = strcontains(local.stack_env["api"], "MASTER_SECRET_ARN=arn:aws:secretsmanager:ap-south-1:123456789012:secret:rds!db-AbCdEf")
    error_message = "An API machine knows where the owner's secret is, for migrations."
  }
  assert {
    condition     = length(regexall("(?m)^(PARIKSHAA_DATA_KEY|ATTEMPT_TOKEN_SECRET|ANTHROPIC_API_KEY|RUNNER_TOKEN)=", local.cloud_config["api"])) == 0
    error_message = "No secret is written into the launch template; machines read them from Secrets Manager."
  }
}

run "api_settings" {
  variables {
    environment = "staging"
    settings    = { SELF_SIGNUP = "on", PUBLIC_URL = "https://elsewhere.example" }
  }

  assert {
    condition     = local.api_settings["PUBLIC_URL"] == "https://exam.example.in" && local.api_settings["SELF_SIGNUP"] == "on"
    error_message = "The stack's own settings win over var.settings."
  }
  assert {
    condition     = local.api_settings["RUNNER_URL"] == "http://parikshaa-0123456789.ap-south-1.elb.amazonaws.com:4000" && local.api_settings["TRUST_PROXY"] == "true"
    error_message = "The API reaches the runners through their load balancer, and trusts the ALB's forwarded address."
  }
  assert {
    condition     = jsondecode(aws_iam_role_policy.role["api"].policy).Statement[0].Resource == "arn:aws:ecr:ap-south-1:123456789012:repository/parikshaa/api"
    error_message = "An API machine pulls the API image only."
  }
  assert {
    condition     = length([for s in jsondecode(aws_iam_role_policy.role["runner"].policy).Statement : s if s.Sid == "ReadImports"]) == 0
    error_message = "A runner machine cannot read imports."
  }
}

run "a_secret_in_settings_is_refused" {
  command = plan
  variables {
    environment = "staging"
    settings    = { PARIKSHAA_DATA_KEY = "oops" }
  }
  expect_failures = [var.settings]
}

run "environment_is_staging_or_production" {
  command = plan
  variables {
    environment = "prod"
  }
  expect_failures = [var.environment]
}

run "dns_records_list_everything_without_route53" {
  variables {
    environment = "staging"
  }


  assert {
    condition     = output.dns_records[0].name == "exam.example.in" && output.dns_records[0].value == "parikshaa-0123456789.ap-south-1.elb.amazonaws.com"
    error_message = "The site's record points at the load balancer."
  }
  assert {
    condition     = contains([for r in output.dns_records : r.name], "_abc.exam.example.in.") && contains([for r in output.dns_records : r.name], "_dmarc.exam.example.in")
    error_message = "The certificate's validation record and DMARC are listed."
  }
  assert {
    condition     = length(output.dns_records) == 6 && contains([for r in output.dns_records : "${r.name} ${r.value}"], "tok2._domainkey.exam.example.in tok2.dkim.amazonses.com")
    error_message = "The three DKIM keys are listed, pointing at SES."
  }
  assert {
    condition     = length(aws_route53_record.dkim) == 0 && length(aws_route53_record.site) == 0 && length(aws_route53_record.certificate) == 0
    error_message = "Without a Route 53 zone nothing is written to DNS; the output lists it."
  }
}

run "route53_gets_every_record" {
  variables {
    environment     = "staging"
    route53_zone_id = "Z0123456789ABCDEFGHIJ"
  }

  assert {
    condition     = length(aws_route53_record.site) == 1 && length(aws_route53_record.certificate) == 1 && length(aws_route53_record.dkim) == 3 && length(aws_route53_record.dmarc) == 1
    error_message = "With a Route 53 zone the site, the certificate, DKIM and DMARC records are all made."
  }
}
