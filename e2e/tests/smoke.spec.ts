import { test, expect } from '@playwright/test';

const UNIQUE = Date.now();
const EMAIL = `smoke-${UNIQUE}@test.com`;
const PASSWORD = 'SmokeE2E1!';
const PRODUCT_NAME = `E2E-GPU-${UNIQUE}`;
let productId = '';

test('ItCommerce full smoke test', async ({ page }) => {

  // ── 1. Register ──────────────────────────────────────────────────────────
  await test.step('register new user', async () => {
    await page.goto('/register');
    await page.fill('[name="firstName"]', 'E2E');
    await page.fill('[name="lastName"]', 'Tester');
    await page.fill('[name="email"]', EMAIL);
    await page.fill('[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/login');
  });

  // ── 2. Login ──────────────────────────────────────────────────────────────
  await test.step('login', async () => {
    // already on /login from the register redirect
    await page.fill('[name="email"]', EMAIL);
    await page.fill('[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    await expect(page.getByText(/welcome to itcommerce/i)).toBeVisible();
  });

  // ── 3. Browse products ────────────────────────────────────────────────────
  // Scope to .navbar to avoid matching the "Browse Products" button on the Home page.
  await test.step('browse products page', async () => {
    await page.locator('.navbar').getByRole('link', { name: 'Products', exact: true }).click();
    await expect(page).toHaveURL('/products');
    await expect(page.locator('main')).toBeVisible();
  });

  // ── 4. Create product ─────────────────────────────────────────────────────
  // Click NavBar "Add Product" — in-SPA navigation to a protected route.
  await test.step('create product', async () => {
    await page.locator('.navbar').getByRole('link', { name: 'Add Product' }).click();
    await expect(page).toHaveURL('/products/create');
    await page.fill('[name="name"]', PRODUCT_NAME);
    await page.fill('[name="category"]', 'E2E');
    await page.fill('[name="price"]', '49.99');
    await page.fill('[name="stockQuantity"]', '5');
    await page.click('button[type="submit"]');
    // CreateProduct.tsx:87 navigates to /products/:id (in-SPA)
    await page.waitForURL(/\/products\/[^/]+$/);
    productId = page.url().split('/products/')[1];
    expect(productId).toBeTruthy();
  });

  // ── 5. Add product to cart ────────────────────────────────────────────────
  // Still on the product detail page from the create redirect — no goto needed.
  await test.step('add product to cart', async () => {
    await expect(page.getByText(PRODUCT_NAME)).toBeVisible();
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByRole('button', { name: /Added to Cart/ })).toBeVisible();
  });

  // ── 6. Checkout ───────────────────────────────────────────────────────────
  // All navigations are in-SPA; Cart and Checkout are accessible via links/buttons.
  await test.step('checkout and place order', async () => {
    // NavBar Cart link — accessible name may include badge text "1", use href selector.
    await page.locator('a[href="/cart"]').click();
    await expect(page).toHaveURL('/cart');
    await expect(page.getByText(PRODUCT_NAME)).toBeVisible();

    // "Proceed to Checkout" is a <Link> — in-SPA navigation to protected /checkout.
    await page.getByRole('link', { name: 'Proceed to Checkout' }).click();
    await expect(page).toHaveURL('/checkout');

    await page.fill('[name="street"]', '123 Main St');
    await page.fill('[name="city"]', 'Timisoara');
    await page.fill('[name="country"]', 'Romania');
    await page.getByRole('button', { name: 'Place Order' }).click();
    // Checkout.tsx:79 navigate(`/orders/${order.id}`) — in-SPA
    await page.waitForURL(/\/orders\/[^/]+$/);
  });

  // ── 7. Verify order in list ───────────────────────────────────────────────
  await test.step('verify order in list', async () => {
    // Scope to .navbar — order detail page also has a "← Back to Orders" link.
    await page.locator('.navbar').getByRole('link', { name: 'Orders', exact: true }).click();
    await expect(page).toHaveURL('/orders');
    await expect(page.getByText('CREATED').first()).toBeVisible();
  });
});
