import express from "express";
import healthRouter from "./routes/health.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();
app.use(express.json());
app.use("/api/v1", healthRouter);
app.use(errorHandler);

export default app;
