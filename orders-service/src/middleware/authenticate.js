import jwt from "jsonwebtoken";
import { promisify } from "node:util";
import jwksRsa from "jwks-rsa";

const JWKS_URL = process.env.ORDERS_JWKS_URL    ?? "http://users-service:8000/.well-known/jwks.json";
const ISSUER   = process.env.ORDERS_JWT_ISSUER  ?? "itcommerce-users";
const AUDIENCE = process.env.ORDERS_JWT_AUDIENCE ?? "itcommerce-api";

const client = jwksRsa({
    jwksUri:     JWKS_URL,
    cache:       true,
    cacheMaxAge: 5 * 60 * 1000,
    rateLimit:   true,
});

const jwtVerify = promisify(jwt.verify);

export default async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            return next(Object.assign(new Error("Missing or invalid Authorization header"), { status: 401 }));
        }

        const token = authHeader.slice(7);

        // Decode header to extract kid without trusting the payload
        const decoded = jwt.decode(token, { complete: true });
        if (!decoded) {
            return next(Object.assign(new Error("Malformed token"), { status: 401 }));
        }

        const signingKey = await client.getSigningKey(decoded.header.kid);
        const publicKey  = signingKey.getPublicKey();

        const payload = await jwtVerify(token, publicKey, {
            algorithms: ["RS256"],
            issuer:     ISSUER,
            audience:   AUDIENCE,
        });

        req.user = { userId: payload.sub, roles: payload.roles ?? [] };
        next();
    } catch (err) {
        next(Object.assign(new Error(err.message), { status: 401 }));
    }
}
