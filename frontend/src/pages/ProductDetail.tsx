import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { ApiError, request, PRODUCTS_API } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import type { Page, Product, WishlistItem } from '../types/products';

function getCartButtonLabel(stockQuantity: number | undefined, addedToCart: boolean): string {
  if (stockQuantity === 0) return 'Out of Stock';
  if (addedToCart) return '✓ Added to Cart';
  return 'Add to Cart';
}

export function ProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const { loggedIn, userId } = useAuth();
  const { addItem } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inWishlist, setInWishlist] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    request<Product>(`${PRODUCTS_API}/${productId}`)
      .then(setProduct)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load product');
      })
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => {
    if (!userId || !productId) return;
    request<Page<WishlistItem>>(`${PRODUCTS_API}/wishlists/${userId}?page=0&size=200`)
      .then((data) => {
        setInWishlist(data.content.some((item) => item.productId === productId));
      })
      .catch(() => { /* leave inWishlist as false on error */ });
  }, [userId, productId]);

  function handleAddToCart() {
    if (!product) return;
    addItem({ productId: product.id, productName: product.name, priceAtPurchase: product.price, stockQuantity: product.stockQuantity });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  }

  async function handleAddToWishlist() {
    if (!userId || !productId) return;
    setWishlistBusy(true);
    try {
      await request(`${PRODUCTS_API}/wishlists/${userId}/${productId}`, { method: 'POST' });
      setInWishlist(true);
    } catch (err) {
      // 409 means already in wishlist — treat as success
      if (err instanceof ApiError && err.status === 409) {
        setInWishlist(true);
      }
    } finally {
      setWishlistBusy(false);
    }
  }

  async function handleRemoveFromWishlist() {
    if (!userId || !productId) return;
    setWishlistBusy(true);
    try {
      await request(`${PRODUCTS_API}/wishlists/${userId}/${productId}`, { method: 'DELETE' });
      setInWishlist(false);
    } catch {
      // keep current state on failure
    } finally {
      setWishlistBusy(false);
    }
  }

  return (
    <>
      <NavBar />
      <main className="page-content">
        <Link to="/products" className="back-link">← Back to Products</Link>

        {loading && <p className="status-msg">Loading…</p>}
        {error && <p className="status-msg error">{error}</p>}

        {product && (
          <div className="product-detail">
            <div className="product-detail-header">
              <h1>{product.name}</h1>
              <span className={`badge ${product.isOfficial ? 'badge-official' : 'badge-user'}`}>
                {product.isOfficial ? 'Official' : 'User listing'}
              </span>
            </div>

            <p className="product-detail-price">${product.price.toFixed(2)}</p>
            <p className="product-detail-category">Category: {product.category}</p>
            {product.stockQuantity !== undefined && (
              <p>In stock: {product.stockQuantity}</p>
            )}
            {product.description && <p className="product-detail-desc">{product.description}</p>}

            {product.technicalSpecs && Object.keys(product.technicalSpecs).length > 0 && (
              <div className="product-specs">
                <h3>Technical Specs</h3>
                <dl>
                  {Object.entries(product.technicalSpecs).map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {product.images && product.images.length > 0 && (
              <div className="product-images">
                {product.images
                  .slice()
                  .sort((a, b) => a.displayOrder - b.displayOrder)
                  .map((img) => (
                    <img key={img.id} src={img.fileUrl} alt={product.name} className="product-img" />
                  ))}
              </div>
            )}

            <div className="cart-actions">
              <button
                onClick={handleAddToCart}
                disabled={product.stockQuantity === 0}
              >
                {getCartButtonLabel(product.stockQuantity, addedToCart)}
              </button>
            </div>

            {loggedIn && (
              <div className="wishlist-actions">
                {inWishlist ? (
                  <button
                    onClick={() => void handleRemoveFromWishlist()}
                    disabled={wishlistBusy}
                    className="btn-secondary"
                  >
                    {wishlistBusy ? 'Removing…' : '♥ Remove from Wishlist'}
                  </button>
                ) : (
                  <button
                    onClick={() => void handleAddToWishlist()}
                    disabled={wishlistBusy}
                  >
                    {wishlistBusy ? 'Adding…' : '♡ Add to Wishlist'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
