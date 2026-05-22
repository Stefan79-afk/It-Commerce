package com.example.products_service.api;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ProductImageResponse(
    UUID id,
    String fileUrl,
    int displayOrder,
    OffsetDateTime uploadedAt
) {
}
