data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# --- Shared Task Execution Role (ECR pull + CloudWatch + Secrets Manager) ---

resource "aws_iam_role" "task_execution" {
  name               = "${var.project_name}-task-execution-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "secrets_read" {
  name = "${var.project_name}-secrets-read"
  role = aws_iam_role.task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = var.secret_arns
    }]
  })
}

# --- Products Task Role (S3 presigned URL generation) ---

resource "aws_iam_role" "products_task" {
  name               = "${var.project_name}-products-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

resource "aws_iam_role_policy" "products_s3" {
  name = "${var.project_name}-products-s3"
  role = aws_iam_role.products_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
      ]
      Resource = "${var.bucket_arn}/*"
    }]
  })
}
