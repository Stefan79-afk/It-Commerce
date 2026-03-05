package com.example.products_service.controllers;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.RestController;

import io.micrometer.core.ipc.http.HttpSender.Response;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;


@RestController
public class HealthController {
    
    private final JdbcTemplate jdbcTemplate;

    public HealthController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/api/v1/health")
    public ResponseEntity<?> health() {
        Integer one = this.jdbcTemplate.queryForObject("SELECT 1", Integer.class);

        if (one == null || one != 1) {
            return ResponseEntity.status(500).body(Map.of("status", "error"));
        }

        return ResponseEntity.status(200).body(Map.of("status", "ok"));
    }
    
}
