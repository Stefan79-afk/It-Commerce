package com.example.products_service.api;

import jakarta.validation.constraints.Min;

public record ReduceStockRequest(@Min(1) int quantity) {}
