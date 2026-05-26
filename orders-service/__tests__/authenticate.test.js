import { jest } from "@jest/globals";
import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
const publicKeyPem  = publicKey.export({ type: "spki", format: "pem" });

const mockGetSigningKey = jest.fn();
jest.unstable_mockModule("jwks-rsa", () => ({
    default: jest.fn(() => ({ getSigningKey: mockGetSigningKey })),
}));

const { default: authenticate } = await import("../src/middleware/authenticate.js");
const { default: request }      = await import("supertest");
const { default: express }      = await import("express");
const { default: errorHandler } = await import("../src/middleware/errorHandler.js");
const { default: jwt }          = await import("jsonwebtoken");

function makeApp() {
    const app = express();
    app.use(express.json());
    app.get("/protected", authenticate, (req, res) => {
        res.json({ userId: req.user.userId, roles: req.user.roles });
    });
    app.use(errorHandler);
    return app;
}

function signToken(overrides = {}, jwtOpts = {}) {
    return jwt.sign(
        {
            iss: "itcommerce-users",
            aud: "itcommerce-api",
            sub: "user-uuid-1",
            email: "test@example.com",
            roles: ["USER"],
            jti: "jti-1",
            ...overrides,
        },
        { key: privateKeyPem },
        { algorithm: "RS256", expiresIn: "10m", ...jwtOpts }
    );
}

describe("authenticate middleware", () => {
    beforeEach(() => {
        mockGetSigningKey.mockResolvedValue({ getPublicKey: () => publicKeyPem });
    });

    test("valid JWT → 200 with req.user populated", async () => {
        const res = await request(makeApp())
            .get("/protected")
            .set("Authorization", `Bearer ${signToken()}`);
        expect(res.status).toBe(200);
        expect(res.body.userId).toBe("user-uuid-1");
        expect(res.body.roles).toEqual(["USER"]);
    });

    test("missing Authorization header → 401", async () => {
        const res = await request(makeApp()).get("/protected");
        expect(res.status).toBe(401);
    });

    test("malformed token → 401", async () => {
        const res = await request(makeApp())
            .get("/protected")
            .set("Authorization", "Bearer not-a-jwt");
        expect(res.status).toBe(401);
    });

    test("expired token → 401", async () => {
        const res = await request(makeApp())
            .get("/protected")
            .set("Authorization", `Bearer ${signToken({}, { expiresIn: "-1s" })}`);
        expect(res.status).toBe(401);
    });

    test("wrong issuer → 401", async () => {
        const res = await request(makeApp())
            .get("/protected")
            .set("Authorization", `Bearer ${signToken({ iss: "bad-issuer" })}`);
        expect(res.status).toBe(401);
    });

    test("wrong audience → 401", async () => {
        const res = await request(makeApp())
            .get("/protected")
            .set("Authorization", `Bearer ${signToken({ aud: "bad-audience" })}`);
        expect(res.status).toBe(401);
    });
});
