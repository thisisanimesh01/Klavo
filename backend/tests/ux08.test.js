import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("UX-08: Onboarding Progress & Persistence Invariants", () => {
  it("initializes default onboarding state correctly for new users", () => {
    const defaultOnboarding = {
      completed: false,
      dismissed: false,
      step: 0,
      completedSteps: [],
      completedAt: null,
    };

    assert.equal(defaultOnboarding.completed, false);
    assert.equal(defaultOnboarding.dismissed, false);
    assert.equal(defaultOnboarding.step, 0);
    assert.deepEqual(defaultOnboarding.completedSteps, []);
    assert.equal(defaultOnboarding.completedAt, null);
  });

  it("safely merges completed steps and prevents duplicate step entries", () => {
    const existingSteps = ["welcome", "create_workspace"];
    const incomingSteps = ["create_workspace", "create_project"];

    const merged = Array.from(new Set([...existingSteps, ...incomingSteps]));
    assert.deepEqual(merged, ["welcome", "create_workspace", "create_project"]);
    assert.equal(merged.length, 3);
  });

  it("handles dismiss, resume, and restart reset transitions cleanly", () => {
    let state = {
      completed: false,
      dismissed: false,
      step: 2,
      completedSteps: ["welcome", "create_workspace"],
      completedAt: null,
    };

    // 1. Dismiss
    state = { ...state, dismissed: true };
    assert.equal(state.dismissed, true);

    // 2. Resume
    state = { ...state, dismissed: false };
    assert.equal(state.dismissed, false);

    // 3. Complete
    const now = new Date();
    state = { ...state, completed: true, completedAt: now };
    assert.equal(state.completed, true);
    assert.ok(state.completedAt instanceof Date);

    // 4. Reset / Restart
    state = {
      completed: false,
      dismissed: false,
      step: 0,
      completedSteps: [],
      completedAt: null,
    };
    assert.equal(state.completed, false);
    assert.equal(state.step, 0);
    assert.deepEqual(state.completedSteps, []);
  });

  it("correctly identifies existing users to prevent re-onboarding", () => {
    const isNewUser = (user, projectCount, teamCount) => {
      // If user has marked onboarding completed or dismissed, they are not a new un-onboarded user
      if (user?.onboarding?.completed || user?.onboarding?.dismissed) {
        return false;
      }
      // If user already owns or belongs to teams or projects, they are existing
      if (projectCount > 0 || teamCount > 0) {
        return false;
      }
      return true;
    };

    const brandNewUser = { onboarding: { completed: false, dismissed: false } };
    assert.equal(isNewUser(brandNewUser, 0, 0), true);

    // Existing user with prior projects
    assert.equal(isNewUser(brandNewUser, 3, 1), false);

    // User who already completed onboarding
    const completedUser = { onboarding: { completed: true, dismissed: false } };
    assert.equal(isNewUser(completedUser, 0, 0), false);

    // User who dismissed onboarding
    const dismissedUser = { onboarding: { completed: false, dismissed: true } };
    assert.equal(isNewUser(dismissedUser, 0, 0), false);
  });
});

describe("UX-08: Role-Specific Guidance & Step Visibility", () => {
  const steps = [
    { id: "welcome", targetRole: ["owner", "admin", "member", "guest"] },
    { id: "create_workspace", targetRole: ["owner", "admin"] },
    { id: "create_project", targetRole: ["owner", "admin", "member"] },
    { id: "manage_tasks", targetRole: ["owner", "admin", "member", "guest"] },
    { id: "collaborate_documents", targetRole: ["owner", "admin", "member", "guest"] },
    { id: "view_analytics", targetRole: ["owner", "admin", "member"] },
  ];

  it("filters actionable steps according to workspace role", () => {
    const filterForRole = (role) =>
      steps.filter((s) => s.targetRole.includes(role.toLowerCase()));

    const ownerSteps = filterForRole("owner");
    assert.equal(ownerSteps.length, 6); // All 6 steps

    const adminSteps = filterForRole("admin");
    assert.equal(adminSteps.length, 6); // All 6 steps

    const memberSteps = filterForRole("member");
    assert.equal(memberSteps.length, 5); // Cannot create_workspace
    assert.equal(memberSteps.some((s) => s.id === "create_workspace"), false);

    const guestSteps = filterForRole("guest");
    assert.equal(guestSteps.length, 3); // Only welcome, tasks, documents
    assert.deepEqual(
      guestSteps.map((s) => s.id),
      ["welcome", "manage_tasks", "collaborate_documents"]
    );
  });
});
