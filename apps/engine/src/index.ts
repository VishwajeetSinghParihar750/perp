import EngineServer from "./classes/EngineServer.js";

let engineServer = new EngineServer();
engineServer.initialize();

// thats it
// on error that is not caught, the owner of this process should restart the process and it will work fine
