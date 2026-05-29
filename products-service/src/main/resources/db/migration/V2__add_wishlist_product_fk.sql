ALTER TABLE wishlists
    ADD CONSTRAINT fk_wishlists_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
