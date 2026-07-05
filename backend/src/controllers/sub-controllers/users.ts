import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import User from "../../models/user";
import {
  ACCESS_EXPIRY,
  REFRESH_EXPIRY,
  blacklist,
  beecrypt,
  getSecret,
  verifyAuth,
} from "../../utils/auth";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(
    jwt({
      name: "jwt",
      secret: getSecret("JWT_SECRET"),
      exp: ACCESS_EXPIRY,
    }),
  )
  .use(
    jwt({
      name: "refreshJwt",
      secret: getSecret("JWT_REFRESH_SECRET") || getSecret("JWT_SECRET"),
      exp: REFRESH_EXPIRY,
    }),
  )

  .post(
    "/register",
    async ({ body, jwt, refreshJwt, set }) => {
      const { username, email, password } = body;
      const normalizedEmail = email.toLowerCase().trim();

      const existing = await User.findOne({
        $or: [{ email: normalizedEmail }, { username }],
      })
        .select("email")
        .lean();
      if (existing) {
        set.status = 409;
        return {
          error:
            existing.email === normalizedEmail
              ? "Email already registered"
              : "Username already taken",
        };
      }

      const passwordHash = await beecrypt.hash(password);
      const user = await User.create({
        username,
        email: normalizedEmail,
        passwordHash,
      });

      const userId = user._id.toString();
      set.status = 201;
      return {
        accessToken: await jwt.sign({ userId }),
        refreshToken: await refreshJwt.sign({ userId }),
        user: user.toJSON(),
      };
    },
    {
      body: t.Object({
        username: t.String({
          minLength: 3,
          maxLength: 30,
          pattern: "^[a-zA-Z0-9_]+$",
        }),
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 8, maxLength: 128 }),
      }),
    },
  )

  .post(
    "/login",
    async ({ body, jwt, refreshJwt, set }) => {
      const { email, password } = body;
      const user = await User.findOne({ email: email.toLowerCase().trim() });

      if (!user || !(await beecrypt.verify(password, user.passwordHash))) {
        set.status = 401;
        return { error: "Invalid email or password" };
      }

      const userId = user._id.toString();
      return {
        accessToken: await jwt.sign({ userId }),
        refreshToken: await refreshJwt.sign({ userId }),
        user: user.toJSON(),
      };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String(),
      }),
    },
  )

  .post(
    "/refresh",
    async ({ body, jwt, refreshJwt, set }) => {
      const payload = await refreshJwt.verify(body.refreshToken);
      if (!payload || !payload.userId) {
        set.status = 401;
        return { error: "Invalid or expired refresh token" };
      }

      const user = await User.findById(payload.userId).lean();
      if (!user) {
        set.status = 401;
        return { error: "User not found" };
      }

      const userId = user._id.toString();
      return {
        accessToken: await jwt.sign({ userId }),
        refreshToken: await refreshJwt.sign({ userId }),
      };
    },
    {
      body: t.Object({
        refreshToken: t.String(),
      }),
    },
  )

  .post("/logout", async ({ headers, jwt, set }) => {
    const auth = headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7);
      const payload = await jwt.verify(token);
      if (payload) blacklist.add(token);
    }
    return { message: "Logged out" };
  })

  .get("/me", async ({ headers, jwt, set }) => {
    const result = await verifyAuth(headers.authorization, jwt);
    if ("error" in result) {
      set.status = 401;
      return { error: result.error };
    }

    const user = await User.findById(result.userId)
      .select("-passwordHash")
      .lean();
    if (!user) {
      set.status = 401;
      return { error: "User not found" };
    }

    return { user };
  })

  .put(
    "/me/password",
    async ({ body, headers, jwt, set }) => {
      const result = await verifyAuth(headers.authorization, jwt);
      if ("error" in result) {
        set.status = 401;
        return { error: result.error };
      }

      const user = await User.findById(result.userId);
      if (!user) {
        set.status = 401;
        return { error: "User not found" };
      }

      if (!(await beecrypt.verify(body.currentPassword, user.passwordHash))) {
        set.status = 403;
        return { error: "Current password is incorrect" };
      }

      user.passwordHash = await beecrypt.hash(body.newPassword);
      await user.save();

      return { message: "Password updated" };
    },
    {
      body: t.Object({
        currentPassword: t.String(),
        newPassword: t.String({ minLength: 8, maxLength: 128 }),
      }),
    },
  );