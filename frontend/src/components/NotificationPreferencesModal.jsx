import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Modal, Button, Checkbox, Input, Select } from "./ui";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  clearNotifications,
} from "../api/notificationApi";
import { setPreferences, clearAll } from "../store/slices/notificationSlice";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Australia/Sydney",
];

export default function NotificationPreferencesModal({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const reduxPreferences = useSelector((state) => state.notifications.preferences);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Local state initialized with defaults
  const [categories, setCategories] = useState({
    assignments: true,
    mentions: true,
    comments: true,
    reactions: true,
    taskUpdates: true,
    projectActivity: true,
    workspaceEvents: true,
  });

  const [channels, setChannels] = useState({
    inApp: true,
  });

  const [quietHours, setQuietHours] = useState({
    enabled: false,
    start: "22:00",
    end: "08:00",
    timezone: "UTC",
  });

  const [grouping, setGrouping] = useState({
    enabled: true,
    windowMinutes: 5,
  });

  // Load preferences from API when opened
  useEffect(() => {
    if (!isOpen) return;

    const loadPrefs = async () => {
      setLoading(true);
      try {
        const data = await getNotificationPreferences();
        if (data) {
          dispatch(setPreferences(data));
          if (data.categories) setCategories((prev) => ({ ...prev, ...data.categories }));
          if (data.channels) setChannels((prev) => ({ ...prev, ...data.channels }));
          if (data.quietHours) setQuietHours((prev) => ({ ...prev, ...data.quietHours }));
          if (data.grouping) setGrouping((prev) => ({ ...prev, ...data.grouping }));
        }
      } catch (err) {
        console.error("Failed to load notification preferences:", err);
      } finally {
        setLoading(false);
      }
    };

    loadPrefs();
  }, [isOpen, dispatch]);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const payload = {
        categories,
        channels,
        quietHours,
        grouping,
      };
      const updated = await updateNotificationPreferences(payload);
      dispatch(setPreferences(updated));
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error("Failed to save notification preferences:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to clear all notifications? This action cannot be undone.")) {
      return;
    }
    setClearing(true);
    try {
      await clearNotifications();
      dispatch(clearAll());
    } catch (err) {
      console.error("Failed to clear notifications:", err);
    } finally {
      setClearing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Notification Preferences"
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="danger"
            size="sm"
            onClick={handleClearAll}
            disabled={clearing || loading}
          >
            {clearing ? "Clearing..." : "Clear all notifications"}
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={saving || loading}
            >
              {saving ? "Saving..." : saveSuccess ? "Saved ✓" : "Save Changes"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6 text-sm text-slate-700 dark:text-slate-300">
        {/* Delivery Channels */}
        <div>
          <h4 className="font-semibold text-xs tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-2">
            Delivery Channels
          </h4>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
            <Checkbox
              id="channel-inapp"
              label="In-App Notifications"
              description="Receive notifications in real-time within Klavo"
              checked={channels.inApp}
              onChange={(e) => setChannels((prev) => ({ ...prev, inApp: e.target.checked }))}
            />
            <p className="text-[11px] text-slate-400 pl-6">
              External delivery channels (email/push) will appear here once configured on your workspace.
            </p>
          </div>
        </div>

        {/* Categories */}
        <div>
          <h4 className="font-semibold text-xs tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-2">
            Notification Categories
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
              <input
                type="checkbox"
                checked={categories.assignments}
                onChange={(e) =>
                  setCategories((prev) => ({ ...prev, assignments: e.target.checked }))
                }
                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <div>
                <span className="font-medium text-xs block">Task Assignments</span>
                <span className="text-[10px] text-slate-400">When you are assigned tasks</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
              <input
                type="checkbox"
                checked={categories.mentions}
                onChange={(e) =>
                  setCategories((prev) => ({ ...prev, mentions: e.target.checked }))
                }
                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <div>
                <span className="font-medium text-xs block">Direct Mentions</span>
                <span className="text-[10px] text-slate-400">When someone mentions @you</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
              <input
                type="checkbox"
                checked={categories.comments}
                onChange={(e) =>
                  setCategories((prev) => ({ ...prev, comments: e.target.checked }))
                }
                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <div>
                <span className="font-medium text-xs block">Comments & Replies</span>
                <span className="text-[10px] text-slate-400">Activity on your items</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
              <input
                type="checkbox"
                checked={categories.reactions}
                onChange={(e) =>
                  setCategories((prev) => ({ ...prev, reactions: e.target.checked }))
                }
                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <div>
                <span className="font-medium text-xs block">Reactions</span>
                <span className="text-[10px] text-slate-400">Emoji reactions on comments</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
              <input
                type="checkbox"
                checked={categories.taskUpdates}
                onChange={(e) =>
                  setCategories((prev) => ({ ...prev, taskUpdates: e.target.checked }))
                }
                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <div>
                <span className="font-medium text-xs block">Task Updates</span>
                <span className="text-[10px] text-slate-400">Status, priority, date changes</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
              <input
                type="checkbox"
                checked={categories.projectActivity}
                onChange={(e) =>
                  setCategories((prev) => ({ ...prev, projectActivity: e.target.checked }))
                }
                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <div>
                <span className="font-medium text-xs block">Project Activity</span>
                <span className="text-[10px] text-slate-400">Milestones, sprints, project status</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer sm:col-span-2">
              <input
                type="checkbox"
                checked={categories.workspaceEvents}
                onChange={(e) =>
                  setCategories((prev) => ({ ...prev, workspaceEvents: e.target.checked }))
                }
                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <div>
                <span className="font-medium text-xs block">Workspace & Automation Events</span>
                <span className="text-[10px] text-slate-400">Automations, memberships, system notices</span>
              </div>
            </label>
          </div>
        </div>

        {/* Quiet Hours */}
        <div>
          <h4 className="font-semibold text-xs tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-2">
            Quiet Hours
          </h4>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
            <Checkbox
              id="quiet-enabled"
              label="Mute real-time notification sounds and popups during quiet hours"
              description="Notifications are saved to your inbox and can be reviewed anytime"
              checked={quietHours.enabled}
              onChange={(e) =>
                setQuietHours((prev) => ({ ...prev, enabled: e.target.checked }))
              }
            />

            {quietHours.enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 pl-6">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Starts at
                  </label>
                  <input
                    type="time"
                    value={quietHours.start}
                    onChange={(e) =>
                      setQuietHours((prev) => ({ ...prev, start: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Ends at
                  </label>
                  <input
                    type="time"
                    value={quietHours.end}
                    onChange={(e) =>
                      setQuietHours((prev) => ({ ...prev, end: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Timezone
                  </label>
                  <select
                    value={quietHours.timezone}
                    onChange={(e) =>
                      setQuietHours((prev) => ({ ...prev, timezone: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-indigo-500"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Grouping & Duplicate Suppression */}
        <div>
          <h4 className="font-semibold text-xs tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-2">
            Notification Grouping & Frequency
          </h4>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
            <Checkbox
              id="grouping-enabled"
              label="Suppress rapid repeated notifications"
              description="Prevents repeated alerts for the same item within a 5-minute window"
              checked={grouping.enabled}
              onChange={(e) =>
                setGrouping((prev) => ({ ...prev, enabled: e.target.checked }))
              }
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
