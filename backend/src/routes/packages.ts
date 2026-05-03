import type { Express } from "express";
import { prisma } from "../lib/prisma.js";

export function registerPackageRoutes(app: Express): void {
  app.get("/api/packages", async (_req, res) => {
    const rows = await prisma.package.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        label: true,
        priceUgx: true,
        durationHours: true,
      },
    });
    res.json({ packages: rows });
  });
}
