package com.example.products_service.errors;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;

import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiErrorResponse> handleApiException(ApiException ex, HttpServletRequest request) {
        int status = ex.getStatus().value();
        String message = ex.getMessage() == null
            ? ApiErrorCatalog.defaultMessageFor(status)
            : ex.getMessage();
        return ResponseEntity.status(status).body(ApiErrorResponse.of(status, message, request.getRequestURI()));
    }

    @ExceptionHandler({
        MethodArgumentNotValidException.class,
        BindException.class,
        ConstraintViolationException.class,
        HttpMessageNotReadableException.class,
        MissingServletRequestParameterException.class,
        MethodArgumentTypeMismatchException.class
    })
    public ResponseEntity<ApiErrorResponse> handleValidationErrors(Exception ex, HttpServletRequest request) {
        int status = 400;
        return ResponseEntity
            .status(status)
            .body(ApiErrorResponse.of(status, ApiErrorCatalog.defaultMessageFor(status), request.getRequestURI()));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiErrorResponse> handleResponseStatusException(
        ResponseStatusException ex,
        HttpServletRequest request
    ) {
        int status = ex.getStatusCode().value();
        String message = ex.getReason() == null
            ? ApiErrorCatalog.defaultMessageFor(status)
            : ex.getReason();
        return ResponseEntity.status(status).body(ApiErrorResponse.of(status, message, request.getRequestURI()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpectedException(Exception ex, HttpServletRequest request) {
        int status = 500;
        String message = ApiErrorCatalog.defaultMessageFor(status);

        if (ex instanceof ErrorResponse errorResponse) {
            status = errorResponse.getStatusCode().value();
            if (errorResponse.getBody() != null && errorResponse.getBody().getDetail() != null) {
                message = errorResponse.getBody().getDetail();
            } else {
                message = ApiErrorCatalog.defaultMessageFor(status);
            }
        }

        return ResponseEntity
            .status(status)
            .body(ApiErrorResponse.of(status, message, request.getRequestURI()));
    }
}
