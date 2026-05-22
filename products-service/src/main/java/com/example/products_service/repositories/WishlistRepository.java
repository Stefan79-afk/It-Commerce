package com.example.products_service.repositories;

import java.util.UUID;

import com.example.products_service.entities.Wishlist;
import com.example.products_service.entities.WishlistId;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WishlistRepository extends JpaRepository<Wishlist, WishlistId> {

    Page<Wishlist> findByIdUserId(UUID userId, Pageable pageable);
}
