import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Login } from './Login';
import * as AuthContext from '../contexts/AuthContext';

const mockLogin = vi.fn();

beforeEach(() => {
  mockLogin.mockReset();
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    loggedIn: false,
    loading: false,
    login: mockLogin,
    logout: vi.fn(),
  });
});

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
}

describe('Login page — form validation', () => {
  it('shows errors when email and password are empty on submit', async () => {
    renderLogin();

    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows error for invalid email format', async () => {
    renderLogin();

    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.type(screen.getByLabelText('Password'), 'SomePassword1!');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('calls login with valid credentials', async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLogin();

    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'ValidPass1!');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'ValidPass1!');
  });
});
