import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderDetail } from './OrderDetail';
import * as api from '../lib/api';
import * as AuthContext from '../contexts/AuthContext';
import * as CartContext from '../contexts/CartContext';
import type { Order } from '../types/orders';

const MOCK_ORDER_CREATED: Order = {
  id: 'o1',
  userId: 'u1',
  status: 'CREATED',
  totalPrice: 999.99,
  createdAt: '2026-01-10T10:00:00Z',
  shippingAddressSnapshot: { street: 'Main St 1', city: 'Timisoara', country: 'Romania' },
  items: [{ productId: 'p1', productName: 'RTX 4080', priceAtPurchase: 999.99, quantity: 1 }],
};

const MOCK_ORDER_DELIVERED: Order = { ...MOCK_ORDER_CREATED, status: 'DELIVERED' };
const MOCK_ORDER_CANCELLED: Order = { ...MOCK_ORDER_CREATED, status: 'CANCELLED' };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    loggedIn: true, loading: false, userId: 'u1', login: vi.fn(), logout: vi.fn(),
  });
  vi.spyOn(CartContext, 'useCart').mockReturnValue({
    items: [], addItem: vi.fn(), removeItem: vi.fn(), updateQuantity: vi.fn(),
    clearCart: vi.fn(), totalItems: 0, totalPrice: 0,
  });
});

function renderOrderDetail(orderId = 'o1') {
  return render(
    <MemoryRouter initialEntries={[`/orders/${orderId}`]}>
      <Routes>
        <Route path="/orders/:orderId" element={<OrderDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OrderDetail', () => {
  it('renders order status, total and item name', async () => {
    vi.spyOn(api, 'request').mockResolvedValue(MOCK_ORDER_CREATED);
    renderOrderDetail();

    expect(await screen.findByText('CREATED')).toBeInTheDocument();
    expect(screen.getAllByText('$999.99').length).toBeGreaterThan(0);
    expect(screen.getByText('RTX 4080')).toBeInTheDocument();
  });

  it('renders shipping address', async () => {
    vi.spyOn(api, 'request').mockResolvedValue(MOCK_ORDER_CREATED);
    renderOrderDetail();

    expect(await screen.findByText('Main St 1')).toBeInTheDocument();
    expect(screen.getByText('Romania')).toBeInTheDocument();
  });

  it('shows Cancel Order button for CREATED status', async () => {
    vi.spyOn(api, 'request').mockResolvedValue(MOCK_ORDER_CREATED);
    renderOrderDetail();

    expect(await screen.findByRole('button', { name: /cancel order/i })).toBeInTheDocument();
  });

  it('does not show Cancel button for DELIVERED status', async () => {
    vi.spyOn(api, 'request').mockResolvedValue(MOCK_ORDER_DELIVERED);
    renderOrderDetail();

    await screen.findByText('DELIVERED');
    expect(screen.queryByRole('button', { name: /cancel order/i })).not.toBeInTheDocument();
  });

  it('does not show Cancel button for already CANCELLED orders', async () => {
    vi.spyOn(api, 'request').mockResolvedValue(MOCK_ORDER_CANCELLED);
    renderOrderDetail();

    await screen.findByText('CANCELLED');
    expect(screen.queryByRole('button', { name: /cancel order/i })).not.toBeInTheDocument();
  });

  it('calls PATCH with CANCELLED status and updates UI', async () => {
    const mockRequest = vi.spyOn(api, 'request')
      .mockResolvedValueOnce(MOCK_ORDER_CREATED)
      .mockResolvedValueOnce({ ...MOCK_ORDER_CREATED, status: 'CANCELLED' });

    renderOrderDetail();
    await userEvent.click(await screen.findByRole('button', { name: /cancel order/i }));

    expect(mockRequest).toHaveBeenCalledTimes(2);
    const [, opts] = mockRequest.mock.calls[1] as [string, RequestInit];
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body as string)).toEqual({ status: 'CANCELLED' });

    expect(await screen.findByText('CANCELLED')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel order/i })).not.toBeInTheDocument();
  });
});
