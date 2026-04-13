package com.example.products_service.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "products.security.jwt")
public class JwtSecurityProperties {

    private String jwksUrl;

    private Duration jwksCacheTtl = Duration.ofMinutes(5);

    private String issuer;

    private String audience;

    public String getJwksUrl() {
        return this.jwksUrl;
    }

    public void setJwksUrl(String jwksUrl) {
        this.jwksUrl = jwksUrl;
    }

    public Duration getJwksCacheTtl() {
        return this.jwksCacheTtl;
    }

    public void setJwksCacheTtl(Duration jwksCacheTtl) {
        this.jwksCacheTtl = jwksCacheTtl;
    }

    public String getIssuer() {
        return this.issuer;
    }

    public void setIssuer(String issuer) {
        this.issuer = issuer;
    }

    public String getAudience() {
        return this.audience;
    }

    public void setAudience(String audience) {
        this.audience = audience;
    }
}
