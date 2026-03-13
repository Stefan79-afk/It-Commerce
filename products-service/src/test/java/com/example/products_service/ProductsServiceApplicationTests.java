package com.example.products_service;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessResourceFailureException;
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

	@BeforeEach
	void setUp() {
		when(this.jdbcTemplate.queryForObject("SELECT 1", Integer.class)).thenReturn(1);
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

}
