import type { Express } from "express";
import { z } from "zod";
import type { Env } from "../env.js";
import { prisma } from "../lib/prisma.js";
import { completePaymentByReference } from "../services/paymentFlow.js";
import { randomUUID } from "node:crypto";

const initiateBody = z.object({
  packageId: z.string().min(1),
  phone: z
    .string()
    .min(9)
    .max(15)
    .transform((s) => s.replace(/\D/g, "")),
  clientMac: z.string().optional(),
});

function normalizeUgandaPhone(digits: string): string {
  if (digits.startsWith("0")) return "256" + digits.slice(1);
  if (digits.startsWith("256")) return digits;
  return digits;
}

export function registerPaymentRoutes(app: Express, env: Env): void {
  app.post("/api/payments/initiate", async (req, res) => {
    const parsed = initiateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }

    const { packageId, phone: rawPhone, clientMac } = parsed.data;
    const phone = normalizeUgandaPhone(rawPhone);

    const pkg = await prisma.package.findFirst({
      where: { id: packageId, active: true },
    });
    if (!pkg) {
      res.status(404).json({ error: "package_not_found" });
      return;
    }

    const reference = `pay_${randomUUID().replace(/-/g, "")}`;

    await prisma.payment.create({
      data: {
        reference,
        packageId: pkg.id,
        phone,
        amountUgx: pkg.priceUgx,
        status: "PENDING",
        clientMac: clientMac ?? null,
      },
    });

    // Demo / dev: complete immediately so you can test without MoMo keys.
    if (env.PAYMENT_MODE === "mock") {
      const result = await completePaymentByReference(env, reference, "mock_provider");
      if (result.ok) {
        res.status(201).json({
          reference,
          status: "completed",
          accessToken: result.accessToken,
          expiresAt: result.expiresAt,
        });
        return;
      }
      res.status(500).json({ error: "completion_failed", reason: result.reason });
      return;
    }

    // Production MoMo: integration layer would STK-push here; stay PENDING until webhook.
    res.status(201).json({
      reference,
      status: "pending",
      amountUgx: pkg.priceUgx,
      phone,
      message:
        "Payment initiated. Approve the mobile money prompt. This server awaits webhook confirmation.",
    });
  });

  app.get("/api/payments/:reference/status", async (req, res) => {
    const reference = req.params.reference;
    const payment = await prisma.payment.findUnique({
      where: { reference },
      include: { session: true, package: true },
    });
    if (!payment) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    if (payment.status === "COMPLETED" && payment.session) {
      const result = await completePaymentByReference(env, reference);
      if (result.ok) {
        res.json({
          reference,
          status: "completed",
          accessToken: result.accessToken,
          expiresAt: result.expiresAt,
          durationHours: payment.package.durationHours,
        });
        return;
      }
    }

    res.json({
      reference,
      status: payment.status.toLowerCase(),
    });
  });
}
