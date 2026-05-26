locals {
  secrets = {
    "jwt-private-key"      = var.jwt_private_key
    "users-db-password"    = var.users_db_password
    "products-db-password" = var.products_db_password
    "mongo-uri"            = var.mongo_uri
    "django-secret-key"    = var.django_secret_key
  }
}

resource "aws_secretsmanager_secret" "app" {
  for_each                = local.secrets
  name                    = "${var.project_name}/prod/${each.key}"
  recovery_window_in_days = 0

  tags = { Name = "${var.project_name}-${each.key}" }
}

resource "aws_secretsmanager_secret_version" "app" {
  for_each      = local.secrets
  secret_id     = aws_secretsmanager_secret.app[each.key].id
  secret_string = each.value
}
