package com.example.products_service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.example.products_service.entities.Product;
import com.example.products_service.entities.ProductImage;
import com.example.products_service.entities.Wishlist;
import com.example.products_service.entities.WishlistId;
import com.example.products_service.repositories.ProductImageRepository;
import com.example.products_service.repositories.ProductRepository;
import com.example.products_service.repositories.WishlistRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
class ProductsServiceApplicationTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private JdbcTemplate jdbcTemplate;

	@MockitoBean
	private ProductRepository productRepository;

	@MockitoBean
	private ProductImageRepository productImageRepository;

	@MockitoBean
	private WishlistRepository wishlistRepository;

	@BeforeEach
	void setUp() {
		when(this.jdbcTemplate.queryForObject("SELECT 1", Integer.class)).thenReturn(1);
		when(this.productRepository.findAll(any(Pageable.class))).thenReturn(Page.empty());
		when(this.productRepository.findById(any(UUID.class))).thenReturn(Optional.empty());
		when(this.productImageRepository.findByProductIdInOrderByProductIdAscDisplayOrderAscUploadedAtAsc(anyCollection()))
			.thenReturn(List.of());
		when(this.productImageRepository.findByProductIdOrderByDisplayOrderAscUploadedAtAsc(any(UUID.class)))
			.thenReturn(List.of());
		when(this.productImageRepository.findByProductId(any(UUID.class), any(Pageable.class)))
			.thenReturn(Page.empty());
		when(this.productImageRepository.findByIdAndProductId(any(UUID.class), any(UUID.class)))
			.thenReturn(Optional.empty());
		when(this.productImageRepository.findById(any(UUID.class)))
			.thenReturn(Optional.empty());
		when(this.wishlistRepository.findByIdUserId(any(UUID.class), any(Pageable.class)))
			.thenReturn(Page.empty());
		when(this.wishlistRepository.existsById(any(WishlistId.class))).thenReturn(false);
		when(this.wishlistRepository.findById(any(WishlistId.class))).thenReturn(Optional.empty());
		when(this.productRepository.save(any(Product.class))).thenAnswer(invocation -> {
			Product savedProduct = invocation.getArgument(0, Product.class);
			if (savedProduct.getCreatedAt() == null) {
				savedProduct.setCreatedAt(OffsetDateTime.parse("2026-03-13T10:15:30Z"));
			}
			if (savedProduct.getUpdatedAt() == null) {
				savedProduct.setUpdatedAt(OffsetDateTime.parse("2026-03-13T10:15:30Z"));
			}
			return savedProduct;
		});
		when(this.productImageRepository.save(any(ProductImage.class))).thenAnswer(invocation -> {
			ProductImage savedImage = invocation.getArgument(0, ProductImage.class);
			if (savedImage.getUploadedAt() == null) {
				savedImage.setUploadedAt(OffsetDateTime.parse("2026-03-13T10:15:30Z"));
			}
			if (savedImage.getDisplayOrder() == null) {
				savedImage.setDisplayOrder(0);
			}
			return savedImage;
		});
		when(this.wishlistRepository.save(any(Wishlist.class))).thenAnswer(invocation -> {
			Wishlist savedWishlist = invocation.getArgument(0, Wishlist.class);
			if (savedWishlist.getAddedAt() == null) {
				savedWishlist.setAddedAt(OffsetDateTime.parse("2026-03-13T10:15:30Z"));
			}
			return savedWishlist;
		});
	}

	@Test
	void contextLoads() {
	}

	@Test
	void healthReturnsUpWhenDatabaseIsReachable() throws Exception {
		this.mockMvc
			.perform(get("/api/v1/health"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("UP"));
	}

	@Test
	void healthFailureReturnsStandardErrorShape() throws Exception {
		when(this.jdbcTemplate.queryForObject("SELECT 1", Integer.class))
			.thenThrow(new DataAccessResourceFailureException("db down"));

		this.mockMvc
			.perform(get("/api/v1/health"))
			.andExpect(status().isInternalServerError())
			.andExpect(jsonPath("$.status").value(500))
			.andExpect(jsonPath("$.error").value("INTERNAL_ERROR"))
			.andExpect(jsonPath("$.message").value("Database connectivity check failed."))
			.andExpect(jsonPath("$.path").value("/api/v1/health"))
			.andExpect(jsonPath("$.timestamp").isNotEmpty());
	}

	@Test
	void unknownRouteReturnsStandardNotFoundShape() throws Exception {
		this.mockMvc
			.perform(get("/api/v1/does-not-exist"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.status").value(404))
			.andExpect(jsonPath("$.error").value("RESOURCE_NOT_FOUND"))
			.andExpect(jsonPath("$.path").value("/api/v1/does-not-exist"))
			.andExpect(jsonPath("$.timestamp").isNotEmpty());
	}

	@Test
	void protectedEndpointReturnsUnauthorizedWithoutJwt() throws Exception {
		this.mockMvc
			.perform(get("/api/v1/products/wishlists/3fa85f64-5717-4562-b3fc-2c963f66afa6"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.status").value(401))
			.andExpect(jsonPath("$.error").value("UNAUTHORIZED"))
			.andExpect(jsonPath("$.message").value("Authentication credentials were not provided or are invalid."))
			.andExpect(jsonPath("$.path").value("/api/v1/products/wishlists/3fa85f64-5717-4562-b3fc-2c963f66afa6"))
			.andExpect(jsonPath("$.timestamp").isNotEmpty());
	}

	@Test
	void selfUserCanListWishlistWithPagination() throws Exception {
		UUID userId = UUID.fromString("aa185f64-5717-4562-b3fc-2c963f66afa1");
		Pageable pageable = PageRequest.of(0, 2);

		Wishlist wishlistOne = buildWishlist(
			userId,
			UUID.fromString("aa185f64-5717-4562-b3fc-2c963f66afa2"),
			OffsetDateTime.parse("2026-03-13T10:15:30Z")
		);
		Wishlist wishlistTwo = buildWishlist(
			userId,
			UUID.fromString("aa185f64-5717-4562-b3fc-2c963f66afa3"),
			OffsetDateTime.parse("2026-03-14T10:15:30Z")
		);

		Page<Wishlist> wishlistPage = new PageImpl<>(List.of(wishlistOne, wishlistTwo), pageable, 4);
		when(this.wishlistRepository.findByIdUserId(any(UUID.class), any(Pageable.class))).thenReturn(wishlistPage);

		this.mockMvc
			.perform(
				get("/api/v1/products/wishlists/" + userId + "?page=0&size=2")
					.with(jwt().jwt(token -> token.subject(userId.toString())))
			)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.page").value(0))
			.andExpect(jsonPath("$.size").value(2))
			.andExpect(jsonPath("$.totalElements").value(4))
			.andExpect(jsonPath("$.totalPages").value(2))
			.andExpect(jsonPath("$.content[0].userId").value(userId.toString()))
			.andExpect(jsonPath("$.content[0].productId").value("aa185f64-5717-4562-b3fc-2c963f66afa2"))
			.andExpect(jsonPath("$.content[0].addedAt").value("2026-03-13T10:15:30Z"));
	}

	@Test
	void nonSelfUserCannotListWishlist() throws Exception {
		UUID pathUserId = UUID.fromString("ab185f64-5717-4562-b3fc-2c963f66afa1");
		UUID jwtUserId = UUID.fromString("ab185f64-5717-4562-b3fc-2c963f66afa2");

		this.mockMvc
			.perform(
				get("/api/v1/products/wishlists/" + pathUserId)
					.with(jwt().jwt(token -> token.subject(jwtUserId.toString())))
			)
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.status").value(403))
			.andExpect(jsonPath("$.error").value("FORBIDDEN"))
			.andExpect(jsonPath("$.path").value("/api/v1/products/wishlists/" + pathUserId));
	}

	@Test
	void selfUserCanAddWishlistItem() throws Exception {
		UUID userId = UUID.fromString("ac185f64-5717-4562-b3fc-2c963f66afa1");
		UUID productId = UUID.fromString("ac185f64-5717-4562-b3fc-2c963f66afa2");
		when(this.productRepository.existsById(productId)).thenReturn(true);

		this.mockMvc
			.perform(
				post("/api/v1/products/wishlists/" + userId + "/" + productId)
					.with(jwt().jwt(token -> token.subject(userId.toString())))
			)
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.userId").value(userId.toString()))
			.andExpect(jsonPath("$.productId").value(productId.toString()))
			.andExpect(jsonPath("$.addedAt").value("2026-03-13T10:15:30Z"));

		ArgumentCaptor<Wishlist> wishlistCaptor = ArgumentCaptor.forClass(Wishlist.class);
		verify(this.wishlistRepository).save(wishlistCaptor.capture());
		assertEquals(userId, wishlistCaptor.getValue().getId().getUserId());
		assertEquals(productId, wishlistCaptor.getValue().getId().getProductId());
	}

	@Test
	void duplicateWishlistItemReturnsConflict() throws Exception {
		UUID userId = UUID.fromString("ad185f64-5717-4562-b3fc-2c963f66afa1");
		UUID productId = UUID.fromString("ad185f64-5717-4562-b3fc-2c963f66afa2");
		WishlistId wishlistId = new WishlistId(userId, productId);

		when(this.productRepository.existsById(productId)).thenReturn(true);
		when(this.wishlistRepository.existsById(wishlistId)).thenReturn(true);

		this.mockMvc
			.perform(
				post("/api/v1/products/wishlists/" + userId + "/" + productId)
					.with(jwt().jwt(token -> token.subject(userId.toString())))
			)
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.status").value(409))
			.andExpect(jsonPath("$.error").value("CONFLICT"));

		verify(this.wishlistRepository, never()).save(any(Wishlist.class));
	}

	@Test
	void addingWishlistItemForMissingProductReturnsNotFound() throws Exception {
		UUID userId = UUID.fromString("ae185f64-5717-4562-b3fc-2c963f66afa1");
		UUID productId = UUID.fromString("ae185f64-5717-4562-b3fc-2c963f66afa2");
		when(this.productRepository.existsById(productId)).thenReturn(false);

		this.mockMvc
			.perform(
				post("/api/v1/products/wishlists/" + userId + "/" + productId)
					.with(jwt().jwt(token -> token.subject(userId.toString())))
			)
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.status").value(404))
			.andExpect(jsonPath("$.error").value("RESOURCE_NOT_FOUND"));

		verify(this.wishlistRepository, never()).save(any(Wishlist.class));
	}

	@Test
	void selfUserCanDeleteWishlistItem() throws Exception {
		UUID userId = UUID.fromString("af185f64-5717-4562-b3fc-2c963f66afa1");
		UUID productId = UUID.fromString("af185f64-5717-4562-b3fc-2c963f66afa2");
		Wishlist wishlist = buildWishlist(userId, productId, OffsetDateTime.parse("2026-03-13T10:15:30Z"));

		when(this.wishlistRepository.findById(new WishlistId(userId, productId))).thenReturn(Optional.of(wishlist));

		this.mockMvc
			.perform(
				delete("/api/v1/products/wishlists/" + userId + "/" + productId)
					.with(jwt().jwt(token -> token.subject(userId.toString())))
			)
			.andExpect(status().isNoContent());

		verify(this.wishlistRepository).delete(wishlist);
	}

	@Test
	void deletingMissingWishlistItemReturnsNotFound() throws Exception {
		UUID userId = UUID.fromString("b0185f64-5717-4562-b3fc-2c963f66afa1");
		UUID productId = UUID.fromString("b0185f64-5717-4562-b3fc-2c963f66afa2");
		when(this.wishlistRepository.findById(new WishlistId(userId, productId))).thenReturn(Optional.empty());

		this.mockMvc
			.perform(
				delete("/api/v1/products/wishlists/" + userId + "/" + productId)
					.with(jwt().jwt(token -> token.subject(userId.toString())))
			)
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.status").value(404))
			.andExpect(jsonPath("$.error").value("RESOURCE_NOT_FOUND"));
	}

	@Test
	void nonSelfUserCannotDeleteWishlistItem() throws Exception {
		UUID pathUserId = UUID.fromString("b1185f64-5717-4562-b3fc-2c963f66afa1");
		UUID productId = UUID.fromString("b1185f64-5717-4562-b3fc-2c963f66afa2");
		UUID jwtUserId = UUID.fromString("b1185f64-5717-4562-b3fc-2c963f66afa3");

		this.mockMvc
			.perform(
				delete("/api/v1/products/wishlists/" + pathUserId + "/" + productId)
					.with(jwt().jwt(token -> token.subject(jwtUserId.toString())))
			)
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.status").value(403))
			.andExpect(jsonPath("$.error").value("FORBIDDEN"));

		verify(this.wishlistRepository, never()).findById(any(WishlistId.class));
	}

	@Test
	void listProductsReturnsPaginationWrapperWithPageable() throws Exception {
		UUID productOneId = UUID.fromString("3fa85f64-5717-4562-b3fc-2c963f66afa6");
		UUID productTwoId = UUID.fromString("3fa85f64-5717-4562-b3fc-2c963f66afa7");
		Pageable pageable = PageRequest.of(0, 2, Sort.by(Sort.Order.asc("price")));

		Product productOne = buildProduct(productOneId, "Mouse", "Peripherals", new BigDecimal("49.99"), true);
		Product productTwo = buildProduct(productTwoId, "Keyboard", "Peripherals", new BigDecimal("89.99"), false);

		Page<Product> productPage = new PageImpl<>(List.of(productOne, productTwo), pageable, 5);
		when(this.productRepository.findAll(any(Pageable.class))).thenReturn(productPage);
		when(this.productImageRepository.findByProductIdInOrderByProductIdAscDisplayOrderAscUploadedAtAsc(
			List.of(productOneId, productTwoId)
		)).thenReturn(List.of(
			buildImage(UUID.fromString("8fa85f64-5717-4562-b3fc-2c963f66afa1"), productOneId, "https://cdn.example.com/mouse.jpg", 0),
			buildImage(UUID.fromString("8fa85f64-5717-4562-b3fc-2c963f66afa2"), productOneId, "https://cdn.example.com/mouse-alt.jpg", 1),
			buildImage(UUID.fromString("8fa85f64-5717-4562-b3fc-2c963f66afa3"), productTwoId, "https://cdn.example.com/keyboard.jpg", 0)
		));

		this.mockMvc
			.perform(get("/api/v1/products?page=0&size=2&sort=price,asc"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.page").value(0))
			.andExpect(jsonPath("$.size").value(2))
			.andExpect(jsonPath("$.totalElements").value(5))
			.andExpect(jsonPath("$.totalPages").value(3))
			.andExpect(jsonPath("$.content[0].id").value(productOneId.toString()))
			.andExpect(jsonPath("$.content[0].name").value("Mouse"))
			.andExpect(jsonPath("$.content[0].category").value("Peripherals"))
			.andExpect(jsonPath("$.content[0].price").value(49.99))
			.andExpect(jsonPath("$.content[0].isOfficial").value(true))
			.andExpect(jsonPath("$.content[0].thumbnailUrl").value("https://cdn.example.com/mouse.jpg"))
			.andExpect(jsonPath("$.content[1].id").value(productTwoId.toString()))
			.andExpect(jsonPath("$.content[1].thumbnailUrl").value("https://cdn.example.com/keyboard.jpg"));

		ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
		verify(this.productRepository).findAll(pageableCaptor.capture());

		Pageable capturedPageable = pageableCaptor.getValue();
		assertEquals(0, capturedPageable.getPageNumber());
		assertEquals(2, capturedPageable.getPageSize());
		assertNotNull(capturedPageable.getSort().getOrderFor("price"));
		assertTrue(capturedPageable.getSort().getOrderFor("price").isAscending());
	}

	@Test
	void productDetailReturnsNotFoundShapeWhenProductIsMissing() throws Exception {
		UUID productId = UUID.fromString("6fa85f64-5717-4562-b3fc-2c963f66afa6");
		when(this.productRepository.findById(productId)).thenReturn(Optional.empty());

		this.mockMvc
			.perform(get("/api/v1/products/" + productId))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.status").value(404))
			.andExpect(jsonPath("$.error").value("RESOURCE_NOT_FOUND"))
			.andExpect(jsonPath("$.message").value("Resource not found."))
			.andExpect(jsonPath("$.path").value("/api/v1/products/" + productId))
			.andExpect(jsonPath("$.timestamp").isNotEmpty());
	}

	@Test
	void createProductSetsCreatorFromJwtAndForcesNonOfficial() throws Exception {
		UUID userId = UUID.fromString("1fa85f64-5717-4562-b3fc-2c963f66afa6");

		this.mockMvc
			.perform(
				post("/api/v1/products")
					.with(jwt().jwt(token -> token.subject(userId.toString())))
					.contentType(APPLICATION_JSON)
					.content("""
						{
						  "name": "Used RTX 3070",
						  "description": "Good condition",
						  "category": "GPU",
						  "price": 350.00,
						  "stockQuantity": 1,
						  "technicalSpecs": {
						    "memory": "8GB"
						  }
						}
						""")
			)
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.id").isNotEmpty())
			.andExpect(jsonPath("$.createdAt").isNotEmpty());

		ArgumentCaptor<Product> createdProductCaptor = ArgumentCaptor.forClass(Product.class);
		verify(this.productRepository).save(createdProductCaptor.capture());

		Product createdProduct = createdProductCaptor.getValue();
		assertEquals(userId, createdProduct.getCreatedByUserId());
		assertFalse(createdProduct.isOfficial());
		assertNotNull(createdProduct.getId());
		assertEquals("Used RTX 3070", createdProduct.getName());
	}

	@Test
	void ownerCanPatchNonOfficialProduct() throws Exception {
		UUID productId = UUID.fromString("2fa85f64-5717-4562-b3fc-2c963f66afa6");
		UUID ownerId = UUID.fromString("2fa85f64-5717-4562-b3fc-2c963f66afa7");

		Product ownedProduct = buildProduct(productId, "Old Name", "GPU", new BigDecimal("350.00"), false);
		ownedProduct.setCreatedByUserId(ownerId);
		ownedProduct.setTechnicalSpecs(Map.of("memory", "8GB"));
		when(this.productRepository.findById(productId)).thenReturn(Optional.of(ownedProduct));

		this.mockMvc
			.perform(
				patch("/api/v1/products/" + productId)
					.with(jwt().jwt(token -> token.subject(ownerId.toString())))
					.contentType(APPLICATION_JSON)
					.content("""
						{
						  "name": "Updated Name",
						  "price": 399.99
						}
						""")
			)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(productId.toString()))
			.andExpect(jsonPath("$.name").value("Updated Name"))
			.andExpect(jsonPath("$.price").value(399.99))
			.andExpect(jsonPath("$.isOfficial").value(false))
			.andExpect(jsonPath("$.createdByUserId").value(ownerId.toString()));

		ArgumentCaptor<Product> savedProductCaptor = ArgumentCaptor.forClass(Product.class);
		verify(this.productRepository).save(savedProductCaptor.capture());
		Product savedProduct = savedProductCaptor.getValue();
		assertEquals("Updated Name", savedProduct.getName());
		assertEquals(new BigDecimal("399.99"), savedProduct.getPrice());
	}

	@Test
	void ownerCanDeleteNonOfficialProduct() throws Exception {
		UUID productId = UUID.fromString("3fa85f64-5717-4562-b3fc-2c963f66afa6");
		UUID ownerId = UUID.fromString("3fa85f64-5717-4562-b3fc-2c963f66afa7");

		Product ownedProduct = buildProduct(productId, "Mouse", "Peripherals", new BigDecimal("49.99"), false);
		ownedProduct.setCreatedByUserId(ownerId);
		when(this.productRepository.findById(productId)).thenReturn(Optional.of(ownedProduct));

		this.mockMvc
			.perform(delete("/api/v1/products/" + productId).with(jwt().jwt(token -> token.subject(ownerId.toString()))))
			.andExpect(status().isNoContent());

		verify(this.productRepository).delete(ownedProduct);
	}

	@Test
	void nonOwnerCannotPatchNonOfficialProduct() throws Exception {
		UUID productId = UUID.fromString("4fa85f64-5717-4562-b3fc-2c963f66afa6");
		UUID ownerId = UUID.fromString("4fa85f64-5717-4562-b3fc-2c963f66afa7");
		UUID nonOwnerId = UUID.fromString("4fa85f64-5717-4562-b3fc-2c963f66afa8");

		Product ownedProduct = buildProduct(productId, "Mouse", "Peripherals", new BigDecimal("49.99"), false);
		ownedProduct.setCreatedByUserId(ownerId);
		when(this.productRepository.findById(productId)).thenReturn(Optional.of(ownedProduct));

		this.mockMvc
			.perform(
				patch("/api/v1/products/" + productId)
					.with(jwt().jwt(token -> token.subject(nonOwnerId.toString())))
					.contentType(APPLICATION_JSON)
					.content("""
						{
						  "name": "Hacker Update"
						}
						""")
			)
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.status").value(403))
			.andExpect(jsonPath("$.error").value("FORBIDDEN"));

		verify(this.productRepository, never()).save(any(Product.class));
	}

	@Test
	void nonOwnerCannotDeleteNonOfficialProduct() throws Exception {
		UUID productId = UUID.fromString("5fa85f64-5717-4562-b3fc-2c963f66afa6");
		UUID ownerId = UUID.fromString("5fa85f64-5717-4562-b3fc-2c963f66afa7");
		UUID nonOwnerId = UUID.fromString("5fa85f64-5717-4562-b3fc-2c963f66afa8");

		Product ownedProduct = buildProduct(productId, "Mouse", "Peripherals", new BigDecimal("49.99"), false);
		ownedProduct.setCreatedByUserId(ownerId);
		when(this.productRepository.findById(productId)).thenReturn(Optional.of(ownedProduct));

		this.mockMvc
			.perform(delete("/api/v1/products/" + productId).with(jwt().jwt(token -> token.subject(nonOwnerId.toString()))))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.status").value(403))
			.andExpect(jsonPath("$.error").value("FORBIDDEN"));

		verify(this.productRepository, never()).delete(any(Product.class));
	}

	@Test
	void adminCanPatchOfficialProduct() throws Exception {
		UUID productId = UUID.fromString("6fa85f64-5717-4562-b3fc-2c963f66afa6");
		UUID adminId = UUID.fromString("6fa85f64-5717-4562-b3fc-2c963f66afa7");

		Product officialProduct = buildProduct(productId, "RTX 4080", "GPU", new BigDecimal("999.99"), true);
		officialProduct.setCreatedByUserId(null);
		when(this.productRepository.findById(productId)).thenReturn(Optional.of(officialProduct));

		this.mockMvc
			.perform(
				patch("/api/v1/products/" + productId)
					.with(jwt()
						.jwt(token -> token.subject(adminId.toString()))
						.authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
					.contentType(APPLICATION_JSON)
					.content("""
						{
						  "stockQuantity": 12
						}
						""")
			)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(productId.toString()))
			.andExpect(jsonPath("$.stockQuantity").value(12))
			.andExpect(jsonPath("$.isOfficial").value(true));

		verify(this.productRepository).save(any(Product.class));
	}

	@Test
	void adminCanDeleteOfficialProduct() throws Exception {
		UUID productId = UUID.fromString("7fa85f64-5717-4562-b3fc-2c963f66afa6");
		UUID adminId = UUID.fromString("7fa85f64-5717-4562-b3fc-2c963f66afa7");

		Product officialProduct = buildProduct(productId, "RTX 4080", "GPU", new BigDecimal("999.99"), true);
		when(this.productRepository.findById(productId)).thenReturn(Optional.of(officialProduct));

		this.mockMvc
			.perform(
				delete("/api/v1/products/" + productId)
					.with(jwt()
						.jwt(token -> token.subject(adminId.toString()))
						.authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
			)
			.andExpect(status().isNoContent());

		verify(this.productRepository).delete(officialProduct);
	}

	@Test
	void nonAdminCannotPatchOfficialProduct() throws Exception {
		UUID productId = UUID.fromString("8fa85f64-5717-4562-b3fc-2c963f66afa6");
		UUID userId = UUID.fromString("8fa85f64-5717-4562-b3fc-2c963f66afa7");

		Product officialProduct = buildProduct(productId, "RTX 4080", "GPU", new BigDecimal("999.99"), true);
		when(this.productRepository.findById(productId)).thenReturn(Optional.of(officialProduct));

		this.mockMvc
			.perform(
				patch("/api/v1/products/" + productId)
					.with(jwt().jwt(token -> token.subject(userId.toString())))
					.contentType(APPLICATION_JSON)
					.content("""
						{
						  "stockQuantity": 99
						}
						""")
			)
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.status").value(403))
			.andExpect(jsonPath("$.error").value("FORBIDDEN"));

		verify(this.productRepository, never()).save(any(Product.class));
	}

	@Test
	void nonAdminCannotDeleteOfficialProduct() throws Exception {
		UUID productId = UUID.fromString("9fa85f64-5717-4562-b3fc-2c963f66afa6");
		UUID userId = UUID.fromString("9fa85f64-5717-4562-b3fc-2c963f66afa7");

		Product officialProduct = buildProduct(productId, "RTX 4080", "GPU", new BigDecimal("999.99"), true);
		when(this.productRepository.findById(productId)).thenReturn(Optional.of(officialProduct));

		this.mockMvc
			.perform(delete("/api/v1/products/" + productId).with(jwt().jwt(token -> token.subject(userId.toString()))))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.status").value(403))
			.andExpect(jsonPath("$.error").value("FORBIDDEN"));

		verify(this.productRepository, never()).delete(any(Product.class));
	}

	@Test
	void ownerCanPresignProductImageWithStubUploadUrl() throws Exception {
		UUID productId = UUID.fromString("0fa85f64-5717-4562-b3fc-2c963f66afa1");
		UUID ownerId = UUID.fromString("0fa85f64-5717-4562-b3fc-2c963f66afa2");
		Product ownedProduct = buildProduct(productId, "Owned Product", "GPU", new BigDecimal("123.45"), false);
		ownedProduct.setCreatedByUserId(ownerId);
		when(this.productRepository.findById(productId)).thenReturn(Optional.of(ownedProduct));

		this.mockMvc
			.perform(
				post("/api/v1/products/" + productId + "/images/presign")
					.with(jwt().jwt(token -> token.subject(ownerId.toString())))
					.contentType(APPLICATION_JSON)
					.content("""
						{
						  "fileName": "my image.png",
						  "contentType": "image/png"
						}
						""")
			)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.imageId").isNotEmpty())
			.andExpect(jsonPath("$.uploadUrl").value(org.hamcrest.Matchers.startsWith("https://stub-upload.test/products/" + productId + "/images/")))
			.andExpect(jsonPath("$.expiresIn").value(900));
	}

	@Test
	void ownerCanConfirmProductImage() throws Exception {
		UUID productId = UUID.fromString("0fa85f64-5717-4562-b3fc-2c963f66afa3");
		UUID ownerId = UUID.fromString("0fa85f64-5717-4562-b3fc-2c963f66afa4");
		UUID imageId = UUID.fromString("0fa85f64-5717-4562-b3fc-2c963f66afa5");

		Product ownedProduct = buildProduct(productId, "Owned Product", "GPU", new BigDecimal("123.45"), false);
		ownedProduct.setCreatedByUserId(ownerId);
		when(this.productRepository.findById(productId)).thenReturn(Optional.of(ownedProduct));

		this.mockMvc
			.perform(
				post("/api/v1/products/" + productId + "/images/confirm")
					.with(jwt().jwt(token -> token.subject(ownerId.toString())))
					.contentType(APPLICATION_JSON)
					.content("""
						{
						  "imageId": "%s",
						  "fileUrl": "https://cdn.example.com/new-image.png"
						}
						""".formatted(imageId))
			)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(imageId.toString()))
			.andExpect(jsonPath("$.fileUrl").value("https://cdn.example.com/new-image.png"))
			.andExpect(jsonPath("$.displayOrder").value(0))
			.andExpect(jsonPath("$.uploadedAt").isNotEmpty());

		ArgumentCaptor<ProductImage> savedImageCaptor = ArgumentCaptor.forClass(ProductImage.class);
		verify(this.productImageRepository).save(savedImageCaptor.capture());
		ProductImage savedImage = savedImageCaptor.getValue();
		assertEquals(productId, savedImage.getProductId());
		assertEquals(imageId, savedImage.getId());
		assertEquals(0, savedImage.getDisplayOrder());
	}

	@Test
	void ownerCanListProductImagesWithPagination() throws Exception {
		UUID productId = UUID.fromString("0fa85f64-5717-4562-b3fc-2c963f66afa6");
		UUID ownerId = UUID.fromString("0fa85f64-5717-4562-b3fc-2c963f66afa7");
		Product ownedProduct = buildProduct(productId, "Owned Product", "GPU", new BigDecimal("123.45"), false);
		ownedProduct.setCreatedByUserId(ownerId);
		when(this.productRepository.findById(productId)).thenReturn(Optional.of(ownedProduct));

		Pageable pageable = PageRequest.of(0, 2);
		Page<ProductImage> imagePage = new PageImpl<>(List.of(
			buildImage(UUID.fromString("0fa85f64-5717-4562-b3fc-2c963f66afa8"), productId, "https://cdn.example.com/a.png", 0),
			buildImage(UUID.fromString("0fa85f64-5717-4562-b3fc-2c963f66afa9"), productId, "https://cdn.example.com/b.png", 1)
		), pageable, 4);
		when(this.productImageRepository.findByProductId(any(UUID.class), any(Pageable.class))).thenReturn(imagePage);

		this.mockMvc
			.perform(
				get("/api/v1/products/" + productId + "/images?page=0&size=2")
					.with(jwt().jwt(token -> token.subject(ownerId.toString())))
			)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.page").value(0))
			.andExpect(jsonPath("$.size").value(2))
			.andExpect(jsonPath("$.totalElements").value(4))
			.andExpect(jsonPath("$.totalPages").value(2))
			.andExpect(jsonPath("$.content[0].id").value("0fa85f64-5717-4562-b3fc-2c963f66afa8"))
			.andExpect(jsonPath("$.content[0].displayOrder").value(0));
	}

	@Test
	void ownerCanDeleteProductImage() throws Exception {
		UUID productId = UUID.fromString("1fa85f64-5717-4562-b3fc-2c963f66afa1");
		UUID ownerId = UUID.fromString("1fa85f64-5717-4562-b3fc-2c963f66afa2");
		UUID imageId = UUID.fromString("1fa85f64-5717-4562-b3fc-2c963f66afa3");

		Product ownedProduct = buildProduct(productId, "Owned Product", "GPU", new BigDecimal("123.45"), false);
		ownedProduct.setCreatedByUserId(ownerId);
		ProductImage ownedImage = buildImage(imageId, productId, "https://cdn.example.com/a.png", 0);
		when(this.productRepository.findById(productId)).thenReturn(Optional.of(ownedProduct));
		when(this.productImageRepository.findByIdAndProductId(imageId, productId)).thenReturn(Optional.of(ownedImage));

		this.mockMvc
			.perform(
				delete("/api/v1/products/" + productId + "/images/" + imageId)
					.with(jwt().jwt(token -> token.subject(ownerId.toString())))
			)
			.andExpect(status().isNoContent());

		verify(this.productImageRepository).delete(ownedImage);
	}

	@Test
	void nonOwnerCannotPresignProductImage() throws Exception {
		UUID productId = UUID.fromString("2fa85f64-5717-4562-b3fc-2c963f66afa1");
		UUID ownerId = UUID.fromString("2fa85f64-5717-4562-b3fc-2c963f66afa2");
		UUID nonOwnerId = UUID.fromString("2fa85f64-5717-4562-b3fc-2c963f66afa3");
		Product ownedProduct = buildProduct(productId, "Owned Product", "GPU", new BigDecimal("123.45"), false);
		ownedProduct.setCreatedByUserId(ownerId);
		when(this.productRepository.findById(productId)).thenReturn(Optional.of(ownedProduct));

		this.mockMvc
			.perform(
				post("/api/v1/products/" + productId + "/images/presign")
					.with(jwt().jwt(token -> token.subject(nonOwnerId.toString())))
					.contentType(APPLICATION_JSON)
					.content("""
						{
						  "fileName": "x.png"
						}
						""")
			)
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.status").value(403))
			.andExpect(jsonPath("$.error").value("FORBIDDEN"));
	}

	@Test
	void adminCanDeleteImageFromOfficialProduct() throws Exception {
		UUID productId = UUID.fromString("3fa85f64-5717-4562-b3fc-2c963f66afa1");
		UUID adminId = UUID.fromString("3fa85f64-5717-4562-b3fc-2c963f66afa2");
		UUID imageId = UUID.fromString("3fa85f64-5717-4562-b3fc-2c963f66afa3");

		Product officialProduct = buildProduct(productId, "Official Product", "GPU", new BigDecimal("999.99"), true);
		ProductImage officialImage = buildImage(imageId, productId, "https://cdn.example.com/a.png", 0);
		when(this.productRepository.findById(productId)).thenReturn(Optional.of(officialProduct));
		when(this.productImageRepository.findByIdAndProductId(imageId, productId)).thenReturn(Optional.of(officialImage));

		this.mockMvc
			.perform(
				delete("/api/v1/products/" + productId + "/images/" + imageId)
					.with(jwt()
						.jwt(token -> token.subject(adminId.toString()))
						.authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
			)
			.andExpect(status().isNoContent());
	}

	@Test
	void nonAdminCannotDeleteImageFromOfficialProduct() throws Exception {
		UUID productId = UUID.fromString("4fa85f64-5717-4562-b3fc-2c963f66afa1");
		UUID userId = UUID.fromString("4fa85f64-5717-4562-b3fc-2c963f66afa2");
		UUID imageId = UUID.fromString("4fa85f64-5717-4562-b3fc-2c963f66afa3");

		Product officialProduct = buildProduct(productId, "Official Product", "GPU", new BigDecimal("999.99"), true);
		when(this.productRepository.findById(productId)).thenReturn(Optional.of(officialProduct));

		this.mockMvc
			.perform(
				delete("/api/v1/products/" + productId + "/images/" + imageId)
					.with(jwt().jwt(token -> token.subject(userId.toString())))
			)
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.status").value(403))
			.andExpect(jsonPath("$.error").value("FORBIDDEN"));

		verify(this.productImageRepository, never()).delete(any(ProductImage.class));
	}

	private Product buildProduct(UUID id, String name, String category, BigDecimal price, boolean isOfficial) {
		Product product = new Product();
		product.setId(id);
		product.setName(name);
		product.setDescription("Description for " + name);
		product.setCategory(category);
		product.setPrice(price);
		product.setStockQuantity(10);
		product.setOfficial(isOfficial);
		product.setCreatedAt(OffsetDateTime.parse("2026-03-13T10:15:30Z"));
		product.setUpdatedAt(OffsetDateTime.parse("2026-03-13T10:15:30Z"));
		return product;
	}

	private ProductImage buildImage(UUID id, UUID productId, String fileUrl, int displayOrder) {
		ProductImage image = new ProductImage();
		image.setId(id);
		image.setProductId(productId);
		image.setFileUrl(fileUrl);
		image.setDisplayOrder(displayOrder);
		image.setUploadedAt(OffsetDateTime.parse("2026-03-13T10:15:30Z"));
		return image;
	}

	private Wishlist buildWishlist(UUID userId, UUID productId, OffsetDateTime addedAt) {
		Wishlist wishlist = new Wishlist();
		wishlist.setId(new WishlistId(userId, productId));
		wishlist.setAddedAt(addedAt);
		return wishlist;
	}

}
