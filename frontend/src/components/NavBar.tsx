import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';

export function NavBar() {
  const { loggedIn, logout } = useAuth();
  const { totalItems } = useCart();

  return (
    <nav className="navbar">
      <Link to="/products" className="nav-brand">ItCommerce</Link>
      <div className="nav-links">
        <Link to="/products">Products</Link>
        <Link to="/cart">
          Cart{totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
        </Link>
        {loggedIn && <Link to="/wishlist">Wishlist</Link>}
        {loggedIn && <Link to="/orders">Orders</Link>}
        {loggedIn && <Link to="/products/create">Add Product</Link>}
        {loggedIn
          ? <button className="nav-btn" onClick={() => { logout().catch(console.error); }}>Sign Out</button>
          : <Link to="/login">Sign In</Link>}
      </div>
    </nav>
  );
}
