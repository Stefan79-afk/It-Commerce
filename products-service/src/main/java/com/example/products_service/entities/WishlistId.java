package com.example.products_service.entities;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class WishlistId implements Serializable {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    public WishlistId() {
    }

    public WishlistId(UUID userId, UUID productId) {
        this.userId = userId;
        this.productId = productId;
    }

    public UUID getUserId() {
        return this.userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public UUID getProductId() {
        return this.productId;
    }

    public void setProductId(UUID productId) {
        this.productId = productId;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof WishlistId wishlistId)) {
            return false;
        }
        return Objects.equals(this.userId, wishlistId.userId)
            && Objects.equals(this.productId, wishlistId.productId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(this.userId, this.productId);
    }
}
