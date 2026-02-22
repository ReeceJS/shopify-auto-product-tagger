import { processQueuedRuns, requeueInFlightRuns } from "./bulk-run.server";

const POLL_INTERVAL_MS = 5000;
let workerStarted = false;

const runWorkerPass = async () => {
  try {
    await processQueuedRuns();
  } catch (error) {
    console.error("Bulk run worker pass failed", error);
  }
};

export const ensureBulkRunWorkerStarted = () => {
  if (workerStarted) {
    return;
  }

  workerStarted = true;

  void (async () => {
    try {
      await requeueInFlightRuns();
    } catch (error) {
      console.error("Failed to requeue in-flight bulk runs", error);
    }

    await runWorkerPass();
  })();

  setInterval(() => {
    void runWorkerPass();
  }, POLL_INTERVAL_MS);
};

export const triggerBulkRunProcessor = () => {
  void runWorkerPass();
};
