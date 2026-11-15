import Notification from "../models/Notification.js";

/**
 * Creates and delivers a real-time notification to a target user.
 * Avoids duplicate self-notifications (sender === recipient) and persists in MongoDB.
 * Emits "notificationCreated" to `user_${recipientId}`.
 *
 * @param {object} io - Socket.io instance
 * @param {object} options
 * @param {string|ObjectId} options.userId - Target recipient user ID
 * @param {string|ObjectId} [options.senderId] - User initiating the event
 * @param {string} options.type - Notification type (e.g. TASK_ASSIGNED, TASK_UPDATED, COMMENT_ADDED, MENTION)
 * @param {string} options.message - Human readable text
 * @param {object} [options.data] - Additional contextual data (taskId, projectId, commentId, etc.)
 * @returns {Promise<object|null>}
 */
export const createTargetedNotification = async (
  io,
  { userId, senderId, type, message, data = {} }
) => {
  try {
    if (!userId || !type || !message) return null;

    // Suppress self-notifications
    if (senderId && userId.toString() === senderId.toString()) {
      return null;
    }

    const notification = await Notification.create({
      userId,
      type,
      message,
      data,
      read: false,
    });

    if (io) {
      io.to(`user_${userId}`).emit("notificationCreated", notification);
    }

    return notification;
  } catch (err) {
    console.error("Failed to create targeted notification:", err);
    return null;
  }
};
