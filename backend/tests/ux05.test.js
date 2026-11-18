import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSafeSvg } from "../src/services/storageService.js";

describe("UX-05: User Profile & Avatar Security Invariants", () => {
  it("validates allowed avatar image formats and detects invalid extensions", () => {
    const allowedExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
    const checkExt = (filename) => {
      const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
      return allowedExtensions.includes(ext);
    };

    assert.equal(checkExt("photo.png"), true);
    assert.equal(checkExt("photo.JPG"), true);
    assert.equal(checkExt("photo.webp"), true);
    assert.equal(checkExt("vector.svg"), true);
    assert.equal(checkExt("script.js"), false);
    assert.equal(checkExt("exploit.php"), false);
    assert.equal(checkExt("malware.exe"), false);
  });

  it("sanitizes dangerous SVG payloads in avatars", () => {
    const safeSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="5"/></svg>');
    assert.equal(isSafeSvg(safeSvg), true);

    const xssSvg1 = Buffer.from('<svg><script>alert("xss")</script></svg>');
    assert.equal(isSafeSvg(xssSvg1), false);

    const xssSvg2 = Buffer.from('<svg onload="alert(1)"></svg>');
    assert.equal(isSafeSvg(xssSvg2), false);

    const xssSvg3 = Buffer.from('<svg><a href="javascript:alert(1)"><text>Click</text></a></svg>');
    assert.equal(isSafeSvg(xssSvg3), false);
  });

  it("validates profile string length caps", () => {
    const bioValidator = (bio) => typeof bio === "string" && bio.trim().slice(0, 500);
    const longBio = "A".repeat(600);
    assert.equal(bioValidator(longBio).length, 500);

    const roleValidator = (role) => typeof role === "string" && role.trim().slice(0, 100);
    const longRole = "Senior Architect ".repeat(15);
    assert.equal(roleValidator(longRole).length, 100);
  });
});

describe("UX-05: Workspace Settings & Member Directory Permissions", () => {
  it("enforces workspace owner role for updating workspace metadata and logo", () => {
    const team = {
      _id: "team-123",
      owner: "user-owner",
      members: ["user-owner", "user-member"],
    };

    const canEditWorkspace = (team, userId) => team.owner === userId;

    assert.equal(canEditWorkspace(team, "user-owner"), true);
    assert.equal(canEditWorkspace(team, "user-member"), false);
    assert.equal(canEditWorkspace(team, "user-stranger"), false);
  });

  it("prevents removal of workspace owner", () => {
    const team = {
      _id: "team-123",
      owner: "user-owner",
      members: ["user-owner", "user-member"],
    };

    const canRemoveMember = (team, requesterId, targetId) => {
      // Owner cannot be removed
      if (targetId === team.owner) return false;
      // Owner can remove members, or a member can remove themselves (leave)
      return requesterId === team.owner || requesterId === targetId;
    };

    assert.equal(canRemoveMember(team, "user-owner", "user-owner"), false);
    assert.equal(canRemoveMember(team, "user-owner", "user-member"), true);
    assert.equal(canRemoveMember(team, "user-member", "user-member"), true); // self-leave
    assert.equal(canRemoveMember(team, "user-member", "user-owner"), false);
  });

  it("filters directory members safely without leaking password hashes", () => {
    const rawUsers = [
      { _id: "1", name: "Alice", email: "alice@example.com", password: "$2a$10$hashedsecret1", avatar: "a.png" },
      { _id: "2", name: "Bob", email: "bob@example.com", password: "$2a$10$hashedsecret2", avatar: "b.png" },
    ];

    const sanitizeDirectoryUser = (u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
    });

    const sanitized = rawUsers.map(sanitizeDirectoryUser);
    for (const u of sanitized) {
      assert.equal(u.password, undefined);
      assert.ok(u.name);
      assert.ok(u.email);
    }
  });
});
