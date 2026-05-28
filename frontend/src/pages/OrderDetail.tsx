import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { ApiError, request, ORDERS_API } from '../lib/api';
import type { Order } from '../types/orders';

const CANCELLABLE = new Set<Order['status']>(['CREATED', 'PROCESSING']);

export function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    request<Order>(`${ORDERS_API}/${orderId}`)
      .then(setOrder)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load order');
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  async function handleCancel() {
    if (!orderId) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const updated = await request<Order>(`${ORDERS_API}/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      setOrder(updated);
    } catch (err) {
      setCancelError(err instanceof ApiError ? err.message : 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <NavBar />
      <main className="page-content">
        <Link to="/orders" className="back-link">← Back to Orders</Link>

        {loading && <p className="status-msg">Loading…</p>}
        {error && <p className="status-msg error">{error}</p>}

        {order && (
          <div className="order-detail-card">
            <div className="order-detail-header">
              <h2>Order Detail</h2>
              <span className={`status-badge status-${order.status}`}>{order.status}</span>
              <span className="order-total">${order.totalPrice.toFixed(2)}</span>
            </div>

            <p className="order-date">
              Placed: {new Date(order.createdAt).toLocaleString()}
            </p>

            {order.items && order.items.length > 0 && (
              <div className="order-table-wrapper">
                <table className="order-items-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <tr key={item.productId}>
                        <td>{item.productName}</td>
                        <td>{item.quantity}</td>
                        <td>${item.priceAtPurchase.toFixed(2)}</td>
                        <td>${(item.priceAtPurchase * item.quantity).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {order.shippingAddressSnapshot && (
              <div className="order-address">
                <h3>Shipping Address</h3>
                <p>{order.shippingAddressSnapshot.street}</p>
                <p>
                  {order.shippingAddressSnapshot.city}
                  {order.shippingAddressSnapshot.postalCode && `, ${order.shippingAddressSnapshot.postalCode}`}
                </p>
                {order.shippingAddressSnapshot.county && (
                  <p>{order.shippingAddressSnapshot.county}</p>
                )}
                <p>{order.shippingAddressSnapshot.country}</p>
              </div>
            )}

            {CANCELLABLE.has(order.status) && (
              <div className="order-actions">
                {cancelError && <p className="error" style={{ marginBottom: '8px' }}>{cancelError}</p>}
                <button
                  className="btn-danger"
                  onClick={() => { handleCancel().catch(console.error); }}
                  disabled={cancelling}
                >
                  {cancelling ? 'Cancelling…' : 'Cancel Order'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
