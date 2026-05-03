import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Env } from "../env.js";

export function createAccessToken(
  env: Env,
  payload: { sessionId: string; reference: string; expiresAt: Date }
): string {
  const seconds = Math.max(
    60,
    Math.floor((payload.expiresAt.getTime() - Date.now()) / 1000)
  );
  return jwt.sign(
    { sub: payload.sessionId, ref: payload.reference },
    env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: seconds }
  );
}

export function verifyAccessToken(
  env: Env,
  token: string
): { sessionId: string; reference: string } | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (typeof decoded.sub !== "string" || typeof decoded.ref !== "string")
      return null;
    return { sessionId: decoded.sub, reference: decoded.ref };
  } catch {
    return null;
  }
}

export function randomSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
