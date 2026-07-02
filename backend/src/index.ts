import { Elysia } from "elysia";
import logutil from "./utils/logger";

const logger = new logutil("Server");

// controllers
import v1 from "./controllers/v1"; 

const app = new Elysia()
  .use(v1)
 
logger.log(`Running on http://localhost:3000`);

export default app;
