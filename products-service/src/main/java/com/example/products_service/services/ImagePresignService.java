package com.example.products_service.services;

import java.util.UUID;

import com.example.products_service.api.ImagePresignRequest;
import com.example.products_service.api.ImagePresignResponse;

public interface ImagePresignService {

    ImagePresignResponse createPresign(UUID productId, UUID imageId, ImagePresignRequest request);
}
