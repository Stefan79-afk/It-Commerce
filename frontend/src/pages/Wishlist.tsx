import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { Pagination } from '../components/Pagination';
import { request, PRODUCTS_API } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Page, WishlistItem } from '../types/products';

export function Wishlist() {
  const { userId } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    request<Page<WishlistItem>>(`${PRODUCTS_API}/wishlists/${userId}?page=${page}&size=20`)
      .then((data) => {
        setItems(data.content);
        setTotalPages(data.totalPages);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load wishlist');
      })
      .finally(() => setLoading(false));
  }, [userId, page]);

  async function handleRemove(productId: string) {
    if (!userId) return;
    setRemoving(productId);
    try {
      await request(`${PRODUCTS_API}/wishlists/${userId}/${productId}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((item) => item.productId !== productId));
    } catch {
      // keep item in list on failure
    } finally {
      setRemoving(null);
    }
  }

  return (
    <>
      <NavBar />
      <main className="page-content">
        <h1>My Wishlist</h1>

        {loading && <p className="status-msg">Loading…</p>}
        {error && <p className="status-msg error">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="status-msg">
            Your wishlist is empty. <Link to="/products">Browse products</Link>
          </p>
        )}

        <ul className="wishlist-list">
          {items.map((item) => (
            <li key={item.productId} className="wishlist-item">
              <div className="wishlist-item-info">
                <Link to={`/products/${item.productId}`} className="wishlist-product-link">
                  View Product
                </Link>
                {item.addedAt && (
                  <span className="wishlist-added-at">
                    Added {new Date(item.addedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <button
                className="btn-secondary btn-sm"
                disabled={removing === item.productId}
                onClick={() => void handleRemove(item.productId)}
              >
                {removing === item.productId ? 'Removing…' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>

        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </main>
    </>
  );
}
