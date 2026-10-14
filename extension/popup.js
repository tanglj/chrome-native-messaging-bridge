const refreshBtn = document.querySelector("#refreshBtn");
const nativeDot = document.querySelector("#nativeDot");
const nativeStatus = document.querySelector("#nativeStatus");
const connectBtn = document.querySelector("#connectBtn");
const pingBtn = document.querySelector("#pingBtn");
const webHostInput = document.querySelector("#webHostInput");
const addWebHostBtn = document.querySelector("#addWebHostBtn");
const webHostList = document.querySelector("#webHostList");
const fetchUrlInput = document.querySelector("#fetchUrlInput");
const fetchUrlBtn = document.querySelector("#fetchUrlBtn");
const output = document.querySelector("#output");

const STORAGE_KEY = "nativeHostManager";

let nativeHostName = "";
let webOrigins = [];

function show(value) {
  output.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function send(message) {
  return chrome.runtime.sendMessage(message);
}

function storageGet() {
  return chrome.storage.local.get(STORAGE_KEY).then((result) => result[STORAGE_KEY] || {});
}

function storageSet(value) {
  return chrome.storage.local.set({ [STORAGE_KEY]: value });
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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function saveState() {
  await storageSet({
    webOrigins,
    fetchUrl: fetchUrlInput.value
  });
}

function setNativeStatus(status) {
  nativeDot.classList.remove("ok", "err");
  if (status?.connected) {
    nativeDot.classList.add("ok");
    nativeStatus.textContent = `Connected: ${status.hostName}`;
  } else {
    if (status?.error) {
      nativeDot.classList.add("err");
    }
    nativeStatus.textContent = status?.error || `Native host: ${status?.hostName || nativeHostName}`;
  }
}

async function getWebOriginStatuses() {
  const statuses = new Map();
  for (const origin of webOrigins) {
    statuses.set(origin, {
      origin,
      granted: await chrome.permissions.contains({ origins: [permissionPattern(origin)] })
    });
  }
  return statuses;
}

function renderWebOrigin(origin, status = {}) {
  const row = document.createElement("div");
  row.className = "host-row";

  const dot = document.createElement("span");
  dot.className = `dot ${status.granted ? "ok" : "err"}`;

  const name = document.createElement("button");
  name.className = "host-name";
  name.textContent = origin;
  name.title = status.granted ? "Permission granted" : "Permission missing";
  name.addEventListener("click", async () => {
    fetchUrlInput.value = `${origin}/`;
    await saveState();
  });

  const useFetch = document.createElement("button");
  useFetch.textContent = "Use";
  useFetch.addEventListener("click", async () => {
    fetchUrlInput.value = `${origin}/`;
    await saveState();
    show({
      type: "fetch",
      url: `${origin}/`,
      method: "GET"
    });
  });

  const check = document.createElement("button");
  check.textContent = "Check";
  check.addEventListener("click", async () => {
    show({
      origin,
      granted: await chrome.permissions.contains({ origins: [permissionPattern(origin)] })
    });
    await render();
  });

  const remove = document.createElement("button");
  remove.textContent = "Remove";
  remove.addEventListener("click", async () => {
    await chrome.permissions.remove({ origins: [permissionPattern(origin)] });
    webOrigins = webOrigins.filter((item) => item !== origin);
    await saveState();
    await render();
  });

  row.append(dot, name, useFetch, check, remove);
  return row;
}

async function render() {
  const status = await send({ type: "status" });
  setNativeStatus(status.hosts?.[0] || { hostName: nativeHostName });

  const webStatuses = await getWebOriginStatuses();
  webHostList.replaceChildren(...webOrigins.map((origin) => renderWebOrigin(origin, webStatuses.get(origin))));
  if (!webOrigins.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No allowed web hosts";
    webHostList.append(empty);
  }
}

connectBtn.addEventListener("click", async () => {
  const result = await send({ type: "connectNative", hostName: nativeHostName });
  setNativeStatus(result);
  show(result);
});

pingBtn.addEventListener("click", async () => {
  const result = await send({
    type: "testNative",
    hostName: nativeHostName,
    payload: { type: "ping" },
    timeoutMs: 5000
  });
  show(result);
  await render();
});

addWebHostBtn.addEventListener("click", async () => {
  try {
    const origin = normalizeWebOrigin(webHostInput.value);
    // Chrome 的权限确认框会关闭 popup，导致 await 之后的代码不再执行，
    // 因此必须先把 origin 持久化到 storage，再发起权限请求。
    webOrigins = unique([...webOrigins, origin]);
    fetchUrlInput.value = `${origin}/`;
    await saveState();
    const granted = await chrome.permissions.request({ origins: [permissionPattern(origin)] });
    webHostInput.value = "";
    await render();
    show(granted ? { allowedWebHost: origin, granted: true } : { allowedWebHost: origin, granted: false });
  } catch (error) {
    show(String(error?.message || error));
  }
});

webHostInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addWebHostBtn.click();
  }
});

fetchUrlBtn.addEventListener("click", async () => {
  try {
    const result = await send({
      type: "browserFetch",
      url: fetchUrlInput.value.trim(),
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });
    show(result);
  } catch (error) {
    show(String(error?.message || error));
  }
});

refreshBtn.addEventListener("click", () => render().catch((error) => show(String(error?.message || error))));
fetchUrlInput.addEventListener("change", saveState);

async function init() {
  const defaults = await send({ type: "defaults" });
  const stored = await storageGet();
  nativeHostName = (defaults.nativeHosts || [])[0] || "";
  webOrigins = unique([...(stored.webOrigins || []), ...((defaults.webOrigins || []).map((item) => item.origin))]);
  fetchUrlInput.value = stored.fetchUrl || "";
  await saveState();
  await render();
}

init().catch((error) => show(String(error?.message || error)));
