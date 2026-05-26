import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Profile } from './Profile';
import * as api from '../lib/api';
import * as AuthContext from '../contexts/AuthContext';
import * as CartContext from '../contexts/CartContext';
import type { User } from '../types/users';

const MOCK_USER: User = {
  id: 'u1',
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  phoneNumber: '+40700000000',
  createdAt: '2026-01-01T00:00:00Z',
};

let mockLogout: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.restoreAllMocks();
  mockLogout = vi.fn();
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    loggedIn: true, loading: false, userId: 'u1', login: vi.fn(), logout: mockLogout,
  });
  vi.spyOn(CartContext, 'useCart').mockReturnValue({
    items: [], addItem: vi.fn(), removeItem: vi.fn(), updateQuantity: vi.fn(),
    clearCart: vi.fn(), totalItems: 0, totalPrice: 0,
  });
});

function renderProfile() {
  return render(<MemoryRouter><Profile /></MemoryRouter>);
}

describe('Profile', () => {
  describe('initial load', () => {
    it('fetches and displays user data', async () => {
      vi.spyOn(api, 'request').mockResolvedValue(MOCK_USER);
      renderProfile();

      expect(await screen.findByText('Jane')).toBeInTheDocument();
      expect(screen.getByText('Doe')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
      expect(screen.getByText('+40700000000')).toBeInTheDocument();
    });

    it('shows error when GET fails', async () => {
      vi.spyOn(api, 'request').mockRejectedValue(new api.ApiError(404, 'Not found'));
      renderProfile();

      expect(await screen.findByText('Not found')).toBeInTheDocument();
    });

    it('shows dash when phoneNumber is absent', async () => {
      const userWithoutPhone: User = { ...MOCK_USER, phoneNumber: undefined };
      vi.spyOn(api, 'request').mockResolvedValue(userWithoutPhone);
      renderProfile();

      await screen.findByText('Jane');
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  describe('edit profile', () => {
    it('clicking Edit shows pre-populated form fields', async () => {
      vi.spyOn(api, 'request').mockResolvedValue(MOCK_USER);
      renderProfile();

      await userEvent.click(await screen.findByRole('button', { name: /edit/i }));

      expect(screen.getByLabelText('First name')).toHaveValue('Jane');
      expect(screen.getByLabelText('Last name')).toHaveValue('Doe');
      expect(screen.getByLabelText('Email')).toHaveValue('jane@example.com');
    });

    it('validates empty firstName', async () => {
      vi.spyOn(api, 'request').mockResolvedValue(MOCK_USER);
      renderProfile();

      await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
      await userEvent.clear(screen.getByLabelText('First name'));
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(screen.getByText('First name is required')).toBeInTheDocument();
    });

    it('validates empty lastName', async () => {
      vi.spyOn(api, 'request').mockResolvedValue(MOCK_USER);
      renderProfile();

      await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
      await userEvent.clear(screen.getByLabelText('Last name'));
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(screen.getByText('Last name is required')).toBeInTheDocument();
    });

    it('validates empty email', async () => {
      vi.spyOn(api, 'request').mockResolvedValue(MOCK_USER);
      renderProfile();

      await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
      await userEvent.clear(screen.getByLabelText('Email'));
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });

    it('validates invalid email format', async () => {
      vi.spyOn(api, 'request').mockResolvedValue(MOCK_USER);
      renderProfile();

      await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
      await userEvent.clear(screen.getByLabelText('Email'));
      await userEvent.type(screen.getByLabelText('Email'), 'notanemail');
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    });

    it('calls PATCH with correct body and returns to view mode on success', async () => {
      const updatedUser: User = { ...MOCK_USER, firstName: 'Janet' };
      const mockRequest = vi.spyOn(api, 'request')
        .mockResolvedValueOnce(MOCK_USER)
        .mockResolvedValueOnce(updatedUser);

      renderProfile();
      await userEvent.click(await screen.findByRole('button', { name: /edit/i }));

      await userEvent.clear(screen.getByLabelText('First name'));
      await userEvent.type(screen.getByLabelText('First name'), 'Janet');
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(mockRequest).toHaveBeenCalledTimes(2);
      const [, opts] = mockRequest.mock.calls[1] as [string, RequestInit];
      expect(opts.method).toBe('PATCH');
      const body = JSON.parse(opts.body as string) as Record<string, string>;
      expect(body.firstName).toBe('Janet');
      expect(body.lastName).toBe('Doe');
      expect(body.phoneNumber).toBe('+40700000000');

      expect(await screen.findByText('Janet')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    });

    it('omits phoneNumber from PATCH body when field is empty', async () => {
      const mockRequest = vi.spyOn(api, 'request')
        .mockResolvedValueOnce(MOCK_USER)
        .mockResolvedValueOnce({ ...MOCK_USER, phoneNumber: undefined });

      renderProfile();
      await userEvent.click(await screen.findByRole('button', { name: /edit/i }));

      await userEvent.clear(screen.getByLabelText('Phone number (optional)'));
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      const [, opts] = mockRequest.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(opts.body as string) as Record<string, unknown>;
      expect(body.phoneNumber).toBeUndefined();
    });

    it('shows API error on failed PATCH', async () => {
      vi.spyOn(api, 'request')
        .mockResolvedValueOnce(MOCK_USER)
        .mockRejectedValueOnce(new api.ApiError(400, 'Invalid email'));

      renderProfile();
      await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(await screen.findByText('Invalid email')).toBeInTheDocument();
    });

    it('Cancel returns to view mode without saving', async () => {
      const mockRequest = vi.spyOn(api, 'request').mockResolvedValue(MOCK_USER);
      renderProfile();

      await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
      await userEvent.clear(screen.getByLabelText('First name'));
      await userEvent.type(screen.getByLabelText('First name'), 'Changed');
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.getByText('Jane')).toBeInTheDocument();
      expect(mockRequest).toHaveBeenCalledOnce();
    });
  });

  describe('delete account', () => {
    it('Delete Account button shows confirmation box', async () => {
      vi.spyOn(api, 'request').mockResolvedValue(MOCK_USER);
      renderProfile();

      await userEvent.click(await screen.findByRole('button', { name: /delete account/i }));

      expect(screen.getByRole('button', { name: /yes, delete my account/i })).toBeInTheDocument();
      expect(screen.getByText(/permanently delete your account/i)).toBeInTheDocument();
    });

    it('Cancel on confirmation hides it and restores Delete Account button', async () => {
      vi.spyOn(api, 'request').mockResolvedValue(MOCK_USER);
      renderProfile();

      await userEvent.click(await screen.findByRole('button', { name: /delete account/i }));
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByRole('button', { name: /yes, delete my account/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument();
    });

    it('calls DELETE then logout on confirmation', async () => {
      const mockRequest = vi.spyOn(api, 'request')
        .mockResolvedValueOnce(MOCK_USER)
        .mockResolvedValueOnce(undefined);

      renderProfile();
      await userEvent.click(await screen.findByRole('button', { name: /delete account/i }));
      await userEvent.click(screen.getByRole('button', { name: /yes, delete my account/i }));

      expect(mockRequest).toHaveBeenCalledTimes(2);
      const [, opts] = mockRequest.mock.calls[1] as [string, RequestInit];
      expect(opts.method).toBe('DELETE');
      expect(mockLogout).toHaveBeenCalledOnce();
    });

    it('shows error and does not logout when DELETE fails', async () => {
      vi.spyOn(api, 'request')
        .mockResolvedValueOnce(MOCK_USER)
        .mockRejectedValueOnce(new api.ApiError(500, 'Server error'));

      renderProfile();
      await userEvent.click(await screen.findByRole('button', { name: /delete account/i }));
      await userEvent.click(screen.getByRole('button', { name: /yes, delete my account/i }));

      expect(await screen.findByText('Server error')).toBeInTheDocument();
      expect(mockLogout).not.toHaveBeenCalled();
    });
  });
});
