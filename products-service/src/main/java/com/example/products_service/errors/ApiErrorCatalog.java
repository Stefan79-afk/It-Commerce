package com.example.products_service.errors;

import java.util.Map;

public final class ApiErrorCatalog {

    private static final Map<Integer, String> ERROR_CODE_BY_STATUS = Map.of(
        400, "VALIDATION_ERROR",
        401, "UNAUTHORIZED",
        403, "FORBIDDEN",
        404, "RESOURCE_NOT_FOUND",
        405, "VALIDATION_ERROR",
        409, "CONFLICT",
        500, "INTERNAL_ERROR"
    );

    private static final Map<Integer, String> DEFAULT_MESSAGE_BY_STATUS = Map.of(
        400, "Request validation failed.",
        401, "Authentication credentials were not provided or are invalid.",
        403, "You do not have permission to perform this action.",
        404, "Resource not found.",
        405, "Method not allowed.",
        409, "Resource conflict.",
        500, "Internal server error."
    );

    private ApiErrorCatalog() {
    }

    public static String errorCodeFor(int status) {
        return ERROR_CODE_BY_STATUS.getOrDefault(status, "INTERNAL_ERROR");
    }

    public static String defaultMessageFor(int status) {
        return DEFAULT_MESSAGE_BY_STATUS.getOrDefault(status, DEFAULT_MESSAGE_BY_STATUS.get(500));
    }
}
