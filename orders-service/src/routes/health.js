import express from "express";
import mongoose from "mongoose";

const router = express.Router();

router.get("/health", async (req, res) => {
    try {
        // MongoDB ping
        await mongoose.connection.db.admin().ping();
        return res.json({status: "ok"});
    } catch (e) {
        return res.status(500).json({status: "error", message: e.message});
    }
})

export default router;