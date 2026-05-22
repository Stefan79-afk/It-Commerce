package com.example.products_service.api;

import java.time.OffsetDateTime;
import java.util.UUID;

public record WishlistItemResponse(
    UUID userId,
    UUID productId,
    OffsetDateTime addedAt
) {
}
