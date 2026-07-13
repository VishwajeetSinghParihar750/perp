import "dotenv/config";
import app from "./app.js";
import { wsServer, attachWebSocketUpgrade } from "./ws/index.js";
import { wsEngineInterface } from "./ws/handlers/index.js";
import http from "http";

async function setupServer() {
  try {
    await wsEngineInterface.initialize();

    const httpServer = http.createServer(app);
    // Serve HTTP and WebSocket from the same port so the app works on hosts
    // that expose a single port (Render sets PORT). Falls back to PORT_HTTP.
    const PORT = Number(process.env.PORT) || Number(process.env.PORT_HTTP) || 3001;
    const PORT_WS = Number(process.env.PORT_WS) || 3000;

    // Share the WS upgrade handler with the main HTTP server (single-port mode).
    attachWebSocketUpgrade(httpServer);

    httpServer.listen(PORT, () =>
      console.log(`running http+ws server on port ${PORT}`),
    );

    // Only run the dedicated WS server in local dev (when PORT isn't provided by
    // the host and a distinct PORT_WS is configured). This keeps the existing
    // ws://localhost:3000 dev workflow working unchanged.
    const runDedicatedWsServer = !process.env.PORT && PORT_WS !== PORT;
    if (runDedicatedWsServer) {
      wsServer.listen(PORT_WS, () =>
        console.log(`running dedicated ws server on port ${PORT_WS}`),
      );
    }

    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}, shutting down servers...`);
      wsEngineInterface.redisClient?.quit?.();
      if (runDedicatedWsServer) {
        wsServer.close(() => console.log("ws server closed"));
      }
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
