import client from "./client";

export async function listApiKeys() {
  const { data } = await client.get("/keys");
  return data.keys;
}

export async function createApiKey(name) {
  const { data } = await client.post("/keys", { name });
  return data;
}

export async function revokeApiKey(id) {
  await client.delete(`/keys/${id}`);
}
