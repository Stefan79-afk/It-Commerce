package com.example.products_service.api;

import java.util.UUID;

public record ImagePresignResponse(
    UUID imageId,
    String uploadUrl,
    Integer expiresIn
) {
}
