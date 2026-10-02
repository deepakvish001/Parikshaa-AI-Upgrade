# The API machines and the runner machines: Ubuntu 24.04 in Auto Scaling
# groups across both zones, each running one container of the released image.
# A machine that stops answering its load balancer is replaced; a release
# replaces them all, one at a time, new before old (release.sh).

locals {
  roles = {
    api = {
      instance_type = var.api_instance_type
      min           = var.api_min
      max           = var.api_max
      cpu_target    = 50
      port          = 3000
      health        = "/api/health"
      repository    = var.api_repository_url
      secret        = aws_secretsmanager_secret.app
      security      = aws_security_group.api.id
      target_group  = aws_lb_target_group.api.arn
    }
    runner = {
      instance_type = var.runner_instance_type
      min           = var.runner_min
      max           = var.runner_max
      cpu_target    = 60
      port          = 4000
      health        = "/health"
      repository    = var.runner_repository_url
      secret        = aws_secretsmanager_secret.runner
      security      = aws_security_group.runner.id
      target_group  = aws_lb_target_group.runner.arn
    }
  }

  # Not secret: where things are. The secrets are read from Secrets Manager
  # as the container starts and never written into the launch template.
  stack_env = {
    for role, r in local.roles : role => join("\n", [
      "ROLE=${role}",
      "REGION=${local.region}",
      "REPOSITORY=${r.repository}",
      "IMAGE_TAG_PARAMETER=${aws_ssm_parameter.image_tag.name}",
      "SECRET_ID=${r.secret.arn}",
      "LOG_GROUP=${aws_cloudwatch_log_group.role[role].name}",
      "DB_HOST=${aws_db_instance.main.address}",
      "MASTER_SECRET_ARN=${role == "api" ? aws_db_instance.main.master_user_secret[0].secret_arn : ""}",
      "",
    ])
  }

  # The API's settings that are not secret. They come after the secrets in
  # the container's environment, so these win.
  api_settings = merge(var.settings, {
    PUBLIC_URL        = "https://${var.domain}"
    RUNNER_URL        = "http://${aws_lb.runner.dns_name}:4000"
    TRUST_PROXY       = "true"
    PORT              = "3000"
    DATABASE_POOL_MAX = tostring(var.database_pool_max)
  })

  placeholder = <<-EOT
    <!doctype html><meta charset="utf-8"><title>Parikshaa</title>
    <p>Parikshaa is being set up here. Nothing has been released yet.</p>
  EOT

  cloud_config = {
    for role, r in local.roles : role => "#cloud-config\n${yamlencode({
      write_files = concat([
        { path = "/etc/parikshaa/stack.env", permissions = "0644", content = local.stack_env[role] },
        { path = "/usr/local/lib/parikshaa/common.sh", permissions = "0644", content = file("${path.module}/host/common.sh") },
        { path = "/usr/local/bin/parikshaa-start", permissions = "0755", content = file("${path.module}/host/parikshaa-start") },
        { path = "/usr/local/sbin/parikshaa-bootstrap", permissions = "0755", content = file("${path.module}/host/bootstrap.sh") },
        { path = "/var/lib/parikshaa/placeholder/index.html", permissions = "0644", content = local.placeholder },
        { path = "/var/lib/parikshaa/placeholder${r.health}", permissions = "0644", content = "{\"ok\":true,\"released\":false}\n" },
        {
          path        = "/etc/systemd/system/parikshaa.service"
          permissions = "0644"
          content     = <<-EOT
            [Unit]
            Description=Parikshaa ${role}, at the released image tag
            Requires=docker.service
            After=docker.service network-online.target snapd.seeded.service
            Wants=network-online.target snapd.seeded.service

            [Service]
            Type=oneshot
            RemainAfterExit=yes
            ExecStart=/usr/local/bin/parikshaa-start
            TimeoutStartSec=600

            [Install]
            WantedBy=multi-user.target
          EOT
        },
        {
          path        = "/etc/systemd/system/parikshaa-placeholder.service"
          permissions = "0644"
          content     = <<-EOT
            [Unit]
            Description=Parikshaa ${role} placeholder, until the first release

            [Service]
            ExecStart=/usr/bin/python3 -m http.server ${r.port} --bind 0.0.0.0 --directory /var/lib/parikshaa/placeholder
            DynamicUser=yes
          EOT
        },
        ], role == "api" ? [
        { path = "/etc/parikshaa/settings.env", permissions = "0644", content = join("", [for key, value in local.api_settings : "${key}=${value}\n"]) },
        { path = "/usr/local/bin/parikshaa-migrate", permissions = "0755", content = file("${path.module}/host/parikshaa-migrate") },
        { path = "/usr/local/bin/parikshaa-import", permissions = "0755", content = file("${path.module}/host/parikshaa-import") },
        { path = "/usr/local/lib/parikshaa/import-dump.sh", permissions = "0644", content = file("${path.module}/../../scripts/import-dump.sh") },
      ] : [])
      runcmd = [["/usr/local/sbin/parikshaa-bootstrap"]]
    })}"
  }
}

resource "aws_cloudwatch_log_group" "role" {
  for_each          = local.roles
  name              = "/${var.name}/${var.environment}/${each.key}"
  retention_in_days = var.log_retention_days
}

# --- Permissions --------------------------------------------------------------

