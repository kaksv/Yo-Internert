import type { Express } from "express";
import type { Env } from "../env.js";
import { completePaymentByReference } from "../services/paymentFlow.js";

/** Manual payment completion when PAYMENT_MODE=momo during integration testing */
export function registerDevRoutes(app: Express, env: Env): void {
  if (!env.ENABLE_DEV_ROUTES || env.NODE_ENV === "production") return;

  app.post("/api/dev/complete-payment/:reference", async (req, res) => {
    const reference = req.params.reference;
    const result = await completePaymentByReference(env, reference, "dev_manual");
    if (!result.ok) {
      res.status(result.reason === "not_found" ? 404 : 400).json({ error: result.reason });
      return;
    }
    res.json({
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
    });
  });
}
