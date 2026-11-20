import { describe, it } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { resolveWorkspaceRole } from "../src/utils/authHelpers.js";
import { checkTeamAccess, checkProjectAccess } from "../src/utils/authHelpers.js";
import { sanitizeS3Key, S3CompatibleStorageProvider } from "../src/services/s3StorageProvider.js";
import { isSafeSvg } from "../src/services/storageService.js";
import { calculateChecksum, encryptBuffer, decryptBuffer } from "../src/utils/backupManager.js";
import { RedisCoordinator } from "../src/utils/redisCoordinator.js";

describe("SEC-10: Security Remediation & Penetration-Test Suite", () => {
  const JWT_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef";

  describe("Authentication, JWT Lifecycle & Tamper Proofing", () => {
    it("rejects forged or improperly signed JWT tokens", () => {
      const forgedToken = jwt.sign({ id: "user_attacker" }, "wrong_secret_key");
      assert.throws(() => {
        jwt.verify(forgedToken, JWT_SECRET);
      }, /invalid signature/i);
    });

    it("rejects expired JWT tokens strictly", () => {
      const expiredToken = jwt.sign({ id: "user_legit" }, JWT_SECRET, { expiresIn: -10 });
      assert.throws(() => {
        jwt.verify(expiredToken, JWT_SECRET);
      }, /jwt expired/i);
    });

    it("rejects algorithm confusion attack (none algorithm)", () => {
      // Token signed with 'none'
      const unsignedHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({ id: "admin_user" })).toString("base64url");
      const attackToken = `${unsignedHeader}.${payload}.`;

      assert.throws(() => {
        jwt.verify(attackToken, JWT_SECRET, { algorithms: ["HS256"] });
      }, /invalid token|invalid algorithm|jwt signature is required/i);
    });
  });

  describe("Workspace RBAC & Horizontal Privilege Escalation", () => {
    const mockTeam = {
      _id: "team_100",
      owner: "user_owner",
      members: ["user_owner", "user_admin", "user_member", "user_guest"],
      memberRoles: [
        { userId: "user_owner", role: "owner" },
        { userId: "user_admin", role: "admin" },
        { userId: "user_member", role: "member" },
        { userId: "user_guest", role: "guest" },
      ],
    };

    it("resolves roles accurately across workspace hierarchy", () => {
      assert.equal(resolveWorkspaceRole(mockTeam, "user_owner"), "owner");
      assert.equal(resolveWorkspaceRole(mockTeam, "user_admin"), "admin");
      assert.equal(resolveWorkspaceRole(mockTeam, "user_member"), "member");
      assert.equal(resolveWorkspaceRole(mockTeam, "user_guest"), "guest");
      assert.equal(resolveWorkspaceRole(mockTeam, "user_outsider"), "none");
    });

    it("prevents non-owners and guests from escalating privileges", () => {
      // Guest or member trying to perform admin action
      const guestRole = resolveWorkspaceRole(mockTeam, "user_guest");
      const isPrivileged = guestRole === "owner" || guestRole === "admin";
      assert.equal(isPrivileged, false, "Guest must not have administrative privileges");
    });
  });

  describe("S3 Path Traversal & Key Isolation Defense", () => {
    it("sanitizes relative path sequences and null bytes", () => {
      const dirtyKeys = [
        "../../etc/shadow\0",
        "..\\..\\system32\\cmd.exe",
        "docs/../../../super_secret.env",
        "/root/.ssh/id_rsa",
      ];

      for (const k of dirtyKeys) {
        const clean = sanitizeS3Key(k);
        assert.ok(!clean.includes(".."), `Key must not contain '..': ${clean}`);
        assert.ok(!clean.includes("\0"), `Key must not contain null bytes: ${clean}`);
        assert.ok(!clean.startsWith("/"), `Key must not start with slash: ${clean}`);
      }
    });

    it("generates SigV4 presigned URLs with required expiration and security headers", () => {
      const provider = new S3CompatibleStorageProvider({
        bucket: "klavo-test-bucket",
        accessKeyId: "mock_id",
        secretAccessKey: "mock_secret",
      });

      const signedUrl = provider.getSignedUrl("uploads/avatar.png", 600);
      const parsed = new URL(signedUrl);

      assert.equal(parsed.searchParams.get("X-Amz-Expires"), "600");
      assert.ok(parsed.searchParams.get("X-Amz-Signature"));
      assert.ok(parsed.searchParams.get("X-Amz-Credential"));
      assert.equal(parsed.searchParams.get("X-Amz-Algorithm"), "AWS4-HMAC-SHA256");
    });
  });

  describe("File Uploads & SVG Script Sanitization", () => {
    it("detects malicious SVG scripts, onload handlers, and javascript URIs", () => {
      const xssSvg1 = Buffer.from('<svg><script>alert("pwned")</script></svg>');
      const xssSvg2 = Buffer.from('<svg onload="fetch(\'http://attacker.com\')"><rect width="10" height="10"/></svg>');
      const xssSvg3 = Buffer.from('<svg><a href="javascript:alert(1)"><circle r="5"/></a></svg>');
      const safeSvg = Buffer.from('<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="blue"/></svg>');

      assert.equal(isSafeSvg(xssSvg1), false);
      assert.equal(isSafeSvg(xssSvg2), false);
      assert.equal(isSafeSvg(xssSvg3), false);
      assert.equal(isSafeSvg(safeSvg), true);
    });
  });

  describe("Redis Coordinator Security & TLS Connection Handling", () => {
    it("correctly identifies TLS requirement for rediss:// schemes", () => {
      const tlsCoord = new RedisCoordinator({
        url: "rediss://:mypassword@secure-redis.cloud.example.com:6380",
      });

      assert.equal(tlsCoord.tls, true);
      assert.equal(tlsCoord.host, "secure-redis.cloud.example.com");
      assert.equal(tlsCoord.port, 6380);
      assert.equal(tlsCoord.password, "mypassword");
    });
  });

  describe("Backup Authenticated Encryption Security", () => {
    it("ensures AES-256-GCM ciphertext cannot be decrypted if tampered", () => {
      const secret = "a_super_strong_key_exceeding_32_chars_123456";
      const payload = Buffer.from("confidential database record dump");

      const encrypted = encryptBuffer(payload, secret);
      assert.ok(encrypted.length > payload.length);

      // Tamper ciphertext
      const tampered = Buffer.from(encrypted);
      tampered[tampered.length - 1] ^= 0x01;

      assert.throws(() => {
        decryptBuffer(tampered, secret);
      }, /Unsupported state or unable to authenticate data|bad decrypt/i);
    });
  });
});
