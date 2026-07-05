import { Beecrypt } from "../../node_modules/beecrypt/src/index.ts";

export const ACCESS_EXPIRY = "7d";
export const REFRESH_EXPIRY = "14d";

export const blacklist = new Set<string>();

export const beecrypt = new Beecrypt({
  digest: "SHA-512",
  iterations: 100_000,
  keyBytes: 64,
  saltBytes: 32,
});

export function getSecret(name: string): string {
  const secret = Bun.env[name];
  if (!secret && Bun.env.NODE_ENV === "production") {
    throw new Error(`Missing ${name} environment variable`);
  }
  return secret || `dev-${name}-change-in-production`;
}

export async function verifyAuth(
  authorization: string | null | undefined,
  jwt: any,
): Promise<{ userId: string } | { error: string }> {
  if (!authorization?.startsWith("Bearer ")) {
    return { error: "No token provided" };
  }
  const token = authorization.slice(7);
  if (blacklist.has(token)) {
    return { error: "Token revoked" };
  }
  const payload = await jwt.verify(token);
  if (!payload?.userId) {
    return { error: "Invalid or expired token" };
  }
  return { userId: payload.userId as string };
}
