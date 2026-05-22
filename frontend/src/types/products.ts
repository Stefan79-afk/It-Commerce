export interface ProductSummary {
  id: string;
  name: string;
  category: string;
  price: number;
  isOfficial: boolean;
  thumbnailUrl?: string;
}

export interface ProductImage {
  id: string;
  fileUrl: string;
  displayOrder: number;
  uploadedAt?: string;
}

export interface Product extends ProductSummary {
  description?: string;
  stockQuantity?: number;
  createdByUserId: string | null;
  technicalSpecs?: Record<string, string>;
  images?: ProductImage[];
  createdAt?: string;
  updatedAt?: string;
}

export interface WishlistItem {
  userId: string;
  productId: string;
  addedAt?: string;
}

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
