import net from "net";

interface PingTask {
  uuid: string;
  url: string;
  type: "http" | "https" | "tcp";
}

interface PingResult {
  uuid: string;
  status: "up" | "down";
  responseTime?: number;
  statusCode?: number;
  errorMessage?: string;
}

self.onmessage = async (event: MessageEvent<PingTask>) => {
  const { uuid, url, type } = event.data;
  const start = performance.now();

  try {
    if (type === "http" || type === "https") {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const response = await fetch(url, { signal: controller.signal, method: "GET" });
      clearTimeout(timeout);
      const responseTime = Math.round(performance.now() - start);

      const result: PingResult = {
        uuid,
        status: response.ok ? "up" : "down",
        responseTime,
        statusCode: response.status,
      };
      self.postMessage(result);
      return;
    }

    if (type === "tcp") {
      const parsedUrl = new URL(url);
      const port = parseInt(parsedUrl.port) || (parsedUrl.protocol === "https:" ? 443 : 80);

      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection(
          { host: parsedUrl.hostname, port, timeout: 10_000 },
          () => {
            socket.destroy();
            resolve();
          },
        );
        socket.on("error", (err) => reject(err));
        socket.on("timeout", () => {
          socket.destroy();
          reject(new Error("Connection timed out"));
        });
      });

      const responseTime = Math.round(performance.now() - start);
      const result: PingResult = { uuid, status: "up", responseTime, statusCode: 0 };
      self.postMessage(result);
      return;
    }

    self.postMessage({ uuid, status: "down", errorMessage: "Unsupported monitor type" } as PingResult);
  } catch (error: unknown) {
    const responseTime = Math.round(performance.now() - start);
    const result: PingResult = {
      uuid,
      status: "down",
      responseTime,
      errorMessage: error instanceof Error ? error.message : "Check failed",
    };
    self.postMessage(result);
  }
};
