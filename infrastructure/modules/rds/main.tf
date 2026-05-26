resource "aws_db_subnet_group" "main" {
  name        = "${var.project_name}-db-subnet-group"
  subnet_ids  = var.private_subnet_ids
  description = "Private subnets for RDS instances"

  tags = { Name = "${var.project_name}-db-subnet-group" }
}

# Users service database (creates users_db automatically)
resource "aws_db_instance" "users" {
  identifier        = "${var.project_name}-users-postgres"
  engine            = "postgres"
  engine_version    = var.postgres_version
  instance_class    = var.db_instance_class
  allocated_storage = 20
  storage_type      = "gp2"

  db_name  = "users_db"
  username = var.db_username
  password = var.users_db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.rds_sg_id]

  multi_az            = false
  publicly_accessible = false
  storage_encrypted   = true

  backup_retention_period = 7
  skip_final_snapshot     = true

  tags = { Name = "${var.project_name}-users-postgres" }
}

# Products service database (creates products_db automatically)
resource "aws_db_instance" "products" {
  identifier        = "${var.project_name}-products-postgres"
  engine            = "postgres"
  engine_version    = var.postgres_version
  instance_class    = var.db_instance_class
  allocated_storage = 20
  storage_type      = "gp2"

  db_name  = "products_db"
  username = var.db_username
  password = var.products_db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.rds_sg_id]

  multi_az            = false
  publicly_accessible = false
  storage_encrypted   = true

  backup_retention_period = 7
  skip_final_snapshot     = true

  tags = { Name = "${var.project_name}-products-postgres" }
}
