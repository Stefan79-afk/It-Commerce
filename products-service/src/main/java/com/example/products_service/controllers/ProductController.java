package com.example.products_service.controllers;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.example.products_service.api.PaginationResponse;
import com.example.products_service.api.ProductDetailResponse;
import com.example.products_service.api.ProductImageResponse;
import com.example.products_service.api.ProductSummaryResponse;
import com.example.products_service.entities.Product;
import com.example.products_service.entities.ProductImage;
import com.example.products_service.errors.ApiErrorCatalog;
import com.example.products_service.errors.ApiException;
import com.example.products_service.repositories.ProductImageRepository;
import com.example.products_service.repositories.ProductRepository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/products")
public class ProductController {

    private final ProductRepository productRepository;

    private final ProductImageRepository productImageRepository;

    public ProductController(
        ProductRepository productRepository,
        ProductImageRepository productImageRepository
    ) {
        this.productRepository = productRepository;
        this.productImageRepository = productImageRepository;
    }

    @GetMapping
    public PaginationResponse<ProductSummaryResponse> listProducts(
        @PageableDefault(page = 0, size = 20) Pageable pageable
    ) {
        Page<Product> productPage = this.productRepository.findAll(pageable);
        Map<UUID, String> thumbnailByProductId = resolveThumbnails(productPage.getContent());

        List<ProductSummaryResponse> content = productPage
            .getContent()
            .stream()
            .map(product -> toProductSummaryResponse(product, thumbnailByProductId.get(product.getId())))
            .toList();

        return new PaginationResponse<>(
            content,
            productPage.getNumber(),
            productPage.getSize(),
            productPage.getTotalElements(),
            productPage.getTotalPages()
        );
    }

    @GetMapping("/{productId}")
    public ProductDetailResponse getProductById(@PathVariable UUID productId) {
        Product product = this.productRepository
            .findById(productId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ApiErrorCatalog.defaultMessageFor(404)));

        List<ProductImageResponse> images = this.productImageRepository
            .findByProductIdOrderByDisplayOrderAscUploadedAtAsc(productId)
            .stream()
            .map(this::toProductImageResponse)
            .toList();

        return new ProductDetailResponse(
            product.getId(),
            product.getName(),
            product.getDescription(),
            product.getCategory(),
            product.getPrice(),
            product.getStockQuantity(),
            product.isOfficial(),
            product.getCreatedByUserId(),
            product.getTechnicalSpecs(),
            images,
            product.getCreatedAt(),
            product.getUpdatedAt()
        );
    }

    private Map<UUID, String> resolveThumbnails(List<Product> products) {
        List<UUID> productIds = products.stream().map(Product::getId).toList();
        if (productIds.isEmpty()) {
            return Map.of();
        }

        Map<UUID, String> thumbnailByProductId = new HashMap<>();
        List<ProductImage> productImages = this.productImageRepository
            .findByProductIdInOrderByProductIdAscDisplayOrderAscUploadedAtAsc(productIds);

        for (ProductImage productImage : productImages) {
            thumbnailByProductId.putIfAbsent(productImage.getProductId(), productImage.getFileUrl());
        }

        return thumbnailByProductId;
    }

    private ProductSummaryResponse toProductSummaryResponse(Product product, String thumbnailUrl) {
        return new ProductSummaryResponse(
            product.getId(),
            product.getName(),
            product.getCategory(),
            product.getPrice(),
            product.isOfficial(),
            thumbnailUrl
        );
    }

    private ProductImageResponse toProductImageResponse(ProductImage productImage) {
        return new ProductImageResponse(
            productImage.getId(),
            productImage.getFileUrl(),
            productImage.getDisplayOrder(),
            productImage.getUploadedAt()
        );
    }
}
