#!/usr/bin/env node

/**
 * Klavo Automated Secret Leak Regression Checker (SEC-09)
 *
 * Scans all Git-tracked files in the repository for:
 * 1. Hardcoded private keys (RSA, EC, PGP, OPENSSH)
 * 2. Real AWS access keys (AKIA[0-9A-Z]{16})
 * 3. Connection URIs with embedded plain passwords (mongodb://user:pass@)
 * 4. Raw JWT tokens (Bearer eyJ...) outside of unit test mocks
 * 5. Tracked production or staging .env files
 *
 * Safety Invariants:
 * - Exits 0 on clean scan; exits 1 if secret exposures are detected.
 * - Never prints discovered secret values.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const SUSPICIOUS_PATTERNS = [
  {
    name: "Private Key Header",
    regex: /-----BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----/,
    severity: "CRITICAL",
  },
  {
    name: "Live AWS Access Key ID",
    regex: /\bAKIA[0-9A-Z]{16}\b/,
    severity: "CRITICAL",
    allowTestMocks: true,
  },
  {
    name: "Live MongoDB URI with Embedded Password",
    regex: /mongodb(\+srv)?:\/\/[a-zA-Z0-9_\-\.]+:[^@\s\/<>\"']+@[a-zA-Z0-9_\-\.]+/i,
    severity: "CRITICAL",
    allowTestMocks: true,
  },
  {
    name: "Hardcoded Bearer JWT Token",
    regex: /Bearer\s+eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/,
    severity: "HIGH",
    allowTestMocks: true,
  },
];

const IGNORED_PATHS = [
  "package-lock.json",
  "frontend/package-lock.json",
  "backend/package-lock.json",
  "node_modules",
  ".git",
];

export function runSecretScan() {
  const violations = [];

  let trackedFiles = [];
  try {
    const stdout = execSync("git ls-files", { cwd: REPO_ROOT, encoding: "utf8" });
    trackedFiles = stdout.split("\n").map((f) => f.trim()).filter(Boolean);
  } catch (err) {
    console.error("Failed to list git-tracked files:", err.message);
    process.exit(1);
  }

  for (const relativePath of trackedFiles) {
    // Check if path is in ignored paths
    if (IGNORED_PATHS.some((ip) => relativePath.startsWith(ip))) {
      continue;
    }

    // Check for tracked .env files (only .env.example allowed)
    const baseName = path.basename(relativePath);
    if (baseName.startsWith(".env") && baseName !== ".env.example") {
      violations.push({
        file: relativePath,
        line: 1,
        rule: "Tracked .env file",
        severity: "CRITICAL",
      });
      continue;
    }

    const fullPath = path.join(REPO_ROOT, relativePath);
    if (!fs.existsSync(fullPath)) continue;

    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) continue;

    // Skip binary files and large bundles
    if (relativePath.endsWith(".png") || relativePath.endsWith(".ico") || relativePath.endsWith(".pdf") || relativePath.endsWith(".gz")) {
      continue;
    }

    const isMarkdownDoc = relativePath.endsWith(".md");

    let content = "";
    try {
      content = fs.readFileSync(fullPath, "utf8");
    } catch {
      continue;
    }

    const isTestFile =
      relativePath.includes("test") ||
      relativePath.includes("spec") ||
      relativePath.includes("fixtures") ||
      relativePath.includes("mock");

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Ignore comments and docstrings that merely document URI format or regexes
      const trimmed = line.trim();
      if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*")) {
        continue;
      }

      // Documentation markdown files: allow example placeholder syntax (e.g. user:pass@host or <placeholder>)
      if (isMarkdownDoc) {
        if (
          trimmed.includes("user:pass@") ||
          trimmed.includes("<") ||
          trimmed.includes("example") ||
          trimmed.includes("dummy")
        ) {
          continue;
        }
      }

      for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.allowTestMocks && isTestFile) {
          // Allow mock tokens/URIs if line explicitly marks as dummy, mock, test, or example
          const lower = line.toLowerCase();
          if (
            lower.includes("mock") ||
            lower.includes("test") ||
            lower.includes("dummy") ||
            lower.includes("example") ||
            lower.includes("sample") ||
            lower.includes("redact") ||
            lower.includes("supersecret123") || // redaction test fixture
            lower.includes("ultra_secure_pass") // redaction test fixture
          ) {
            continue;
          }
        }

        // Allow regex definitions themselves
        if (line.includes("URI_CREDENTIAL_REGEX") || line.includes("BEARER_REGEX") || line.includes("regex:")) {
          continue;
        }

        if (pattern.regex.test(line)) {
          violations.push({
            file: relativePath,
            line: i + 1,
            rule: pattern.name,
            severity: pattern.severity,
          });
        }
      }
    }
  }

  return violations;
}

// Direct CLI Execution
if (process.argv[1] && process.argv[1].endsWith("scan_secrets.js")) {
  console.log("==================================================");
  console.log("🔒 Running Klavo Secret Leak Regression Scan");
  console.log("==================================================");

  const findings = runSecretScan();

  if (findings.length === 0) {
    console.log("✅ Secret Scan Passed: Zero exposed secrets found across tracked files.");
    console.log("==================================================");
    process.exit(0);
  } else {
    console.error(`❌ Secret Scan Failed: Found ${findings.length} potential secret leak(s):`);
    for (const v of findings) {
      console.error(`  - [${v.severity}] ${v.file}:${v.line} (${v.rule})`);
    }
    console.log("==================================================");
    process.exit(1);
  }
}
