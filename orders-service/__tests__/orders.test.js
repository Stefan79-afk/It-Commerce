import { jest } from "@jest/globals";
import { generateKeyPairSync } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import Order from "../src/models/Order.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
const publicKeyPem  = publicKey.export({ type: "spki", format: "pem" });

const mockGetSigningKey = jest.fn();
jest.unstable_mockModule("jwks-rsa", () => ({
    default: jest.fn(() => ({ getSigningKey: mockGetSigningKey })),
}));

const { default: app }     = await import("../src/app.js");
const { default: request } = await import("supertest");
const { default: jwt }     = await import("jsonwebtoken");

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    mockGetSigningKey.mockResolvedValue({ getPublicKey: () => publicKeyPem });
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(() => {
    // Default: products service accepts all stock reductions
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 204 });
});

afterEach(async () => {
    await mongoose.connection.collection("orders").deleteMany({});
    jest.restoreAllMocks();
});

function signToken(sub = "user-uuid-1", roles = ["USER"]) {
    return jwt.sign(
        { iss: "itcommerce-users", aud: "itcommerce-api", sub,
          email: "test@example.com", roles, jti: "jti-1" },
        { key: privateKeyPem },
        { algorithm: "RS256", expiresIn: "10m" }
    );
}

const validBody = {
    shippingAddressId:       "addr-uuid-1",
    shippingAddressSnapshot: { street: "Main St 1", city: "Timisoara", country: "Romania" },
    items: [
        { productId: "prod-uuid-1", productName: "RTX 4080", priceAtPurchase: 999.99, quantity: 2 },
    ],
};

const orderBase = {
    shippingAddressId:       "addr-uuid-1",
    shippingAddressSnapshot: { street: "Main St 1", city: "Timisoara", country: "Romania" },
    items: [{ productId: "prod-uuid-1", productName: "RTX 4080", priceAtPurchase: 999.99, quantity: 1 }],
    totalPrice: 999.99,
};

describe("POST /api/v1/orders", () => {
    test("creates order and computes totalPrice correctly", async () => {
        const res = await request(app)
            .post("/api/v1/orders")
            .set("Authorization", `Bearer ${signToken()}`)
            .send(validBody);

        expect(res.status).toBe(201);
        expect(res.body.status).toBe("CREATED");
        expect(res.body.userId).toBe("user-uuid-1");
        expect(res.body.totalPrice).toBeCloseTo(1999.98, 2);
        expect(res.body.id).toBeDefined();
        expect(res.body.createdAt).toBeDefined();
    });

    test("userId comes from JWT sub, not request body", async () => {
        const res = await request(app)
            .post("/api/v1/orders")
            .set("Authorization", `Bearer ${signToken("jwt-owner-uuid")}`)
            .send(validBody);

        expect(res.status).toBe(201);
        expect(res.body.userId).toBe("jwt-owner-uuid");
    });

    test("rejects request with missing token → 401", async () => {
        const res = await request(app)
            .post("/api/v1/orders")
            .send(validBody);

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("UNAUTHORIZED");
    });

    test("rejects empty items array → 400", async () => {
        const res = await request(app)
            .post("/api/v1/orders")
            .set("Authorization", `Bearer ${signToken()}`)
            .send({ ...validBody, items: [] });

        expect(res.status).toBe(400);
    });

    test("rejects missing required snapshot fields → 400", async () => {
        const res = await request(app)
            .post("/api/v1/orders")
            .set("Authorization", `Bearer ${signToken()}`)
            .send({ ...validBody, shippingAddressSnapshot: { street: "Only Street" } });

        expect(res.status).toBe(400);
    });

    test("returns 409 when products service reports insufficient stock", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 409,
            json: async () => ({ message: "Insufficient stock." }),
        });

        const res = await request(app)
            .post("/api/v1/orders")
            .set("Authorization", `Bearer ${signToken()}`)
            .send(validBody);

        expect(res.status).toBe(409);
        expect(res.body.error).toBe("CONFLICT");
        expect(res.body.message).toBe("Insufficient stock.");
    });

    test("compensates reduced items and returns 409 when a later item has insufficient stock", async () => {
        const multiItemBody = {
            ...validBody,
            items: [
                { productId: "prod-uuid-1", productName: "RTX 4080", priceAtPurchase: 999.99, quantity: 1 },
                { productId: "prod-uuid-2", productName: "CPU i9",   priceAtPurchase: 599.99, quantity: 1 },
            ],
        };

        global.fetch = jest.fn()
            .mockResolvedValueOnce({ ok: true,  status: 204 })  // first item reduces fine
            .mockResolvedValueOnce({             // second item: insufficient stock
                ok: false, status: 409,
                json: async () => ({ message: "Insufficient stock." }),
            })
            .mockResolvedValue({ ok: true, status: 204 });      // compensation restore call

        const res = await request(app)
            .post("/api/v1/orders")
            .set("Authorization", `Bearer ${signToken()}`)
            .send(multiItemBody);

        expect(res.status).toBe(409);
        expect(res.body.error).toBe("CONFLICT");
        // Restore call should have been made for the first item
        expect(global.fetch).toHaveBeenCalledTimes(3);
        const restoreCall = global.fetch.mock.calls[2];
        expect(restoreCall[0]).toContain("prod-uuid-1");
        expect(restoreCall[0]).toContain("restore-stock");
    });
});

