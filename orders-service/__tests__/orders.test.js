import { jest } from "@jest/globals";
import { generateKeyPairSync } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

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

afterEach(async () => {
    await mongoose.connection.collection("orders").deleteMany({});
});

function signToken(sub = "user-uuid-1") {
    return jwt.sign(
        { iss: "itcommerce-users", aud: "itcommerce-api", sub,
          email: "test@example.com", roles: ["USER"], jti: "jti-1" },
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
});
