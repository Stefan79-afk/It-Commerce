package com.example.products_service.controllers;

import java.util.Map;

import com.example.products_service.errors.ApiException;

import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;


@RestController
public class HealthController {
    
    private final JdbcTemplate jdbcTemplate;

    public HealthController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/api/v1/health")
    public Map<String, String> health() {
        try {
            Integer one = this.jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            if (one == null || one != 1) {
                throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Database connectivity check failed.");
            }
        } catch (DataAccessException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Database connectivity check failed.", ex);
        }

        return Map.of("status", "UP");
    }
    
}