describe("GET /api/v1/orders", () => {
    test("returns only the authenticated user's orders", async () => {
        await Order.create([
            { ...orderBase, userId: "user-A" },
            { ...orderBase, userId: "user-A" },
            { ...orderBase, userId: "user-B" },
        ]);
        const res = await request(app)
            .get("/api/v1/orders")
            .set("Authorization", `Bearer ${signToken("user-A")}`);
        expect(res.status).toBe(200);
        expect(res.body.content).toHaveLength(2);
        expect(res.body.content.every(o => o.userId === "user-A")).toBe(true);
        expect(res.body.totalElements).toBe(2);
        expect(res.body.totalPages).toBe(1);
    });

    test("paginates results with page and size params", async () => {
        await Order.create(
            Array.from({ length: 3 }, () => ({ ...orderBase, userId: "user-uuid-1" }))
        );
        const res = await request(app)
            .get("/api/v1/orders?page=0&size=2")
            .set("Authorization", `Bearer ${signToken()}`);
        expect(res.status).toBe(200);
        expect(res.body.content).toHaveLength(2);
        expect(res.body.page).toBe(0);
        expect(res.body.size).toBe(2);
        expect(res.body.totalElements).toBe(3);
        expect(res.body.totalPages).toBe(2);
    });

    test("returns empty list when user has no orders", async () => {
        const res = await request(app)
            .get("/api/v1/orders")
            .set("Authorization", `Bearer ${signToken("no-orders-user")}`);
        expect(res.status).toBe(200);
        expect(res.body.content).toHaveLength(0);
        expect(res.body.totalElements).toBe(0);
    });

    test("rejects missing token → 401", async () => {
        const res = await request(app).get("/api/v1/orders");
        expect(res.status).toBe(401);
    });
});

describe("GET /api/v1/orders/:orderId", () => {
    test("owner fetches their own order with full details", async () => {
        const order = await Order.create({ ...orderBase, userId: "user-uuid-1" });
        const res = await request(app)
            .get(`/api/v1/orders/${order._id}`)
            .set("Authorization", `Bearer ${signToken("user-uuid-1")}`);
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(order._id);
        expect(res.body.shippingAddressSnapshot).toBeDefined();
        expect(res.body.items).toHaveLength(1);
        expect(res.body.updatedAt).toBeDefined();
    });

    test("non-owner gets 403 Forbidden", async () => {
        const order = await Order.create({ ...orderBase, userId: "user-uuid-1" });
        const res = await request(app)
            .get(`/api/v1/orders/${order._id}`)
            .set("Authorization", `Bearer ${signToken("other-user")}`);
        expect(res.status).toBe(403);
        expect(res.body.error).toBe("FORBIDDEN");
    });

    test("admin role bypasses ownership check", async () => {
        const order = await Order.create({ ...orderBase, userId: "user-uuid-1" });
        const res = await request(app)
            .get(`/api/v1/orders/${order._id}`)
            .set("Authorization", `Bearer ${signToken("admin-uuid", ["ADMIN"])}`);
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(order._id);
    });

    test("non-existent orderId → 404", async () => {
        const res = await request(app)
            .get("/api/v1/orders/does-not-exist")
            .set("Authorization", `Bearer ${signToken()}`);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe("RESOURCE_NOT_FOUND");
    });

    test("rejects missing token → 401", async () => {
        const res = await request(app).get("/api/v1/orders/some-id");
        expect(res.status).toBe(401);
    });
});

