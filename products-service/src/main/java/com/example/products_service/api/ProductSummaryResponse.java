package com.example.products_service.api;

import java.math.BigDecimal;
import java.util.UUID;

public record ProductSummaryResponse(
    UUID id,
    String name,
    String category,
    BigDecimal price,
    boolean isOfficial,
    String thumbnailUrl
) {
}
