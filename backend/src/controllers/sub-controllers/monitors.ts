import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { randomUUID } from "node:crypto";
import net from "node:net";
import Monitor from "../../models/monitors";
import History from "../../models/monitorHistory";
import User from "../../models/user";
import { getSecret, verifyAuth } from "../../utils/auth";

function paginate(page?: string, limit?: string) {
  const pageNum = Math.max(1, parseInt(page || "1") || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit || "20") || 20));
  return { page: pageNum, limit: limitNum, skip: (pageNum - 1) * limitNum };
}

async function performCheck(monitor: {
  url: string;
  type: string;
}): Promise<{
  status: "up" | "down";
  responseTime?: number;
  statusCode?: number;
  errorMessage?: string;
}> {
  const start = performance.now();

  try {
    if (monitor.type === "http" || monitor.type === "https") {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      const response = await fetch(monitor.url, {
        signal: controller.signal,
        method: "GET",
      });

      clearTimeout(timeout);
      const responseTime = Math.round(performance.now() - start);

      return {
        status: response.ok ? "up" : "down",
        responseTime,
        statusCode: response.status,
      };
    }

    if (monitor.type === "tcp") {
      const url = new URL(monitor.url);
      const port = parseInt(url.port) || (url.protocol === "https:" ? 443 : 80);

      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection(
          { host: url.hostname, port, timeout: 10_000 },
          () => {
            socket.destroy();
            resolve();
          },
        );
        socket.on("error", reject);
        socket.on("timeout", () => {
          socket.destroy();
          reject(new Error("Connection timed out"));
        });
      });

      const responseTime = Math.round(performance.now() - start);
      return { status: "up", responseTime, statusCode: 0 };
    }

    return { status: "down", errorMessage: "Unsupported monitor type" };
  } catch (error: any) {
    const responseTime = Math.round(performance.now() - start);
    return {
      status: "down",
      responseTime,
      errorMessage: error.message ?? "Check failed",
    };
  }
}

const monitors = new Elysia({ prefix: "/monitors" })
  .use(
    jwt({
      name: "jwt",
      secret: getSecret("JWT_SECRET"),
      exp: "7d",
    }),
  )

  .get(
    "/",
    async ({ headers, jwt, set, query: { page, limit } }) => {
      const auth = await verifyAuth(headers.authorization, jwt);
      if ("error" in auth) {
        set.status = 401;
        return { error: auth.error };
      }

      const { page: p, limit: l, skip } = paginate(page, limit);
      const [monitors, total] = await Promise.all([
        Monitor.find({ userId: auth.userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(l)
          .lean(),
        Monitor.countDocuments({ userId: auth.userId }),
      ]);

      return {
        monitors,
        pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) },
      };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )

  .get(
    "/:uuid",
    async ({ headers, jwt, set, params: { uuid } }) => {
      const auth = await verifyAuth(headers.authorization, jwt);
      if ("error" in auth) {
        set.status = 401;
        return { error: auth.error };
      }

      const monitor = await Monitor.findOne({
        uuid,
        userId: auth.userId,
      }).lean();
      if (!monitor) {
        set.status = 404;
        return { error: "Monitor not found" };
      }

      return { monitor };
    },
  )

  .post(
    "/",
    async ({ headers, jwt, set, body }) => {
      const auth = await verifyAuth(headers.authorization, jwt);
      if ("error" in auth) {
        set.status = 401;
        return { error: auth.error };
      }

      const uuid = randomUUID();
      const monitor = await Monitor.create({
        ...body,
        uuid,
        userId: auth.userId,
      });

      await User.findByIdAndUpdate(auth.userId, {
        $push: { monitorIds: uuid },
      });

      set.status = 201;
      return { monitor: monitor.toJSON() };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        url: t.String({ minLength: 1 }),
        type: t.Union([t.Literal("http"), t.Literal("https"), t.Literal("tcp")]),
        interval: t.Optional(t.Number({ minimum: 10_000, maximum: 86_400_000 })),
        status: t.Optional(
          t.Union([t.Literal("active"), t.Literal("inactive")]),
        ),
      }),
    },
  )

  .put(
    "/:uuid",
    async ({ headers, jwt, set, params: { uuid }, body }) => {
      const auth = await verifyAuth(headers.authorization, jwt);
      if ("error" in auth) {
        set.status = 401;
        return { error: auth.error };
      }

      const monitor = await Monitor.findOneAndUpdate(
        { uuid, userId: auth.userId },
        { $set: body },
        { new: true, runValidators: true },
      );

      if (!monitor) {
        set.status = 404;
        return { error: "Monitor not found" };
      }

      return { monitor: monitor.toJSON() };
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        url: t.Optional(t.String({ minLength: 1 })),
        type: t.Optional(
          t.Union([t.Literal("http"), t.Literal("https"), t.Literal("tcp")]),
        ),
        interval: t.Optional(t.Number({ minimum: 10_000, maximum: 86_400_000 })),
        status: t.Optional(
          t.Union([t.Literal("active"), t.Literal("inactive")]),
        ),
      }),
    },
  )

  .delete("/:uuid", async ({ headers, jwt, set, params: { uuid } }) => {
    const auth = await verifyAuth(headers.authorization, jwt);
    if ("error" in auth) {
      set.status = 401;
      return { error: auth.error };
    }

    const monitor = await Monitor.findOneAndDelete({
      uuid,
      userId: auth.userId,
    });
    if (!monitor) {
      set.status = 404;
      return { error: "Monitor not found" };
    }

    await Promise.all([
      User.findByIdAndUpdate(auth.userId, { $pull: { monitorIds: uuid } }),
      History.deleteMany({ uuid }),
    ]);

    return { message: "Monitor deleted" };
  })

  .post(
    "/:uuid/check",
    async ({ headers, jwt, set, params: { uuid } }) => {
      const auth = await verifyAuth(headers.authorization, jwt);
      if ("error" in auth) {
        set.status = 401;
        return { error: auth.error };
      }

      const monitor = await Monitor.findOne({
        uuid,
        userId: auth.userId,
      }).lean();
      if (!monitor) {
        set.status = 404;
        return { error: "Monitor not found" };
      }

      const result = await performCheck(monitor);
      const history = await History.create({ uuid, ...result });

      return { history: history.toJSON() };
    },
  )

  .get(
    "/:uuid/history",
    async ({ headers, jwt, set, params: { uuid }, query: { page, limit } }) => {
      const auth = await verifyAuth(headers.authorization, jwt);
      if ("error" in auth) {
        set.status = 401;
        return { error: auth.error };
      }

      const monitor = await Monitor.findOne({
        uuid,
        userId: auth.userId,
      })
        .select("_id")
        .lean();
      if (!monitor) {
        set.status = 404;
        return { error: "Monitor not found" };
      }

      const { page: p, limit: l, skip } = paginate(page, limit || "50");
      const [history, total] = await Promise.all([
        History.find({ uuid })
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(l)
          .lean(),
        History.countDocuments({ uuid }),
      ]);

      return {
        history,
        pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) },
      };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  );

export default monitors;
