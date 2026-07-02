import { Elysia } from "elysia";

const monitors = new Elysia({ prefix: "/monitors" }).get(
  "/",
  () => "hello from monitors",
);

export default monitors;
