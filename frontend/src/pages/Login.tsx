import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface FormState {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address';
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) return 'Password is required';
  return undefined;
}

export function Login() {
  const [form, setForm] = useState<FormState>({ email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined, general: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const emailError = validateEmail(form.email);
    const passwordError = validatePassword(form.password);

    if (emailError || passwordError) {
      setErrors({ email: emailError, password: passwordError });
      return;
    }

    setSubmitting(true);
    try {
      await login(form.email, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'An unexpected error occurred';
      setErrors({ general: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-container">
      <h1>Sign In</h1>
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {errors.email && (
            <span id="email-error" role="alert" className="error">
              {errors.email}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
          />
          {errors.password && (
            <span id="password-error" role="alert" className="error">
              {errors.password}
            </span>
          )}
        </div>

        {errors.general && (
          <p role="alert" className="error general-error">
            {errors.general}
          </p>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      <p>
        Don&apos;t have an account? <Link to="/register">Register</Link>
      </p>
      <p>
        <Link to="/forgot-password">Forgot your password?</Link>
      </p>
    </div>
  );
}
