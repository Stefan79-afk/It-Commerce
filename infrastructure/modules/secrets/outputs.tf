output "secret_arns" {
  description = "List of all secret ARNs (used by IAM policy)"
  value       = [for s in aws_secretsmanager_secret.app : s.arn]
}

output "secret_arns_map" {
  description = "Map of secret key → ARN (used by ECS task definitions)"
  value       = { for k, s in aws_secretsmanager_secret.app : k => s.arn }
}
