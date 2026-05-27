locals {
  db_port = "5432"

  # Products and orders services call the users-service JWKS endpoint directly via Service Connect DNS
  jwks_url = "http://users-service:8000/.well-known/jwks.json"
}

# --- Service Connect namespace ---

resource "aws_service_discovery_http_namespace" "main" {
  name        = "${var.project_name}.local"
  description = "ECS Service Connect namespace for inter-service DNS"
}

# --- ECS Cluster ---

resource "aws_ecs_cluster" "main" {
  name = var.project_name

  service_connect_defaults {
    namespace = aws_service_discovery_http_namespace.main.arn
  }

  tags = { Name = var.project_name }
}

# --- CloudWatch Log Groups ---

resource "aws_cloudwatch_log_group" "services" {
  for_each          = toset(["users-service", "products-service", "orders-service", "frontend", "nginx"])
  name              = "/ecs/${var.project_name}/${each.key}"
  retention_in_days = 7

  tags = { Name = "${var.project_name}-${each.key}-logs" }
}

# --- Users Service ---

resource "aws_ecs_task_definition" "users" {
  family                   = "${var.project_name}-users"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.users_cpu
  memory                   = var.users_memory
  execution_role_arn       = var.execution_role_arn

  container_definitions = jsonencode([{
    name      = "users-service"
    image     = "${var.ecr_repository_urls["users-service"]}:latest"
    essential = true

    portMappings = [{
      name          = "users-service-port"
      containerPort = 8000
      protocol      = "tcp"
    }]

    environment = [
      { name = "USERS_DEBUG",                value = "0" },
      { name = "USERS_ALLOWED_HOSTS",        value = "${var.alb_dns_name},${var.cloudfront_domain},localhost,users-service" },
      { name = "USERS_POSTGRES_DB",          value = "users_db" },
      { name = "USERS_POSTGRES_USER",        value = var.db_username },
      { name = "USERS_POSTGRES_HOST",        value = var.users_db_host },
      { name = "USERS_POSTGRES_PORT",        value = local.db_port },
      { name = "USERS_JWT_KID",              value = var.jwt_kid },
      { name = "USERS_JWT_ISSUER",           value = var.jwt_issuer },
      { name = "USERS_JWT_AUDIENCE",         value = var.jwt_audience },
      { name = "USERS_JWT_ACCESS_TTL_SECONDS",  value = "900" },
      { name = "USERS_JWT_REFRESH_TTL_SECONDS", value = "604800" },
      { name = "USERS_ROTATE_REFRESH_TOKENS",   value = "1" },
    ]

    secrets = [
      { name = "USERS_SECRET_KEY",          valueFrom = var.secrets["django-secret-key"] },
      { name = "USERS_POSTGRES_PASSWORD",   valueFrom = var.secrets["users-db-password"] },
      { name = "USERS_JWT_PRIVATE_KEY",     valueFrom = var.secrets["jwt-private-key"] },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.services["users-service"].name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

resource "aws_ecs_service" "users" {
  name            = "users-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.users.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_sg_id]
    assign_public_ip = false
  }

  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn

    service {
      port_name      = "users-service-port"
      discovery_name = "users-service"
      client_alias {
        dns_name = "users-service"
        port     = 8000
      }
    }
  }

  depends_on = [aws_ecs_cluster.main]
}

# --- Products Service ---

resource "aws_ecs_task_definition" "products" {
  family                   = "${var.project_name}-products"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.products_cpu
  memory                   = var.products_memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.products_task_role_arn

  container_definitions = jsonencode([{
    name      = "products-service"
    image     = "${var.ecr_repository_urls["products-service"]}:latest"
    essential = true

    portMappings = [{
      name          = "products-service-port"
      containerPort = 8080
      protocol      = "tcp"
    }]

    environment = [
      { name = "PRODUCTS_DB_URL",          value = "jdbc:postgresql://${var.products_db_host}:${local.db_port}/products_db" },
      { name = "PRODUCTS_DB_USER",         value = var.db_username },
      { name = "PRODUCTS_JWKS_URL",        value = local.jwks_url },
      { name = "PRODUCTS_JWKS_CACHE_TTL",  value = "5m" },
      { name = "PRODUCTS_JWT_ISSUER",      value = var.jwt_issuer },
      { name = "PRODUCTS_JWT_AUDIENCE",    value = var.jwt_audience },
      { name = "PRODUCTS_S3_BUCKET",       value = var.bucket_name },
      { name = "PRODUCTS_S3_REGION",       value = var.aws_region },
      { name = "PRODUCTS_S3_PRESIGN_TTL",  value = "15m" },
    ]

    secrets = [
      { name = "PRODUCTS_DB_PASSWORD", valueFrom = var.secrets["products-db-password"] },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.services["products-service"].name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

resource "aws_ecs_service" "products" {
  name            = "products-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.products.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_sg_id]
    assign_public_ip = false
  }

  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn

    service {
      port_name      = "products-service-port"
      discovery_name = "products-service"
      client_alias {
        dns_name = "products-service"
        port     = 8080
      }
    }
  }

  depends_on = [aws_ecs_cluster.main]
}

# --- Orders Service ---

resource "aws_ecs_task_definition" "orders" {
  family                   = "${var.project_name}-orders"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.orders_cpu
  memory                   = var.orders_memory
  execution_role_arn       = var.execution_role_arn

  container_definitions = jsonencode([{
    name      = "orders-service"
    image     = "${var.ecr_repository_urls["orders-service"]}:latest"
    essential = true

    portMappings = [{
      name          = "orders-service-port"
      containerPort = 3000
      protocol      = "tcp"
    }]

    environment = [
      { name = "PORT",             value = "3000" },
      { name = "ORDERS_JWKS_URL", value = local.jwks_url },
    ]

    secrets = [
      { name = "ORDERS_MONGO_URI", valueFrom = var.secrets["mongo-uri"] },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.services["orders-service"].name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

resource "aws_ecs_service" "orders" {
  name            = "orders-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.orders.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_sg_id]
    assign_public_ip = false
  }

  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn

    service {
      port_name      = "orders-service-port"
      discovery_name = "orders-service"
      client_alias {
        dns_name = "orders-service"
        port     = 3000
      }
    }
  }

  depends_on = [aws_ecs_cluster.main]
}

# --- Frontend ---

resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.project_name}-frontend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.frontend_cpu
  memory                   = var.frontend_memory
  execution_role_arn       = var.execution_role_arn

  container_definitions = jsonencode([{
    name      = "frontend"
    image     = "${var.ecr_repository_urls["frontend"]}:latest"
    essential = true

    portMappings = [{
      name          = "frontend-port"
      containerPort = 80
      protocol      = "tcp"
    }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.services["frontend"].name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

resource "aws_ecs_service" "frontend" {
  name            = "frontend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_sg_id]
    assign_public_ip = false
  }

  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn

    service {
      port_name      = "frontend-port"
      discovery_name = "frontend"
      client_alias {
        dns_name = "frontend"
        port     = 80
      }
    }
  }

  depends_on = [aws_ecs_cluster.main]
}

# --- Nginx (routing gateway) — registered in ALB ---

resource "aws_ecs_task_definition" "nginx" {
  family                   = "${var.project_name}-nginx"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.nginx_cpu
  memory                   = var.nginx_memory
  execution_role_arn       = var.execution_role_arn

  container_definitions = jsonencode([{
    name      = "nginx"
    image     = "${var.ecr_repository_urls["nginx"]}:latest"
    essential = true

    portMappings = [{
      name          = "nginx-port"
      containerPort = 80
      protocol      = "tcp"
    }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.services["nginx"].name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

resource "aws_ecs_service" "nginx" {
  name            = "nginx"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.nginx.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_sg_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.nginx_target_group_arn
    container_name   = "nginx"
    container_port   = 80
  }

  # nginx is a client; it resolves other services via Service Connect
  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn
  }

  depends_on = [
    aws_ecs_cluster.main,
    aws_ecs_service.users,
    aws_ecs_service.products,
    aws_ecs_service.orders,
    aws_ecs_service.frontend,
  ]
}
