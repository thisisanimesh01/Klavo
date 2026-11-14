import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appJsxPath = path.resolve(__dirname, "../../frontend/src/App.jsx");
const sidebarJsxPath = path.resolve(__dirname, "../../frontend/src/components/Sidebar.jsx");

const appJsx = fs.readFileSync(appJsxPath, "utf-8");
const sidebarJsx = fs.readFileSync(sidebarJsxPath, "utf-8");

test("ROUT-01: Application Route Registration in App.jsx", async (t) => {
  await t.test("Calendar, Files, and Analytics views are imported", () => {
    assert.equal(appJsx.includes("import Calendar from \"./pages/Calendar\";"), true);
    assert.equal(appJsx.includes("import Files from \"./pages/Files\";"), true);
    assert.equal(appJsx.includes("import Analytics from \"./pages/Analytics\";"), true);
  });

  await t.test("All core routes (/calendar, /files, /analytics, /projects, /teams, /) are mounted", () => {
    const requiredRoutes = ["/calendar", "/files", "/analytics", "/projects", "/teams", "/"];
    for (const route of requiredRoutes) {
      const routeRegex = new RegExp(`path=["']${route}["']`);
      assert.equal(routeRegex.test(appJsx), true, `Route ${route} must be mounted`);
    }
  });

  await t.test("404 catch-all route is mounted", () => {
    assert.equal(appJsx.includes("path=\"*\""), true);
  });
});

test("ROUT-01: Sidebar Navigation Consistency", async (t) => {
  await t.test("Sidebar links match application routes", () => {
    assert.equal(sidebarJsx.includes("path: \"/calendar\""), true);
    assert.equal(sidebarJsx.includes("path: \"/files\""), true);
    assert.equal(sidebarJsx.includes("path: \"/analytics\""), true);
  });
});
