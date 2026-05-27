import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Checkout } from './Checkout';
import * as api from '../lib/api';
import * as CartContext from '../contexts/CartContext';
import * as AuthContext from '../contexts/AuthContext';

const CART_ITEMS = [
  { productId: 'p1', productName: 'RTX 4080', priceAtPurchase: 999.99, quantity: 1 },
];

const mockClearCart = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    loggedIn: true, loading: false, userId: 'u1', login: vi.fn(), logout: vi.fn(),
  });
  vi.spyOn(CartContext, 'useCart').mockReturnValue({
    items: CART_ITEMS,
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    clearCart: mockClearCart,
    totalItems: 1,
    totalPrice: 999.99,
  });
});

function renderCheckout() {
  return render(<MemoryRouter><Checkout /></MemoryRouter>);
}

describe('Checkout — address validation', () => {
  it('shows errors when required address fields are empty', async () => {
    renderCheckout();

    await userEvent.click(screen.getByRole('button', { name: /place order/i }));

    expect(screen.getByText('Street is required')).toBeInTheDocument();
    expect(screen.getByText('City is required')).toBeInTheDocument();
    expect(screen.getByText('Country is required')).toBeInTheDocument();
  });

  it('renders order summary items', () => {
    renderCheckout();
    expect(screen.getByText(/RTX 4080 × 1/)).toBeInTheDocument();
    expect(screen.getAllByText('$999.99').length).toBeGreaterThan(0);
  });

  it('calls orders API with cart items and address on valid submit', async () => {
    const mockRequest = vi
      .spyOn(api, 'request')
      .mockResolvedValue({ id: 'order-1', userId: 'u1', status: 'CREATED', totalPrice: 999.99, createdAt: '2026-01-01T00:00:00Z' });

    renderCheckout();

    await userEvent.type(screen.getByLabelText('Street'), 'Main St 1');
    await userEvent.type(screen.getByLabelText('City'), 'Timisoara');
    await userEvent.type(screen.getByLabelText('Country'), 'Romania');
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));

    expect(mockRequest).toHaveBeenCalledOnce();
    const [url, opts] = mockRequest.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/orders');
    const body = JSON.parse(opts.body as string) as { items: unknown[]; shippingAddressSnapshot: { street: string } };
    expect(body.items).toHaveLength(1);
    expect(body.shippingAddressSnapshot.street).toBe('Main St 1');
  });

  it('clears the cart after successful order', async () => {
    vi.spyOn(api, 'request').mockResolvedValue({ id: 'order-1', userId: 'u1', status: 'CREATED', totalPrice: 999.99, createdAt: '2026-01-01T00:00:00Z' });

    renderCheckout();

    await userEvent.type(screen.getByLabelText('Street'), 'Main St 1');
    await userEvent.type(screen.getByLabelText('City'), 'Timisoara');
    await userEvent.type(screen.getByLabelText('Country'), 'Romania');
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));

    expect(mockClearCart).toHaveBeenCalledOnce();
  });

  it('shows error message when API fails', async () => {
    vi.spyOn(api, 'request').mockRejectedValue(new api.ApiError(400, 'Items list is empty'));

    renderCheckout();

    await userEvent.type(screen.getByLabelText('Street'), 'Main St 1');
    await userEvent.type(screen.getByLabelText('City'), 'Timisoara');
    await userEvent.type(screen.getByLabelText('Country'), 'Romania');
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));

    expect(await screen.findByText('Items list is empty')).toBeInTheDocument();
  });

  it('shows insufficient stock error when API returns 409', async () => {
    vi.spyOn(api, 'request').mockRejectedValue(new api.ApiError(409, 'Insufficient stock.'));

    renderCheckout();

    await userEvent.type(screen.getByLabelText('Street'), 'Main St 1');
    await userEvent.type(screen.getByLabelText('City'), 'Timisoara');
    await userEvent.type(screen.getByLabelText('Country'), 'Romania');
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));

    expect(await screen.findByText('Insufficient stock.')).toBeInTheDocument();
  });
});
