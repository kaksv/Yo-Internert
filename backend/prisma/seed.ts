import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const packs = [
    { label: "3 hours", priceUgx: 500, durationHours: 3, sortOrder: 1 },
    { label: "8 hours", priceUgx: 800, durationHours: 8, sortOrder: 2 },
    { label: "12 hours", priceUgx: 1000, durationHours: 12, sortOrder: 3 },
  ];

  for (const p of packs) {
    await prisma.package.upsert({
      where: {
        id: `seed-${p.durationHours}h`,
      },
      create: {
        id: `seed-${p.durationHours}h`,
        label: p.label,
        priceUgx: p.priceUgx,
        durationHours: p.durationHours,
        sortOrder: p.sortOrder,
        active: true,
      },
      update: {
        label: p.label,
        priceUgx: p.priceUgx,
        durationHours: p.durationHours,
        sortOrder: p.sortOrder,
      },
    });
  }

  console.log("Seeded packages.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
