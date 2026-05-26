package com.example.products_service.entities;

import java.time.OffsetDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "wishlists")
public class Wishlist {

    @EmbeddedId
    private WishlistId id;

    @Column(name = "added_at", nullable = false)
    private OffsetDateTime addedAt;

    public Wishlist() {
    }

    @PrePersist
    void prePersist() {
        if (this.addedAt == null) {
            this.addedAt = OffsetDateTime.now();
        }
    }

    public WishlistId getId() {
        return this.id;
    }

    public void setId(WishlistId id) {
        this.id = id;
    }

    public OffsetDateTime getAddedAt() {
        return this.addedAt;
    }

    public void setAddedAt(OffsetDateTime addedAt) {
        this.addedAt = addedAt;
    }
}
