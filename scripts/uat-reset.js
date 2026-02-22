/* eslint-env node */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const shop = process.env.UAT_SHOP || "uat-shop.myshopify.com";

const run = async () => {
  const [rulesResult, runsResult] = await prisma.$transaction([
    prisma.rule.deleteMany({ where: { shop } }),
    prisma.bulkRun.deleteMany({ where: { shop } }),
  ]);

  console.log(
    `Reset UAT data for ${shop}: deleted ${rulesResult.count} rules and ${runsResult.count} runs`,
  );
};

run()
  .catch((error) => {
    console.error("UAT reset failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
