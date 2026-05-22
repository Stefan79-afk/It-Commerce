import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateProduct } from './CreateProduct';
import * as api from '../lib/api';
import * as AuthContext from '../contexts/AuthContext';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    loggedIn: true,
    loading: false,
    userId: 'user-uuid-1',
    login: vi.fn(),
    logout: vi.fn(),
  });
});

function renderCreateProduct() {
  return render(
    <MemoryRouter>
      <CreateProduct />
    </MemoryRouter>,
  );
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
