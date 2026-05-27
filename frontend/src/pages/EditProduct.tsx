import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { ApiError, request, PRODUCTS_API } from '../lib/api';
import type { Product, ProductImage } from '../types/products';

interface FormState {
  name: string;
  category: string;
  price: string;
  stockQuantity: string;
  description: string;
}

interface FormErrors {
  name?: string;
  category?: string;
  price?: string;
  stockQuantity?: string;
  general?: string;
}

interface ImagePresignResponse {
  imageId: string;
  uploadUrl: string;
  expiresIn: number;
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  if (!form.category.trim()) errors.category = 'Category is required';

  const price = parseFloat(form.price);
  if (!form.price) {
    errors.price = 'Price is required';
  } else if (isNaN(price) || price <= 0) {
    errors.price = 'Price must be a positive number';
  }

  const stock = parseInt(form.stockQuantity, 10);
  if (form.stockQuantity === '') {
    errors.stockQuantity = 'Stock quantity is required';
  } else if (isNaN(stock) || stock < 0) {
    errors.stockQuantity = 'Stock quantity must be 0 or more';
  }

  return errors;
}

async function uploadNewImages(productId: string, files: File[], startOrder: number) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const presign = await request<ImagePresignResponse>(
      `${PRODUCTS_API}/${productId}/images/presign`,
      { method: 'POST', body: JSON.stringify({ fileName: file.name, contentType: file.type }) },
    );
    await fetch(presign.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });
    const fileUrl = presign.uploadUrl.split('?')[0];
    await request(`${PRODUCTS_API}/${productId}/images/confirm`, {
      method: 'POST',
      body: JSON.stringify({ imageId: presign.imageId, fileUrl, displayOrder: startOrder + i }),
    });
  }
}

export function EditProduct() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();

  const [loadError, setLoadError] = useState<string | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [form, setForm] = useState<FormState>({
    name: '', category: '', price: '', stockQuantity: '', description: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!productId) return;
    request<Product>(`${PRODUCTS_API}/${productId}`)
      .then((product) => {
        setForm({
          name: product.name,
          category: product.category,
          price: String(product.price),
          stockQuantity: String(product.stockQuantity ?? ''),
          description: product.description ?? '',
        });
        setImages(
          [...(product.images ?? [])].sort((a, b) => a.displayOrder - b.displayOrder),
        );
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load product');
      });
  }, [productId]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined, general: undefined }));
  }

  async function handleDeleteImage(imageId: string) {
    if (!productId) return;
    await request(`${PRODUCTS_API}/${productId}/images/${imageId}`, { method: 'DELETE' });
    setImages((prev) => prev.filter((img) => img.id !== imageId));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = validateForm(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      await request(`${PRODUCTS_API}/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category.trim(),
          price: parseFloat(form.price),
          stockQuantity: parseInt(form.stockQuantity, 10),
          description: form.description.trim() || undefined,
        }),
      });

      if (selectedFiles.length > 0) {
        await uploadNewImages(productId!, selectedFiles, images.length);
      }

      navigate(`/products/${productId}`);
    } catch (err) {
      setErrors({ general: err instanceof ApiError ? err.message : 'Failed to save product' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteProduct() {
    if (!productId || !window.confirm('Delete this product? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await request(`${PRODUCTS_API}/${productId}`, { method: 'DELETE' });
      navigate('/products');
    } catch (err) {
      setErrors({ general: err instanceof ApiError ? err.message : 'Failed to delete product' });
      setDeleting(false);
    }
  }

  if (loadError) {
    return (
      <>
        <NavBar />
        <main className="page-content">
          <p className="status-msg error">{loadError}</p>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="page-content">
        <Link to={`/products/${productId}`} className="back-link">← Back to Product</Link>
        <h1>Edit Product</h1>

        <form onSubmit={(e) => void handleSave(e)} noValidate className="product-form">
          <div className="field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              aria-invalid={!!errors.name}
            />
            {errors.name && <span role="alert" className="error">{errors.name}</span>}
          </div>

          <div className="field">
            <label htmlFor="category">Category</label>
            <input
              id="category"
              name="category"
              type="text"
              value={form.category}
              onChange={handleChange}
              aria-invalid={!!errors.category}
            />
            {errors.category && <span role="alert" className="error">{errors.category}</span>}
          </div>

          <div className="field">
            <label htmlFor="price">Price ($)</label>
            <input
              id="price"
              name="price"
              type="number"
              min="0.01"
              step="0.01"
              value={form.price}
              onChange={handleChange}
              aria-invalid={!!errors.price}
            />
            {errors.price && <span role="alert" className="error">{errors.price}</span>}
          </div>

          <div className="field">
            <label htmlFor="stockQuantity">Stock Quantity</label>
            <input
              id="stockQuantity"
              name="stockQuantity"
              type="number"
              min="0"
              value={form.stockQuantity}
              onChange={handleChange}
              aria-invalid={!!errors.stockQuantity}
            />
            {errors.stockQuantity && (
              <span role="alert" className="error">{errors.stockQuantity}</span>
            )}
          </div>

          <div className="field">
            <label htmlFor="description">Description (optional)</label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
            />
          </div>

          {images.length > 0 && (
            <div className="field">
              <label>Current Images</label>
              <div className="image-list">
                {images.map((img) => (
                  <div key={img.id} className="image-item">
                    <img src={img.fileUrl} alt="product" className="product-img-thumb" />
                    <button
                      type="button"
                      className="btn-danger btn-sm"
                      aria-label="Delete image"
                      onClick={() => { void handleDeleteImage(img.id); }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="newImages">Add Images (optional)</label>
            <input
              id="newImages"
              name="newImages"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))}
            />
            {selectedFiles.length > 0 && (
              <ul className="file-list">
                {selectedFiles.map((f) => <li key={f.name}>{f.name}</li>)}
              </ul>
            )}
          </div>

          {errors.general && (
            <p role="alert" className="error general-error">{errors.general}</p>
          )}

          <div className="form-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => { void handleDeleteProduct(); }}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete Product'}
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
