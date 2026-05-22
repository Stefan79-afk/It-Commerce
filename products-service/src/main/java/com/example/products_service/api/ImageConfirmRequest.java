package com.example.products_service.api;

import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ImageConfirmRequest(
    @NotNull UUID imageId,
    @NotBlank String fileUrl,
    Integer displayOrder
) {
}
