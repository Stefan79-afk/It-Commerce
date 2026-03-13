package com.example.products_service.errors;

import java.util.Map;
import java.util.Objects;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;

import org.springframework.boot.web.error.ErrorAttributeOptions;
import org.springframework.boot.webmvc.error.ErrorAttributes;
import org.springframework.boot.webmvc.error.ErrorController;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;

@RestController
@RequestMapping("${server.error.path:${error.path:/error}}")
public class StandardErrorController implements ErrorController {

    private final ErrorAttributes errorAttributes;

    public StandardErrorController(ErrorAttributes errorAttributes) {
        this.errorAttributes = errorAttributes;
    }

    @RequestMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiErrorResponse> error(HttpServletRequest request) {
        WebRequest webRequest = new ServletWebRequest(request);
        Map<String, Object> attributes = this.errorAttributes.getErrorAttributes(
            webRequest,
            ErrorAttributeOptions.of(ErrorAttributeOptions.Include.MESSAGE)
        );

        int status = resolveStatus(attributes, request);
        String path = Objects.toString(attributes.getOrDefault("path", request.getRequestURI()), request.getRequestURI());
        String message = resolveMessage(attributes, status);

        return ResponseEntity.status(status).body(ApiErrorResponse.of(status, message, path));
    }

    private int resolveStatus(Map<String, Object> attributes, HttpServletRequest request) {
        Object rawStatus = attributes.get("status");
        if (rawStatus instanceof Number numberStatus) {
            return numberStatus.intValue();
        }

        Object requestStatus = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        if (requestStatus instanceof Integer integerStatus) {
            return integerStatus;
        }

        return 500;
    }

    private String resolveMessage(Map<String, Object> attributes, int status) {
        String rawMessage = Objects.toString(attributes.get("message"), "").trim();
        if (!rawMessage.isEmpty()) {
            return rawMessage;
        }

        return ApiErrorCatalog.defaultMessageFor(status);
    }
}
