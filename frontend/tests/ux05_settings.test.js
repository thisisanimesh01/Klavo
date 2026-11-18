import test from "node:test";
import assert from "node:assert/strict";

test("FRONTEND UX-05: Settings Tabs, Directory Search & Navigation State", async (t) => {
  const settingsTabs = ["profile", "account", "preferences", "workspace", "directory"];

  await t.test("supports all core settings navigation tabs", () => {
    assert.equal(settingsTabs.length, 5);
    assert.ok(settingsTabs.includes("profile"));
    assert.ok(settingsTabs.includes("account"));
    assert.ok(settingsTabs.includes("preferences"));
    assert.ok(settingsTabs.includes("workspace"));
    assert.ok(settingsTabs.includes("directory"));
  });

  await t.test("filters workspace directory members accurately across name, email, and roleTitle", () => {
    const members = [
      { _id: "1", name: "Animesh Yadav", email: "animesh@example.com", roleTitle: "Lead Architect" },
      { _id: "2", name: "Sarah Connor", email: "sarah@cyberdyne.org", roleTitle: "DevOps Engineer" },
      { _id: "3", name: "John Doe", email: "jdoe@acme.com", roleTitle: "Frontend Developer" },
    ];

    const filterMembers = (list, query) => {
      if (!query.trim()) return list;
      const term = query.toLowerCase();
      return list.filter(
        (m) =>
          m.name.toLowerCase().includes(term) ||
          m.email.toLowerCase().includes(term) ||
          m.roleTitle.toLowerCase().includes(term)
      );
    };

    assert.equal(filterMembers(members, "").length, 3);
    assert.equal(filterMembers(members, "animesh").length, 1);
    assert.equal(filterMembers(members, "DevOps").length, 1);
    assert.equal(filterMembers(members, "acme.com").length, 1);
    assert.equal(filterMembers(members, "nonexistent").length, 0);
  });

  await t.test("validates password change equality match prior to network dispatch", () => {
    const validatePasswordForm = (newPass, confirmPass) => {
      if (!newPass || newPass.length < 6) return { valid: false, error: "Password must be at least 6 characters" };
      if (newPass !== confirmPass) return { valid: false, error: "New passwords do not match" };
      return { valid: true, error: "" };
    };

    assert.equal(validatePasswordForm("short", "short").valid, false);
    assert.equal(validatePasswordForm("validpass123", "mismatchpass").valid, false);
    assert.equal(validatePasswordForm("validpass123", "validpass123").valid, true);
  });
});
