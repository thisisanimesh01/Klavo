import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import jwt from "jsonwebtoken";

/**
 * Dispatches an in-memory HTTP request directly into the Express application pipeline
 * using native Node.js IncomingMessage and ServerResponse.
 *
 * This executes the full Express middleware stack (CORS, body parser, cookie parser, router,
 * controller handlers, notFoundHandler, and errorHandler) without opening OS network sockets.
 * Guarantees 100% deterministic test execution inside sandbox environments and CI containers.
 */
export const dispatchRequest = (app, { method = "GET", url = "/", headers = {}, body = null, token = null }) => {
  return new Promise((resolve) => {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    const res = new ServerResponse(req);

    req.method = method.toUpperCase();
    req.url = url;
    req.headers = {};

    for (const [k, v] of Object.entries(headers)) {
      req.headers[k.toLowerCase()] = v;
    }

    if (token) {
      req.headers["authorization"] = `Bearer ${token}`;
    }

    let payloadBuffer = null;
    if (body !== null && body !== undefined) {
      if (typeof body === "object" && !(body instanceof Buffer)) {
        req.headers["content-type"] = req.headers["content-type"] || "application/json";
        payloadBuffer = Buffer.from(JSON.stringify(body));
      } else if (typeof body === "string") {
        payloadBuffer = Buffer.from(body);
      } else if (body instanceof Buffer) {
        payloadBuffer = body;
      }
      req.headers["content-length"] = String(payloadBuffer.length);
    }

    let responseData = "";

    res.write = function (chunk, encoding) {
      if (chunk) {
        responseData += Buffer.isBuffer(chunk) ? chunk.toString() : chunk;
      }
      return true;
    };

    res.end = function (chunk, encoding) {
      if (chunk) {
        responseData += Buffer.isBuffer(chunk) ? chunk.toString() : chunk;
      }

      let parsedBody = responseData;
      const contentType = res.getHeader("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          parsedBody = JSON.parse(responseData);
        } catch {
          // keep as string
        }
      }

      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        body: parsedBody,
      });
    };

    app.handle(req, res);

    if (payloadBuffer) {
      req.push(payloadBuffer);
    }
    req.push(null);
  });
};

/**
 * Generates an authenticated JWT test token for any user ID
 */
export const createTestAuthToken = (userId, secret = "test_jwt_secret_key_ci") => {
  return jwt.sign({ id: userId }, secret, { expiresIn: "1h" });
};
