package com.example.products_service.api;

import jakarta.validation.constraints.NotBlank;

public record ImagePresignRequest(
    @NotBlank String fileName,
    String contentType
) {
}
