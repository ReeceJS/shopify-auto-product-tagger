import db from "../db.server";
import { unauthenticated } from "../shopify.server";
import { evaluateRulesForProduct } from "./rules-engine.server";
import { getEnabledRulesForShop } from "./rules.server";
import { listProductsPage, updateProductTags } from "./products.server";

let isProcessing = false;

const updateRun = (runId, data) =>
  db.bulkRun.update({
    where: { id: runId },
    data,
  });

export const getLatestRun = (shop) => {
  return db.bulkRun.findFirst({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });
};

export const enqueueBulkRun = async (shop) => {
  return db.bulkRun.create({
    data: {
      shop,
      status: "queued",
    },
  });
};

export const requeueInFlightRuns = async () => {
  await db.bulkRun.updateMany({
    where: {
      status: "running",
      finishedAt: null,
    },
    data: {
      status: "queued",
    },
  });
};

const claimNextRun = async () => {
  const nextRun = await db.bulkRun.findFirst({
    where: {
      status: "queued",
      finishedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!nextRun) {
    return null;
  }

  const claim = await db.bulkRun.updateMany({
    where: {
      id: nextRun.id,
      status: "queued",
    },
    data: {
      status: "running",
    },
  });

  if (claim.count === 0) {
    return null;
  }

  return db.bulkRun.findUnique({
    where: { id: nextRun.id },
  });
};

const processBulkRun = async (run) => {
  let processed = run.processed || 0;
  let updated = run.updated || 0;
  let errors = run.errors || 0;
  let cursor = run.cursor || null;
  let hasNextPage = true;

  try {
    const { admin } = await unauthenticated.admin(run.shop);
    const rules = await getEnabledRulesForShop(run.shop);

    while (hasNextPage) {
      const page = await listProductsPage(admin, cursor);

      for (const product of page.products) {
        processed += 1;

        try {
          const diff = evaluateRulesForProduct(product, rules);

          if (diff.changed) {
            await updateProductTags(admin, product.id, diff.afterTags);
            updated += 1;
          }
        } catch (error) {
          errors += 1;
          await updateRun(run.id, {
            lastError: error instanceof Error ? error.message : "Unknown error",
          });
        }

        await updateRun(run.id, {
          processed,
          updated,
          errors,
        });
      }

      cursor = page.pageInfo.endCursor;

      await updateRun(run.id, {
        total: processed,
        cursor,
      });

      hasNextPage = page.pageInfo.hasNextPage;
    }

    await updateRun(run.id, {
      status: "completed",
      finishedAt: new Date(),
      processed,
      updated,
      errors,
      total: processed,
      cursor,
    });
  } catch (error) {
    await updateRun(run.id, {
      status: "failed",
      finishedAt: new Date(),
      lastError: error instanceof Error ? error.message : "Bulk run failed",
      processed,
      updated,
      errors,
      total: processed,
      cursor,
    });
  }
};

export const processQueuedRuns = async () => {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  try {
    let hasPendingRun = true;

    while (hasPendingRun) {
      const run = await claimNextRun();

      if (!run) {
        hasPendingRun = false;
        continue;
      }

      await processBulkRun(run);
    }
  } finally {
    isProcessing = false;
  }
};
