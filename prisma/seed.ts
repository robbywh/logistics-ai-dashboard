import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { parseOrdersCsv } from "./csv";

const CSV_PATH = path.join(
  __dirname,
  "..",
  "docs",
  "data",
  "mock_logistics_data.csv",
);

async function main() {
  const csvText = fs.readFileSync(CSV_PATH, "utf-8");
  const orders = parseOrdersCsv(csvText);

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  for (const order of orders) {
    await prisma.order.upsert({
      where: { id: order.id },
      create: order,
      update: order,
    });
  }

  console.log(`Seeded ${orders.length} orders.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
