import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { ApiError, request, ORDERS_API } from '../lib/api';
import { useCart } from '../contexts/CartContext';
import type { OrderSummary, ShippingAddressSnapshot } from '../types/orders';

interface AddressForm {
  street: string;
  city: string;
  country: string;
  postalCode: string;
  county: string;
}

interface AddressErrors {
  street?: string;
  city?: string;
  country?: string;
  general?: string;
}

function validateAddress(form: AddressForm): AddressErrors {
  const errors: AddressErrors = {};
  if (!form.street.trim()) errors.street = 'Street is required';
  if (!form.city.trim()) errors.city = 'City is required';
  if (!form.country.trim()) errors.country = 'Country is required';
  return errors;
}

export function Checkout() {
  const { items, totalPrice, clearCart } = useCart();
  const navigate = useNavigate();

  const [form, setForm] = useState<AddressForm>({
    street: '', city: '', country: '', postalCode: '', county: '',
  });
  const [errors, setErrors] = useState<AddressErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Redirect to cart if nothing to check out
  if (items.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined, general: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = validateAddress(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    const snapshot: ShippingAddressSnapshot = {
      street: form.street.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      postalCode: form.postalCode.trim() || undefined,
      county: form.county.trim() || undefined,
    };

    setSubmitting(true);
    try {
      const order = await request<OrderSummary>(`${ORDERS_API}`, {
        method: 'POST',
        body: JSON.stringify({
          shippingAddressId: crypto.randomUUID(),
          shippingAddressSnapshot: snapshot,
          items,
        }),
      });
      clearCart();
      navigate(`/orders/${order.id}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to place order';
      setErrors({ general: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <NavBar />
      <main className="page-content">
        <h1>Checkout</h1>

        <div className="checkout-layout">
          {/* Shipping address form */}
          <form onSubmit={(e) => void handleSubmit(e)} noValidate className="checkout-form">
            <h2>Shipping Address</h2>

            {(['street', 'city', 'country'] as const).map((field) => (
              <div key={field} className="field">
                <label htmlFor={field}>
                  {field.charAt(0).toUpperCase() + field.slice(1)}
                </label>
                <input
                  id={field}
                  name={field}
                  type="text"
                  value={form[field]}
                  onChange={handleChange}
                  aria-invalid={!!(errors as Record<string, string | undefined>)[field]}
                />
                {(errors as Record<string, string | undefined>)[field] && (
                  <span role="alert" className="error">
                    {(errors as Record<string, string | undefined>)[field]}
                  </span>
                )}
              </div>
            ))}

            <div className="field">
              <label htmlFor="postalCode">Postal Code (optional)</label>
              <input id="postalCode" name="postalCode" type="text" value={form.postalCode} onChange={handleChange} />
            </div>

            <div className="field">
              <label htmlFor="county">County / State (optional)</label>
              <input id="county" name="county" type="text" value={form.county} onChange={handleChange} />
            </div>

            {errors.general && (
              <p role="alert" className="error general-error">{errors.general}</p>
            )}

            <button type="submit" disabled={submitting}>
              {submitting ? 'Placing order…' : 'Place Order'}
            </button>
          </form>

          {/* Order summary */}
          <div className="checkout-summary">
            <h2>Order Summary</h2>
            {items.map((item) => (
              <div key={item.productId} className="checkout-summary-item">
                <span>{item.productName} × {item.quantity}</span>
                <span>${(item.priceAtPurchase * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="checkout-total">
              <span>Total</span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>
            <Link to="/cart" className="btn-secondary" style={{ marginTop: '12px', display: 'inline-block' }}>
              Edit Cart
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
