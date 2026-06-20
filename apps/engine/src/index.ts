import Communicator from "./classes/infrastructure/Communicator.js";
import RequestHandler from "./classes/interface/requestHandler.js";

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  process.exit(1);
});

// thats it
// on error that is not caught, the owner of this process should restart the process and it will work fine

const requestHandler = new RequestHandler({});
const communicator = new Communicator(requestHandler);
communicator.processRequests();
