import { DEFAULT_NATIVE_HOSTS, DEFAULT_WEB_ORIGINS, NATIVE_HOST_NAME } from "./config.js";

const nativeHosts = new Map();
const STORAGE_KEY = "nativeHostManager";
const AUTO_CONNECT_KEY = "nativeHostAutoConnect";
const KEEPALIVE_ALARM = "nativeHostKeepalive";

async function isAutoConnectEnabled() {
  const result = await chrome.storage.local.get(AUTO_CONNECT_KEY);
  return result[AUTO_CONNECT_KEY] !== false;
}

async function setAutoConnectEnabled(value) {
  await chrome.storage.local.set({ [AUTO_CONNECT_KEY]: value });
}

async function ensureConnected() {
  if (!(await isAutoConnectEnabled())) {
    return;
  }
  const status = getHostStatus(NATIVE_HOST_NAME);
  if (status.connected) {
    return;
  }
  try {
    await connectNative(NATIVE_HOST_NAME);
  } catch (error) {
    // 宿主 manifest 缺失等情况：静默失败，保活闹钟会继续重试。
  }
}

// 对账自愈：首次授权时 Chrome 的权限确认框可能关闭 popup，导致 origin 已授权但未入列。
// 这里把 Chrome 已授予但 storage 中缺失的 http/https origin 补进 webOrigins。
async function reconcileGrantedOrigins() {
  const granted = await chrome.permissions.getAll();
  const grantedOrigins = (granted.origins || [])
    .map((pattern) => pattern.replace(/\/\*$/, ""))
    .filter((origin) => {
      try {
        return ["http:", "https:"].includes(new URL(origin).protocol);
      } catch {
        return false;
      }
    });
  if (!grantedOrigins.length) {
    return;
  }
  const state = await getStoredState();
  const current = (state.webOrigins || []).map(normalizeWebOrigin);
  const merged = [...new Set([...current, ...grantedOrigins.map(normalizeWebOrigin)])];
  if (merged.length !== current.length) {
    await chrome.storage.local.set({ [STORAGE_KEY]: { ...state, webOrigins: merged } });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validateNativeHostName(hostName) {
  if (!/^[a-z0-9_]+(\.[a-z0-9_]+)*$/.test(hostName || "")) {
    throw new Error("Invalid native host name.");
  }
}

function normalizeWebOrigin(value) {
  const input = String(value || "").trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;
  const url = new URL(withScheme);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http and https web hosts are supported.");
  }
  return url.origin;
}

function permissionPattern(origin) {
  return `${origin}/*`;
}

async function getStoredState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || {};
}

async function getAllowedWebOrigins() {
  const state = await getStoredState();
  return [...new Set([...(state.webOrigins || []), ...DEFAULT_WEB_ORIGINS].map(normalizeWebOrigin))];
}

async function hasWebOriginPermission(origin) {
  return chrome.permissions.contains({ origins: [permissionPattern(origin)] });
}

async function webOriginStatuses() {
  const origins = await getAllowedWebOrigins();
  const statuses = [];
  for (const origin of origins) {
    statuses.push({
      origin,
      granted: await hasWebOriginPermission(origin)
    });
  }
  return statuses;
}

async function isAllowedUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const origins = await getAllowedWebOrigins();
    return origins.includes(url.origin) && await hasWebOriginPermission(url.origin);
  } catch {
    return false;
  }
}

function getHeader(headers, name) {
  if (!headers || typeof headers !== "object") {
    return undefined;
  }
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) {
      return value;
    }
  }
  return undefined;
}

