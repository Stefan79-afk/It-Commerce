package com.example.products_service.controllers;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import jakarta.validation.Valid;

import com.example.products_service.api.CreateProductRequest;
import com.example.products_service.api.ImageConfirmRequest;
import com.example.products_service.api.ImagePresignRequest;
import com.example.products_service.api.ImagePresignResponse;
import com.example.products_service.api.PaginationResponse;
import com.example.products_service.api.ProductDetailResponse;
import com.example.products_service.api.ProductCreateResponse;
import com.example.products_service.api.ProductImageResponse;
import com.example.products_service.api.ProductSummaryResponse;
import com.example.products_service.api.UpdateProductRequest;
import com.example.products_service.api.WishlistItemResponse;
import com.example.products_service.entities.Product;
import com.example.products_service.entities.ProductImage;
import com.example.products_service.entities.Wishlist;
import com.example.products_service.entities.WishlistId;
import com.example.products_service.errors.ApiErrorCatalog;
import com.example.products_service.errors.ApiException;
import com.example.products_service.repositories.ProductImageRepository;
import com.example.products_service.repositories.ProductRepository;
import com.example.products_service.repositories.WishlistRepository;
import com.example.products_service.services.ImagePresignService;

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

    private final ImagePresignService imagePresignService;

    private final WishlistRepository wishlistRepository;

    public ProductController(
        ProductRepository productRepository,
        ProductImageRepository productImageRepository,
        ImagePresignService imagePresignService,
        WishlistRepository wishlistRepository
    ) {
        this.productRepository = productRepository;
        this.productImageRepository = productImageRepository;
        this.imagePresignService = imagePresignService;
        this.wishlistRepository = wishlistRepository;
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

    @PostMapping("/{productId}/images/presign")
    public ImagePresignResponse createProductImagePresign(
        @PathVariable UUID productId,
        @Valid @RequestBody ImagePresignRequest request,
        Authentication authentication
    ) {
        UUID userId = extractUserId(authentication);
        Product product = getProductOrNotFound(productId);
        assertCanManageProduct(product, userId, authentication);

        UUID imageId = UUID.randomUUID();
        return this.imagePresignService.createPresign(productId, imageId, request);
    }

    @PostMapping("/{productId}/images/confirm")
    public ProductImageResponse confirmProductImage(
        @PathVariable UUID productId,
        @Valid @RequestBody ImageConfirmRequest request,
        Authentication authentication
    ) {
        UUID userId = extractUserId(authentication);
        Product product = getProductOrNotFound(productId);
        assertCanManageProduct(product, userId, authentication);

        ProductImage productImage = this.productImageRepository
            .findByIdAndProductId(request.imageId(), productId)
            .orElseGet(() -> newOrMissingScopedImage(productId, request.imageId()));

        productImage.setFileUrl(request.fileUrl());
        productImage.setDisplayOrder(request.displayOrder() == null ? 0 : request.displayOrder());

        ProductImage savedProductImage = this.productImageRepository.save(productImage);
        return toProductImageResponse(savedProductImage);
    }

    @GetMapping("/{productId}/images")
    public PaginationResponse<ProductImageResponse> listProductImages(
        @PathVariable UUID productId,
        @PageableDefault(page = 0, size = 20) Pageable pageable,
        Authentication authentication
    ) {
        UUID userId = extractUserId(authentication);
        Product product = getProductOrNotFound(productId);
        assertCanManageProduct(product, userId, authentication);

        Page<ProductImage> imagePage = this.productImageRepository.findByProductId(productId, pageable);
        List<ProductImageResponse> content = imagePage.getContent().stream().map(this::toProductImageResponse).toList();

        return new PaginationResponse<>(
            content,
            imagePage.getNumber(),
            imagePage.getSize(),
            imagePage.getTotalElements(),
            imagePage.getTotalPages()
        );
    }

    @DeleteMapping("/{productId}/images/{imageId}")
    public ResponseEntity<Void> deleteProductImage(
        @PathVariable UUID productId,
        @PathVariable UUID imageId,
        Authentication authentication
    ) {
        UUID userId = extractUserId(authentication);
        Product product = getProductOrNotFound(productId);
        assertCanManageProduct(product, userId, authentication);

        ProductImage image = this.productImageRepository
            .findByIdAndProductId(imageId, productId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ApiErrorCatalog.defaultMessageFor(404)));

        this.productImageRepository.delete(image);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/wishlists/{userId}")
    public PaginationResponse<WishlistItemResponse> listWishlistItems(
        @PathVariable UUID userId,
        @PageableDefault(page = 0, size = 20) Pageable pageable,
        Authentication authentication
    ) {
        UUID authenticatedUserId = extractUserId(authentication);
        assertAuthenticatedUserMatches(authenticatedUserId, userId);

        Page<Wishlist> wishlistPage = this.wishlistRepository.findByIdUserId(userId, pageable);
        List<WishlistItemResponse> content = wishlistPage.getContent().stream().map(this::toWishlistItemResponse).toList();

        return new PaginationResponse<>(
            content,
            wishlistPage.getNumber(),
            wishlistPage.getSize(),
            wishlistPage.getTotalElements(),
            wishlistPage.getTotalPages()
        );
    }

    @PostMapping("/wishlists/{userId}/{productId}")
    public ResponseEntity<WishlistItemResponse> addWishlistItem(
        @PathVariable UUID userId,
        @PathVariable UUID productId,
        Authentication authentication
    ) {
        UUID authenticatedUserId = extractUserId(authentication);
        assertAuthenticatedUserMatches(authenticatedUserId, userId);

        if (!this.productRepository.existsById(productId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, ApiErrorCatalog.defaultMessageFor(404));
        }

        WishlistId wishlistId = new WishlistId(userId, productId);
        if (this.wishlistRepository.existsById(wishlistId)) {
            throw new ApiException(HttpStatus.CONFLICT, ApiErrorCatalog.defaultMessageFor(409));
        }

        Wishlist wishlist = new Wishlist();
        wishlist.setId(wishlistId);
        Wishlist savedWishlist = this.wishlistRepository.save(wishlist);

        return ResponseEntity.status(HttpStatus.CREATED).body(toWishlistItemResponse(savedWishlist));
    }

    @DeleteMapping("/wishlists/{userId}/{productId}")
    public ResponseEntity<Void> deleteWishlistItem(
        @PathVariable UUID userId,
        @PathVariable UUID productId,
        Authentication authentication
    ) {
        UUID authenticatedUserId = extractUserId(authentication);
        assertAuthenticatedUserMatches(authenticatedUserId, userId);

        WishlistId wishlistId = new WishlistId(userId, productId);
        Wishlist wishlist = this.wishlistRepository
            .findById(wishlistId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ApiErrorCatalog.defaultMessageFor(404)));

        this.wishlistRepository.delete(wishlist);
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
            thumbnailByProductId.putIfAbsent(productImage.getProductId(), this.imagePresignService.resolveViewUrl(productImage.getFileUrl()));
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
            this.imagePresignService.resolveViewUrl(productImage.getFileUrl()),
            productImage.getDisplayOrder(),
            productImage.getUploadedAt()
        );
    }

    private WishlistItemResponse toWishlistItemResponse(Wishlist wishlist) {
        if (wishlist.getId() == null) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, ApiErrorCatalog.defaultMessageFor(500));
        }

        return new WishlistItemResponse(
            wishlist.getId().getUserId(),
            wishlist.getId().getProductId(),
            wishlist.getAddedAt()
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

    private void assertAuthenticatedUserMatches(UUID authenticatedUserId, UUID pathUserId) {
        if (!authenticatedUserId.equals(pathUserId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, ApiErrorCatalog.defaultMessageFor(403));
        }
    }

    private ProductImage newOrMissingScopedImage(UUID productId, UUID imageId) {
        Optional<ProductImage> productImageWithSameId = this.productImageRepository.findById(imageId);
        if (productImageWithSameId.isPresent() && !productId.equals(productImageWithSameId.get().getProductId())) {
            throw new ApiException(HttpStatus.NOT_FOUND, ApiErrorCatalog.defaultMessageFor(404));
        }

        ProductImage image = new ProductImage();
        image.setId(imageId);
        image.setProductId(productId);
        return image;
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
