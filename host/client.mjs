#!/usr/bin/env node

const port = process.env.NATIVE_BRIDGE_PORT || "8765";
const baseUrl = `http://127.0.0.1:${port}`;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (${response.status}): ${text}`);
  }
  if (!response.ok || json.ok === false) {
    throw new Error(json.error || `HTTP ${response.status}`);
  }
  return json;
}

function printUsage() {
  console.log(`Usage:
  node host/client.mjs health
  node host/client.mjs ping
  node host/client.mjs fetch <url>
`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  if (command === "health") {
    console.log(JSON.stringify(await request("/health"), null, 2));
    return;
  }

  if (command === "ping") {
    console.log(JSON.stringify(await request("/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "ping" })
    }), null, 2));
    return;
  }

  if (command === "fetch") {
    const url = args[0];
    if (!url) {
      throw new Error("Missing URL.");
    }
    console.log(JSON.stringify(await request("/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "fetch", url, method: "GET" })
    }), null, 2));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
