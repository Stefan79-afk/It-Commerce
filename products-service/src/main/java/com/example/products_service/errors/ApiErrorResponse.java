package com.example.products_service.errors;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

public record ApiErrorResponse(
    OffsetDateTime timestamp,
    int status,
    String error,
    String message,
    String path
) {

    public static ApiErrorResponse of(int status, String message, String path) {
        return new ApiErrorResponse(
            OffsetDateTime.now(ZoneOffset.UTC),
            status,
            ApiErrorCatalog.errorCodeFor(status),
            message,
            path
        );
    }
}
