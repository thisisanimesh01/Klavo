import mongoose from "mongoose";
import { redisCoordinator } from "./redisCoordinator.js";
import { logger } from "./logger.js";

const distributedLockSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // e.g. "recurring_task_runner"
    lockToken: { type: String, required: true },
    acquiredAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { _id: false, versionKey: false }
);

// TTL index to automatically clean up expired locks if an instance crashes
distributedLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

let DistributedLockModel = null;
try {
  DistributedLockModel = mongoose.model("DistributedLock");
} catch {
  DistributedLockModel = mongoose.model("DistributedLock", distributedLockSchema);
}

/**
 * Acquires a distributed lock using Redis (if connected) or atomic MongoDB findOneAndUpdate with lease expiration.
 *
 * @param {string} resourceKey - Unique name of the resource to lock
 * @param {string} token - Unique identifier of the requesting pod/job
 * @param {number} [ttlMs=15000] - Lock duration before expiration
 * @returns {Promise<boolean>} True if lock was successfully acquired
 */
export const acquireDistributedLock = async (resourceKey, token, ttlMs = 15000) => {
  // 1. If Redis is active, acquire Redis lock
  if (redisCoordinator.connected) {
    const acquired = await redisCoordinator.acquireLock(resourceKey, token, ttlMs);
    if (acquired) return true;
  }

  // 2. Atomic MongoDB lease acquisition
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    // Atomically claim lock if it doesn't exist OR has expired
    const result = await DistributedLockModel.findOneAndUpdate(
      {
        _id: resourceKey,
        $or: [
          { expiresAt: { $lte: now } },
          { lockToken: token }, // Re-entrant renew
        ],
      },
      {
        $set: {
          lockToken: token,
          acquiredAt: now,
          expiresAt,
        },
      },
      {
        upsert: false,
        new: true,
      }
    );

    if (result) return true;

    // If document does not exist yet, attempt atomic insertion
    try {
      await DistributedLockModel.create({
        _id: resourceKey,
        lockToken: token,
        acquiredAt: now,
        expiresAt,
      });
      return true;
    } catch (insertErr) {
      // Duplicate key error (E11000) means another concurrent instance acquired it first
      return false;
    }
  } catch (err) {
    logger.warn("Failed to acquire distributed lock via MongoDB", {
      resourceKey,
      error: err.message,
    });
    return false;
  }
};

/**
 * Releases a distributed lock if the token matches the owner.
 *
 * @param {string} resourceKey
 * @param {string} token
 * @returns {Promise<boolean>} True if successfully released
 */
export const releaseDistributedLock = async (resourceKey, token) => {
  if (redisCoordinator.connected) {
    await redisCoordinator.releaseLock(resourceKey, token);
  }

  try {
    const deleted = await DistributedLockModel.findOneAndDelete({
      _id: resourceKey,
      lockToken: token,
    });
    return !!deleted;
  } catch (err) {
    logger.warn("Failed to release distributed lock via MongoDB", {
      resourceKey,
      error: err.message,
    });
    return false;
  }
};

export { DistributedLockModel };
