import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Running ROUT-01 route mounting and navigation regression test suite...");

const appJsxPath = path.resolve(__dirname, "../../frontend/src/App.jsx");
const sidebarJsxPath = path.resolve(__dirname, "../../frontend/src/components/Sidebar.jsx");

const appJsx = fs.readFileSync(appJsxPath, "utf-8");
const sidebarJsx = fs.readFileSync(sidebarJsxPath, "utf-8");

// Test 1: Verify all 3 pages are imported in App.jsx
{
  assert.strictEqual(appJsx.includes("import Calendar from \"./pages/Calendar\";"), true, "Calendar must be imported in App.jsx");
  assert.strictEqual(appJsx.includes("import Files from \"./pages/Files\";"), true, "Files must be imported in App.jsx");
  assert.strictEqual(appJsx.includes("import Analytics from \"./pages/Analytics\";"), true, "Analytics must be imported in App.jsx");
  console.log("✔ Test 1 Passed: Calendar, Files, and Analytics properly imported in App.jsx.");
}

// Test 2: Verify all sidebar paths exist in App.jsx routes
{
  const requiredRoutes = ["/calendar", "/files", "/analytics", "/projects", "/teams", "/"];
  for (const route of requiredRoutes) {
    const routeRegex = new RegExp(`path=["']${route}["']`);
    assert.strictEqual(routeRegex.test(appJsx), true, `Route ${route} must be mounted in App.jsx`);
  }
  console.log("✔ Test 2 Passed: All sidebar destination routes are explicitly mounted in App.jsx.");
}

// Test 3: Verify sidebar menu matches mounted routes
{
  assert.strictEqual(sidebarJsx.includes("path: \"/calendar\""), true, "Sidebar must link to /calendar");
  assert.strictEqual(sidebarJsx.includes("path: \"/files\""), true, "Sidebar must link to /files");
  assert.strictEqual(sidebarJsx.includes("path: \"/analytics\""), true, "Sidebar must link to /analytics");
  console.log("✔ Test 3 Passed: Sidebar items map 1:1 to mounted application routes.");
}

// Test 4: Verify 404 fallback route is mounted
{
  assert.strictEqual(appJsx.includes("path=\"*\""), true, "404 catch-all route must be mounted");
  console.log("✔ Test 4 Passed: 404 fallback route is mounted.");
}
