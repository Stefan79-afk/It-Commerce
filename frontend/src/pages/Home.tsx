import { useAuth } from '../contexts/AuthContext';

export function Home() {
  const { logout } = useAuth();

  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1>Welcome to ItCommerce</h1>
      <p style={{ marginTop: '16px', marginBottom: '24px' }}>You are signed in.</p>
      <button onClick={() => void logout()}>Sign Out</button>
    </div>
  );
}
