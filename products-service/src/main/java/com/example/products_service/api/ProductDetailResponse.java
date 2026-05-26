package com.example.products_service.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record ProductDetailResponse(
    UUID id,
    String name,
    String description,
    String category,
    BigDecimal price,
    int stockQuantity,
    boolean isOfficial,
    UUID createdByUserId,
    Map<String, String> technicalSpecs,
    List<ProductImageResponse> images,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
}
