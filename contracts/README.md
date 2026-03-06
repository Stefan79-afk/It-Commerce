# API Contracts

This directory contains the OpenAPI source of truth for It-Commerce APIs.

- `common.yaml`: shared `ErrorResponse`, `PaginationResponse`, and `BearerAuth` JWT security scheme.
- `users.openapi.yaml`: Users service contract.
- `products.openapi.yaml`: Products service contract.
- `orders.openapi.yaml`: Orders service contract.

## Update Rules

- Any endpoint, request field, response field, or auth behavior change must be updated here in the same change.
- Reuse `common.yaml` for standard error and pagination shapes to keep all services consistent.
- Keep all service paths under `/api/v1/...`.
- Mark protected endpoints with bearer auth security.
- Keep schemas minimal and accurate to implemented behavior.
