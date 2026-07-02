import { Elysia } from "elysia";
import monitors from "./sub-controllers/monitors";
import { authRoutes } from "./sub-controllers/users";

const v1 = new Elysia({ prefix: "/api/v1" })
  .use(authRoutes)
  .use(monitors)
  .get("/", () => ({
    name: "StatisIO API",
    version: "1.0.0",
    documentation: "/api/v1/docs",
    endpoints: {
      auth: "/api/v1/auth",
      monitors: "/api/v1/monitors",
    },
    timestamp: new Date().toISOString()
  }))
  .all("/", () => ({ message: "Hello from v1 API" }));


export default v1;
