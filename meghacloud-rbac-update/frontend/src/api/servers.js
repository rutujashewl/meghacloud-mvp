import client from "./client";

export async function getMeta() {
  const { data } = await client.get("/servers/meta");
  return data; // { osOptions, sizes, regions }
}

export async function listServers() {
  const { data } = await client.get("/servers");
  return data.servers;
}

export async function launchServer({ name, os, size, region }) {
  const { data } = await client.post("/servers", { name, os, size, region });
  return data.server;
}

export async function startServer(id) {
  const { data } = await client.patch(`/servers/${id}/start`);
  return data.server;
}

export async function stopServer(id) {
  const { data } = await client.patch(`/servers/${id}/stop`);
  return data.server;
}

export async function restartServer(id) {
  const { data } = await client.patch(`/servers/${id}/restart`);
  return data.server;
}

export async function deleteServer(id) {
  await client.delete(`/servers/${id}`);
}
