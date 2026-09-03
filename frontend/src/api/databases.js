import client from "./client";

export async function listDatabases() {
  const { data } = await client.get("/databases");
  return data.databases;
}

export async function createDatabase(payload) {
  const { data } = await client.post("/databases", payload);
  return data.database;
}

export async function deleteDatabase(id) {
  await client.delete(`/databases/${id}`);
}
