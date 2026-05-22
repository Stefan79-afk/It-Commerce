import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductDetail } from './ProductDetail';
import * as api from '../lib/api';
import * as AuthContext from '../contexts/AuthContext';
import * as CartContext from '../contexts/CartContext';

const MOCK_PRODUCT = {
  id: 'p1',
  name: 'RTX 4080',
  category: 'GPU',
  price: 999.99,
  isOfficial: true,
  description: 'High performance GPU',
  stockQuantity: 10,
  createdByUserId: null,
  technicalSpecs: { memory: '16GB' },
  images: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function renderDetail(loggedIn = false, userId: string | null = null) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    loggedIn,
    loading: false,
    userId,
    login: vi.fn(),
    logout: vi.fn(),
  });

  return render(
    <MemoryRouter initialEntries={['/products/p1']}>
      <Routes>
        <Route path="/products/:productId" element={<ProductDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(CartContext, 'useCart').mockReturnValue({
    items: [], addItem: vi.fn(), removeItem: vi.fn(), updateQuantity: vi.fn(),
    clearCart: vi.fn(), totalItems: 0, totalPrice: 0,
  });
});

describe('ProductDetail', () => {
  it('renders product name, price and description', async () => {
    vi.spyOn(api, 'request').mockResolvedValue(MOCK_PRODUCT);
    renderDetail();

    expect(await screen.findByText('RTX 4080')).toBeInTheDocument();
    expect(screen.getByText('$999.99')).toBeInTheDocument();
    expect(screen.getByText('High performance GPU')).toBeInTheDocument();
  });

  it('renders technical specs', async () => {
    vi.spyOn(api, 'request').mockResolvedValue(MOCK_PRODUCT);
    renderDetail();

    expect(await screen.findByText('memory')).toBeInTheDocument();
    expect(screen.getByText('16GB')).toBeInTheDocument();
  });

  it('shows Add to Wishlist button when authenticated', async () => {
    vi.spyOn(api, 'request').mockResolvedValue(MOCK_PRODUCT);
    renderDetail(true, 'user-uuid-1');

    expect(await screen.findByRole('button', { name: /add to wishlist/i })).toBeInTheDocument();
  });

  it('does not show wishlist button when not authenticated', async () => {
    vi.spyOn(api, 'request').mockResolvedValue(MOCK_PRODUCT);
    renderDetail(false, null);

    await screen.findByText('RTX 4080');
    expect(screen.queryByRole('button', { name: /wishlist/i })).not.toBeInTheDocument();
  });

  it('switches to Remove after clicking Add to Wishlist', async () => {
    const mockRequest = vi
      .spyOn(api, 'request')
      .mockResolvedValueOnce(MOCK_PRODUCT) // product fetch
      .mockResolvedValueOnce(undefined);   // wishlist add

    renderDetail(true, 'user-uuid-1');

    const addBtn = await screen.findByRole('button', { name: /add to wishlist/i });
    await userEvent.click(addBtn);

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[1][0]).toContain('/wishlists/user-uuid-1/p1');
    expect(await screen.findByRole('button', { name: /remove from wishlist/i })).toBeInTheDocument();
  });

  it('handles 409 on Add (already wishlisted) by switching to Remove state', async () => {
    vi.spyOn(api, 'request')
      .mockResolvedValueOnce(MOCK_PRODUCT)
      .mockRejectedValueOnce(new api.ApiError(409, 'Already in wishlist'));

    renderDetail(true, 'user-uuid-1');
    await userEvent.click(await screen.findByRole('button', { name: /add to wishlist/i }));

    expect(await screen.findByRole('button', { name: /remove from wishlist/i })).toBeInTheDocument();
  });
});
