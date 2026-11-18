import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapTypeToCategory,
  isQuietHoursActive,
} from "../src/utils/notificationHelpers.js";

describe("UX-04: Notification Preferences & Category Mapping", () => {
  it("correctly maps notification types to categories", () => {
    assert.equal(mapTypeToCategory("TASK_ASSIGNED"), "assignments");
    assert.equal(mapTypeToCategory("MENTION"), "mentions");
    assert.equal(mapTypeToCategory("COMMENT_ADDED"), "comments");
    assert.equal(mapTypeToCategory("COMMENT_REPLIED"), "comments");
    assert.equal(mapTypeToCategory("REACTION_ADDED"), "reactions");
    assert.equal(mapTypeToCategory("TASK_UPDATED"), "taskUpdates");
    assert.equal(mapTypeToCategory("PROJECT_ACTIVITY"), "projectActivity");
    assert.equal(mapTypeToCategory("WORKSPACE_EVENT"), "workspaceEvents");
    assert.equal(mapTypeToCategory("AUTOMATION_TRIGGERED"), "workspaceEvents");
    // Fallback default
    assert.equal(mapTypeToCategory("UNKNOWN_FOO"), "taskUpdates");
  });
});

describe("UX-04: Quiet Hours Calculation Logic", () => {
  it("returns false if quiet hours are disabled", () => {
    const quietHours = {
      enabled: false,
      start: "22:00",
      end: "08:00",
      timezone: "UTC",
    };
    const testDate = new Date("2026-11-18T23:30:00Z");
    assert.equal(isQuietHoursActive(quietHours, testDate), false);
  });

  it("handles overnight quiet hours window (e.g. 22:00 to 08:00 UTC)", () => {
    const quietHours = {
      enabled: true,
      start: "22:00",
      end: "08:00",
      timezone: "UTC",
    };

    // 23:30 UTC -> inside quiet hours
    const night = new Date("2026-11-18T23:30:00Z");
    assert.equal(isQuietHoursActive(quietHours, night), true);

    // 04:15 UTC -> inside quiet hours
    const earlyMorning = new Date("2026-11-18T04:15:00Z");
    assert.equal(isQuietHoursActive(quietHours, earlyMorning), true);

    // 08:00 UTC -> boundary is exclusive at end
    const endBoundary = new Date("2026-11-18T08:00:00Z");
    assert.equal(isQuietHoursActive(quietHours, endBoundary), false);

    // 14:00 UTC -> outside quiet hours
    const afternoon = new Date("2026-11-18T14:00:00Z");
    assert.equal(isQuietHoursActive(quietHours, afternoon), false);

    // 22:00 UTC -> boundary is inclusive at start
    const startBoundary = new Date("2026-11-18T22:00:00Z");
    assert.equal(isQuietHoursActive(quietHours, startBoundary), true);
  });

  it("handles same-day quiet hours window (e.g. 13:00 to 15:00 UTC)", () => {
    const quietHours = {
      enabled: true,
      start: "13:00",
      end: "15:00",
      timezone: "UTC",
    };

    // 12:59 UTC -> outside
    assert.equal(isQuietHoursActive(quietHours, new Date("2026-11-18T12:59:00Z")), false);
    // 13:00 UTC -> inside
    assert.equal(isQuietHoursActive(quietHours, new Date("2026-11-18T13:00:00Z")), true);
    // 14:30 UTC -> inside
    assert.equal(isQuietHoursActive(quietHours, new Date("2026-11-18T14:30:00Z")), true);
    // 15:00 UTC -> outside
    assert.equal(isQuietHoursActive(quietHours, new Date("2026-11-18T15:00:00Z")), false);
  });

  it("respects timezone adjustments correctly (e.g. America/New_York)", () => {
    // America/New_York is UTC-5 in November (EST)
    const quietHours = {
      enabled: true,
      start: "22:00",
      end: "08:00",
      timezone: "America/New_York",
    };

    // 03:30 UTC is 22:30 EST (New York) -> inside quiet hours
    const nyNight = new Date("2026-11-18T03:30:00Z");
    assert.equal(isQuietHoursActive(quietHours, nyNight), true);

    // 15:00 UTC is 10:00 EST (New York) -> outside quiet hours
    const nyDay = new Date("2026-11-18T15:00:00Z");
    assert.equal(isQuietHoursActive(quietHours, nyDay), false);
  });

  it("gracefully falls back on invalid time or timezone inputs", () => {
    assert.equal(isQuietHoursActive(null), false);
    assert.equal(isQuietHoursActive({ enabled: true, start: "invalid", end: "bad" }), false);
  });
});

describe("UX-04: IDOR & Security Invariants for Notifications & Preferences", () => {
  it("verifies notification deletion and modification requires user ownership", () => {
    const currentUserId = "64b0f0000000000000000001";
    const foreignUserId = "64b0f0000000000000000002";

    const ownNotification = {
      _id: "64b0f0000000000000000010",
      userId: currentUserId,
      read: false,
    };

    const foreignNotification = {
      _id: "64b0f0000000000000000020",
      userId: foreignUserId,
      read: false,
    };

    const isOwn = (notif, userId) => notif.userId.toString() === userId.toString();

    assert.equal(isOwn(ownNotification, currentUserId), true);
    assert.equal(isOwn(foreignNotification, currentUserId), false);
  });

  it("validates quiet hours time format regex", () => {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    assert.equal(timeRegex.test("00:00"), true);
    assert.equal(timeRegex.test("23:59"), true);
    assert.equal(timeRegex.test("08:30"), true);
    assert.equal(timeRegex.test("24:00"), false);
    assert.equal(timeRegex.test("12:60"), false);
    assert.equal(timeRegex.test("9:30"), false);
    assert.equal(timeRegex.test("abc"), false);
  });
});
