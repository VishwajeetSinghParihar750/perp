import EngineServer from "./classes/EngineServer.js";

let engineServer = new EngineServer();
engineServer.initialize();

// thats it
// on error that is not caught, the owner of this process should restart the process and it will work fine

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  process.exit(1);
});
