import { Elysia } from "elysia";
import Logger from "./utils/logger";
import Scheduler from "./services/scheduler";

const logger = new Logger("Server");

// controllers
import v1 from "./controllers/v1";

const app = new Elysia()
  .use(v1)
  .listen(3000);

logger.log(`Running on http://localhost:3000`);

// Background monitor pinging
const scheduler = new Scheduler();
scheduler.start();

export default app;
