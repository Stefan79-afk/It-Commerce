import express from "express";
import Order from "../models/Order.js";
import authenticate from "../middleware/authenticate.js";

const router = express.Router();

router.post("/orders", authenticate, async (req, res, next) => {
    try {
        const { shippingAddressId, shippingAddressSnapshot, items } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return next(Object.assign(new Error("items must be a non-empty array"), { status: 400 }));
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

        res.status(201).json({
            id:         order._id,
            userId:     order.userId,
            status:     order.status,
            totalPrice: order.totalPrice,
            createdAt:  order.createdAt,
        });
    } catch (err) {
        if (err.name === "ValidationError") {
            return next(Object.assign(new Error(err.message), { status: 400 }));
        }
        next(err);
    }
});

export default router;
