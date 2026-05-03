import type { Express } from "express";
import type { Env } from "../env.js";
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../lib/tokens.js";

/**
 * Hotspot gateway / router can call this to verify a client still has access.
 * Pass Authorization: Bearer <jwt from successful payment>.
 */
export function registerSessionRoutes(app: Express, env: Env): void {
  app.get("/api/session/me", async (req, res) => {
    const auth = req.headers.authorization;
    const token =
      auth?.startsWith("Bearer ") ? auth.slice(7) : (req.query.token as string | undefined);
    if (!token) {
      res.status(401).json({ error: "missing_token" });
      return;
    }

    const payload = verifyAccessToken(env, token);
    if (!payload) {
      res.status(401).json({ error: "invalid_token" });
      return;
    }

    const session = await prisma.accessSession.findUnique({
      where: { id: payload.sessionId },
      include: { payment: { include: { package: true } } },
    });

    if (!session) {
      res.status(401).json({ error: "session_not_found" });
      return;
    }

    if (session.expiresAt.getTime() < Date.now()) {
      res.status(403).json({ error: "session_expired", expiredAt: session.expiresAt.toISOString() });
      return;
    }

    res.json({
      valid: true,
      expiresAt: session.expiresAt.toISOString(),
      reference: session.payment.reference,
      package: {
        label: session.payment.package.label,
        durationHours: session.payment.package.durationHours,
      },
    });
  });
}
