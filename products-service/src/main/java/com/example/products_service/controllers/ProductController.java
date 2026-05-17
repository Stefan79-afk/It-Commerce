package com.example.products_service.controllers;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.Valid;

import com.example.products_service.api.CreateProductRequest;
import com.example.products_service.api.PaginationResponse;
import com.example.products_service.api.ProductDetailResponse;
import com.example.products_service.api.ProductCreateResponse;
import com.example.products_service.api.ProductImageResponse;
import com.example.products_service.api.ProductSummaryResponse;
import com.example.products_service.api.UpdateProductRequest;
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
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
        Product product = getProductOrNotFound(productId);

        return toProductDetailResponse(product);
    }

    @PostMapping
    public ResponseEntity<ProductCreateResponse> createProduct(
        @Valid @RequestBody CreateProductRequest request,
        Authentication authentication
    ) {
        UUID userId = extractUserId(authentication);

        Product product = new Product();
        product.setId(UUID.randomUUID());
        product.setName(request.name());
        product.setDescription(request.description());
        product.setCategory(request.category());
        product.setPrice(request.price());
        product.setStockQuantity(request.stockQuantity());
        product.setOfficial(false);
        product.setCreatedByUserId(userId);
        product.setTechnicalSpecs(request.technicalSpecs());

        Product savedProduct = this.productRepository.save(product);
        ProductCreateResponse body = new ProductCreateResponse(savedProduct.getId(), savedProduct.getCreatedAt());
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @PatchMapping("/{productId}")
    public ProductDetailResponse updateProduct(
        @PathVariable UUID productId,
        @RequestBody UpdateProductRequest request,
        Authentication authentication
    ) {
        UUID userId = extractUserId(authentication);
        Product product = getProductOrNotFound(productId);

        assertCanManageProduct(product, userId, authentication);
        applyPatch(product, request);

        Product savedProduct = this.productRepository.save(product);
        return toProductDetailResponse(savedProduct);
    }

    @DeleteMapping("/{productId}")
    public ResponseEntity<Void> deleteProduct(
        @PathVariable UUID productId,
        Authentication authentication
    ) {
        UUID userId = extractUserId(authentication);
        Product product = getProductOrNotFound(productId);

        assertCanManageProduct(product, userId, authentication);
        this.productRepository.delete(product);
        return ResponseEntity.noContent().build();
    }

    private Product getProductOrNotFound(UUID productId) {
        return this.productRepository
            .findById(productId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ApiErrorCatalog.defaultMessageFor(404)));
    }

    private ProductDetailResponse toProductDetailResponse(Product product) {
        List<ProductImageResponse> images = this.productImageRepository
            .findByProductIdOrderByDisplayOrderAscUploadedAtAsc(product.getId())
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

    private UUID extractUserId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, ApiErrorCatalog.defaultMessageFor(401));
        }

        try {
            return UUID.fromString(authentication.getName());
        } catch (IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, ApiErrorCatalog.defaultMessageFor(401), ex);
        }
    }

    private void assertCanManageProduct(Product product, UUID userId, Authentication authentication) {
        boolean hasAdminRole = authentication.getAuthorities()
            .stream()
            .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));

        if (product.isOfficial()) {
            if (!hasAdminRole) {
                throw new ApiException(HttpStatus.FORBIDDEN, ApiErrorCatalog.defaultMessageFor(403));
            }
            return;
        }

        if (product.getCreatedByUserId() == null || !product.getCreatedByUserId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, ApiErrorCatalog.defaultMessageFor(403));
        }
    }

    private void applyPatch(Product product, UpdateProductRequest request) {
        if (request.name() != null) {
            product.setName(request.name());
        }
        if (request.description() != null) {
            product.setDescription(request.description());
        }
        if (request.category() != null) {
            product.setCategory(request.category());
        }
        if (request.price() != null) {
            product.setPrice(request.price());
        }
        if (request.stockQuantity() != null) {
            product.setStockQuantity(request.stockQuantity());
        }
        if (request.technicalSpecs() != null) {
            product.setTechnicalSpecs(request.technicalSpecs());
        }
    }
}
