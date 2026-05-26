import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangePassword } from './ChangePassword';
import * as api from '../lib/api';
import * as AuthContext from '../contexts/AuthContext';
import * as CartContext from '../contexts/CartContext';

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

function renderChangePassword() {
  return render(<MemoryRouter><ChangePassword /></MemoryRouter>);
}

describe('ChangePassword', () => {
  describe('render', () => {
    it('renders all four labeled fields', () => {
      renderChangePassword();

      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Current Password')).toBeInTheDocument();
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('shows error for empty email', async () => {
      renderChangePassword();

      await userEvent.click(screen.getByRole('button', { name: /change password/i }));

      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });

    it('shows error for invalid email format', async () => {
      renderChangePassword();

      await userEvent.type(screen.getByLabelText('Email'), 'notanemail');
      await userEvent.click(screen.getByRole('button', { name: /change password/i }));

      expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    });

    it('shows error for empty current password', async () => {
      renderChangePassword();

      await userEvent.click(screen.getByRole('button', { name: /change password/i }));

      expect(screen.getByText('Current password is required')).toBeInTheDocument();
    });

    it('shows error for empty new password', async () => {
      renderChangePassword();

      await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
      await userEvent.type(screen.getByLabelText('Current Password'), 'OldPass1!');
      await userEvent.click(screen.getByRole('button', { name: /change password/i }));

      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });

    it('shows password rule error for short new password', async () => {
      renderChangePassword();

      await userEvent.type(screen.getByLabelText('New Password'), 'short');
      await userEvent.click(screen.getByRole('button', { name: /change password/i }));

      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });

    it('shows password rule error when new password is missing special character', async () => {
      renderChangePassword();

      await userEvent.type(screen.getByLabelText('New Password'), 'ValidPass1');
      await userEvent.click(screen.getByRole('button', { name: /change password/i }));

      expect(screen.getByText(/special character/i)).toBeInTheDocument();
    });

    it('shows error when confirm password does not match', async () => {
      renderChangePassword();

      await userEvent.type(screen.getByLabelText('New Password'), 'ValidPass1!');
      await userEvent.type(screen.getByLabelText('Confirm New Password'), 'DifferentPass1!');
      await userEvent.click(screen.getByRole('button', { name: /change password/i }));

      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });
  });

  describe('submission', () => {
    it('calls PATCH with correct URL and body on valid submit', async () => {
      const mockRequest = vi.spyOn(api, 'request').mockResolvedValue({ message: 'Password updated.' });
      renderChangePassword();

      await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
      await userEvent.type(screen.getByLabelText('Current Password'), 'OldPass1!');
      await userEvent.type(screen.getByLabelText('New Password'), 'NewPass1!');
      await userEvent.type(screen.getByLabelText('Confirm New Password'), 'NewPass1!');
      await userEvent.click(screen.getByRole('button', { name: /change password/i }));

      expect(mockRequest).toHaveBeenCalledOnce();
      const [url, opts] = mockRequest.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/u1/password/reset-request');
      expect(opts.method).toBe('PATCH');
      const body = JSON.parse(opts.body as string) as Record<string, string>;
      expect(body.email).toBe('jane@example.com');
      expect(body.current_password).toBe('OldPass1!');
      expect(body.new_password).toBe('NewPass1!');
      expect(body.confirm_new_password).toBeUndefined();
    });

    it('shows success message after successful PATCH', async () => {
      vi.spyOn(api, 'request').mockResolvedValue({ message: 'Password updated.' });
      renderChangePassword();

      await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
      await userEvent.type(screen.getByLabelText('Current Password'), 'OldPass1!');
      await userEvent.type(screen.getByLabelText('New Password'), 'NewPass1!');
      await userEvent.type(screen.getByLabelText('Confirm New Password'), 'NewPass1!');
      await userEvent.click(screen.getByRole('button', { name: /change password/i }));

      expect(await screen.findByText(/password updated successfully/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /change password/i })).not.toBeInTheDocument();
    });

    it('shows API error on failed PATCH', async () => {
      vi.spyOn(api, 'request').mockRejectedValue(new api.ApiError(401, 'Incorrect current password'));
      renderChangePassword();

      await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
      await userEvent.type(screen.getByLabelText('Current Password'), 'WrongPass1!');
      await userEvent.type(screen.getByLabelText('New Password'), 'NewPass1!');
      await userEvent.type(screen.getByLabelText('Confirm New Password'), 'NewPass1!');
      await userEvent.click(screen.getByRole('button', { name: /change password/i }));

      expect(await screen.findByText('Incorrect current password')).toBeInTheDocument();
    });
  });
});
