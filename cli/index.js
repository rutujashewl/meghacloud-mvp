#!/usr/bin/env node

const apiUrl = (process.env.MEGHACLOUD_API_URL || "http://localhost:4000/api").replace(/\/$/, "");
const apiKey = process.env.MEGHACLOUD_API_KEY;
const [command, ...args] = process.argv.slice(2);

function usage() {
  console.log(`MeghaCloud CLI\n\nUsage:\n  meghacloud servers\n  meghacloud launch <name> [size] [os]\n  meghacloud <start|stop|restart|delete> <server-id>\n\nEnvironment:\n  MEGHACLOUD_API_URL  API base URL (default: http://localhost:4000/api)\n  MEGHACLOUD_API_KEY  API key created from POST /api/keys`);
}

async function request(path, options = {}) {
  if (!apiKey) throw new Error("MEGHACLOUD_API_KEY is required");
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...(options.headers || {}) },
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
  return body;
}

async function main() {
  if (!command || command === "help" || command === "--help") return usage();
  if (command === "servers") {
    const data = await request("/servers");
    console.table(data.servers || data);
    return;
  }
  if (command === "launch") {
    if (!args[0]) throw new Error("Server name is required");
    const data = await request("/servers", { method: "POST", body: JSON.stringify({ name: args[0], size: args[1] || "small", os: args[2] || "Ubuntu 22.04", region: "Mumbai" }) });
    console.log(JSON.stringify(data.server || data, null, 2));
    return;
  }
  if (["start", "stop", "restart", "delete"].includes(command)) {
    if (!args[0]) throw new Error("Server ID is required");
    const data = await request(`/servers/${args[0]}/${command}`, { method: command === "delete" ? "DELETE" : "PATCH" });
    if (data) console.log(JSON.stringify(data.server || data, null, 2));
    else console.log("Server deleted");
    return;
  }
  usage();
}

main().catch((error) => { console.error(`Error: ${error.message}`); process.exitCode = 1; });
