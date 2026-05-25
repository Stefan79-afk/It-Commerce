import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Home } from './pages/Home';
import { ProductList } from './pages/ProductList';
import { ProductDetail } from './pages/ProductDetail';
import { CreateProduct } from './pages/CreateProduct';
import { Wishlist } from './pages/Wishlist';
import { Cart } from './pages/Cart';
import { Checkout } from './pages/Checkout';
import { OrderList } from './pages/OrderList';
import { OrderDetail } from './pages/OrderDetail';
import { Profile } from './pages/Profile';
import { ChangePassword } from './pages/ChangePassword';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/products/:productId" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />

          {/* Protected — ProtectedRoute renders <Outlet /> */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />
            <Route path="/products/create" element={<CreateProduct />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/orders" element={<OrderList />} />
            <Route path="/orders/:orderId" element={<OrderDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/change-password" element={<ChangePassword />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
