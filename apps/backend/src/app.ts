import express, { type Express } from "express";
import router from "./routes/index.js";
import cors from "cors";

const app: Express = express();
app.use(cors({ origin: "http://localhost:5173" }));

app.use(express.json());

app.use(router);

export default app;
