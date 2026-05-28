package com.example.products_service.repositories;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.example.products_service.entities.ProductImage;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface ProductImageRepository extends JpaRepository<ProductImage, UUID> {

    List<ProductImage> findByProductIdOrderByDisplayOrderAscUploadedAtAsc(UUID productId);

    List<ProductImage> findByProductIdInOrderByProductIdAscDisplayOrderAscUploadedAtAsc(Collection<UUID> productIds);

    Page<ProductImage> findByProductId(UUID productId, Pageable pageable);

    Optional<ProductImage> findByIdAndProductId(UUID id, UUID productId);

    @Transactional
    @Modifying
    @Query("DELETE FROM ProductImage p WHERE p.productId = :productId")
    void deleteByProductId(@Param("productId") UUID productId);
}
