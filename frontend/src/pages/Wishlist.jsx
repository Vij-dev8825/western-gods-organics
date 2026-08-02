import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import ProductCard from '../components/ProductCard';
import ChakkiWheel from '../components/ChakkiWheel';

export default function Wishlist() {
  const { productIds } = useWishlist();
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getProducts({}, token).then((d) => {
      setProducts(d.products);
      setLoading(false);
    });
  }, []);

  const wishedProducts = products.filter((p) => productIds.includes(p.id));

  if (loading) {
    return (
      <div className="center" style={{ padding: '120px 0' }}>
        <ChakkiWheel size={56} />
      </div>
    );
  }

  if (!wishedProducts.length) {
    return (
      <div className="container">
        <div className="empty-state">
          <ChakkiWheel size={70} spin={false} />
          <h2>Your wishlist is empty</h2>
          <p className="muted">Tap the heart on any product to save it here.</p>
          <Link to="/shop" className="btn btn-gold">Browse the shop</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container section">
      <div className="breadcrumb">Home / Wishlist</div>
      <h2>Your Wishlist</h2>
      <div className="grid">
        {wishedProducts.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
