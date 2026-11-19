import os from "os";

/**
 * Lightweight, in-memory metrics registry for operational telemetry.
 * Captures request latencies, status codes, database failures, socket counts,
 * automation outcomes, and process resource utilization.
 */
export class MetricsRegistry {
  constructor() {
    this.reset();
  }

  reset() {
    this.startTime = Date.now();
    this.httpRequests = {
      total: 0,
      byStatus: {}, // e.g. "2xx": count, "4xx": count, "5xx": count
      byMethod: {},
    };
    this.latency = {
      count: 0,
      totalMs: 0,
      minMs: Infinity,
      maxMs: 0,
      // Lightweight histogram buckets (ms): <50, <100, <250, <500, <1000, >=1000
      buckets: {
        "50ms": 0,
        "100ms": 0,
        "250ms": 0,
        "500ms": 0,
        "1000ms": 0,
        "overflow": 0,
      },
    };
    this.database = {
      errors: 0,
      lastErrorTime: null,
      lastErrorMessage: null,
    };
    this.storage = {
      operations: 0,
      errors: 0,
      lastErrorTime: null,
    };
    this.socketIO = {
      connectedSockets: 0,
      totalConnections: 0,
      disconnects: 0,
    };
    this.automation = {
      executions: 0,
      failures: 0,
      lastFailureTime: null,
    };
  }

  /**
   * Record completion of an HTTP request.
   * @param {string} method
   * @param {number} statusCode
   * @param {number} durationMs
   */
  recordHttpRequest(method, statusCode, durationMs) {
    this.httpRequests.total++;

    const statusGroup = `${Math.floor(statusCode / 100)}xx`;
    this.httpRequests.byStatus[statusGroup] = (this.httpRequests.byStatus[statusGroup] || 0) + 1;

    const normMethod = (method || "GET").toUpperCase();
    this.httpRequests.byMethod[normMethod] = (this.httpRequests.byMethod[normMethod] || 0) + 1;

    // Latency
    this.latency.count++;
    this.latency.totalMs += durationMs;
    if (durationMs < this.latency.minMs) this.latency.minMs = durationMs;
    if (durationMs > this.latency.maxMs) this.latency.maxMs = durationMs;

    if (durationMs <= 50) this.latency.buckets["50ms"]++;
    else if (durationMs <= 100) this.latency.buckets["100ms"]++;
    else if (durationMs <= 250) this.latency.buckets["250ms"]++;
    else if (durationMs <= 500) this.latency.buckets["500ms"]++;
    else if (durationMs <= 1000) this.latency.buckets["1000ms"]++;
    else this.latency.buckets["overflow"]++;
  }

  /**
   * Record a database operation failure.
   * @param {Error|string} err
   */
  recordDatabaseError(err) {
    this.database.errors++;
    this.database.lastErrorTime = new Date().toISOString();
    this.database.lastErrorMessage = typeof err === "string" ? err : err?.message || "Unknown DB error";
  }

  /**
   * Record a storage operation (upload, download, delete).
   * @param {boolean} isError
   */
  recordStorageOperation(isError = false) {
    this.storage.operations++;
    if (isError) {
      this.storage.errors++;
      this.storage.lastErrorTime = new Date().toISOString();
    }
  }

  /**
   * Record Socket.IO connection event.
   */
  recordSocketConnect() {
    this.socketIO.connectedSockets++;
    this.socketIO.totalConnections++;
  }

  /**
   * Record Socket.IO disconnection event.
   */
  recordSocketDisconnect() {
    this.socketIO.connectedSockets = Math.max(0, this.socketIO.connectedSockets - 1);
    this.socketIO.disconnects++;
  }

  /**
   * Record an automation engine execution.
   * @param {boolean} isFailure
   */
  recordAutomationExecution(isFailure = false) {
    this.automation.executions++;
    if (isFailure) {
      this.automation.failures++;
      this.automation.lastFailureTime = new Date().toISOString();
    }
  }

  /**
   * Gather process and system resource telemetry safely.
   * @returns {object}
   */
  getResourceMetrics() {
    const mem = process.memoryUsage();
    return {
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rssMb: Math.round(mem.rss / (1024 * 1024)),
        heapTotalMb: Math.round(mem.heapTotal / (1024 * 1024)),
        heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
        externalMb: Math.round(mem.external / (1024 * 1024)),
      },
      cpu: {
        cpuUsage: process.cpuUsage(),
        systemLoad: os.loadavg ? os.loadavg() : [],
      },
    };
  }

  /**
   * Return formatted telemetry snapshot suitable for monitoring / metrics endpoints.
   * @returns {object}
   */
  getSnapshot() {
    const avgLatencyMs =
      this.latency.count > 0 ? parseFloat((this.latency.totalMs / this.latency.count).toFixed(2)) : 0;

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      http: {
        totalRequests: this.httpRequests.total,
        statusCodes: this.httpRequests.byStatus,
        methods: this.httpRequests.byMethod,
        latency: {
          count: this.latency.count,
          avgMs: avgLatencyMs,
          minMs: this.latency.minMs === Infinity ? 0 : this.latency.minMs,
          maxMs: this.latency.maxMs,
          distribution: this.latency.buckets,
        },
      },
      database: {
        errorCount: this.database.errors,
        lastErrorTime: this.database.lastErrorTime,
      },
      storage: {
        operationsCount: this.storage.operations,
        errorCount: this.storage.errors,
        lastErrorTime: this.storage.lastErrorTime,
      },
      socketIO: {
        activeConnections: this.socketIO.connectedSockets,
        totalLifetimeConnections: this.socketIO.totalConnections,
        disconnects: this.socketIO.disconnects,
      },
      automations: {
        executionsCount: this.automation.executions,
        failureCount: this.automation.failures,
        lastFailureTime: this.automation.lastFailureTime,
      },
      process: this.getResourceMetrics(),
    };
  }
}

export const metrics = new MetricsRegistry();

/**
 * Express middleware to automatically track request latencies and response codes.
 */
export const metricsMiddleware = (req, res, next) => {
  const startHrTime = process.hrtime();

  res.on("finish", () => {
    const elapsed = process.hrtime(startHrTime);
    const durationMs = parseFloat((elapsed[0] * 1000 + elapsed[1] / 1e6).toFixed(2));
    metrics.recordHttpRequest(req.method, res.statusCode, durationMs);
  });

  next();
};