function sanitizeHeaders(headers) {
  const result = {};
  const allowed = new Set(["accept", "content-type"]);
  if (!headers || typeof headers !== "object") {
    return result;
  }
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (allowed.has(lower) && typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
}

async function getCookieHeader(url) {
  if (!await isAllowedUrl(url)) {
    throw new Error(`URL is not allowed: ${url}`);
  }
  // getAll({ url }) 已按 URL 返回适用的 Cookie（含 Domain 级 Cookie），不额外扩大域名范围。
  const cookies = await chrome.cookies.getAll({ url });
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function browserFetch(request) {
  const url = request.url;
  if (!await isAllowedUrl(url)) {
    throw new Error(`URL is not allowed: ${url}`);
  }

  const method = (request.method || "GET").toUpperCase();
  if (!["GET", "POST"].includes(method)) {
    throw new Error(`HTTP method is not allowed: ${method}`);
  }

  const response = await fetch(url, {
    method,
    headers: sanitizeHeaders(request.headers),
    body: method === "GET" ? undefined : request.body,
    credentials: "include",
    redirect: "manual"
  });

  const text = await response.text();
  return {
    status: response.status,
    redirected: response.redirected,
    url: response.url,
    location: response.headers.get("location") || "",
    contentType: response.headers.get("content-type") || "",
    body: text
  };
}

async function handleHostRequest(message) {
  if (!message || typeof message !== "object") {
    throw new Error("Invalid message.");
  }
  switch (message.type) {
    case "ping":
      return { pong: true, time: new Date().toISOString() };
    case "fetch":
      return browserFetch(message);
    case "getCookieHeader":
      return { cookieHeader: await getCookieHeader(message.url) };
    default:
      throw new Error(`Unsupported message type: ${message.type}`);
  }
}

function isBridgeRequest(message) {
  return Boolean(
    message &&
    typeof message === "object" &&
    typeof message.type === "string" &&
    ["ping", "fetch", "getCookieHeader"].includes(message.type) &&
    !("ok" in message)
  );
}

function getHostStatus(hostName) {
  const entry = nativeHosts.get(hostName);
  return {
    hostName,
    connected: Boolean(entry?.connected && entry?.port),
    error: entry?.error || "",
    lastMessage: entry?.lastMessage || null
  };
}

function listHostStatuses() {
  const names = new Set([...DEFAULT_NATIVE_HOSTS, ...nativeHosts.keys()]);
  return [...names].sort().map(getHostStatus);
}

function postToNative(hostName, payload) {
  const entry = nativeHosts.get(hostName);
  if (!entry?.port) {
    throw new Error(`Native host is not connected: ${hostName}`);
  }
  entry.port.postMessage(payload);
}

async function connectNative(hostName = NATIVE_HOST_NAME) {
  validateNativeHostName(hostName);
  await setAutoConnectEnabled(true);
  const existing = nativeHosts.get(hostName);
  if (existing?.port) {
    return getHostStatus(hostName);
  }

  const entry = {
    hostName,
    port: null,
    connected: false,
    error: "",
    lastMessage: null,
    pendingTests: []
  };

  nativeHosts.set(hostName, entry);
  entry.port = chrome.runtime.connectNative(hostName);
  entry.connected = true;

  entry.port.onMessage.addListener(async (message) => {
    const id = message?.id || null;
    try {
      // 只有无 id 的宿主回执才是 testNative 的响应，避免误吞 /rpc 的桥接响应
      const pending = !id ? entry.pendingTests.shift() : null;
      if (pending) {
        clearTimeout(pending.timeout);
        entry.lastMessage = message;
        pending.resolve(message);
        return;
      }

      if (isBridgeRequest(message)) {
        const result = await handleHostRequest(message);
        postToNative(hostName, { id, ok: true, result });
        return;
      }
      entry.lastMessage = message;
    } catch (error) {
      postToNative(hostName, { id, ok: false, error: String(error?.message || error) });
    }
  });

  entry.port.onDisconnect.addListener(() => {
    entry.connected = false;
    entry.error = chrome.runtime.lastError?.message || "Disconnected";
    entry.port = null;
    for (const pending of entry.pendingTests.splice(0)) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(entry.error));
    }
  });

  await sleep(250);
  return getHostStatus(hostName);
}

function disconnectNative(hostName = NATIVE_HOST_NAME) {
  validateNativeHostName(hostName);
  const entry = nativeHosts.get(hostName);
  if (entry?.port) {
    entry.port.disconnect();
  }
  nativeHosts.delete(hostName);
  setAutoConnectEnabled(false);
  return getHostStatus(hostName);
}

async function testNative(hostName, payload, timeoutMs = 5000) {
  const status = await connectNative(hostName);
  if (!status.connected) {
    return { connected: false, error: status.error || "Native host is not connected." };
  }

  const entry = nativeHosts.get(hostName);
  const responsePromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const index = entry.pendingTests.findIndex((item) => item.resolve === resolve);
      if (index >= 0) {
        entry.pendingTests.splice(index, 1);
      }
      reject(new Error(`Timed out waiting for ${hostName}.`));
    }, Math.max(1000, Math.min(Number(timeoutMs) || 5000, 30000)));
    entry.pendingTests.push({ resolve, reject, timeout });
  });

  postToNative(hostName, payload);
  const response = await responsePromise;
  return { connected: true, response };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === "defaults") {
      sendResponse({
        nativeHosts: DEFAULT_NATIVE_HOSTS,
        webOrigins: await webOriginStatuses(),
        defaultTestMessage: { type: "ping" }
      });
      return;
    }
    if (message?.type === "webOrigins") {
      sendResponse({ webOrigins: await webOriginStatuses() });
      return;
    }
    if (message?.type === "browserFetch") {
      sendResponse({ ok: true, result: await browserFetch(message) });
      return;
    }
    if (message?.type === "getCookieHeader") {
      sendResponse({ ok: true, result: await getCookieHeader(message.url) });
      return;
    }
    if (message?.type === "connectNative") {
      sendResponse(await connectNative(message.hostName || NATIVE_HOST_NAME));
      return;
    }
    if (message?.type === "disconnectNative") {
      sendResponse(disconnectNative(message.hostName || NATIVE_HOST_NAME));
      return;
    }
    if (message?.type === "status") {
      if (message.hostName) {
        sendResponse(getHostStatus(message.hostName));
      } else {
        sendResponse({ hosts: listHostStatuses() });
      }
      return;
    }
    if (message?.type === "testNative") {
      sendResponse(await testNative(message.hostName || NATIVE_HOST_NAME, message.payload || { type: "ping" }, message.timeoutMs));
      return;
    }
    sendResponse({ ok: false, error: "Unsupported popup message." });
  })().catch((error) => {
    sendResponse({ ok: false, error: String(error?.message || error) });
  });
  return true;
});

// 自动连接：Chrome 启动、扩展安装/更新时拉起宿主，让本地 HTTP bridge 常驻可用。
chrome.runtime.onStartup.addListener(() => {
  reconcileGrantedOrigins();
  ensureConnected();
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 1 });
});

chrome.runtime.onInstalled.addListener(() => {
  reconcileGrantedOrigins();
  ensureConnected();
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) {
    reconcileGrantedOrigins();
    ensureConnected();
  }
});
