import express from "express";
import healthRouter from "./routes/health.js";
import ordersRouter from "./routes/orders.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();
app.use(express.json());
app.use("/api/v1", healthRouter);
app.use("/api/v1", ordersRouter);
app.use(errorHandler);

export default app;
