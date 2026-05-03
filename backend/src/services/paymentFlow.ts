import type { Env } from "../env.js";
import { prisma } from "../lib/prisma.js";
import { createAccessToken, randomSessionToken } from "../lib/tokens.js";

export async function completePaymentByReference(
  env: Env,
  reference: string,
  providerNote?: string
): Promise<{ ok: true; accessToken: string; expiresAt: string } | { ok: false; reason: string }> {
  const payment = await prisma.payment.findUnique({
    where: { reference },
    include: { package: true, session: true },
  });

  if (!payment) return { ok: false, reason: "not_found" };
  if (payment.status === "COMPLETED" && payment.session) {
    const token = createAccessToken(env, {
      sessionId: payment.session.id,
      reference: payment.reference,
      expiresAt: payment.session.expiresAt,
    });
    return {
      ok: true,
      accessToken: token,
      expiresAt: payment.session.expiresAt.toISOString(),
    };
  }
  if (payment.status === "FAILED") return { ok: false, reason: "failed" };
  if (payment.status === "COMPLETED" && !payment.session) {
    // Should not happen; recover by creating session
  }

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + payment.package.durationHours * 60 * 60 * 1000
  );

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "COMPLETED",
        providerNote: providerNote ?? null,
      },
    });
    await tx.accessSession.create({
      data: {
        paymentId: payment.id,
        macAddress: payment.clientMac,
        token: randomSessionToken(),
        expiresAt,
      },
    });
  });

  const session = await prisma.accessSession.findUniqueOrThrow({
    where: { paymentId: payment.id },
  });

  const accessToken = createAccessToken(env, {
    sessionId: session.id,
    reference: payment.reference,
    expiresAt: session.expiresAt,
  });

  return {
    ok: true,
    accessToken,
    expiresAt: session.expiresAt.toISOString(),
  };
}

export async function failPayment(reference: string, note?: string): Promise<boolean> {
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment || payment.status !== "PENDING") return false;
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "FAILED", providerNote: note ?? null },
  });
  return true;
}
