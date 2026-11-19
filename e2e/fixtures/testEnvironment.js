import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createApp } from "../../backend/src/app.js";
import { connectDB } from "../../backend/src/config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

/**
 * Boots an isolated unified test server serving both the frontend static production bundle
 * and the backend Express REST API under the same origin.
 *
 * This eliminates CORS, port conflicts, and external network dependencies.
 */
export async function startUnifiedTestServer() {
  await connectDB();
  const distDir = path.resolve(__dirname, "../../frontend/dist");
  const backendApp = createApp();

  const server = http.createServer((req, res) => {
    // If request is directed to backend API, route into Express backend app
    if (req.url.startsWith("/api/")) {
      return backendApp.handle(req, res);
    }

    // Otherwise serve frontend production build assets from frontend/dist
    const parsedUrl = new URL(req.url, "http://127.0.0.1");
    let safePath = path.normalize(parsedUrl.pathname);
    if (safePath === "/") safePath = "/index.html";

    let filePath = path.join(distDir, safePath);

    // Fallback to index.html for SPA client-side routing
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, "index.html");
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found: Build frontend first (npm run build in frontend/)");
    }
  });

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    server,
    baseUrl,
    port,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
