import path from "path";
import Logger from "../utils/logger";

interface Task {
  uuid: string;
  url: string;
  type: string;
}

export interface PingResult {
  uuid: string;
  status: "up" | "down";
  responseTime?: number;
  statusCode?: number;
  errorMessage?: string;
}

type ResultCallback = (result: PingResult) => void;

const logger = new Logger("WorkerPool");

class WorkerPool {
  private workers: Worker[] = [];
  private busy: Set<number> = new Set();
  private queue: Array<{ task: Task; resolve: ResultCallback }> = [];
  private resolvers: Map<number, ResultCallback> = new Map();
  private poolSize: number;

  constructor(poolSize: number = 4) {
    this.poolSize = poolSize;
  }

  start() {
    const workerPath = path.resolve(__dirname, "../workers/ping.worker.ts");
    for (let i = 0; i < this.poolSize; i++) {
      this.createWorker(i, workerPath);
    }
    logger.log(`Started ${this.poolSize} ping workers`);
  }

  private createWorker(index: number, workerPath: string) {
    const worker = new Worker(workerPath);

    worker.onmessage = (event: MessageEvent<PingResult>) => {
      this.busy.delete(index);
      const resolve = this.resolvers.get(index);
      this.resolvers.delete(index);
      resolve?.(event.data);
      this.processQueue(index);
    };

    worker.onerror = (error) => {
      logger.error(`Worker ${index} error: ${error.message}`);
      this.busy.delete(index);
      const resolve = this.resolvers.get(index);
      this.resolvers.delete(index);
      resolve?.({ uuid: "", status: "down", errorMessage: "Worker error" });
      this.createWorker(index, workerPath);
      this.processQueue(index);
    };

    this.workers[index] = worker;
  }

  private processQueue(workerIndex: number) {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      this.dispatchToWorker(workerIndex, next.task, next.resolve);
    }
  }

  private dispatchToWorker(index: number, task: Task, resolve: ResultCallback) {
    this.busy.add(index);
    this.resolvers.set(index, resolve);
    this.workers[index].postMessage(task);
  }

  async dispatch(task: Task): Promise<PingResult> {
    return new Promise((resolve) => {
      for (let i = 0; i < this.poolSize; i++) {
        if (!this.busy.has(i)) {
          this.dispatchToWorker(i, task, resolve);
          return;
        }
      }
      this.queue.push({ task, resolve });
    });
  }

  terminate() {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.busy.clear();
    this.queue = [];
    this.resolvers.clear();
    logger.log("All workers terminated");
  }
}

export default WorkerPool;
