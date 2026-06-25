import app from "./app.js";
import { wsServer } from "./ws/index.js";
import { wsEngineInterface } from "./ws/handlers/index.js";
import http from "http";

async function setupServer() {
  try {
    await wsEngineInterface.initialize();

    const httpServer = http.createServer(app);
    const PORT_HTTP = Number(process.env.PORT_HTTP) || 3001;
    const PORT_WS = Number(process.env.PORT_WS) || 3000;

    httpServer.listen(PORT_HTTP, () =>
      console.log(`running http server on port ${PORT_HTTP}`),
    );
    wsServer.listen(PORT_WS, () =>
      console.log(`running ws server on port ${PORT_WS}`),
    );

    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}, shutting down servers...`);
      wsEngineInterface.redisClient?.quit?.();
      wsServer.close(() => console.log("ws server closed"));
      httpServer.close(() => console.log("http server closed"));
      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    console.error("Failed to start servers:", err);
    process.exit(1);
  }
}

setupServer();
