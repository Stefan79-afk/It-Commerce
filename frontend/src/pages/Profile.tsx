import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { ApiError, request, USERS_API } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { User } from '../types/users';

interface ProfileForm {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
}

interface ProfileErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  general?: string;
}

function validateForm(form: ProfileForm): ProfileErrors {
  const errors: ProfileErrors = {};
  if (!form.firstName.trim()) errors.firstName = 'First name is required';
  if (!form.lastName.trim()) errors.lastName = 'Last name is required';
  if (!form.email.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Enter a valid email address';
  }
  return errors;
}

export function Profile() {
  const { userId, logout } = useAuth();
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileForm>({ firstName: '', lastName: '', email: '', phoneNumber: '' });
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setLoadError(null);
    request<User>(`${USERS_API}/${userId}`)
      .then((data) => {
        setUser(data);
        setForm({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phoneNumber: data.phoneNumber ?? '',
        });
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load profile');
      })
      .finally(() => setLoading(false));
  }, [userId]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined, general: undefined }));
  }

  function startEditing() {
    if (!user) return;
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber ?? '',
    });
    setErrors({});
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = validateForm(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, string> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
      };
      if (form.phoneNumber.trim()) {
        body.phoneNumber = form.phoneNumber.trim();
      }

      const updated = await request<User>(`${USERS_API}/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setUser(updated);
      setEditing(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to save changes';
      setErrors({ general: message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await request<void>(`${USERS_API}/${userId}`, { method: 'DELETE' });
      await logout();
      navigate('/login');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete account';
      setDeleteError(message);
      setDeleting(false);
    }
  }

  return (
    <>
      <NavBar />
      <main className="page-content">
        <h1>My Profile</h1>

        {loading && <p className="status-msg">Loading…</p>}
        {loadError && <p className="status-msg error">{loadError}</p>}

        {user && !editing && (
          <div className="profile-card">
            <dl>
              <div className="profile-field">
                <dt>First name</dt>
                <dd>{user.firstName}</dd>
              </div>
              <div className="profile-field">
                <dt>Last name</dt>
                <dd>{user.lastName}</dd>
              </div>
              <div className="profile-field">
                <dt>Email</dt>
                <dd>{user.email}</dd>
              </div>
              <div className="profile-field">
                <dt>Phone number</dt>
                <dd>{user.phoneNumber ?? '—'}</dd>
              </div>
            </dl>
            <div className="profile-actions">
              <button type="button" className="btn-primary" onClick={startEditing}>
                Edit
              </button>
            </div>
          </div>
        )}

        {user && editing && (
          <form onSubmit={(e) => { void handleSave(e); }} noValidate className="profile-card">
            <div className="field">
              <label htmlFor="firstName">First name</label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                value={form.firstName}
                onChange={handleChange}
                aria-invalid={!!errors.firstName}
              />
              {errors.firstName && <span role="alert" className="error">{errors.firstName}</span>}
            </div>

            <div className="field">
              <label htmlFor="lastName">Last name</label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                value={form.lastName}
                onChange={handleChange}
                aria-invalid={!!errors.lastName}
              />
              {errors.lastName && <span role="alert" className="error">{errors.lastName}</span>}
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
              {errors.email && <span role="alert" className="error">{errors.email}</span>}
            </div>

            <div className="field">
              <label htmlFor="phoneNumber">Phone number (optional)</label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                value={form.phoneNumber}
                onChange={handleChange}
              />
            </div>

            {errors.general && (
              <p role="alert" className="error general-error">{errors.general}</p>
            )}

            <div className="profile-actions">
              <button type="submit" className="btn-primary" disabled={saving} style={{ width: 'auto' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {user && (
          <>
            <hr className="profile-divider" />

            <h2 style={{ marginBottom: '12px', fontSize: '1.1rem' }}>Danger Zone</h2>

            {!confirmDelete && (
              <button
                type="button"
                className="btn-danger"
                onClick={() => { setConfirmDelete(true); setDeleteError(null); }}
              >
                Delete Account
              </button>
            )}

            {confirmDelete && (
              <div className="confirm-box">
                <p>This will permanently delete your account and all associated data. This action cannot be undone.</p>
                {deleteError && <p role="alert" className="error" style={{ marginBottom: '12px' }}>{deleteError}</p>}
                <div className="confirm-actions">
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => { void handleDelete(); }}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete my account'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => { setConfirmDelete(false); setDeleteError(null); }}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
