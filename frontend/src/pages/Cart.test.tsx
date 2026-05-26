import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cart } from './Cart';
import * as CartContext from '../contexts/CartContext';
import * as AuthContext from '../contexts/AuthContext';

const mockRemoveItem = vi.fn();
const mockUpdateQuantity = vi.fn();

const CART_ITEMS = [
  { productId: 'p1', productName: 'RTX 4080', priceAtPurchase: 999.99, quantity: 2 },
  { productId: 'p2', productName: 'Ryzen 9', priceAtPurchase: 299.99, quantity: 1 },
];

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    loggedIn: false, loading: false, userId: null, login: vi.fn(), logout: vi.fn(),
  });
});

function renderCart(items = CART_ITEMS) {
  vi.spyOn(CartContext, 'useCart').mockReturnValue({
    items,
    addItem: vi.fn(),
    removeItem: mockRemoveItem,
    updateQuantity: mockUpdateQuantity,
    clearCart: vi.fn(),
    totalItems: items.reduce((s, i) => s + i.quantity, 0),
    totalPrice: items.reduce((s, i) => s + i.priceAtPurchase * i.quantity, 0),
  });
  return render(<MemoryRouter><Cart /></MemoryRouter>);
}

describe('Cart', () => {
  it('renders item names and prices', () => {
    renderCart();
    expect(screen.getByText('RTX 4080')).toBeInTheDocument();
    expect(screen.getByText('Ryzen 9')).toBeInTheDocument();
    expect(screen.getByText('$999.99 each')).toBeInTheDocument();
  });

  it('shows correct line subtotals and total', () => {
    renderCart();
    // 999.99 × 2
    expect(screen.getByText('$1999.98')).toBeInTheDocument();
    // grand total: 1999.98 + 299.99
    expect(screen.getByText('$2299.97')).toBeInTheDocument();
  });

  it('shows empty-cart message when cart has no items', () => {
    renderCart([]);
    expect(screen.getByText(/cart is empty/i)).toBeInTheDocument();
    expect(screen.queryByText(/proceed to checkout/i)).not.toBeInTheDocument();
  });

  it('calls removeItem when Remove is clicked', async () => {
    renderCart();
    const removeBtns = screen.getAllByRole('button', { name: /remove/i });
    await userEvent.click(removeBtns[0]);
    expect(mockRemoveItem).toHaveBeenCalledWith('p1');
  });

  it('calls updateQuantity with +1 when increase button clicked', async () => {
    renderCart();
    const incBtns = screen.getAllByRole('button', { name: /increase quantity/i });
    await userEvent.click(incBtns[0]);
    expect(mockUpdateQuantity).toHaveBeenCalledWith('p1', 3);
  });

  it('calls updateQuantity with -1 when decrease button clicked', async () => {
    renderCart();
    const decBtns = screen.getAllByRole('button', { name: /decrease quantity/i });
    await userEvent.click(decBtns[0]);
    expect(mockUpdateQuantity).toHaveBeenCalledWith('p1', 1);
  });
});
