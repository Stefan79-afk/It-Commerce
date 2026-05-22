import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Wishlist } from './Wishlist';
import * as api from '../lib/api';
import * as AuthContext from '../contexts/AuthContext';

const MOCK_WISHLIST_PAGE = {
  content: [
    { userId: 'user-1', productId: 'prod-1', addedAt: '2026-01-15T10:00:00Z' },
    { userId: 'user-1', productId: 'prod-2', addedAt: '2026-01-16T10:00:00Z' },
  ],
  page: 0,
  size: 20,
  totalElements: 2,
  totalPages: 1,
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    loggedIn: true,
    loading: false,
    userId: 'user-1',
    login: vi.fn(),
    logout: vi.fn(),
  });
});

function renderWishlist() {
  return render(
    <MemoryRouter>
      <Wishlist />
    </MemoryRouter>,
  );
}

describe('Wishlist', () => {
  it('renders wishlist items', async () => {
    vi.spyOn(api, 'request').mockResolvedValue(MOCK_WISHLIST_PAGE);
    renderWishlist();

    // Two "View Product" links expected
    const links = await screen.findAllByText('View Product');
    expect(links).toHaveLength(2);
  });

  it('shows empty state when wishlist is empty', async () => {
    vi.spyOn(api, 'request').mockResolvedValue({
      ...MOCK_WISHLIST_PAGE,
      content: [],
      totalElements: 0,
    });
    renderWishlist();

    expect(await screen.findByText(/wishlist is empty/i)).toBeInTheDocument();
  });

  it('removes item from list after clicking Remove', async () => {
    const mockRequest = vi
      .spyOn(api, 'request')
      .mockResolvedValueOnce(MOCK_WISHLIST_PAGE) // initial fetch
      .mockResolvedValueOnce(undefined);         // DELETE

    renderWishlist();
    const removeBtns = await screen.findAllByRole('button', { name: /remove/i });
    await userEvent.click(removeBtns[0]);

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[1][0]).toContain('/wishlists/user-1/prod-1');
    expect(mockRequest.mock.calls[1][1]).toMatchObject({ method: 'DELETE' });

    // Item should disappear from the list
    const linksAfter = screen.queryAllByText('View Product');
    expect(linksAfter).toHaveLength(1);
  });

  it('shows error when API fails', async () => {
    vi.spyOn(api, 'request').mockRejectedValue(new Error('Network error'));
    renderWishlist();

    expect(await screen.findByText('Network error')).toBeInTheDocument();
  });
});
