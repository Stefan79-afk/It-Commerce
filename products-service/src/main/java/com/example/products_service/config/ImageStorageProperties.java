package com.example.products_service.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
@ConfigurationProperties(prefix = "products.images")
public class ImageStorageProperties {

    private final S3 s3 = new S3();

    private Duration presignTtl = Duration.ofMinutes(15);

    private String stubBaseUrl = "https://stub-upload.local";

    public S3 getS3() {
        return this.s3;
    }

    public Duration getPresignTtl() {
        return this.presignTtl;
    }

    public void setPresignTtl(Duration presignTtl) {
        this.presignTtl = presignTtl;
    }

    public String getStubBaseUrl() {
        return this.stubBaseUrl;
    }

    public void setStubBaseUrl(String stubBaseUrl) {
        this.stubBaseUrl = stubBaseUrl;
    }

    public boolean hasS3Configuration() {
        return StringUtils.hasText(this.s3.getBucket()) && StringUtils.hasText(this.s3.getRegion());
    }

    public static class S3 {

        private String bucket = "";

        private String region = "";

        public String getBucket() {
            return this.bucket;
        }

        public void setBucket(String bucket) {
            this.bucket = bucket;
        }

        public String getRegion() {
            return this.region;
        }

        public void setRegion(String region) {
            this.region = region;
        }
    }
}
