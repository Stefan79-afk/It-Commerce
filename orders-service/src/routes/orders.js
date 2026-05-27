import express from "express";
import Order from "../models/Order.js";
import authenticate from "../middleware/authenticate.js";

const router = express.Router();

const CANCELLABLE    = new Set(["CREATED", "PROCESSING"]);
const ORDER_STATUSES = ["CREATED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

const PRODUCTS_URL = process.env.PRODUCTS_SERVICE_URL ?? "http://products-service:8080";

async function reduceStock(productId, quantity, bearerToken) {
    return fetch(`${PRODUCTS_URL}/api/v1/products/${productId}/reduce-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: bearerToken },
        body: JSON.stringify({ quantity }),
    });
}

async function restoreStock(productId, quantity, bearerToken) {
    await fetch(`${PRODUCTS_URL}/api/v1/products/${productId}/restore-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: bearerToken },
        body: JSON.stringify({ quantity }),
    }).catch(() => {});
}

function toSummary(o) {
    return { id: o._id, userId: o.userId, status: o.status,
             totalPrice: o.totalPrice, createdAt: o.createdAt };
}

function toOrder(o) {
    return { ...toSummary(o), shippingAddressSnapshot: o.shippingAddressSnapshot,
             items: o.items, updatedAt: o.updatedAt };
}

router.post("/orders", authenticate, async (req, res, next) => {
    try {
        const { shippingAddressId, shippingAddressSnapshot, items } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return next(Object.assign(new Error("items must be a non-empty array"), { status: 400 }));
        }

        // Reduce stock for each item; compensate already-reduced items on failure
        const bearerToken = req.headers.authorization;
        const reduced = [];
        for (const item of items) {
            const stockRes = await reduceStock(item.productId, item.quantity, bearerToken);
            if (!stockRes.ok) {
                for (const r of reduced) {
                    await restoreStock(r.productId, r.quantity, bearerToken);
                }
                if (stockRes.status === 404) {
                    return next(Object.assign(
                        new Error(`Product ${item.productId} not found.`),
                        { status: 409 }
                    ));
                }
                const stockBody = await stockRes.json().catch(() => ({}));
                return next(Object.assign(
                    new Error(stockBody.message ?? `Insufficient stock for product ${item.productId}.`),
                    { status: 409 }
                ));
            }
            reduced.push({ productId: item.productId, quantity: item.quantity });
        }

        // Compute server-side — never trust client-supplied total
        const totalPrice = items.reduce((sum, i) => sum + i.priceAtPurchase * i.quantity, 0);

        const order = await Order.create({
            userId:                  req.user.userId,
            shippingAddressId,
            shippingAddressSnapshot,
            items,
            totalPrice,
        });

        res.status(201).json(toSummary(order));
    } catch (err) {
        if (err.name === "ValidationError") {
            return next(Object.assign(new Error(err.message), { status: 400 }));
        }
        next(err);
    }
});

router.get("/orders", authenticate, async (req, res, next) => {
    try {
        const page = Math.max(0, Number.parseInt(req.query.page ?? "0", 10) || 0);
        const size = Math.max(1, Number.parseInt(req.query.size ?? "20", 10) || 20);
        const userId = req.user.userId;

        const [docs, totalElements] = await Promise.all([
            Order.find({ userId }).sort({ createdAt: -1 }).skip(page * size).limit(size).lean(),
            Order.countDocuments({ userId }),
        ]);

        res.json({
            content:      docs.map(toSummary),
            page,
            size,
            totalElements,
            totalPages:   Math.ceil(totalElements / size) || 0,
        });
    } catch (err) {
        next(err);
    }
});

router.get("/orders/:orderId", authenticate, async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.orderId).lean();

        if (!order) {
            return next(Object.assign(new Error("Order not found"), { status: 404 }));
        }

        const isOwner = order.userId === req.user.userId;
        const isAdmin = req.user.roles.includes("ADMIN");

        if (!isOwner && !isAdmin) {
            return next(Object.assign(new Error("Access denied"), { status: 403 }));
        }

        res.json(toOrder(order));
    } catch (err) {
        next(err);
    }
});

router.patch("/orders/:orderId", authenticate, async (req, res, next) => {
    try {
        const { status } = req.body;

        if (!status || !ORDER_STATUSES.includes(status)) {
            return next(Object.assign(
                new Error(`status must be one of: ${ORDER_STATUSES.join(", ")}`),
                { status: 400 }
            ));
        }

        const order = await Order.findById(req.params.orderId);

        if (!order) {
            return next(Object.assign(new Error("Order not found"), { status: 404 }));
        }

        const isOwner = order.userId === req.user.userId;
        const isAdmin = req.user.roles.includes("ADMIN");

        if (!isOwner && !isAdmin) {
            return next(Object.assign(new Error("Access denied"), { status: 403 }));
        }

        if (!isAdmin) {
            if (status !== "CANCELLED") {
                return next(Object.assign(new Error("Customers may only cancel orders"), { status: 403 }));
            }
            if (!CANCELLABLE.has(order.status)) {
                return next(Object.assign(
                    new Error(`Cannot cancel an order with status ${order.status}`),
                    { status: 400 }
                ));
            }
        }

        order.status = status;
        await order.save();

        res.json(toOrder(order.toObject()));
    } catch (err) {
        next(err);
    }
});

export default router;
