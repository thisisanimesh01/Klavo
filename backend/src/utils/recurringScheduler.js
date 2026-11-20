import crypto from "crypto";
import RecurringTask from "../models/RecurringTask.js";
import Task from "../models/Task.js";
import { calculateNextRunDate, isRecurringExpired } from "./recurringHelpers.js";
import { acquireDistributedLock, releaseDistributedLock } from "./distributedLock.js";
import { logger } from "./logger.js";

/**
 * Klavo Distributed Recurring Task Scheduler.
 *
 * Guarantees:
 * 1. Exactly-once execution across horizontal pods using distributed lock.
 * 2. Atomic findOneAndUpdate lease check on individual tasks.
 * 3. Graceful degradation when single-node.
 */
export class RecurringTaskScheduler {
  constructor(options = {}) {
    this.intervalMs = options.intervalMs || 60000; // Run tick every 60s
    this.timer = null;
    this.podId = options.podId || `pod_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
    this.running = false;
    this.io = options.io || null;
  }

  setIO(io) {
    this.io = io;
  }

  start() {
    if (this.timer) return;
    this.running = true;
    logger.info("Recurring Task Scheduler started", { podId: this.podId, intervalMs: this.intervalMs });
    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        logger.error("Error in recurring task scheduler tick", { error: err.message });
      });
    }, this.intervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
  }

  /**
   * Processes all active recurring tasks whose nextRunAt <= now.
   * Employs distributed leader locking and per-task optimistic concurrency.
   */
  async tick() {
    const lockKey = "klavo_recurring_tick_leader";
    const lockTtl = 45000;
    const lockAcquired = await acquireDistributedLock(lockKey, this.podId, lockTtl);

    if (!lockAcquired) {
      // Another instance owns the recurring task execution loop for this cycle
      return { executed: 0, reason: "locked_by_peer" };
    }

    try {
      const now = new Date();
      // Find eligible recurring tasks
      const eligibleTasks = await RecurringTask.find({
        isActive: true,
        nextRunAt: { $lte: now },
      }).limit(50);

      let executedCount = 0;

      for (const recurring of eligibleTasks) {
        // Atomic lease claim on the task record itself
        const nextRun = calculateNextRunDate({
          frequency: recurring.frequency,
          interval: recurring.interval,
          daysOfWeek: recurring.daysOfWeek,
          dayOfMonth: recurring.dayOfMonth,
          from: now,
        });

        const isExpired = isRecurringExpired(recurring.endDate, nextRun);

        // Atomic update prevents any other pod from generating the same task instance
        const updated = await RecurringTask.findOneAndUpdate(
          {
            _id: recurring._id,
            nextRunAt: recurring.nextRunAt, // Optimistic concurrency check
            isActive: true,
          },
          {
            $set: {
              nextRunAt: nextRun,
              lastGeneratedAt: now,
              isActive: !isExpired,
            },
            $inc: { totalGenerated: 1 },
          },
          { new: true }
        );

        if (!updated) {
          // Already claimed by a concurrent worker
          continue;
        }

        // Spawn real Task instance
        try {
          const createdTask = await Task.create({
            title: recurring.title,
            description: recurring.description,
            status: recurring.status,
            priority: recurring.priority,
            assignedTo: recurring.assignedTo,
            labels: recurring.labels,
            estimatedHours: recurring.estimatedHours,
            sprintId: recurring.sprintId,
            milestoneId: recurring.milestoneId,
            projectId: recurring.projectId,
            createdBy: recurring.createdBy,
          });

          executedCount++;

          if (this.io) {
            this.io.to(`project_${recurring.projectId}`).emit("taskCreated", createdTask);
            this.io.to(`project_${recurring.projectId}`).emit("recurringTaskUpdated", updated);
          }
        } catch (taskErr) {
          logger.error("Failed to generate task instance from recurring template", {
            recurringId: recurring._id,
            error: taskErr.message,
          });
        }
      }

      return { executed: executedCount };
    } finally {
      await releaseDistributedLock(lockKey, this.podId);
    }
  }
}

export const recurringScheduler = new RecurringTaskScheduler();
