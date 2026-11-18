import Notification from "../models/Notification.js";
import NotificationPreference from "../models/NotificationPreference.js";

export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 });

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // IDOR check: Users can only mark their own notifications as read
    if (notification.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Forbidden: You cannot modify another user's notification" });
    }

    notification.read = true;
    await notification.save();

    res.json({ message: "Marked as read", notification });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // IDOR check: Users can only delete their own notifications
    if (notification.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Forbidden: You cannot delete another user's notification" });
    }

    await Notification.deleteOne({ _id: id });
    res.json({ message: "Notification deleted", id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const clearAllNotifications = async (req, res) => {
  try {
    const result = await Notification.deleteMany({ userId: req.user._id });
    res.json({ message: "All notifications cleared", count: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getPreferences = async (req, res) => {
  try {
    let preference = await NotificationPreference.findOne({ userId: req.user._id });

    if (!preference) {
      preference = await NotificationPreference.create({
        userId: req.user._id,
        categories: {
          assignments: true,
          mentions: true,
          comments: true,
          reactions: true,
          taskUpdates: true,
          projectActivity: true,
          workspaceEvents: true,
        },
        channels: {
          inApp: true,
        },
        quietHours: {
          enabled: false,
          start: "22:00",
          end: "08:00",
          timezone: "UTC",
        },
        grouping: {
          enabled: true,
          windowMinutes: 5,
        },
      });
    }

    res.json(preference);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updatePreferences = async (req, res) => {
  try {
    const { categories, channels, quietHours, grouping } = req.body;

    let preference = await NotificationPreference.findOne({ userId: req.user._id });

    if (!preference) {
      preference = new NotificationPreference({ userId: req.user._id });
    }

    if (categories && typeof categories === "object") {
      preference.categories = {
        ...preference.categories.toObject?.() || preference.categories,
        ...categories,
      };
    }

    if (channels && typeof channels === "object") {
      preference.channels = {
        ...preference.channels.toObject?.() || preference.channels,
        ...channels,
      };
    }

    if (quietHours && typeof quietHours === "object") {
      // Validate time format if provided
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      const start = quietHours.start ?? preference.quietHours.start;
      const end = quietHours.end ?? preference.quietHours.end;

      if (!timeRegex.test(start) || !timeRegex.test(end)) {
        return res.status(400).json({ message: "Invalid quiet hours format. Expected HH:mm (24-hour)" });
      }

      preference.quietHours = {
        enabled: quietHours.enabled !== undefined ? Boolean(quietHours.enabled) : preference.quietHours.enabled,
        start,
        end,
        timezone: quietHours.timezone || preference.quietHours.timezone || "UTC",
      };
    }

    if (grouping && typeof grouping === "object") {
      preference.grouping = {
        enabled: grouping.enabled !== undefined ? Boolean(grouping.enabled) : preference.grouping.enabled,
        windowMinutes: typeof grouping.windowMinutes === "number" ? Math.max(1, Math.min(60, grouping.windowMinutes)) : preference.grouping.windowMinutes,
      };
    }

    await preference.save();

    // Broadcast preference update via Socket.io to user's private room to keep active sessions in sync
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${req.user._id}`).emit("preferenceUpdated", preference);
    }

    res.json(preference);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
