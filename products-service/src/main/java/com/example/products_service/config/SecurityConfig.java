package com.example.products_service.config;

import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

import com.example.products_service.errors.StandardAccessDeniedHandler;
import com.example.products_service.errors.StandardAuthenticationEntryPoint;
import com.github.benmanes.caffeine.cache.Caffeine;

import org.springframework.cache.Cache;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.web.client.RestOperations;
import org.springframework.web.client.RestTemplate;

@Configuration
public class SecurityConfig {

    private static final String JWKS_CACHE_NAME = "jwks";

    @Bean
    public SecurityFilterChain securityFilterChain(
        HttpSecurity http,
        AuthenticationEntryPoint authenticationEntryPoint,
        AccessDeniedHandler accessDeniedHandler,
        JwtDecoder jwtDecoder,
        Converter<Jwt, ? extends AbstractAuthenticationToken> jwtAuthenticationConverter
    ) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(authorize -> authorize
                .requestMatchers(HttpMethod.GET, "/api/v1/health").permitAll()
                .requestMatchers("/error").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/products").authenticated()
                .requestMatchers(HttpMethod.PATCH, "/api/v1/products/*").authenticated()
                .requestMatchers(HttpMethod.DELETE, "/api/v1/products/*").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/v1/products/*/images/presign").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/v1/products/*/images/confirm").authenticated()
                .requestMatchers(HttpMethod.PUT, "/api/v1/products/*/images/*").authenticated()
                .requestMatchers(HttpMethod.DELETE, "/api/v1/products/*/images/*").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/v1/products/wishlists/*").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/v1/products/wishlists/*/*").authenticated()
                .requestMatchers(HttpMethod.DELETE, "/api/v1/products/wishlists/*/*").authenticated()
                .anyRequest().permitAll()
            )
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint(authenticationEntryPoint)
                .accessDeniedHandler(accessDeniedHandler)
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .authenticationEntryPoint(authenticationEntryPoint)
                .accessDeniedHandler(accessDeniedHandler)
                .jwt(jwt -> jwt
                    .decoder(jwtDecoder)
                    .jwtAuthenticationConverter(jwtAuthenticationConverter)
                )
            );

        return http.build();
    }

    @Bean
    public AuthenticationEntryPoint authenticationEntryPoint() {
        return new StandardAuthenticationEntryPoint();
    }

    @Bean
    public AccessDeniedHandler accessDeniedHandler() {
        return new StandardAccessDeniedHandler();
    }

    @Bean
    public RestOperations jwksRestOperations() {
        return new RestTemplate();
    }

    @Bean
    public Cache jwksCache(JwtSecurityProperties jwtSecurityProperties) {
        return new CaffeineCache(
            JWKS_CACHE_NAME,
            Caffeine.newBuilder()
                .maximumSize(10)
                .expireAfterWrite(jwtSecurityProperties.getJwksCacheTtl())
                .build()
        );
    }

    @Bean
    public JwtDecoder jwtDecoder(
        JwtSecurityProperties jwtSecurityProperties,
        RestOperations jwksRestOperations,
        Cache jwksCache
    ) {
        NimbusJwtDecoder jwtDecoder = NimbusJwtDecoder.withJwkSetUri(jwtSecurityProperties.getJwksUrl())
            .jwsAlgorithm(SignatureAlgorithm.RS256)
            .restOperations(jwksRestOperations)
            .cache(jwksCache)
            .build();

        OAuth2TokenValidator<Jwt> withIssuer = JwtValidators.createDefaultWithIssuer(jwtSecurityProperties.getIssuer());
        OAuth2TokenValidator<Jwt> withAudience = new JwtAudienceValidator(jwtSecurityProperties.getAudience());

        jwtDecoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(withIssuer, withAudience));
        return jwtDecoder;
    }

    @Bean
    public Converter<Jwt, ? extends AbstractAuthenticationToken> jwtAuthenticationConverter() {
        JwtAuthenticationConverter jwtAuthenticationConverter = new JwtAuthenticationConverter();
        jwtAuthenticationConverter.setPrincipalClaimName("sub");
        jwtAuthenticationConverter.setJwtGrantedAuthoritiesConverter(this::extractRoleAuthorities);
        return jwtAuthenticationConverter;
    }

    private Collection<GrantedAuthority> extractRoleAuthorities(Jwt jwt) {
        Object rolesClaim = jwt.getClaims().get("roles");
        if (!(rolesClaim instanceof Collection<?> roles)) {
            return List.of();
        }

        return roles.stream()
            .filter(Objects::nonNull)
            .map(Object::toString)
            .map(String::trim)
            .filter(role -> !role.isEmpty())
            .map(role -> role.startsWith("ROLE_") ? role : "ROLE_" + role)
            .map(SimpleGrantedAuthority::new)
            .collect(Collectors.toList());
    }
}