describe("PATCH /api/v1/orders/:orderId", () => {
    test("user cancels CREATED order → 200 with status CANCELLED", async () => {
        const order = await Order.create({ ...orderBase, userId: "user-uuid-1", status: "CREATED" });
        const res = await request(app)
            .patch(`/api/v1/orders/${order._id}`)
            .set("Authorization", `Bearer ${signToken()}`)
            .send({ status: "CANCELLED" });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("CANCELLED");
        expect(res.body.items).toBeDefined();
        expect(res.body.shippingAddressSnapshot).toBeDefined();
    });

    test("user cancels PROCESSING order → 200", async () => {
        const order = await Order.create({ ...orderBase, userId: "user-uuid-1", status: "PROCESSING" });
        const res = await request(app)
            .patch(`/api/v1/orders/${order._id}`)
            .set("Authorization", `Bearer ${signToken()}`)
            .send({ status: "CANCELLED" });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("CANCELLED");
    });

    test("user cannot cancel SHIPPED order → 400", async () => {
        const order = await Order.create({ ...orderBase, userId: "user-uuid-1", status: "SHIPPED" });
        const res = await request(app)
            .patch(`/api/v1/orders/${order._id}`)
            .set("Authorization", `Bearer ${signToken()}`)
            .send({ status: "CANCELLED" });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("VALIDATION_ERROR");
    });

    test("non-admin cannot set status to SHIPPED → 403", async () => {
        const order = await Order.create({ ...orderBase, userId: "user-uuid-1", status: "CREATED" });
        const res = await request(app)
            .patch(`/api/v1/orders/${order._id}`)
            .set("Authorization", `Bearer ${signToken()}`)
            .send({ status: "SHIPPED" });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe("FORBIDDEN");
    });

    test("admin can set status to any valid value → 200", async () => {
        const order = await Order.create({ ...orderBase, userId: "user-uuid-1", status: "CREATED" });
        const res = await request(app)
            .patch(`/api/v1/orders/${order._id}`)
            .set("Authorization", `Bearer ${signToken("admin-uuid", ["ADMIN"])}`)
            .send({ status: "SHIPPED" });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("SHIPPED");
    });

    test("non-owner cannot patch order → 403", async () => {
        const order = await Order.create({ ...orderBase, userId: "user-uuid-1" });
        const res = await request(app)
            .patch(`/api/v1/orders/${order._id}`)
            .set("Authorization", `Bearer ${signToken("other-user")}`)
            .send({ status: "CANCELLED" });
        expect(res.status).toBe(403);
    });

    test("invalid status value → 400", async () => {
        const order = await Order.create({ ...orderBase, userId: "user-uuid-1" });
        const res = await request(app)
            .patch(`/api/v1/orders/${order._id}`)
            .set("Authorization", `Bearer ${signToken()}`)
            .send({ status: "INVALID" });
        expect(res.status).toBe(400);
    });

    test("non-existent orderId → 404", async () => {
        const res = await request(app)
            .patch("/api/v1/orders/does-not-exist")
            .set("Authorization", `Bearer ${signToken()}`)
            .send({ status: "CANCELLED" });
        expect(res.status).toBe(404);
    });

    test("cancelling an order restores stock for every item", async () => {
        const order = await Order.create({
            ...orderBase,
            userId: "user-uuid-1",
            status: "CREATED",
            items: [
                { productId: "prod-uuid-1", productName: "RTX 4080", priceAtPurchase: 999.99, quantity: 2 },
                { productId: "prod-uuid-2", productName: "CPU i9",   priceAtPurchase: 599.99, quantity: 1 },
            ],
        });

        global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 204 });

        const res = await request(app)
            .patch(`/api/v1/orders/${order._id}`)
            .set("Authorization", `Bearer ${signToken()}`)
            .send({ status: "CANCELLED" });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("CANCELLED");

        // One restore-stock call per item
        expect(global.fetch).toHaveBeenCalledTimes(2);
        const calls = global.fetch.mock.calls;
        expect(calls[0][0]).toContain("prod-uuid-1");
        expect(calls[0][0]).toContain("restore-stock");
        expect(JSON.parse(calls[0][1].body).quantity).toBe(2);
        expect(calls[1][0]).toContain("prod-uuid-2");
        expect(JSON.parse(calls[1][1].body).quantity).toBe(1);
    });

    test("admin setting CANCELLED on an already-cancelled order does not restore stock again", async () => {
        const order = await Order.create({ ...orderBase, userId: "user-uuid-1", status: "CANCELLED" });

        global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 204 });

        const res = await request(app)
            .patch(`/api/v1/orders/${order._id}`)
            .set("Authorization", `Bearer ${signToken("admin-uuid", ["ADMIN"])}`)
            .send({ status: "CANCELLED" });

        expect(res.status).toBe(200);
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
