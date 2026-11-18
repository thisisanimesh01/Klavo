import Notification from "../models/Notification.js";
import NotificationPreference from "../models/NotificationPreference.js";

/**
 * Maps incoming notification types to their corresponding preference category.
 *
 * @param {string} type
 * @returns {string} Category key in NotificationPreference
 */
export const mapTypeToCategory = (type) => {
  switch (type) {
    case "TASK_ASSIGNED":
      return "assignments";
    case "MENTION":
      return "mentions";
    case "COMMENT_ADDED":
    case "COMMENT_REPLIED":
      return "comments";
    case "REACTION_ADDED":
      return "reactions";
    case "TASK_UPDATED":
      return "taskUpdates";
    case "PROJECT_ACTIVITY":
      return "projectActivity";
    case "WORKSPACE_EVENT":
    case "AUTOMATION_TRIGGERED":
      return "workspaceEvents";
    default:
      return "taskUpdates";
  }
};

/**
 * Checks if current time is within user's configured quiet hours window.
 * Handles overnight schedules (e.g., 22:00 -> 08:00) as well as same-day schedules (e.g. 13:00 -> 15:00).
 *
 * @param {object} quietHours
 * @param {boolean} quietHours.enabled
 * @param {string} quietHours.start - "HH:mm"
 * @param {string} quietHours.end - "HH:mm"
 * @param {string} [quietHours.timezone] - IANA Timezone string e.g. "America/New_York", "UTC"
 * @param {Date} [currentTime] - optional test injection
 * @returns {boolean} True if quiet hours are currently in effect
 */
export const isQuietHoursActive = (quietHours, currentTime = new Date()) => {
  if (!quietHours?.enabled) return false;

  const { start, end, timezone = "UTC" } = quietHours;
  if (!start || !end) return false;

  const [startHour, startMin] = start.split(":").map(Number);
  const [endHour, endMin] = end.split(":").map(Number);

  if (
    Number.isNaN(startHour) ||
    Number.isNaN(startMin) ||
    Number.isNaN(endHour) ||
    Number.isNaN(endMin)
  ) {
    return false;
  }

  // Determine current local time in the specified timezone
  let localHour;
  let localMin;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(currentTime);
    localHour = Number(parts.find((p) => p.type === "hour")?.value ?? currentTime.getUTCHours());
    localMin = Number(parts.find((p) => p.type === "minute")?.value ?? currentTime.getUTCMinutes());
    // Intl hour: "24" may appear in hour12: false depending on locale engine
    if (localHour === 24) localHour = 0;
  } catch (err) {
    // Fallback to UTC if timezone is invalid
    localHour = currentTime.getUTCHours();
    localMin = currentTime.getUTCMinutes();
  }

  const currentMinutes = localHour * 60 + localMin;
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  if (startMinutes <= endMinutes) {
    // Same-day window (e.g., 09:00 to 17:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight window (e.g., 22:00 to 08:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
};

/**
 * Creates and delivers a real-time notification to a target user.
 * Honors user notification preferences (categories, inApp channel, quiet hours, duplicate suppression/grouping).
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

    // Retrieve or default recipient preferences
    let preference = await NotificationPreference.findOne({ userId });
    if (!preference) {
      // Default preferences if none saved yet
      preference = {
        categories: {
          assignments: true,
          mentions: true,
          comments: true,
          reactions: true,
          taskUpdates: true,
          projectActivity: true,
          workspaceEvents: true,
        },
        channels: { inApp: true },
        quietHours: { enabled: false, start: "22:00", end: "08:00", timezone: "UTC" },
        grouping: { enabled: true, windowMinutes: 5 },
      };
    }

    // 1. Check inApp channel preference
    if (preference.channels && preference.channels.inApp === false) {
      return null;
    }

    // 2. Check category preference
    const category = mapTypeToCategory(type);
    if (preference.categories && preference.categories[category] === false) {
      return null;
    }

    // 3. Duplicate suppression / grouping within time window
    const grouping = preference.grouping || { enabled: true, windowMinutes: 5 };
    if (grouping.enabled) {
      const windowMs = (grouping.windowMinutes || 5) * 60 * 1000;
      const windowStart = new Date(Date.now() - windowMs);

      // Check for an existing recent notification for this user with same type and target entity/message
      const query = {
        userId,
        type,
        createdAt: { $gte: windowStart },
      };

      if (data?.taskId) {
        query["data.taskId"] = data.taskId;
      } else if (data?.documentId) {
        query["data.documentId"] = data.documentId;
      } else {
        query.message = message;
      }

      const existingRecent = await Notification.findOne(query).sort({ createdAt: -1 });
      if (existingRecent) {
        // Suppress duplicate notification
        return existingRecent;
      }
    }

    // 4. Create notification in database
    const notification = await Notification.create({
      userId,
      type,
      message,
      data,
      read: false,
    });

    // 5. Real-time delivery check with Quiet Hours
    const isQuiet = isQuietHoursActive(preference.quietHours);
    if (io && !isQuiet) {
      io.to(`user_${userId}`).emit("notificationCreated", notification);
    }

    return notification;
  } catch (err) {
    console.error("Failed to create targeted notification:", err);
    return null;
  }
};
