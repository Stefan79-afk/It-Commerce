output "alb_dns_name" {
  description = "Public ALB DNS name — set USERS_ALLOWED_HOSTS to this value"
  value       = module.alb.alb_dns_name
}

output "cloudfront_url" {
  description = "HTTPS URL of the CloudFront distribution — use this to access the app"
  value       = "https://${module.cloudfront.distribution_domain_name}"
}

output "ecr_repository_urls" {
  description = "Map of service name → ECR image URL"
  value       = module.ecr.repository_urls
}

output "users_db_host" {
  description = "Users RDS instance hostname"
  value       = module.rds.users_db_host
}

output "products_db_host" {
  description = "Products RDS instance hostname"
  value       = module.rds.products_db_host
}

output "s3_bucket_name" {
  description = "S3 bucket name for product images"
  value       = module.s3.bucket_name
}
