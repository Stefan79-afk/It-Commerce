import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function NavBar() {
  const { loggedIn, logout } = useAuth();

  return (
    <nav className="navbar">
      <Link to="/products" className="nav-brand">ItCommerce</Link>
      <div className="nav-links">
        <Link to="/products">Products</Link>
        {loggedIn && <Link to="/wishlist">Wishlist</Link>}
        {loggedIn && <Link to="/products/create">Add Product</Link>}
        {loggedIn
          ? <button className="nav-btn" onClick={() => void logout()}>Sign Out</button>
          : <Link to="/login">Sign In</Link>}
      </div>
    </nav>
  );
}
