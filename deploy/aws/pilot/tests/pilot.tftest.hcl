# The pilot machine's promises, checked without an AWS account:
#   terraform init -backend=false && terraform test
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
  # Real ARNs where the provider checks the shape of one.
  mock_resource "aws_sns_topic" {
    defaults = { arn = "arn:aws:sns:ap-south-1:123456789012:parikshaa-pilot-alarms" }
  }
  mock_resource "aws_iam_role" {
    defaults = { arn = "arn:aws:iam::123456789012:role/parikshaa-pilot" }
  }
  mock_resource "aws_s3_bucket" {
    defaults = { arn = "arn:aws:s3:::parikshaa-pilot-backups-123456789012" }
  }
  mock_resource "aws_secretsmanager_secret" {
    defaults = { arn = "arn:aws:secretsmanager:ap-south-1:123456789012:secret:parikshaa/pilot/settings-AbCdEf" }
  }
}

variables {
  domain      = "exam.example.in"
  alarm_email = "ops@example.in"
}

run "only_web_traffic_comes_in" {
  assert {
    condition     = toset([for rule in aws_vpc_security_group_ingress_rule.web : rule.from_port]) == toset([80, 443])
    error_message = "The pilot takes HTTP and HTTPS and nothing else in: no SSH, no database port."
  }
  assert {
    condition     = alltrue([for rule in aws_vpc_security_group_ingress_rule.web : rule.to_port == rule.from_port])
    error_message = "Each rule opens exactly one port."
  }
}

run "the_machine_is_locked_down" {
  assert {
    condition     = aws_instance.pilot.metadata_options[0].http_tokens == "required"
    error_message = "IMDSv2 only."
  }
  assert {
    condition     = aws_instance.pilot.metadata_options[0].http_put_response_hop_limit == 1
    error_message = "One hop: containers on the machine cannot reach the metadata service."
  }
  assert {
    condition     = aws_instance.pilot.root_block_device[0].encrypted
    error_message = "The disk holding Postgres is encrypted."
  }
  assert {
    condition     = aws_instance.pilot.associate_public_ip_address
    error_message = "The first boot can reach the internet before the Elastic IP is attached."
  }
  assert {
    condition     = aws_instance.pilot.disable_api_termination
    error_message = "Terminating the machine needs termination_protection turned off first."
  }
}

run "the_machine_may_only_add_backups" {
  assert {
    condition     = jsondecode(aws_iam_role_policy.pilot.policy).Statement[0].Action == "s3:PutObject"
    error_message = "The machine may add a backup, and cannot read or delete one."
  }
  assert {
    condition     = endswith(jsondecode(aws_iam_role_policy.pilot.policy).Statement[0].Resource, "/pilot/*")
    error_message = "Only under pilot/."
  }
  assert {
    condition     = strcontains(local.user_data, "BACKUP_UPLOAD='/snap/bin/aws s3 cp") && strcontains(local.user_data, "s3://parikshaa-pilot-backups-123456789012/pilot/")
    error_message = "Every nightly dump is copied to the backups bucket, with the AWS CLI named in full for cron."
  }
}

run "backups_are_private_and_expire" {
  assert {
    condition     = aws_s3_bucket_public_access_block.backups.block_public_acls && aws_s3_bucket_public_access_block.backups.restrict_public_buckets
    error_message = "The backups bucket is never public."
  }
  assert {
    condition     = aws_s3_bucket_lifecycle_configuration.backups.rule[0].expiration[0].days == 35
    error_message = "Dumps are kept 35 days by default."
  }
}
