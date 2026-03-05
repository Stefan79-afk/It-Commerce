import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path"
import healthRouter from "./routes/health.js";

dotenv.config({path: path.resolve(path.dirname("./"), "../../.env")});

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.ORDERS_MONGO_URI;

if (!MONGO_URI) {
    console.error("Missing ORDERS_MONGO_URI in environment");
    process.exit(1);
}

async function connectMongo() {
    await mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 5000
    });
    console.log("Connected to MongoDB");
}

app.use("/api/v1", healthRouter);

connectMongo()
    .then(() => {
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Orders service listening on port ${{PORT}}`);
        });
    })
    .catch((err) => {
        console.error("Failed to connect to MongoDB:", err.message);
        process.exit(1);
    });

