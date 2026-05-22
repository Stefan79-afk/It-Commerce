import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Register } from './Register';
import * as api from '../lib/api';

beforeEach(() => {
  vi.restoreAllMocks();
});

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  );
}

describe('Register page — form validation', () => {
  it('shows errors for all empty required fields on submit', async () => {
    renderRegister();

    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('Last name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('shows password rule error for short password', async () => {
    renderRegister();

    await userEvent.type(screen.getByLabelText('First Name'), 'John');
    await userEvent.type(screen.getByLabelText('Last Name'), 'Doe');
    await userEvent.type(screen.getByLabelText('Email'), 'john@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it('shows password rule error when special character is missing', async () => {
    renderRegister();

    await userEvent.type(screen.getByLabelText('First Name'), 'John');
    await userEvent.type(screen.getByLabelText('Last Name'), 'Doe');
    await userEvent.type(screen.getByLabelText('Email'), 'john@example.com');
    // Has 8+ chars, uppercase, lowercase, digit — but no special character
    await userEvent.type(screen.getByLabelText('Password'), 'ValidPass1');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByText(/special character/i)).toBeInTheDocument();
  });

  it('calls request with valid input and shows no field errors', async () => {
    const mockRequest = vi.spyOn(api, 'request').mockResolvedValue(undefined);
    renderRegister();

    await userEvent.type(screen.getByLabelText('First Name'), 'John');
    await userEvent.type(screen.getByLabelText('Last Name'), 'Doe');
    await userEvent.type(screen.getByLabelText('Email'), 'john@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'ValidPass1!');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(mockRequest).toHaveBeenCalledOnce();
    expect(screen.queryByText('First name is required')).not.toBeInTheDocument();
    expect(screen.queryByText('Password is required')).not.toBeInTheDocument();
  });
});
