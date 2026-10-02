# Postgres 16 that AWS keeps: encrypted with a key of our own, TLS required,
# point-in-time recovery, a standby in the second zone in production, and the
# backups copied to Hyderabad.
#
# The master user is parikshaa_owner, the schema's owner; its password is
# made and kept by RDS in Secrets Manager (never in Terraform's state), and
# only migrations use it. The API logs in as parikshaa_app, which row-level
# security binds and which can never rewrite the ledger.

resource "aws_kms_key" "data" {
  description             = "${local.prefix}: the database, its snapshots, and the secrets"
  enable_key_rotation     = true
  deletion_window_in_days = 30
}

resource "aws_kms_alias" "data" {
  name          = "alias/${local.prefix}-data"
  target_key_id = aws_kms_key.data.key_id
}

resource "aws_db_subnet_group" "main" {
  name       = local.prefix
  subnet_ids = aws_subnet.data[*].id
}

resource "aws_db_parameter_group" "main" {
  name        = "${local.prefix}-pg16"
  family      = "postgres${var.db_engine_version}"
  description = "Parikshaa: TLS only, slow statements logged"

  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }
  # A statement over a second is worth a look; none should take that long.
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }
  parameter {
    name  = "log_lock_waits"
    value = "1"
  }
  # A logged statement never carries its values: they are candidates'
  # answers, emails and tokens (docs/OPERATIONS.md, "Logs").
  parameter {
    name  = "log_parameter_max_length"
    value = "0"
  }
  parameter {
    name  = "log_parameter_max_length_on_error"
    value = "0"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# RDS makes these on its own with no expiry; made here first, they keep a month.
resource "aws_cloudwatch_log_group" "db" {
  for_each          = toset(["postgresql", "upgrade"])
  name              = "/aws/rds/instance/${local.prefix}/${each.key}"
  retention_in_days = 30
}

resource "aws_db_instance" "main" {
  identifier     = local.prefix
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  db_name                       = "parikshaa"
  username                      = "parikshaa_owner"
  manage_master_user_password   = true
  master_user_secret_kms_key_id = aws_kms_key.data.key_id

  allocated_storage     = var.db_storage_gb
  max_allocated_storage = var.db_max_storage_gb
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.data.arn

  multi_az               = var.db_multi_az
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  parameter_group_name   = aws_db_parameter_group.main.name
  ca_cert_identifier     = "rds-ca-rsa2048-g1"

  # 01:30 IST backups, Monday 02:30 IST maintenance: no exam runs then.
  backup_retention_period  = var.db_backup_days
  backup_window            = "20:00-20:30"
  maintenance_window       = "sun:21:00-sun:22:00"
  copy_tags_to_snapshot    = true
  delete_automated_backups = false

  auto_minor_version_upgrade  = true
  allow_major_version_upgrade = false
  apply_immediately           = false

  performance_insights_enabled          = true
  performance_insights_kms_key_id       = aws_kms_key.data.arn
  performance_insights_retention_period = 7
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]

  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.prefix}-final"

  depends_on = [aws_cloudwatch_log_group.db]
}

# A whole region failing: the backups, and so point-in-time recovery, in
# Hyderabad too, under a key of their own there.
resource "aws_kms_key" "backup_copy" {
  count                   = var.db_backup_copy ? 1 : 0
  provider                = aws.backup
  description             = "${local.prefix}: copies of the database's backups"
  enable_key_rotation     = true
  deletion_window_in_days = 30
}

resource "aws_db_instance_automated_backups_replication" "copy" {
  count                  = var.db_backup_copy ? 1 : 0
  provider               = aws.backup
  source_db_instance_arn = aws_db_instance.main.arn
  kms_key_id             = aws_kms_key.backup_copy[0].arn
  retention_period       = var.db_backup_days
}
