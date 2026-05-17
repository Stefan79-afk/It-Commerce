package com.example.products_service.repositories;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.example.products_service.entities.ProductImage;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductImageRepository extends JpaRepository<ProductImage, UUID> {

    List<ProductImage> findByProductIdOrderByDisplayOrderAscUploadedAtAsc(UUID productId);

    List<ProductImage> findByProductIdInOrderByProductIdAscDisplayOrderAscUploadedAtAsc(Collection<UUID> productIds);
}
