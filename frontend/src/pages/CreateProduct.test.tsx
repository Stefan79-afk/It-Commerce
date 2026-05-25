import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateProduct } from './CreateProduct';
import * as api from '../lib/api';
import * as AuthContext from '../contexts/AuthContext';
import * as CartContext from '../contexts/CartContext';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    loggedIn: true, loading: false, userId: 'user-uuid-1', login: vi.fn(), logout: vi.fn(),
  });
  vi.spyOn(CartContext, 'useCart').mockReturnValue({
    items: [], addItem: vi.fn(), removeItem: vi.fn(), updateQuantity: vi.fn(),
    clearCart: vi.fn(), totalItems: 0, totalPrice: 0,
  });
});

function renderCreateProduct() {
  return render(
    <MemoryRouter>
      <CreateProduct />
    </MemoryRouter>,
  );
}

async function fillRequiredFields() {
  await userEvent.type(screen.getByLabelText('Name'), 'RTX 4080');
  await userEvent.type(screen.getByLabelText('Category'), 'GPU');
  await userEvent.type(screen.getByLabelText('Price ($)'), '999.99');
  await userEvent.type(screen.getByLabelText('Stock Quantity'), '5');
}

describe('CreateProduct — form validation', () => {
  it('shows errors for all empty required fields', async () => {
    renderCreateProduct();

    await userEvent.click(screen.getByRole('button', { name: /create product/i }));

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Category is required')).toBeInTheDocument();
    expect(screen.getByText('Price is required')).toBeInTheDocument();
    expect(screen.getByText('Stock quantity is required')).toBeInTheDocument();
  });

  it('shows error for non-positive price', async () => {
    renderCreateProduct();

    await userEvent.type(screen.getByLabelText('Name'), 'GPU');
    await userEvent.type(screen.getByLabelText('Category'), 'Electronics');
    await userEvent.type(screen.getByLabelText('Price ($)'), '-5');
    await userEvent.type(screen.getByLabelText('Stock Quantity'), '10');
    await userEvent.click(screen.getByRole('button', { name: /create product/i }));

    expect(screen.getByText('Price must be a positive number')).toBeInTheDocument();
  });

  it('shows error for negative stock quantity', async () => {
    renderCreateProduct();

    await userEvent.type(screen.getByLabelText('Name'), 'GPU');
    await userEvent.type(screen.getByLabelText('Category'), 'Electronics');
    await userEvent.type(screen.getByLabelText('Price ($)'), '99.99');
    await userEvent.type(screen.getByLabelText('Stock Quantity'), '-1');
    await userEvent.click(screen.getByRole('button', { name: /create product/i }));

    expect(screen.getByText('Stock quantity must be 0 or more')).toBeInTheDocument();
  });

  it('calls request with valid input', async () => {
    const mockRequest = vi
      .spyOn(api, 'request')
      .mockResolvedValue({ id: 'new-product-id', createdAt: '2026-01-01T00:00:00Z' });

    renderCreateProduct();

    await userEvent.type(screen.getByLabelText('Name'), 'RTX 4080');
    await userEvent.type(screen.getByLabelText('Category'), 'GPU');
    await userEvent.type(screen.getByLabelText('Price ($)'), '999.99');
    await userEvent.type(screen.getByLabelText('Stock Quantity'), '5');
    await userEvent.click(screen.getByRole('button', { name: /create product/i }));

    expect(mockRequest).toHaveBeenCalledOnce();
    const [, options] = mockRequest.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { name: string; price: number };
    expect(body.name).toBe('RTX 4080');
    expect(body.price).toBe(999.99);
  });
});

describe('CreateProduct — image upload', () => {
  it('renders an image file input', () => {
    renderCreateProduct();

    const input = screen.getByLabelText('Images (optional)');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', 'image/*');
    expect(input).toHaveAttribute('multiple');
  });

  it('shows selected file names when files are chosen', async () => {
    renderCreateProduct();

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    await userEvent.upload(screen.getByLabelText('Images (optional)'), file);

    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
  });

  it('does not call image endpoints when no files are selected', async () => {
    const mockRequest = vi
      .spyOn(api, 'request')
      .mockResolvedValue({ id: 'prod-1', createdAt: '2026-01-01T00:00:00Z' });

    renderCreateProduct();
    await fillRequiredFields();
    await userEvent.click(screen.getByRole('button', { name: /create product/i }));

    expect(mockRequest).toHaveBeenCalledOnce();
  });

  it('calls presign, uploads to presigned URL, and confirms the image', async () => {
    const mockRequest = vi
      .spyOn(api, 'request')
      .mockResolvedValueOnce({ id: 'prod-1', createdAt: '2026-01-01T00:00:00Z' })
      .mockResolvedValueOnce({ imageId: 'img-1', uploadUrl: 'https://s3.example.com/path?sig=abc', expiresIn: 900 })
      .mockResolvedValueOnce({ id: 'img-1', fileUrl: 'https://s3.example.com/path', displayOrder: 0, uploadedAt: '2026-01-01T00:00:00Z' });
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    renderCreateProduct();
    await fillRequiredFields();
    const file = new File(['img data'], 'photo.jpg', { type: 'image/jpeg' });
    await userEvent.upload(screen.getByLabelText('Images (optional)'), file);
    await userEvent.click(screen.getByRole('button', { name: /create product/i }));

    expect(mockRequest).toHaveBeenCalledTimes(3);

    const [presignUrl, presignOpts] = mockRequest.mock.calls[1] as [string, RequestInit];
    expect(presignUrl).toContain('/prod-1/images/presign');
    const presignBody = JSON.parse(presignOpts.body as string) as { fileName: string; contentType: string };
    expect(presignBody.fileName).toBe('photo.jpg');
    expect(presignBody.contentType).toBe('image/jpeg');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [fetchUrl, fetchOpts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(fetchUrl).toBe('https://s3.example.com/path?sig=abc');
    expect(fetchOpts.method).toBe('PUT');

    const [confirmUrl, confirmOpts] = mockRequest.mock.calls[2] as [string, RequestInit];
    expect(confirmUrl).toContain('/prod-1/images/confirm');
    const confirmBody = JSON.parse(confirmOpts.body as string) as { imageId: string; fileUrl: string; displayOrder: number };
    expect(confirmBody.imageId).toBe('img-1');
    expect(confirmBody.fileUrl).toBe('https://s3.example.com/path');
    expect(confirmBody.displayOrder).toBe(0);
  });

  it('shows error when image upload fails after product was created', async () => {
    vi.spyOn(api, 'request')
      .mockResolvedValueOnce({ id: 'prod-1', createdAt: '2026-01-01T00:00:00Z' })
      .mockRejectedValueOnce(new api.ApiError(500, 'Presign failed'));

    renderCreateProduct();
    await fillRequiredFields();
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    await userEvent.upload(screen.getByLabelText('Images (optional)'), file);
    await userEvent.click(screen.getByRole('button', { name: /create product/i }));

    expect(await screen.findByText(/image upload failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create product/i })).toBeInTheDocument();
  });
});
