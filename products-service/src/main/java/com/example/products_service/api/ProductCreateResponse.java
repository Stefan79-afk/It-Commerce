package com.example.products_service.api;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ProductCreateResponse(
    UUID id,
    OffsetDateTime createdAt
) {
}
