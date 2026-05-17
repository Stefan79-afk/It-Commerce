package com.example.products_service.api;

import java.math.BigDecimal;
import java.util.Map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateProductRequest(
    @NotBlank String name,
    String description,
    @NotBlank String category,
    @NotNull BigDecimal price,
    @NotNull Integer stockQuantity,
    Map<String, String> technicalSpecs
) {
}
