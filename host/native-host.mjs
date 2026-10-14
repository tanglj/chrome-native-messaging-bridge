#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));

let pendingBuffer = Buffer.alloc(0);
let nextId = 1;
const pending = new Map();

function log(message) {
  fs.appendFileSync(path.join(__dirname, "native-host.log"), `${new Date().toISOString()} ${message}\n`);
}

function sendNative(message) {
  const json = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  process.stdout.write(Buffer.concat([header, json]));
}

function handleNativeBytes(chunk) {
  pendingBuffer = Buffer.concat([pendingBuffer, chunk]);
  while (pendingBuffer.length >= 4) {
    const length = pendingBuffer.readUInt32LE(0);
    if (pendingBuffer.length < 4 + length) {
      break;
    }
    const body = pendingBuffer.subarray(4, 4 + length).toString("utf8");
    pendingBuffer = pendingBuffer.subarray(4 + length);
    let message;
    try {
      message = JSON.parse(body);
    } catch (error) {
      log(`Invalid JSON from extension: ${String(error?.message || error)}`);
      continue;
    }
    handleNativeMessage(message);
  }
}

function handleNativeMessage(message) {
  const id = message?.id;
  if (id && pending.has(id)) {
    const { resolve, reject, timeout } = pending.get(id);
    clearTimeout(timeout);
    pending.delete(id);
    if (message.ok) {
      resolve(message.result);
    } else {
      reject(new Error(message.error || "Extension returned an error."));
    }
    return;
  }

  if (message?.type === "ping") {
    sendNative({
      id: id || null,
      ok: true,
      result: {
        pong: true,
        host: config.hostName,
        time: new Date().toISOString()
      }
    });
    return;
  }

  if (id) {
    sendNative({
      id,
      ok: false,
      error: `Unsupported host message type: ${message?.type || "unknown"}`
    });
    return;
  }

  log(`Unmatched native message: ${JSON.stringify(message).slice(0, 500)}`);
}

function askExtension(payload, timeoutMs = 30000) {
  const id = String(nextId++);
  const message = { id, ...payload };
  const promise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Timed out waiting for the Chrome extension."));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timeout });
  });
  sendNative(message);
  return promise;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > config.maxBodyBytes) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Request body must be JSON."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

async function route(req, res) {
  try {
    const url = new URL(req.url || "/", `http://${config.httpHost}:${config.httpPort}`);
    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { ok: true, host: config.hostName });
      return;
    }

    if (req.method === "POST" && url.pathname === "/rpc") {
      const body = await readRequestBody(req);
      const result = await askExtension(body);
      sendJson(res, 200, { ok: true, result });
      return;
    }

    sendJson(res, 404, { ok: false, error: "Not found." });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: String(error?.message || error) });
  }
}

const server = http.createServer(route);
server.listen(config.httpPort, config.httpHost, () => {
  log(`HTTP bridge listening on http://${config.httpHost}:${config.httpPort}`);
});

process.stdin.on("data", handleNativeBytes);
process.stdin.on("end", () => {
  log("Native stdin ended.");
  server.close();
});
process.on("uncaughtException", (error) => log(`Uncaught: ${String(error?.stack || error)}`));
process.on("unhandledRejection", (error) => log(`Unhandled rejection: ${String(error?.stack || error)}`));
