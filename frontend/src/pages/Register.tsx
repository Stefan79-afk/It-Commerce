import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, request, USERS_API } from '../lib/api';

interface FormState {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  general?: string;
}

const PASSWORD_RULE =
  'Password must be at least 8 characters and include uppercase, lowercase, digit, and special character.';

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.firstName.trim()) errors.firstName = 'First name is required';
  if (!form.lastName.trim()) errors.lastName = 'Last name is required';
  if (!form.email.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Enter a valid email address';
  }
  if (!form.password) {
    errors.password = 'Password is required';
  } else if (form.password.length < 8) {
    errors.password = PASSWORD_RULE;
  } else if (!/[A-Z]/.test(form.password)) {
    errors.password = PASSWORD_RULE;
  } else if (!/[a-z]/.test(form.password)) {
    errors.password = PASSWORD_RULE;
  } else if (!/\d/.test(form.password)) {
    errors.password = PASSWORD_RULE;
  } else if (!/[^A-Za-z0-9]/.test(form.password)) {
    errors.password = PASSWORD_RULE;
  }
  return errors;
}

export function Register() {
  const [form, setForm] = useState<FormState>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined, general: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = validateForm(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      await request(`${USERS_API}/register`, {
        method: 'POST',
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
        }),
      });
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'An unexpected error occurred';
      setErrors({ general: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-container">
      <h1>Create Account</h1>
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="field">
          <label htmlFor="firstName">First Name</label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            value={form.firstName}
            onChange={handleChange}
            aria-invalid={!!errors.firstName}
          />
          {errors.firstName && (
            <span role="alert" className="error">
              {errors.firstName}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="lastName">Last Name</label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            value={form.lastName}
            onChange={handleChange}
            aria-invalid={!!errors.lastName}
          />
          {errors.lastName && (
            <span role="alert" className="error">
              {errors.lastName}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <span role="alert" className="error">
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
          />
          {errors.password && (
            <span role="alert" className="error">
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
          {submitting ? 'Creating account…' : 'Create Account'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Sign In</Link>
      </p>
    </div>
  );
}
