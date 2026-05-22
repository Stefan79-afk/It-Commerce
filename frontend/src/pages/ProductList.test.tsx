import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductList } from './ProductList';
import * as api from '../lib/api';
import * as AuthContext from '../contexts/AuthContext';
import * as CartContext from '../contexts/CartContext';

const MOCK_PAGE = {
  content: [
    { id: 'p1', name: 'RTX 4080', category: 'GPU', price: 999.99, isOfficial: true },
    { id: 'p2', name: 'Used RTX 3070', category: 'GPU', price: 350.0, isOfficial: false },
  ],
  page: 0,
  size: 20,
  totalElements: 2,
  totalPages: 1,
};

const MOCK_PAGE_MULTI = { ...MOCK_PAGE, totalPages: 3, totalElements: 60 };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    loggedIn: false, loading: false, userId: null, login: vi.fn(), logout: vi.fn(),
  });
  vi.spyOn(CartContext, 'useCart').mockReturnValue({
    items: [], addItem: vi.fn(), removeItem: vi.fn(), updateQuantity: vi.fn(),
    clearCart: vi.fn(), totalItems: 0, totalPrice: 0,
  });
});

function renderProductList() {
  return render(
    <MemoryRouter>
      <ProductList />
    </MemoryRouter>,
  );
}

describe('ProductList', () => {
  it('renders product cards from API response', async () => {
    vi.spyOn(api, 'request').mockResolvedValue(MOCK_PAGE);
    renderProductList();

    expect(await screen.findByText('RTX 4080')).toBeInTheDocument();
    expect(screen.getByText('Used RTX 3070')).toBeInTheDocument();
    expect(screen.getByText('$999.99')).toBeInTheDocument();
    expect(screen.getByText('$350.00')).toBeInTheDocument();
  });

  it('shows loading message initially', () => {
    vi.spyOn(api, 'request').mockReturnValue(new Promise(() => undefined));
    renderProductList();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows error message when API fails', async () => {
    vi.spyOn(api, 'request').mockRejectedValue(new Error('Network error'));
    renderProductList();

    expect(await screen.findByText('Network error')).toBeInTheDocument();
  });

  it('shows pagination when totalPages > 1', async () => {
    vi.spyOn(api, 'request').mockResolvedValue(MOCK_PAGE_MULTI);
    renderProductList();

    expect(await screen.findByText(/Page 1 of 3/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });

  it('fetches next page when Next is clicked', async () => {
    const mockRequest = vi.spyOn(api, 'request').mockResolvedValue(MOCK_PAGE_MULTI);
    renderProductList();

    await screen.findByText(/Page 1 of 3/);
    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[1][0]).toContain('page=1');
  });
});
