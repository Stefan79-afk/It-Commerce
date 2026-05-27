output "distribution_domain_name" {
  description = "The *.cloudfront.net domain assigned to this distribution (HTTPS)"
  value       = aws_cloudfront_distribution.main.domain_name
}
