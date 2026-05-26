package com.example.products_service.errors;

import org.springframework.http.HttpStatusCode;

public class ApiException extends RuntimeException {

    private final HttpStatusCode status;

    public ApiException(HttpStatusCode status, String message) {
        super(message);
        this.status = status;
    }

    public ApiException(HttpStatusCode status, String message, Throwable cause) {
        super(message, cause);
        this.status = status;
    }

    public HttpStatusCode getStatus() {
        return this.status;
    }
}
