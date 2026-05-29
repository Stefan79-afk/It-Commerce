package com.example.products_service.repositories;

import java.util.UUID;

import com.example.products_service.entities.Wishlist;
import com.example.products_service.entities.WishlistId;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface WishlistRepository extends JpaRepository<Wishlist, WishlistId> {

    Page<Wishlist> findByIdUserId(UUID userId, Pageable pageable);

    @Transactional
    @Modifying
    @Query("DELETE FROM Wishlist w WHERE w.id.productId = :productId")
    void deleteByProductId(@Param("productId") UUID productId);
}
