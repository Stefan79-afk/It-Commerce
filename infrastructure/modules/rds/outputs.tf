output "users_db_host" {
  description = "Hostname of the users RDS instance"
  value       = aws_db_instance.users.address
}

output "products_db_host" {
  description = "Hostname of the products RDS instance"
  value       = aws_db_instance.products.address
}