resource "aws_iam_role" "role" {
  for_each = local.roles
  name     = "${local.prefix}-${each.key}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# A shell through Session Manager (no SSH anywhere), and release.sh's commands.
resource "aws_iam_role_policy_attachment" "ssm" {
  for_each   = local.roles
  role       = aws_iam_role.role[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "role" {
  for_each = local.roles
  name     = "parikshaa-${each.key}"
  role     = aws_iam_role.role[each.key].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Sid      = "PullImages"
          Effect   = "Allow"
          Action   = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"]
          Resource = "arn:aws:ecr:${local.region}:${local.account}:repository/${regex("^[^/]+/(.+)$", each.value.repository)[0]}"
        },
        {
          Sid      = "LogInToEcr"
          Effect   = "Allow"
          Action   = "ecr:GetAuthorizationToken"
          Resource = "*"
        },
        {
          Sid      = "ReleasedTag"
          Effect   = "Allow"
          Action   = "ssm:GetParameter"
          Resource = aws_ssm_parameter.image_tag.arn
        },
        {
          Sid    = "OwnSecrets"
          Effect = "Allow"
          Action = "secretsmanager:GetSecretValue"
          Resource = compact([
            each.value.secret.arn,
            each.key == "api" ? aws_db_instance.main.master_user_secret[0].secret_arn : "",
          ])
        },
        {
          Sid       = "DecryptSecrets"
          Effect    = "Allow"
          Action    = "kms:Decrypt"
          Resource  = aws_kms_key.data.arn
          Condition = { StringEquals = { "kms:ViaService" = "secretsmanager.${local.region}.amazonaws.com" } }
        },
        {
          Sid      = "Logs"
          Effect   = "Allow"
          Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
          Resource = "${aws_cloudwatch_log_group.role[each.key].arn}:*"
        },
      ],
      each.key == "api" ? [{
        Sid      = "ReadImports"
        Effect   = "Allow"
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.ops.arn}/import/*"
      }] : [],
    )
  })
}

resource "aws_iam_instance_profile" "role" {
  for_each = local.roles
  name     = "${local.prefix}-${each.key}"
  role     = aws_iam_role.role[each.key].name
}

# --- Machines -----------------------------------------------------------------

resource "aws_launch_template" "role" {
  for_each               = local.roles
  name                   = "${local.prefix}-${each.key}"
  image_id               = local.ami
  instance_type          = each.value.instance_type
  vpc_security_group_ids = [each.value.security]
  user_data              = base64gzip(local.cloud_config[each.key])
  update_default_version = true

  iam_instance_profile {
    arn = aws_iam_instance_profile.role[each.key].arn
  }

  # IMDSv2 only, one hop: a container cannot reach the metadata service, so
  # neither the API's dependencies nor candidate code can borrow the role.
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  block_device_mappings {
    device_name = "/dev/sda1"
    ebs {
      volume_type           = "gp3"
      volume_size           = 30
      encrypted             = true
      delete_on_termination = true
    }
  }

  tag_specifications {
    resource_type = "instance"
    tags          = { Name = "${local.prefix}-${each.key}", Role = each.key }
  }
  tag_specifications {
    resource_type = "volume"
    tags          = { Name = "${local.prefix}-${each.key}" }
  }
}

resource "aws_autoscaling_group" "role" {
  for_each                  = local.roles
  name                      = "${local.prefix}-${each.key}"
  vpc_zone_identifier       = aws_subnet.app[*].id
  min_size                  = each.value.min
  max_size                  = each.value.max
  target_group_arns         = [each.value.target_group]
  health_check_type         = "ELB"
  health_check_grace_period = 600
  default_instance_warmup   = 180
  wait_for_capacity_timeout = "20m"

  launch_template {
    id      = aws_launch_template.role[each.key].id
    version = aws_launch_template.role[each.key].latest_version
  }

  # A new launch template (a newer Ubuntu, a changed setting) rolls the
  # machines the same way a release does: one new machine up before an old
  # one goes.
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 100
      max_healthy_percentage = 200
      instance_warmup        = 180
    }
  }

  tag {
    key                 = "Name"
    value               = "${local.prefix}-${each.key}"
    propagate_at_launch = true
  }

  lifecycle {
    # Scaling moves the desired count; Terraform should not move it back.
    ignore_changes = [desired_capacity]
  }

  # A first boot installs packages and pulls images: the way out must exist.
  depends_on = [aws_route_table_association.app, aws_nat_gateway.main, aws_vpc_endpoint.s3]
}

resource "aws_autoscaling_policy" "cpu" {
  for_each               = local.roles
  name                   = "${local.prefix}-${each.key}-cpu"
  autoscaling_group_name = aws_autoscaling_group.role[each.key].name
  policy_type            = "TargetTrackingScaling"
  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = each.value.cpu_target
  }
}

# --- The runners' load balancer, inside the VPC only --------------------------

resource "aws_lb" "runner" {
  name               = "${local.prefix}-runner"
  internal           = true
  load_balancer_type = "network"
  subnets            = aws_subnet.app[*].id
  security_groups    = [aws_security_group.runner_lb.id]
}

resource "aws_lb_target_group" "runner" {
  name     = "${local.prefix}-runner"
  port     = 4000
  protocol = "TCP"
  vpc_id   = aws_vpc.main.id
  # The runners see the load balancer's address, so their security group can
  # name the load balancer's.
  preserve_client_ip   = "false"
  deregistration_delay = "60"
  health_check {
    protocol            = "HTTP"
    path                = "/health"
    port                = "4000"
    interval            = 10
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "runner" {
  load_balancer_arn = aws_lb.runner.arn
  port              = 4000
  protocol          = "TCP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.runner.arn
  }
}
