variable "project_name" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "rds_sg_id" { type = string }

variable "db_username" {
  type      = string
  sensitive = true
}

variable "users_db_password" {
  type      = string
  sensitive = true
}

variable "products_db_password" {
  type      = string
  sensitive = true
}

variable "db_instance_class" { type = string }
variable "postgres_version" { type = string }
