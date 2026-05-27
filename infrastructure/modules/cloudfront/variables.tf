variable "project_name" { type = string }

variable "alb_dns_name" {
  description = "DNS name of the ALB used as the CloudFront origin"
  type        = string
}
