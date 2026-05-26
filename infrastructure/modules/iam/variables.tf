variable "project_name" { type = string }
variable "secret_arns" { type = list(string) }
variable "bucket_arn" { type = string }
variable "github_repo" {
  description = "GitHub repository allowed to assume the CI role, in owner/repo format (e.g. acme/my-app)"
  type        = string
}
