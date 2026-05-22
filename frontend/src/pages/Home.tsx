import { Link } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { useAuth } from '../contexts/AuthContext';

export function Home() {
  const { logout } = useAuth();

  return (
    <>
      <NavBar />
      <main className="page-content home-hero">
        <h1>Welcome to ItCommerce</h1>
        <p>Buy and sell computer hardware with confidence.</p>
        <div className="home-actions">
          <Link to="/products" className="btn-primary">Browse Products</Link>
          <Link to="/wishlist" className="btn-secondary">My Wishlist</Link>
          <Link to="/products/create" className="btn-secondary">Add a Product</Link>
        </div>
        <button className="nav-btn" style={{ marginTop: '32px' }} onClick={() => { logout().catch(console.error); }}>
          Sign Out
        </button>
      </main>
    </>
  );
}
