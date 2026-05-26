import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgotPassword } from './ForgotPassword';
import * as api from '../lib/api';
import * as AuthContext from '../contexts/AuthContext';
import * as CartContext from '../contexts/CartContext';

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

function renderForgotPassword() {
  return render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
}

describe('ForgotPassword', () => {
  describe('render', () => {
    it('renders email, new password, and confirm password fields', () => {
      renderForgotPassword();

      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('shows error when email is missing', async () => {
      renderForgotPassword();

      await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });

    it('shows error when email format is invalid', async () => {
      renderForgotPassword();

      await userEvent.type(screen.getByLabelText('Email'), 'notanemail');
      await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

      expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    });

    it('shows error when new password is missing', async () => {
      renderForgotPassword();

      await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
      await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });

    it('shows password rule error for weak new password', async () => {
      renderForgotPassword();

      await userEvent.type(screen.getByLabelText('New Password'), 'weak');
      await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });

    it('shows error when passwords do not match', async () => {
      renderForgotPassword();

      await userEvent.type(screen.getByLabelText('New Password'), 'ValidPass1!');
      await userEvent.type(screen.getByLabelText('Confirm New Password'), 'DifferentPass1!');
      await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });
  });

  describe('submission', () => {
    it('calls POST with correct URL and body on valid submit', async () => {
      const mockRequest = vi.spyOn(api, 'request').mockResolvedValue({ message: 'Password updated.' });
      renderForgotPassword();

      await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
      await userEvent.type(screen.getByLabelText('New Password'), 'NewPass1!');
      await userEvent.type(screen.getByLabelText('Confirm New Password'), 'NewPass1!');
      await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

      expect(mockRequest).toHaveBeenCalledOnce();
      const [url, opts] = mockRequest.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/forgot-password');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body as string) as Record<string, string>;
      expect(body.email).toBe('jane@example.com');
      expect(body.new_password).toBe('NewPass1!');
      expect(body.confirm_new_password).toBeUndefined();
    });

    it('shows success message after successful POST', async () => {
      vi.spyOn(api, 'request').mockResolvedValue({ message: 'Password updated.' });
      renderForgotPassword();

      await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
      await userEvent.type(screen.getByLabelText('New Password'), 'NewPass1!');
      await userEvent.type(screen.getByLabelText('Confirm New Password'), 'NewPass1!');
      await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

      expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reset password/i })).not.toBeInTheDocument();
    });

    it('shows 404 error as friendly message', async () => {
      vi.spyOn(api, 'request').mockRejectedValue(
        new api.ApiError(404, 'No account found with that email address.'),
      );
      renderForgotPassword();

      await userEvent.type(screen.getByLabelText('Email'), 'nobody@example.com');
      await userEvent.type(screen.getByLabelText('New Password'), 'NewPass1!');
      await userEvent.type(screen.getByLabelText('Confirm New Password'), 'NewPass1!');
      await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

      expect(await screen.findByText('No account found with that email address.')).toBeInTheDocument();
    });

    it('shows general error on unexpected API failure', async () => {
      vi.spyOn(api, 'request').mockRejectedValue(new Error('Network error'));
      renderForgotPassword();

      await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
      await userEvent.type(screen.getByLabelText('New Password'), 'NewPass1!');
      await userEvent.type(screen.getByLabelText('Confirm New Password'), 'NewPass1!');
      await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

      expect(await screen.findByText('An unexpected error occurred')).toBeInTheDocument();
    });
  });
});
