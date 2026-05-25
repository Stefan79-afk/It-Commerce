import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { ApiError, request, PRODUCTS_API } from '../lib/api';

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

interface ProductCreateResponse {
  id: string;
  createdAt: string;
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
  if (!form.stockQuantity) {
    errors.stockQuantity = 'Stock quantity is required';
  } else if (isNaN(stock) || stock < 0) {
    errors.stockQuantity = 'Stock quantity must be 0 or more';
  }

  return errors;
}

async function uploadImages(productId: string, files: File[]) {
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
      body: JSON.stringify({ imageId: presign.imageId, fileUrl, displayOrder: i }),
    });
  }
}

export function CreateProduct() {
  const [form, setForm] = useState<FormState>({
    name: '',
    category: '',
    price: '',
    stockQuantity: '',
    description: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const navigate = useNavigate();

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined, general: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = validateForm(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const data = await request<ProductCreateResponse>(`${PRODUCTS_API}`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category.trim(),
          price: parseFloat(form.price),
          stockQuantity: parseInt(form.stockQuantity, 10),
          description: form.description.trim() || undefined,
        }),
      });

      if (selectedFiles.length > 0) {
        try {
          await uploadImages(data.id, selectedFiles);
        } catch (err) {
          const message = err instanceof ApiError ? err.message : 'Unknown error';
          setErrors({ general: `Product created, but image upload failed: ${message}` });
          return;
        }
      }

      navigate(`/products/${data.id}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create product';
      setErrors({ general: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <NavBar />
      <main className="page-content">
        <h1>Add Product</h1>
        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="product-form">
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

          <div className="field">
            <label htmlFor="images">Images (optional)</label>
            <input
              id="images"
              name="images"
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

          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Product'}
          </button>
        </form>
      </main>
    </>
  );
}
