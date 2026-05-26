package com.example.products_service.api;

import java.util.List;

public record PaginationResponse<T>(
    List<T> content,
    int page,
    int size,
    long totalElements,
    int totalPages
) {
}
