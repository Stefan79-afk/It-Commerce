package com.example.products_service.services;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;

import com.example.products_service.api.ImagePresignRequest;
import com.example.products_service.api.ImagePresignResponse;
import com.example.products_service.config.ImageStorageProperties;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

@Service
public class S3ImagePresignService implements ImagePresignService {

    private final ImageStorageProperties imageStorageProperties;

    public S3ImagePresignService(ImageStorageProperties imageStorageProperties) {
        this.imageStorageProperties = imageStorageProperties;
    }

    @Override
    public ImagePresignResponse createPresign(UUID productId, UUID imageId, ImagePresignRequest request) {
        String sanitizedFileName = sanitizeFileName(request.fileName());
        String objectKey = buildObjectKey(productId, imageId, sanitizedFileName);
        int expiresIn = Math.toIntExact(Math.max(1L, resolveTtl().toSeconds()));

        String uploadUrl;
        if (this.imageStorageProperties.hasS3Configuration()) {
            uploadUrl = generateS3PresignedUrlOrNull(objectKey, request.contentType());
            if (uploadUrl != null) {
                return new ImagePresignResponse(imageId, uploadUrl, expiresIn);
            }
        }

        uploadUrl = buildStubUploadUrl(productId, imageId, sanitizedFileName);
        return new ImagePresignResponse(imageId, uploadUrl, expiresIn);
    }

    private String generateS3PresignedUrlOrNull(String objectKey, String contentType) {
        String bucket = this.imageStorageProperties.getS3().getBucket();
        String region = this.imageStorageProperties.getS3().getRegion();

        try (
            DefaultCredentialsProvider credentialsProvider = DefaultCredentialsProvider.create();
            S3Presigner presigner = S3Presigner.builder()
                .region(Region.of(region))
                .credentialsProvider(credentialsProvider)
                .build()
        ) {
            credentialsProvider.resolveCredentials();

            PutObjectRequest.Builder putObjectBuilder = PutObjectRequest.builder()
                .bucket(bucket)
                .key(objectKey);
            if (StringUtils.hasText(contentType)) {
                putObjectBuilder.contentType(contentType.trim());
            }

            PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(resolveTtl())
                .putObjectRequest(putObjectBuilder.build())
                .build();

            PresignedPutObjectRequest presignedPutObjectRequest = presigner.presignPutObject(presignRequest);
            return presignedPutObjectRequest.url().toString();
        } catch (SdkClientException | IllegalArgumentException ex) {
            return null;
        }
    }

    @Override
    public String resolveViewUrl(String storedUrl) {
        if (storedUrl == null || !this.imageStorageProperties.hasS3Configuration()) {
            return storedUrl;
        }

        String bucket = this.imageStorageProperties.getS3().getBucket();
        String region = this.imageStorageProperties.getS3().getRegion();
        String s3Prefix = "https://" + bucket + ".s3." + region + ".amazonaws.com/";

        if (!storedUrl.startsWith(s3Prefix)) {
            return storedUrl;
        }

        String objectKey = storedUrl.substring(s3Prefix.length());
        String presignedUrl = generateS3PresignedGetUrlOrNull(objectKey);
        return presignedUrl != null ? presignedUrl : storedUrl;
    }

    private String generateS3PresignedGetUrlOrNull(String objectKey) {
        String bucket = this.imageStorageProperties.getS3().getBucket();
        String region = this.imageStorageProperties.getS3().getRegion();

        try (
            DefaultCredentialsProvider credentialsProvider = DefaultCredentialsProvider.create();
            S3Presigner presigner = S3Presigner.builder()
                .region(Region.of(region))
                .credentialsProvider(credentialsProvider)
                .build()
        ) {
            credentialsProvider.resolveCredentials();

            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(resolveTtl())
                .getObjectRequest(GetObjectRequest.builder()
                    .bucket(bucket)
                    .key(objectKey)
                    .build())
                .build();

            return presigner.presignGetObject(presignRequest).url().toString();
        } catch (SdkClientException | IllegalArgumentException ex) {
            return null;
        }
    }

    private Duration resolveTtl() {
        Duration configured = this.imageStorageProperties.getPresignTtl();
        if (configured == null || configured.isNegative() || configured.isZero()) {
            return Duration.ofMinutes(15);
        }
        return configured;
    }

    private String buildObjectKey(UUID productId, UUID imageId, String sanitizedFileName) {
        return "products/" + productId + "/" + imageId + "/" + sanitizedFileName;
    }

    private String buildStubUploadUrl(UUID productId, UUID imageId, String fileName) {
        String baseUrl = trimTrailingSlash(this.imageStorageProperties.getStubBaseUrl());
        String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");
        return baseUrl + "/products/" + productId + "/images/" + imageId + "/" + encodedFileName;
    }

    private String sanitizeFileName(String fileName) {
        String candidate = fileName == null ? "" : fileName.replace('\\', '/');
        int lastSlashIndex = candidate.lastIndexOf('/');
        if (lastSlashIndex >= 0) {
            candidate = candidate.substring(lastSlashIndex + 1);
        }

        String sanitized = candidate.replaceAll("[^A-Za-z0-9._-]", "_");
        if (!StringUtils.hasText(sanitized)) {
            return "upload.bin";
        }
        return sanitized;
    }

    private String trimTrailingSlash(String url) {
        if (!StringUtils.hasText(url)) {
            return "https://stub-upload.local";
        }

        int endIndex = url.length();
        while (endIndex > 0 && url.charAt(endIndex - 1) == '/') {
            endIndex--;
        }

        return endIndex == 0 ? "https://stub-upload.local" : url.substring(0, endIndex);
    }
}
