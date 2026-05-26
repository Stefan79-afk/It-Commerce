module "networking" {
  source = "./modules/networking"

  project_name         = var.project_name
  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  availability_zones   = var.availability_zones
}

module "ecr" {
  source = "./modules/ecr"

  project_name = var.project_name
}

module "secrets" {
  source = "./modules/secrets"

  project_name         = var.project_name
  jwt_private_key      = var.jwt_private_key
  users_db_password    = var.users_db_password
  products_db_password = var.products_db_password
  mongo_uri            = var.mongo_uri
  django_secret_key    = var.django_secret_key
}

module "s3" {
  source = "./modules/s3"

  project_name = var.project_name
}

module "iam" {
  source = "./modules/iam"

  project_name = var.project_name
  secret_arns  = module.secrets.secret_arns
  bucket_arn   = module.s3.bucket_arn
}

module "rds" {
  source = "./modules/rds"

  project_name         = var.project_name
  private_subnet_ids   = module.networking.private_subnet_ids
  rds_sg_id            = module.networking.rds_sg_id
  db_username          = var.db_username
  users_db_password    = var.users_db_password
  products_db_password = var.products_db_password
  db_instance_class    = var.db_instance_class
  postgres_version     = var.postgres_version
}

module "alb" {
  source = "./modules/alb"

  project_name      = var.project_name
  vpc_id            = module.networking.vpc_id
  public_subnet_ids = module.networking.public_subnet_ids
  alb_sg_id         = module.networking.alb_sg_id
}

module "ecs" {
  source = "./modules/ecs"

  project_name           = var.project_name
  aws_region             = var.aws_region
  private_subnet_ids     = module.networking.private_subnet_ids
  ecs_sg_id              = module.networking.ecs_sg_id
  execution_role_arn     = module.iam.execution_role_arn
  products_task_role_arn = module.iam.products_task_role_arn
  ecr_repository_urls    = module.ecr.repository_urls
  nginx_target_group_arn = module.alb.nginx_target_group_arn
  secrets                = module.secrets.secret_arns_map
  users_db_host          = module.rds.users_db_host
  products_db_host       = module.rds.products_db_host
  db_username            = var.db_username
  bucket_name            = module.s3.bucket_name
  aws_account_id         = data.aws_caller_identity.current.account_id

  # App config
  jwt_kid       = var.jwt_kid
  jwt_issuer    = var.jwt_issuer
  jwt_audience  = var.jwt_audience
  alb_dns_name  = module.alb.alb_dns_name

  # Task sizing
  users_cpu       = var.users_cpu
  users_memory    = var.users_memory
  products_cpu    = var.products_cpu
  products_memory = var.products_memory
  orders_cpu      = var.orders_cpu
  orders_memory   = var.orders_memory
  frontend_cpu    = var.frontend_cpu
  frontend_memory = var.frontend_memory
  nginx_cpu       = var.nginx_cpu
  nginx_memory    = var.nginx_memory
}

data "aws_caller_identity" "current" {}
