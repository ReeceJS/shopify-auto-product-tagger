/* eslint-env node */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const shop = process.env.UAT_SHOP || "uat-shop.myshopify.com";

const run = async () => {
  const existing = await prisma.rule.findFirst({
    where: {
      shop,
      name: "UAT - Premium Vendor Rule",
    },
  });

  if (existing) {
    console.log("UAT seed rule already exists for shop:", shop);
    return;
  }

  await prisma.rule.create({
    data: {
      shop,
      name: "UAT - Premium Vendor Rule",
      enabled: true,
      conditions: {
        groupJoiner: "AND",
        groups: [
          {
            joiner: "AND",
            conditions: [
              { field: "vendor", operator: "contains", value: "X" },
              { field: "minVariantPrice", operator: "greater_than", value: "80" },
            ],
          },
        ],
      },
      actions: {
        items: [{ type: "add", tags: ["premium"] }],
      },
    },
  });

  console.log("Seeded UAT rule for shop:", shop);
};

run()
  .catch((error) => {
    console.error("UAT seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
