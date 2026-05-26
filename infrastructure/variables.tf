variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "eu-west-1"
}

variable "project_name" {
  description = "Short name used to prefix all resources"
  type        = string
  default     = "itcommerce"
}

variable "environment" {
  description = "Deployment environment label"
  type        = string
  default     = "prod"
}

# --- Networking ---

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.3.0/24", "10.0.4.0/24"]
}

variable "availability_zones" {
  type    = list(string)
  default = ["eu-west-1a", "eu-west-1b"]
}

# --- RDS ---

variable "db_username" {
  description = "Master username for RDS"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.micro"
}

variable "postgres_version" {
  type    = string
  default = "17"
}

# --- Secrets (initial values only; rotate manually after first apply) ---

variable "jwt_private_key" {
  description = "RS256 private key PEM for JWT signing"
  type        = string
  sensitive   = true
}

variable "users_db_password" {
  description = "Password for users PostgreSQL database"
  type        = string
  sensitive   = true
}

variable "products_db_password" {
  description = "Password for products PostgreSQL database"
  type        = string
  sensitive   = true
}

variable "mongo_uri" {
  description = "MongoDB Atlas connection string"
  type        = string
  sensitive   = true
}

variable "django_secret_key" {
  description = "Django SECRET_KEY for users-service"
  type        = string
  sensitive   = true
}

# --- ECS task sizing ---

variable "users_cpu" {
  type    = number
  default = 512
}
variable "users_memory" {
  type    = number
  default = 1024
}

variable "products_cpu" {
  type    = number
  default = 1024
}
variable "products_memory" {
  type    = number
  default = 2048
}

variable "orders_cpu" {
  type    = number
  default = 512
}
variable "orders_memory" {
  type    = number
  default = 1024
}

variable "frontend_cpu" {
  type    = number
  default = 256
}
variable "frontend_memory" {
  type    = number
  default = 512
}

variable "nginx_cpu" {
  type    = number
  default = 256
}
variable "nginx_memory" {
  type    = number
  default = 512
}

# --- JWT / App config ---

variable "github_repo" {
  description = "GitHub repository for CI/CD OIDC trust, in owner/repo format (e.g. acme/my-app)"
  type        = string
}

variable "jwt_kid" {
  type    = string
  default = "users-key-1"
}

variable "jwt_issuer" {
  type    = string
  default = "itcommerce-users"
}

variable "jwt_audience" {
  type    = string
  default = "itcommerce-api"
}
