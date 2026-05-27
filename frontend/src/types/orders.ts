export type OrderStatus = 'CREATED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface ShippingAddressSnapshot {
  street: string;
  postalCode?: string;
  city: string;
  county?: string;
  country: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  priceAtPurchase: number;
  quantity: number;
}

/** Same shape as OrderItem; used locally before an order is placed. */
export interface CartItem {
  productId: string;
  productName: string;
  priceAtPurchase: number;
  quantity: number;
  stockQuantity?: number;
}

export interface OrderSummary {
  id: string;
  userId: string;
  status: OrderStatus;
  totalPrice: number;
  createdAt: string;
}

export interface Order extends OrderSummary {
  shippingAddressSnapshot?: ShippingAddressSnapshot;
  items?: OrderItem[];
  updatedAt?: string;
}
