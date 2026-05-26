import { Link } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { useCart } from '../contexts/CartContext';

export function Cart() {
  const { items, removeItem, updateQuantity, totalPrice } = useCart();

  return (
    <>
      <NavBar />
      <main className="page-content">
        <h1>Shopping Cart</h1>

        {items.length === 0 && (
          <p className="status-msg">
            Your cart is empty. <Link to="/products">Browse products</Link>
          </p>
        )}

        {items.length > 0 && (
          <>
            <ul className="cart-items" style={{ listStyle: 'none' }}>
              {items.map((item) => (
                <li key={item.productId} className="cart-item">
                  <div className="cart-item-info">
                    <p className="cart-item-name">{item.productName}</p>
                    <p className="cart-item-price">${item.priceAtPurchase.toFixed(2)} each</p>
                  </div>

                  <div className="cart-item-qty">
                    <button
                      aria-label="decrease quantity"
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      aria-label="increase quantity"
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>

                  <p className="cart-item-subtotal">
                    ${(item.priceAtPurchase * item.quantity).toFixed(2)}
                  </p>

                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => removeItem(item.productId)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>

            <div className="cart-summary">
              <div className="cart-total">
                <span>Total</span>
                <span>${totalPrice.toFixed(2)}</span>
              </div>
              <div className="cart-actions-row">
                <Link to="/checkout" className="btn-primary">Proceed to Checkout</Link>
                <Link to="/products" className="btn-secondary">Continue Shopping</Link>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
