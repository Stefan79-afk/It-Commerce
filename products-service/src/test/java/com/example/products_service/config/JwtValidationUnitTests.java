package com.example.products_service.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.cache.Cache;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.web.client.RestOperations;
import org.springframework.web.client.RestTemplate;

class JwtValidationUnitTests {

    private static final String JWKS_PATH = "/.well-known/jwks.json";
    private static final String SUBJECT = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

    private final AtomicInteger jwksRequestCount = new AtomicInteger();

    private HttpServer jwksServer;

    private RSAKey rsaKey;

    private String jwksUrl;

    @BeforeEach
    void setUp() throws Exception {
        this.rsaKey = new RSAKeyGenerator(2048).keyID("test-key").generate();
        this.jwksServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        this.jwksServer.createContext(JWKS_PATH, exchange -> {
            this.jwksRequestCount.incrementAndGet();
            byte[] response = new JWKSet(this.rsaKey.toPublicJWK()).toString().getBytes();
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            try (OutputStream outputStream = exchange.getResponseBody()) {
                outputStream.write(response);
            }
        });
        this.jwksServer.start();
        this.jwksUrl = "http://127.0.0.1:" + this.jwksServer.getAddress().getPort() + JWKS_PATH;
    }

    @AfterEach
    void tearDown() {
        if (this.jwksServer != null) {
            this.jwksServer.stop(0);
        }
    }

    @Test
    void validatesJwtAndCachesJwksFromUsersService() throws Exception {
        JwtSecurityProperties properties = new JwtSecurityProperties();
        properties.setJwksUrl(this.jwksUrl);
        properties.setJwksCacheTtl(Duration.ofMinutes(5));
        properties.setIssuer("itcommerce-users");
        properties.setAudience("itcommerce-api");

        SecurityConfig securityConfig = new SecurityConfig();
        Cache jwksCache = securityConfig.jwksCache(properties);
        RestOperations restOperations = new RestTemplate();
        JwtDecoder jwtDecoder = securityConfig.jwtDecoder(properties, restOperations, jwksCache);
        Converter<Jwt, ? extends AbstractAuthenticationToken> authConverter = securityConfig.jwtAuthenticationConverter();

        String token = createToken(this.rsaKey);

        Jwt firstDecode = jwtDecoder.decode(token);
        Jwt secondDecode = jwtDecoder.decode(token);

        assertThat(firstDecode.getSubject()).isEqualTo(SUBJECT);
        assertThat(secondDecode.getSubject()).isEqualTo(SUBJECT);
        assertThat(this.jwksRequestCount.get()).isEqualTo(1);

        AbstractAuthenticationToken authentication = authConverter.convert(firstDecode);
        assertThat(authentication).isNotNull();
        assertThat(authentication.getName()).isEqualTo(SUBJECT);
        assertThat(authentication.getAuthorities())
            .extracting(GrantedAuthority::getAuthority)
            .contains("ROLE_USER", "ROLE_ADMIN");
    }

    private static String createToken(RSAKey rsaKey) throws Exception {
        Instant now = Instant.now();
        JWTClaimsSet claimsSet = new JWTClaimsSet.Builder()
            .issuer("itcommerce-users")
            .audience("itcommerce-api")
            .subject(SUBJECT)
            .issueTime(Date.from(now))
            .expirationTime(Date.from(now.plusSeconds(300)))
            .jwtID(UUID.randomUUID().toString())
            .claim("roles", List.of("USER", "ADMIN"))
            .build();

        JWSHeader header = new JWSHeader.Builder(JWSAlgorithm.RS256)
            .type(JOSEObjectType.JWT)
            .keyID(rsaKey.getKeyID())
            .build();

        SignedJWT signedJwt = new SignedJWT(header, claimsSet);
        signedJwt.sign(new RSASSASigner(rsaKey.toPrivateKey()));
        return signedJwt.serialize();
    }
}
