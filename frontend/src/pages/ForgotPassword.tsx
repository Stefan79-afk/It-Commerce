import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { ApiError, request, USERS_API } from '../lib/api';

interface FormState {
  email: string;
  newPassword: string;
  confirmNewPassword: string;
}

interface FormErrors {
  email?: string;
  newPassword?: string;
  confirmNewPassword?: string;
  general?: string;
}

const PASSWORD_RULE =
  'Password must be at least 8 characters and include uppercase, lowercase, digit, and special character.';

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!form.email.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Enter a valid email address';
  }

  if (!form.newPassword) {
    errors.newPassword = 'Password is required';
  } else if (form.newPassword.length < 8) {
    errors.newPassword = PASSWORD_RULE;
  } else if (!/[A-Z]/.test(form.newPassword)) {
    errors.newPassword = PASSWORD_RULE;
  } else if (!/[a-z]/.test(form.newPassword)) {
    errors.newPassword = PASSWORD_RULE;
  } else if (!/\d/.test(form.newPassword)) {
    errors.newPassword = PASSWORD_RULE;
  } else if (!/[^A-Za-z0-9]/.test(form.newPassword)) {
    errors.newPassword = PASSWORD_RULE;
  }

  if (form.newPassword && form.confirmNewPassword !== form.newPassword) {
    errors.confirmNewPassword = 'Passwords do not match';
  }

  return errors;
}

export function ForgotPassword() {
  const [form, setForm] = useState<FormState>({
    email: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

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
      await request<{ message: string }>(`${USERS_API}/forgot-password`, {
        method: 'POST',
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          new_password: form.newPassword,
        }),
      });
      setSuccess(true);
    } catch (err) {
      let message = 'An unexpected error occurred';
      if (err instanceof ApiError) {
        message = err.status === 404
          ? 'No account found with that email address.'
          : err.message;
      }
      setErrors({ general: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <NavBar />
      <main className="page-content">
        <h1>Forgot Password</h1>

        {success ? (
          <div className="profile-card">
            <p className="status-msg" style={{ marginTop: 0 }}>
              Password updated. You can now log in with your new password.
            </p>
            <div className="profile-actions">
              <Link to="/login" className="btn-primary">Back to Login</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => { void handleSubmit(e); }} noValidate className="profile-card">
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
              {errors.email && <span role="alert" className="error">{errors.email}</span>}
            </div>

            <div className="field">
              <label htmlFor="newPassword">New Password</label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                value={form.newPassword}
                onChange={handleChange}
                aria-invalid={!!errors.newPassword}
              />
              {errors.newPassword && (
                <span role="alert" className="error">{errors.newPassword}</span>
              )}
            </div>

            <div className="field">
              <label htmlFor="confirmNewPassword">Confirm New Password</label>
              <input
                id="confirmNewPassword"
                name="confirmNewPassword"
                type="password"
                value={form.confirmNewPassword}
                onChange={handleChange}
                aria-invalid={!!errors.confirmNewPassword}
              />
              {errors.confirmNewPassword && (
                <span role="alert" className="error">{errors.confirmNewPassword}</span>
              )}
            </div>

            {errors.general && (
              <p role="alert" className="error general-error">{errors.general}</p>
            )}

            <button type="submit" disabled={submitting}>
              {submitting ? 'Resetting…' : 'Reset Password'}
            </button>
          </form>
        )}
      </main>
    </>
  );
}
