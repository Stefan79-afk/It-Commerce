import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderList } from './OrderList';
import * as api from '../lib/api';
import * as AuthContext from '../contexts/AuthContext';
import * as CartContext from '../contexts/CartContext';

const MOCK_PAGE = {
  content: [
    { id: 'o1', userId: 'u1', status: 'CREATED',    totalPrice: 999.99,  createdAt: '2026-01-10T10:00:00Z' },
    { id: 'o2', userId: 'u1', status: 'DELIVERED',  totalPrice: 1299.00, createdAt: '2026-01-05T10:00:00Z' },
  ],
  page: 0, size: 20, totalElements: 2, totalPages: 1,
};

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

function renderOrderList() {
  return render(<MemoryRouter><OrderList /></MemoryRouter>);
}

describe('OrderList', () => {
  it('renders orders with status badge and total', async () => {
    vi.spyOn(api, 'request').mockResolvedValue(MOCK_PAGE);
    renderOrderList();

    expect(await screen.findByText('CREATED')).toBeInTheDocument();
    expect(screen.getByText('DELIVERED')).toBeInTheDocument();
    expect(screen.getByText('$999.99')).toBeInTheDocument();
    expect(screen.getByText('$1299.00')).toBeInTheDocument();
  });

  it('shows loading message initially', () => {
    vi.spyOn(api, 'request').mockReturnValue(new Promise(() => undefined));
    renderOrderList();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows empty state when no orders', async () => {
    vi.spyOn(api, 'request').mockResolvedValue({ ...MOCK_PAGE, content: [], totalElements: 0 });
    renderOrderList();
    expect(await screen.findByText(/no orders yet/i)).toBeInTheDocument();
  });

  it('fetches next page when Next is clicked', async () => {
    const mockRequest = vi.spyOn(api, 'request').mockResolvedValue({ ...MOCK_PAGE, totalPages: 3 });
    renderOrderList();

    await screen.findByText('CREATED');
    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[1][0]).toContain('page=1');
  });
});
