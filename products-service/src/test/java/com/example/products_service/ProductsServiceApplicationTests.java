package com.example.products_service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.example.products_service.entities.Product;
import com.example.products_service.entities.ProductImage;
import com.example.products_service.repositories.ProductImageRepository;
import com.example.products_service.repositories.ProductRepository;

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

	@BeforeEach
	void setUp() {
		when(this.jdbcTemplate.queryForObject("SELECT 1", Integer.class)).thenReturn(1);
		when(this.productRepository.findAll(any(Pageable.class))).thenReturn(Page.empty());
		when(this.productRepository.findById(any(UUID.class))).thenReturn(Optional.empty());
		when(this.productImageRepository.findByProductIdInOrderByProductIdAscDisplayOrderAscUploadedAtAsc(anyCollection()))
			.thenReturn(List.of());
		when(this.productImageRepository.findByProductIdOrderByDisplayOrderAscUploadedAtAsc(any(UUID.class)))
			.thenReturn(List.of());
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

}
