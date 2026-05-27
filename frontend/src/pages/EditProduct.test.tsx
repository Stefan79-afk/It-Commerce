import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditProduct } from './EditProduct';
import * as api from '../lib/api';
import * as AuthContext from '../contexts/AuthContext';
import * as CartContext from '../contexts/CartContext';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return { ...mod, useNavigate: () => mockNavigate };
});

const MOCK_PRODUCT = {
  id: 'p1',
  name: 'RTX 4080',
  category: 'GPU',
  price: 999.99,
  isOfficial: false,
  description: 'High performance GPU',
  stockQuantity: 10,
  createdByUserId: 'user-uuid-1',
  technicalSpecs: {},
  images: [
    { id: 'img-1', fileUrl: 'https://cdn.example.com/img.png', displayOrder: 0 },
  ],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function renderEditProduct() {
  return render(
    <MemoryRouter initialEntries={['/products/p1/edit']}>
      <Routes>
        <Route path="/products/:productId/edit" element={<EditProduct />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockNavigate.mockReset();
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    loggedIn: true, loading: false, userId: 'user-uuid-1', login: vi.fn(), logout: vi.fn(),
  });
  vi.spyOn(CartContext, 'useCart').mockReturnValue({
    items: [], addItem: vi.fn(), removeItem: vi.fn(), updateQuantity: vi.fn(),
    clearCart: vi.fn(), totalItems: 0, totalPrice: 0,
  });
});

describe('EditProduct', () => {
  it('pre-fills form with existing product data', async () => {
    vi.spyOn(api, 'request').mockResolvedValueOnce(MOCK_PRODUCT);
    renderEditProduct();

    expect(await screen.findByLabelText('Name')).toHaveValue('RTX 4080');
    expect(screen.getByLabelText('Category')).toHaveValue('GPU');
    expect(screen.getByLabelText('Stock Quantity')).toHaveValue(10);
  });

  it('shows existing product images', async () => {
    vi.spyOn(api, 'request').mockResolvedValueOnce(MOCK_PRODUCT);
    renderEditProduct();

    expect(await screen.findByRole('img')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.example.com/img.png');
  });

  it('saves changes and navigates to product detail', async () => {
    const mockRequest = vi.spyOn(api, 'request')
      .mockResolvedValueOnce(MOCK_PRODUCT)
      .mockResolvedValueOnce(undefined);

    renderEditProduct();
    await screen.findByLabelText('Name');

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(mockRequest).toHaveBeenCalledTimes(2);
    const [url, opts] = mockRequest.mock.calls[1] as [string, RequestInit];
    expect(url).toContain('/p1');
    expect((opts as RequestInit).method).toBe('PATCH');
    const body = JSON.parse((opts as RequestInit).body as string) as { name: string };
    expect(body.name).toBe('RTX 4080');
    expect(mockNavigate).toHaveBeenCalledWith('/products/p1');
  });

  it('deletes an image and removes it from the list', async () => {
    const mockRequest = vi.spyOn(api, 'request')
      .mockResolvedValueOnce(MOCK_PRODUCT)
      .mockResolvedValueOnce(undefined);

    renderEditProduct();
    await screen.findByRole('img');

    await userEvent.click(screen.getByRole('button', { name: /delete image/i }));

    const [url, opts] = mockRequest.mock.calls[1] as [string, RequestInit];
    expect(url).toContain('/images/img-1');
    expect((opts as RequestInit).method).toBe('DELETE');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('deletes the product and navigates to product list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const mockRequest = vi.spyOn(api, 'request')
      .mockResolvedValueOnce(MOCK_PRODUCT)
      .mockResolvedValueOnce(undefined);

    renderEditProduct();
    await screen.findByLabelText('Name');

    await userEvent.click(screen.getByRole('button', { name: /delete product/i }));

    const [url, opts] = mockRequest.mock.calls[1] as [string, RequestInit];
    expect(url).toContain('/p1');
    expect((opts as RequestInit).method).toBe('DELETE');
    expect(mockNavigate).toHaveBeenCalledWith('/products');
  });

  it('does not delete product when user cancels confirm dialog', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const mockRequest = vi.spyOn(api, 'request').mockResolvedValueOnce(MOCK_PRODUCT);

    renderEditProduct();
    await screen.findByLabelText('Name');

    await userEvent.click(screen.getByRole('button', { name: /delete product/i }));

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows validation errors when required fields are empty', async () => {
    vi.spyOn(api, 'request').mockResolvedValueOnce(MOCK_PRODUCT);
    renderEditProduct();

    const nameInput = await screen.findByLabelText('Name');
    await userEvent.clear(nameInput);
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('shows error message when save API fails', async () => {
    vi.spyOn(api, 'request')
      .mockResolvedValueOnce(MOCK_PRODUCT)
      .mockRejectedValueOnce(new api.ApiError(403, 'Access denied'));

    renderEditProduct();
    await screen.findByLabelText('Name');

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText('Access denied')).toBeInTheDocument();
  });

  it('shows error when product fails to load', async () => {
    vi.spyOn(api, 'request').mockRejectedValueOnce(new api.ApiError(404, 'Resource not found.'));
    renderEditProduct();

    expect(await screen.findByText('Resource not found.')).toBeInTheDocument();
  });
});
