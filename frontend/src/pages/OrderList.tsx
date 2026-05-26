import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { Pagination } from '../components/Pagination';
import { request, ORDERS_API } from '../lib/api';
import type { OrderSummary } from '../types/orders';
import type { Page } from '../types/products';

export function OrderList() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    request<Page<OrderSummary>>(`${ORDERS_API}?page=${page}&size=20`)
      .then((data) => {
        setOrders(data.content);
        setTotalPages(data.totalPages);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load orders');
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <>
      <NavBar />
      <main className="page-content">
        <h1>My Orders</h1>

        {loading && <p className="status-msg">Loading…</p>}
        {error && <p className="status-msg error">{error}</p>}

        {!loading && !error && orders.length === 0 && (
          <p className="status-msg">
            No orders yet. <Link to="/products">Start shopping</Link>
          </p>
        )}

        <div className="orders-list">
          {orders.map((order) => (
            <Link key={order.id} to={`/orders/${order.id}`} className="order-row">
              <span className="order-id">{order.id}</span>
              <span className={`status-badge status-${order.status}`}>{order.status}</span>
              <span className="order-total">${order.totalPrice.toFixed(2)}</span>
              <span className="order-date">
                {new Date(order.createdAt).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>

        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </main>
    </>
  );
}
