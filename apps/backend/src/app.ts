import express, { type Express } from "express";
import router from "./routes/index.js";
import cors from "cors";
import { errorHandler } from "./middlewares/errorHandler.js";

const app: Express = express();

// Allowed browser origins. Set FRONTEND_ORIGIN in production (comma-separated
// list supported), e.g. "https://your-app.vercel.app". Defaults to the local
// Vite dev server.
const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (no Origin header) and any whitelisted origin.
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
  }),
);
app.use(express.json());

// Lightweight health check so uptime pingers can keep the free instance warm.
app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// mount routes
app.use(router);

// centralized error handler (should be last middleware)
app.use(errorHandler);

export default app;
