variable "project_name" { type = string }

variable "jwt_private_key" {
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

variable "mongo_uri" {
  type      = string
  sensitive = true
}

variable "django_secret_key" {
  type      = string
  sensitive = true
}
