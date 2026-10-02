# Who may talk to whom. Only the load balancer faces the internet; each tier
# takes connections from the one in front of it and from nothing else.
#
#   internet :80,:443 → alb → :3000 api → :5432 db
#                              api → :4000 runner_lb → :4000 runner

resource "aws_security_group" "alb" {
  name        = "${local.prefix}-alb"
  description = "Parikshaa load balancer: HTTP and HTTPS from anywhere"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.prefix}-alb" }
}

resource "aws_security_group" "api" {
  name        = "${local.prefix}-api"
  description = "Parikshaa API machines: from the load balancer only"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.prefix}-api" }
}

resource "aws_security_group" "runner_lb" {
  name        = "${local.prefix}-runner-lb"
  description = "Parikshaa runner load balancer: from the API only"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.prefix}-runner-lb" }
}

resource "aws_security_group" "runner" {
  name        = "${local.prefix}-runner"
  description = "Parikshaa code runners: from their load balancer only"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.prefix}-runner" }
}

resource "aws_security_group" "db" {
  name        = "${local.prefix}-db"
  description = "Parikshaa Postgres: from the API only"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.prefix}-db" }
}

# --- In -----------------------------------------------------------------------

resource "aws_vpc_security_group_ingress_rule" "alb" {
  for_each          = { http = 80, https = 443 }
  security_group_id = aws_security_group.alb.id
  description       = each.key
  ip_protocol       = "tcp"
  from_port         = each.value
  to_port           = each.value
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "api_from_alb" {
  security_group_id            = aws_security_group.api.id
  description                  = "From the load balancer"
  ip_protocol                  = "tcp"
  from_port                    = 3000
  to_port                      = 3000
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_vpc_security_group_ingress_rule" "runner_lb_from_api" {
  security_group_id            = aws_security_group.runner_lb.id
  description                  = "From the API"
  ip_protocol                  = "tcp"
  from_port                    = 4000
  to_port                      = 4000
  referenced_security_group_id = aws_security_group.api.id
}

resource "aws_vpc_security_group_ingress_rule" "runner_from_lb" {
  security_group_id            = aws_security_group.runner.id
  description                  = "From the runner load balancer (runs and health checks)"
  ip_protocol                  = "tcp"
  from_port                    = 4000
  to_port                      = 4000
  referenced_security_group_id = aws_security_group.runner_lb.id
}

resource "aws_vpc_security_group_ingress_rule" "db_from_api" {
  security_group_id            = aws_security_group.db.id
  description                  = "From the API (and migrations, run on an API machine)"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.api.id
}

# --- Out ----------------------------------------------------------------------

resource "aws_vpc_security_group_egress_rule" "alb_to_api" {
  security_group_id            = aws_security_group.alb.id
  description                  = "To the API"
  ip_protocol                  = "tcp"
  from_port                    = 3000
  to_port                      = 3000
  referenced_security_group_id = aws_security_group.api.id
}

resource "aws_vpc_security_group_egress_rule" "runner_lb_to_runner" {
  security_group_id            = aws_security_group.runner_lb.id
  description                  = "To the runners"
  ip_protocol                  = "tcp"
  from_port                    = 4000
  to_port                      = 4000
  referenced_security_group_id = aws_security_group.runner.id
}

# The API reaches the model, SES, Razorpay, WhatsApp and AWS's own APIs.
resource "aws_vpc_security_group_egress_rule" "api" {
  security_group_id = aws_security_group.api.id
  description       = "The model, email, payments, AWS APIs, the database, the runners"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# The runner machine itself pulls its image and reads its token. Candidate
# code never gets this far: on the machine, iptables drops every connection a
# container opens (host/parikshaa-start).
resource "aws_vpc_security_group_egress_rule" "runner" {
  security_group_id = aws_security_group.runner.id
  description       = "The machine (image, token, logs); never its containers"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

# Ubuntu's packages (and gVisor's) at first boot are fetched over HTTP, signed.
resource "aws_vpc_security_group_egress_rule" "runner_packages" {
  security_group_id = aws_security_group.runner.id
  description       = "Signed Ubuntu packages at first boot"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = "0.0.0.0/0"
}
