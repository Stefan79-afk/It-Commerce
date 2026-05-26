import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const shippingAddressSnapshotSchema = new mongoose.Schema(
    {
        street:     { type: String, required: true },
        postalCode: { type: String },
        city:       { type: String, required: true },
        county:     { type: String },
        country:    { type: String, required: true },
    },
    { _id: false }
);

const orderItemSchema = new mongoose.Schema(
    {
        productId:       { type: String, required: true },
        productName:     { type: String, required: true },
        priceAtPurchase: { type: Number, required: true },
        quantity:        { type: Number, required: true, min: 1 },
    },
    { _id: false }
);

const ORDER_STATUSES = ["CREATED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

const orderSchema = new mongoose.Schema(
    {
        _id:                     { type: String, default: uuidv4 },
        userId:                  { type: String, required: true },
        shippingAddressId:       { type: String, required: true },
        shippingAddressSnapshot: { type: shippingAddressSnapshotSchema, required: true },
        status:                  { type: String, enum: ORDER_STATUSES, default: "CREATED" },
        items:                   { type: [orderItemSchema], required: true },
        totalPrice:              { type: Number, required: true },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

orderSchema.index({ userId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

export default mongoose.model("Order", orderSchema);
