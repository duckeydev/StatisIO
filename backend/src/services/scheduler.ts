import Monitor from "../models/monitors";
import History from "../models/monitorHistory";
import WorkerPool from "./monitorWorker";
import Logger from "../utils/logger";

const logger = new Logger("Scheduler");

class Scheduler {
  private workerPool: WorkerPool;
  private interval: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private tickIntervalMs: number;

  constructor(tickIntervalMs: number = 10_000) {
    this.tickIntervalMs = tickIntervalMs;
    this.workerPool = new WorkerPool();
  }

  async start() {
    this.workerPool.start();
    this.running = true;
    this.interval = setInterval(() => this.tick(), this.tickIntervalMs);
    logger.log(`Scheduler started (tick every ${this.tickIntervalMs}ms)`);
  }

  private async tick() {
    if (!this.running) return;

    try {
      const activeMonitors = await Monitor.find({ status: "active" });
      const now = Date.now();

      for (const monitor of activeMonitors) {
        const due = !monitor.lastChecked ||
          (now - monitor.lastChecked.getTime()) >= monitor.interval;

        if (due) {
          this.dispatchCheck(monitor);
        }
      }
    } catch (error) {
      logger.error(`Tick error: ${error}`);
    }
  }

  private async dispatchCheck(monitor: Record<string, any>) {
    try {
      const result = await this.workerPool.dispatch({
        uuid: monitor.uuid,
        url: monitor.url,
        type: monitor.type,
      });

      await History.create({
        uuid: result.uuid,
        status: result.status,
        responseTime: result.responseTime,
        statusCode: result.statusCode,
        errorMessage: result.errorMessage,
      });

      await Monitor.updateOne(
        { uuid: monitor.uuid },
        { $set: { lastChecked: new Date() } },
      );

      logger.log(`${monitor.uuid} → ${result.status} (${result.responseTime ?? "?"}ms)`);
    } catch (error) {
      logger.error(`Check failed for ${monitor.uuid}: ${error}`);
    }
  }

  stop() {
    this.running = false;
    if (this.interval) clearInterval(this.interval);
    this.workerPool.terminate();
    logger.log("Scheduler stopped");
  }
}

export default Scheduler;
