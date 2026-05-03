import type { Express } from "express";
import { z } from "zod";
import type { Env } from "../env.js";
import { completePaymentByReference, failPayment } from "../services/paymentFlow.js";

/**
 * Placeholder for your MoMo aggregator webhook.
 * Replace body schema + signature verification with your provider's spec.
 */
const momoWebhookBody = z.object({
  reference: z.string().min(1),
  status: z.enum(["SUCCESS", "FAILED"]),
  transactionId: z.string().optional(),
  note: z.string().optional(),
});

export function registerWebhookRoutes(app: Express, env: Env): void {
  app.post("/api/webhooks/momo", async (req, res) => {
    if (env.PAYMENT_MODE !== "momo") {
      res.status(404).json({ error: "webhook_disabled" });
      return;
    }

    const parsed = momoWebhookBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }

    const { reference, status, transactionId, note } = parsed.data;

    if (status === "SUCCESS") {
      const result = await completePaymentByReference(
        env,
        reference,
        transactionId ?? note
      );
      if (!result.ok && result.reason === "not_found") {
        res.status(404).json({ error: "unknown_reference" });
        return;
      }
      if (!result.ok) {
        res.status(409).json({ error: "cannot_complete", reason: result.reason });
        return;
      }
      res.json({ received: true, reference });
      return;
    }

    await failPayment(reference, note);
    res.json({ received: true, reference, status: "failed" });
  });
}
