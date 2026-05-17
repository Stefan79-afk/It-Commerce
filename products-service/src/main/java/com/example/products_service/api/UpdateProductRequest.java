package com.example.products_service.api;

import java.math.BigDecimal;
import java.util.Map;

public record UpdateProductRequest(
    String name,
    String description,
    String category,
    BigDecimal price,
    Integer stockQuantity,
    Map<String, String> technicalSpecs
) {
}
