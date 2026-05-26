import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { Pagination } from '../components/Pagination';
import { request, PRODUCTS_API } from '../lib/api';
import type { Page, ProductSummary } from '../types/products';

export function ProductList() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    request<Page<ProductSummary>>(`${PRODUCTS_API}?page=${page}&size=20`)
      .then((data) => {
        setProducts(data.content);
        setTotalPages(data.totalPages);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load products');
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <>
      <NavBar />
      <main className="page-content">
        <h1>Products</h1>

        {loading && <p className="status-msg">Loading…</p>}
        {error && <p className="status-msg error">{error}</p>}

        {!loading && !error && products.length === 0 && (
          <p className="status-msg">No products found.</p>
        )}

        <div className="product-grid">
          {products.map((p) => (
            <Link key={p.id} to={`/products/${p.id}`} className="product-card">
              {p.thumbnailUrl && (
                <img src={p.thumbnailUrl} alt={p.name} className="product-thumb" />
              )}
              <div className="product-card-body">
                <span className={`badge ${p.isOfficial ? 'badge-official' : 'badge-user'}`}>
                  {p.isOfficial ? 'Official' : 'User'}
                </span>
                <h3>{p.name}</h3>
                <p className="product-category">{p.category}</p>
                <p className="product-price">${p.price.toFixed(2)}</p>
              </div>
            </Link>
          ))}
        </div>

        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </main>
    </>
  );
}
