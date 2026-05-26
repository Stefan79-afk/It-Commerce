variable "project_name" { type = string }
variable "aws_region" { type = string }
variable "aws_account_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "ecs_sg_id" { type = string }
variable "execution_role_arn" { type = string }
variable "products_task_role_arn" { type = string }
variable "ecr_repository_urls" { type = map(string) }
variable "nginx_target_group_arn" { type = string }

variable "secrets" {
  description = "Map of secret key → Secrets Manager ARN"
  type        = map(string)
}

variable "users_db_host" {
  description = "Hostname of the users RDS instance"
  type        = string
}

variable "products_db_host" {
  description = "Hostname of the products RDS instance"
  type        = string
}

variable "db_username" {
  description = "RDS master username (used by both services)"
  type        = string
}

variable "bucket_name" { type = string }
variable "alb_dns_name" { type = string }
variable "jwt_kid" { type = string }
variable "jwt_issuer" { type = string }
variable "jwt_audience" { type = string }

variable "users_cpu" { type = number }
variable "users_memory" { type = number }
variable "products_cpu" { type = number }
variable "products_memory" { type = number }
variable "orders_cpu" { type = number }
variable "orders_memory" { type = number }
variable "frontend_cpu" { type = number }
variable "frontend_memory" { type = number }
variable "nginx_cpu" { type = number }
variable "nginx_memory" { type = number }
