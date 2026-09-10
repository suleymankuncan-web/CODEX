// Requires a disposable Redis instance; never point FIXTURE_REDIS_URL at a shared queue.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { Queue, QueueEvents, Worker } = require("bullmq");
const { Logger } = require("@nestjs/common");
const { BullMqJobDispatcherService } = require("../dist/src/shared/jobs/bullmq-job-dispatcher.service");
const { IntegrationImportCommandService } = require("../dist/src/modules/integration/application/integration-import-command.service");

async function verify(strict) {
  assert.equal(process.env.ALLOW_IMPORT_REPLAY_FIXTURE, "1");
  assert.ok(process.env.FIXTURE_REDIS_URL, "Disposable FIXTURE_REDIS_URL is required");
  const queueName = `import-replay-fixture-${randomUUID()}`;
  const config = { queueBackend: "bullmq", isStrictLocal: strict,
    redisUrl: process.env.FIXTURE_REDIS_URL, redisOperationTimeoutMs: 2000,
    importQueueName: queueName, snapshotQueueName: `${queueName}-snapshots`,
    visualComparisonEnqueueEnabled: false, visualComparisonWorkerEnabled: false };
  const dispatcher = new BullMqJobDispatcherService(config);
  // Strict-local requires an acknowledged ready connection before dispatch.
  if (dispatcher.connection.status !== "ready") {
    await new Promise((resolve, reject) => {
      dispatcher.connection.once("ready", resolve);
      dispatcher.connection.once("error", reject);
    });
  }
  const queue = new Queue(queueName, { connection: { url: config.redisUrl } });
  const events = new QueueEvents(queueName, { connection: { url: config.redisUrl } });
  let worker;
  try {
    await events.waitUntilReady();
    const batchId = randomUUID();
    let persisted = false;
    const repository = { createImportBatch: async () => {
      const reused = persisted;
      persisted = true;
      return { batchId, reused, status: "pending" };
    } };
    const enqueue = dispatcher.dispatch.bind(dispatcher);
    let failBeforeAdd = true;
    let loseAck = true;
    dispatcher.dispatch = async (...args) => {
      if (failBeforeAdd) { failBeforeAdd = false; throw new Error("fixture enqueue unavailable"); }
      const result = await enqueue(...args);
      if (loseAck) { loseAck = false; throw new Error("fixture ack lost"); }
      return result;
    };
    const service = new IntegrationImportCommandService(repository, {}, {}, {}, {}, {}, {}, dispatcher);
    const input = { actorCompanyIds: [randomUUID()], sourceCode: "fixture", entityType: "employee",
      fileReference: "fixture.csv", actorUserId: randomUUID(), idempotencyKey: "same-upload" };
    await assert.rejects(service.createImportBatch(input), /enqueue unavailable/);
    assert.equal(await queue.getWaitingCount(), 0);
    await assert.rejects(service.createImportBatch(input), /ack lost/);
    const receipts = await Promise.all(Array.from({ length: 8 }, () => service.createImportBatch(input)));
    assert.equal(new Set(receipts.map((receipt) => receipt.job.jobId)).size, 1);
    assert.equal(await queue.getWaitingCount(), 1);
    const job = await queue.getJob(`import-batch-${batchId}-initial`);
    let processed = 0;
    worker = new Worker(queueName, async (entry) => {
      if (entry.data.fail) throw new Error("fixture exhausted worker");
      processed += 1;
    }, { connection: { url: config.redisUrl } });
    await job.waitUntilFinished(events, 10000);
    const completed = await service.createImportBatch(input);
    assert.equal(completed.command.status, "completed");
    assert.equal(processed, 1);

    const failed = await queue.add("import-batch", { fail: true }, { jobId: "failed-fixture", attempts: 1 });
    await assert.rejects(failed.waitUntilFinished(events, 10000), /fixture exhausted worker/);
    await assert.rejects(enqueue("import-batch", {}, async () => {}, {
      jobId: "failed-fixture", strictLocalJobId: "failed-fixture",
    }), /enqueue was not confirmed/);
    console.log(`PASS: ${strict ? "strict-local" : "hosted"} Redis replay recovers dispatch/lost ack; 8 replays, 1 job, 1 execution; completed/failed receipts are truthful`);
  } finally {
    if (worker) await worker.close();
    await events.close();
    await queue.close();
    await dispatcher.onModuleDestroy();
  }
}
Logger.overrideLogger(false);
verify(false).then(() => verify(true)).catch((error) => { console.error(error.message); process.exitCode = 1; });
