package com.example.products_service.repositories;

import java.util.UUID;

import com.example.products_service.entities.Product;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<Product, UUID> {
}
