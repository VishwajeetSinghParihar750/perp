import express, { type Express } from "express";
import router from "./routes/index.js";
import cors from "cors";
import { errorHandler } from "./middlewares/errorHandler.js";

const app: Express = express();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// mount routes
app.use(router);

// centralized error handler (should be last middleware)
app.use(errorHandler);

export default app;
